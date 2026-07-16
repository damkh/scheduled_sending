<?php
// Queue viewer + actions for scheduled_sending
trait scheduled_sending_queue_trait {
    private function ss_queue_decode_header($value)
    {
        $value = (string) $value;
        if ($value === '') return '';

        if (function_exists('mb_decode_mimeheader')) {
            $decoded = @mb_decode_mimeheader($value);
            if (is_string($decoded) && $decoded !== '') return $decoded;
        }
        if (function_exists('iconv_mime_decode')) {
            $decoded = @iconv_mime_decode($value, ICONV_MIME_DECODE_CONTINUE_ON_ERROR, 'UTF-8');
            if (is_string($decoded) && $decoded !== '') return $decoded;
        }

        return $value;
    }

    private function ss_queue_header_param($value, $name)
    {
        $value = (string) $value;
        $name = preg_quote((string) $name, '/');
        if (preg_match('/;\s*' . $name . '\*?=(?:"([^"]*)"|([^;\r\n]*))/i', $value, $m)) {
            $raw = isset($m[1]) && $m[1] !== '' ? $m[1] : $m[2];
            $raw = preg_replace('/^[A-Za-z0-9\-]+\'[^\']*\'/', '', (string) $raw);
            return $this->ss_queue_decode_header(rawurldecode(trim($raw)));
        }

        return '';
    }

    private function ss_queue_content_type($headers)
    {
        $ct = $this->ss_header_value($headers, 'Content-Type');
        if ($ct === '') return array('type' => 'text/plain', 'boundary' => '', 'charset' => '');

        $type = strtolower(trim(strtok($ct, ';')));
        return array(
            'type' => $type ?: 'text/plain',
            'boundary' => $this->ss_queue_header_param($ct, 'boundary'),
            'charset' => $this->ss_queue_header_param($ct, 'charset'),
        );
    }

    private function ss_queue_decode_part_body($body, $encoding)
    {
        $encoding = strtolower(trim((string) $encoding));
        if ($encoding === 'base64') {
            $decoded = base64_decode(preg_replace('/\s+/', '', (string) $body), true);
            return $decoded === false ? (string) $body : $decoded;
        }
        if ($encoding === 'quoted-printable') {
            return quoted_printable_decode((string) $body);
        }

        return (string) $body;
    }

    private function ss_queue_preview_walk($raw, &$preview, $depth = 0)
    {
        if ($depth > 8 || !is_string($raw) || $raw === '') return;

        list($raw_headers, $raw_body) = $this->ss_split_raw_message($raw);
        $headers = $this->ss_parse_raw_headers($raw_headers);
        $ct = $this->ss_queue_content_type($headers);
        $disposition = strtolower($this->ss_header_value($headers, 'Content-Disposition'));
        $filename = $this->ss_queue_header_param($disposition, 'filename');
        if ($filename === '') {
            $filename = $this->ss_queue_header_param($this->ss_header_value($headers, 'Content-Type'), 'name');
        }

        if (strpos($ct['type'], 'multipart/') === 0 && $ct['boundary'] !== '') {
            $parts = preg_split('/(?:^|\r\n|\n|\r)--' . preg_quote($ct['boundary'], '/') . '(?:--)?[ \t]*(?:\r\n|\n|\r)?/', $raw_body);
            foreach ($parts as $idx => $part) {
                $part = trim((string) $part, "\r\n");
                if ($idx === 0 || $part === '' || $part === '--') continue;
                $this->ss_queue_preview_walk($part, $preview, $depth + 1);
            }
            return;
        }

        $is_attachment = (strpos($disposition, 'attachment') !== false) || ($filename !== '' && strpos($disposition, 'inline') === false);
        $decoded_body = $this->ss_queue_decode_part_body($raw_body, $this->ss_header_value($headers, 'Content-Transfer-Encoding'));

        if ($is_attachment) {
            $preview['attachments'][] = array(
                'name' => $filename !== '' ? $filename : 'attachment',
                'type' => $ct['type'],
                'size' => strlen($decoded_body),
            );
            return;
        }

        if ($ct['type'] === 'text/html' && $preview['body_html'] === '') {
            $preview['body_html'] = $decoded_body;
            $preview['body_type'] = 'html';
            return;
        }

        if ($ct['type'] === 'text/plain' && $preview['body_text'] === '') {
            $preview['body_text'] = $decoded_body;
            if ($preview['body_type'] === '') {
                $preview['body_type'] = 'plain';
            }
        }
    }

    private function ss_queue_preview_from_raw($raw, $meta)
    {
        list($raw_headers,) = $this->ss_split_raw_message($raw);
        $headers = $this->ss_parse_raw_headers($raw_headers);
        $preview = array(
            'from' => $this->ss_queue_decode_header($this->ss_header_value($headers, 'From')),
            'to' => $this->ss_queue_decode_header($this->ss_header_value($headers, 'To')),
            'cc' => $this->ss_queue_decode_header($this->ss_header_value($headers, 'Cc')),
            'bcc' => $this->ss_queue_decode_header($this->ss_header_value($headers, 'Bcc')),
            'subject' => $this->ss_queue_decode_header($this->ss_header_value($headers, 'Subject')),
            'date' => $this->ss_queue_decode_header($this->ss_header_value($headers, 'Date')),
            'body_type' => '',
            'body_text' => '',
            'body_html' => '',
            'attachments' => array(),
        );

        foreach (array('to', 'cc', 'bcc') as $key) {
            if ($preview[$key] === '' && !empty($meta[$key])) {
                $preview[$key] = (string) $meta[$key];
            }
        }
        if ($preview['subject'] === '' && !empty($meta['subj'])) {
            $preview['subject'] = (string) $meta['subj'];
        }

        $this->ss_queue_preview_walk((string) $raw, $preview);
        if ($preview['body_html'] !== '') {
            $preview['body_type'] = 'html';
        } elseif ($preview['body_text'] === '') {
            $preview['body_text'] = '';
            $preview['body_type'] = 'plain';
        }

        return $preview;
    }

    private function ss_queue_timezone()
    {
        $tz = (string) $this->rc->config->get('scheduled_timezone', '');
        if ($tz === '') {
            $tz = @date_default_timezone_get();
        }

        try {
            return new DateTimeZone($tz ?: 'UTC');
        } catch (Exception $e) {
            return new DateTimeZone('UTC');
        }
    }

    private function ss_queue_utc_to_timestamp($utc)
    {
        try {
            $dt = new DateTimeImmutable((string) $utc, new DateTimeZone('UTC'));
            return $dt->getTimestamp();
        } catch (Exception $e) {
            $ts = strtotime((string) $utc . ' UTC');
            return $ts === false ? 0 : $ts;
        }
    }

    private function ss_queue_format_scheduled_time($utc)
    {
        try {
            $dt = new DateTimeImmutable((string) $utc, new DateTimeZone('UTC'));
            return $dt->setTimezone($this->ss_queue_timezone())->format('Y-m-d H:i');
        } catch (Exception $e) {
            return (string) $utc;
        }
    }

    public function action_queue()
    {
        $rc = $this->rc;
        $this->include_stylesheet('skins/larry/scheduled.css');
        $this->include_script('js/queue.js');
        $rc->output->set_pagetitle($this->gettext('scheduled_queue_title'));
        $rc->output->send('scheduled_sending.queue');
    }

    public function action_queue_list()
    {
        $rc  = $this->rc;
        $cfg = $rc->config;
        $db  = $rc->get_dbh();
        $table = $this->ss_queue_table();
        $limit = 200;
        $user_id = (int) $rc->user->ID;
        $q = $db->query(
            "SELECT id, user_id, identity_id, status, scheduled_at, created_at, updated_at, meta_json, last_error
               FROM $table
              WHERE user_id = ? AND status IN ('queued','processing','sending','error')
              ORDER BY scheduled_at ASC LIMIT $limit",
            $user_id
        );
        $rows = array();
        while ($q && ($r = $db->fetch_assoc($q))) {
            $meta = array();
            if (!empty($r['meta_json'])) {
                $tmp = json_decode($r['meta_json'], true);
                if (is_array($tmp)) $meta = $tmp;
            }
            $rows[] = array(
                'id' => (int)$r['id'],
                'status' => (string)$r['status'],
                'scheduled_utc' => (string)$r['scheduled_at'],
                'scheduled_local' => $this->ss_queue_format_scheduled_time($r['scheduled_at']),
                'scheduled_tz' => $this->ss_queue_timezone()->getName(),
                'scheduled_ts' => $this->ss_queue_utc_to_timestamp($r['scheduled_at']),
                'created_at' => (string)$r['created_at'],
                'updated_at' => (string)$r['updated_at'],
                'to' => isset($meta['to']) ? (string)$meta['to'] : '',
                'cc' => isset($meta['cc']) ? (string)$meta['cc'] : '',
                'bcc' => isset($meta['bcc']) ? (string)$meta['bcc'] : '',
                'subj' => isset($meta['subj']) ? (string)$meta['subj'] : '',
                'error' => (string)$r['last_error'],
            );
        }
        $rc->output->command('plugin.scheduled_sending.queue_data', $rows);
        $rc->output->send();
    }

    public function action_queue_count()
    {
        $rc  = $this->rc;
        $db  = $rc->get_dbh();
        $table = $this->ss_queue_table();
        $user_id = (int) $rc->user->ID;
        $count = 0;

        $q = $db->query(
            "SELECT COUNT(*) AS cnt
               FROM $table
              WHERE user_id = ? AND status IN ('queued','processing','sending','error')",
            $user_id
        );
        if ($q && ($row = $db->fetch_assoc($q))) {
            $count = (int) $row['cnt'];
        }

        $rc->output->command('plugin.scheduled_sending.queue_count', array('count' => $count));
        $rc->output->send();
    }

    public function action_queue_cancel()
    {
        $rc  = $this->rc;
        $cfg = $rc->config;
        $db  = $rc->get_dbh();
        $table = $this->ss_queue_table();
        $id = (int) rcube_utils::get_input_value('id', rcube_utils::INPUT_POST);
        if ($id > 0) {
            $db->query("UPDATE $table SET status='canceled', updated_at=NOW() WHERE id=? AND status IN ('queued','processing','sending')", $id);
        }
        $rc->output->command('display_message', $this->gettext('queue_cancel_ok'), 'confirmation');
        $rc->output->send();
    }

    public function action_queue_reschedule()
    {
        $rc  = $this->rc;
        $cfg = $rc->config;
        $db  = $rc->get_dbh();
        $table = $this->ss_queue_table();
        $id = (int) rcube_utils::get_input_value('id', rcube_utils::INPUT_POST);
        $ts = (int) rcube_utils::get_input_value('at_ts', rcube_utils::INPUT_POST);
        if ($id > 0 && $ts > 0) {
            $utc = gmdate('Y-m-d H:i:s', $ts);
            $db->query("UPDATE $table SET status='queued', scheduled_at=?, updated_at=NOW() WHERE id=?", $utc, $id);
        }
        $rc->output->command('display_message', $this->gettext('queue_resched_ok'), 'confirmation');
        $rc->output->send();
    }

    public function action_queue_preview()
    {
        $rc  = $this->rc;
        $db  = $rc->get_dbh();
        $table = $this->ss_queue_table();
        $id = (int) rcube_utils::get_input_value('id', rcube_utils::INPUT_POST);
        if (!$id) {
            $id = (int) rcube_utils::get_input_value('_id', rcube_utils::INPUT_POST);
        }
        $user_id = (int) $rc->user->ID;

        $q = $db->query(
            "SELECT id, status, scheduled_at, raw_mime, meta_json
               FROM $table
              WHERE id = ? AND user_id = ? LIMIT 1",
            $id,
            $user_id
        );
        $row = $q ? $db->fetch_assoc($q) : null;
        if (!$row) {
            $rc->output->command('display_message', $this->gettext('preview_not_found'), 'error');
            $rc->output->send();
            return;
        }

        $meta = array();
        if (!empty($row['meta_json'])) {
            $decoded = json_decode($row['meta_json'], true);
            if (is_array($decoded)) $meta = $decoded;
        }

        $preview = $this->ss_queue_preview_from_raw((string) $row['raw_mime'], $meta);
        $preview['id'] = (int) $row['id'];
        $preview['status'] = (string) $row['status'];
        $preview['scheduled_utc'] = (string) $row['scheduled_at'];
        $preview['scheduled_local'] = $this->ss_queue_format_scheduled_time($row['scheduled_at']);
        $preview['scheduled_tz'] = $this->ss_queue_timezone()->getName();

        $rc->output->command('plugin.scheduled_sending.preview_data', $preview);
        $rc->output->send();
    }

    public function action_queue_delete()
    {
        $rc  = $this->rc;
        $cfg = $rc->config;
        $db  = $rc->get_dbh();
        $table = $this->ss_queue_table();
        $id = (int) rcube_utils::get_input_value('_id', rcube_utils::INPUT_POST);
        $user_id = $rc->user->ID;

        if ($id > 0) {
            $sql = "DELETE FROM {$table} WHERE id = ? AND user_id = ?";
            $db->query($sql, $id, $user_id);

            if ($db->affected_rows() > 0) {
                $rc->output->command('display_message', 'Scheduled message deleted.', 'confirmation');
            } else {
                $rc->output->command('display_message', 'Failed to delete scheduled message.', 'error');
            }
        }
        $rc->output->send();
    }
}
