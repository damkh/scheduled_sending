<?php
// helper to respect scheduled_debug
if (!function_exists('ss_debug')) {
    function ss_debug($payload) {
        try {
            $rc = rcmail::get_instance();
            if ($rc && $rc->config->get('scheduled_debug', false) && function_exists('write_log')) {
                if (!is_scalar($payload)) {
                    $payload = json_encode($payload);
                }
                write_log('scheduled_sending_debug', $payload);
            }
        } catch (Exception $e) {
            // Never let logging explode the worker.
        }
    }
}
// Worker include for Scheduled Sending
// Processes due messages with duplicate-send protection and retry/backoff.

trait scheduled_sending_worker_trait {
    private function ss_split_raw_message($raw)
    {
        $raw = (string) $raw;
        $raw = preg_replace("/\r\n|\r|\n/", "\n", $raw);

        // Some stored messages arrive with all headers glued together. Rebuild
        // enough RFC822 structure for header parsing and body delivery.
        if (strpos($raw, "\n") === false) {
            $header_names = 'Date|From|To|Cc|Bcc|Subject|Message-ID|MIME-Version|Content-Type|Content-Transfer-Encoding';
            $raw = preg_replace('/(?<!^)(?=(?:' . $header_names . '):)/i', "\n", $raw);
        }

        if (strpos($raw, "\n\n") === false) {
            $raw = preg_replace('/(Content-Transfer-Encoding:\s*(?:7bit|8bit|base64|quoted-printable|binary))\s*/i', "$1\n\n", $raw, 1);
        }

        $parts = preg_split("/\n\n/", $raw, 2);
        return array(
            isset($parts[0]) ? str_replace("\n", "\r\n", $parts[0]) : '',
            isset($parts[1]) ? str_replace("\n", "\r\n", $parts[1]) : '',
        );
    }

    private function ss_parse_raw_headers($raw_headers)
    {
        $headers_arr = array();
        $current = '';
        foreach (preg_split("/\r\n|\r|\n/", (string) $raw_headers) as $line) {
            if ($line === '') continue;
            if ($line[0] === ' ' || $line[0] === "\t") {
                $current .= ' ' . trim($line);
            } else {
                if ($current !== '' && preg_match('/^([A-Za-z0-9\-]+):\s*(.*)$/', $current, $mm)) {
                    $name = $mm[1]; $value = $mm[2];
                    if (isset($headers_arr[$name])) $headers_arr[$name] .= ', ' . $value;
                    else $headers_arr[$name] = $value;
                }
                $current = $line;
            }
        }
        if ($current !== '' && preg_match('/^([A-Za-z0-9\-]+):\s*(.*)$/', $current, $mm)) {
            $name = $mm[1]; $value = $mm[2];
            if (isset($headers_arr[$name])) $headers_arr[$name] .= ', ' . $value;
            else $headers_arr[$name] = $value;
        }
        return $headers_arr;
    }

    private function ss_header_value($headers, $name)
    {
        foreach ((array) $headers as $k => $v) {
            if (strcasecmp($k, $name) === 0) {
                return $v;
            }
        }
        return '';
    }

    private function ss_set_header_value(&$headers, $name, $value)
    {
        foreach ($headers as $k => $v) {
            if (strcasecmp($k, $name) === 0) {
                $headers[$k] = $value;
                return;
            }
        }
        $headers[$name] = $value;
    }

    private function ss_remove_header(&$headers, $name)
    {
        foreach (array_keys($headers) as $k) {
            if (strcasecmp($k, $name) === 0) {
                unset($headers[$k]);
            }
        }
    }

    private function ss_rebuild_raw_message($headers, $body)
    {
        $lines = array();
        foreach ((array) $headers as $name => $value) {
            $lines[] = $name . ': ' . $value;
        }
        return implode("\r\n", $lines) . "\r\n\r\n" . (string) $body;
    }

    private function ss_actual_date_header()
    {
        try {
            $timezone = method_exists($this, 'ss_timezone')
                ? $this->ss_timezone()
                : new DateTimeZone('UTC');
            return (new DateTimeImmutable('now', $timezone))->format('r');
        } catch (Exception $e) {
            return gmdate('D, d M Y H:i:s') . ' +0000';
        }
    }

    private function ss_worker_draft_mime($meta)
    {
        try {
            $rc = $this->rc ?: rcmail::get_instance();
            $storage = $rc->get_storage();
            $drafts = !empty($meta['draft_folder'])
                ? $meta['draft_folder']
                : $rc->config->get('drafts_mbox', 'Drafts');

            if (!empty($meta['draft_uid']) && $drafts && $storage->folder_exists($drafts)) {
                $uid = (int) $meta['draft_uid'];
                if (method_exists($storage, 'get_raw_message')) {
                    $raw = (string) $storage->get_raw_message($uid, $drafts);
                    if ($raw !== '') return $raw;
                }
                if (method_exists($storage, 'get_raw_body')) {
                    $raw = (string) $storage->get_raw_body($uid, $drafts);
                    if ($raw !== '') return $raw;
                }
            }

            if (!empty($meta['subj']) && method_exists($this, '_ss_try_fetch_draft_mime')) {
                return (string) $this->_ss_try_fetch_draft_mime($meta['subj']);
            }
        } catch (Exception $e) {
            $this->log('worker draft recovery failed', array('error' => $e->getMessage()));
        }
        return '';
    }

    private function ss_extract_recipients($value)
    {
        $recipients = array();
        $value = (string) $value;
        if ($value === '') return $recipients;

        if (preg_match_all('/<([^<>\s]+@[^<>\s]+)>/', $value, $m)) {
            foreach ($m[1] as $addr) {
                $addr = trim($addr);
                if (filter_var($addr, FILTER_VALIDATE_EMAIL)) $recipients[] = $addr;
            }
        }
        if (preg_match_all('/(?<![A-Z0-9._%+\-])([A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,})(?![A-Z0-9._%+\-])/i', $value, $m)) {
            foreach ($m[1] as $addr) {
                $addr = trim($addr);
                if (filter_var($addr, FILTER_VALIDATE_EMAIL)) $recipients[] = $addr;
            }
        }

        return array_values(array_unique($recipients));
    }

    private function ss_sanitize_envelope_from($value)
    {
        $value = (string) $value;
        if (preg_match('/<([^>]+)>/', $value, $mm)) {
            $value = $mm[1];
        }

        $value = trim($value);
        if ($value === '' || preg_match('/[\r\n]/', $value)) {
            return '';
        }

        return filter_var($value, FILTER_VALIDATE_EMAIL) ? $value : '';
    }

    private function run_send_due_worker()
    {
        $rc  = $this->rc;
        $cfg = $rc->config;
        $db  = $rc->get_dbh();

        $table   = $this->ss_queue_table();
        $batch   = (int)$cfg->get('scheduled_sending_batch', 25);
        if ($batch < 1) $batch = 25;
        $delivery = $cfg->get('scheduled_sending_delivery', 'smtp'); // 'smtp' | 'mail' | 'none'
        $this->log('worker start', array('delivery'=>$delivery,'batch'=>$batch));

        // Pick due rows in UTC
        $batch_int = (int)$batch; if ($batch_int < 1) $batch_int = 25;
$sql = "SELECT id, user_id, identity_id, scheduled_at, raw_mime, meta_json, status
                  FROM " . $table . "
                 WHERE status='queued' AND scheduled_at <= UTC_TIMESTAMP()
                 ORDER BY scheduled_at ASC
                 LIMIT " . $batch_int;
$res = $db->query($sql);if (!$res) {
            $this->log('worker scan', array('time'=>gmdate('c'), 'count'=>0));
            return array('ok'=>true, 'count'=>0);
        }

        $rows = array();
        while ($arr = $db->fetch_assoc($res)) $rows[] = $arr;
        $this->log('worker scan', array('time'=>gmdate('c'), 'count'=>count($rows)));
        if (!count($rows)) return array('ok'=>true,'count'=>0);

        $processed = 0; $sent_ok = 0; $failed = 0; $last_err = null;
        foreach ($rows as $row) {
            $id = (int)$row['id'];

            // Flip to 'sending' so we don't repick in parallel
            $pick = $db->query("UPDATE $table SET status='sending', updated_at=UTC_TIMESTAMP() WHERE id=? AND status='queued'", $id);
            if ($db->affected_rows($pick) < 1) {
                $this->log('worker skip', array('id'=>$id,'reason'=>'status_changed'));
                continue;
            }
            $this->log('worker pick', array('id'=>$id));

            $raw = $row['raw_mime'];
            $meta = array();
            if (!empty($row['meta_json'])) {
                $tmp = json_decode($row['meta_json'], true);
                if (is_array($tmp)) $meta = $tmp;
            }

            // Split raw into headers/body
            list($raw_headers, $raw_body) = $this->ss_split_raw_message($raw);

            // Parse headers with unfolding (handles multi-line/continued headers per RFC 5322)
            $headers_arr = $this->ss_parse_raw_headers($raw_headers);

            // Envelope sender
            $env_from = $this->ss_sanitize_envelope_from($this->ss_header_value($headers_arr, 'From'));

            // Recipients from headers
            $to  = $this->ss_header_value($headers_arr, 'To');
            $cc  = $this->ss_header_value($headers_arr, 'Cc');
            $bcc = $this->ss_header_value($headers_arr, 'Bcc');
            $rcpts_hdr = array();
            foreach (array($to, $cc, $bcc) as $_list) {
                if (!$_list) continue;
                $rcpts_hdr = array_merge($rcpts_hdr, $this->ss_extract_recipients($_list));
            }

            // Recipients from meta_json fallback
            $rcpts_meta = array();
            if (!empty($meta) && is_array($meta)) {
                foreach (array('to','cc','bcc') as $_k) {
                    if (!empty($meta[$_k])) {
                        $rcpts_meta = array_merge($rcpts_meta, $this->ss_extract_recipients($meta[$_k]));
                    }
                }
            }

            $rcpts_all = array_values(array_unique(array_merge($rcpts_hdr, $rcpts_meta)));
            if (!count($rcpts_all)) {
                $draft_raw = $this->ss_worker_draft_mime($meta);
                if ($draft_raw !== '') {
                    $raw = $draft_raw;
                    list($raw_headers, $raw_body) = $this->ss_split_raw_message($raw);
                    $headers_arr = $this->ss_parse_raw_headers($raw_headers);
                    $env_from = $this->ss_sanitize_envelope_from($this->ss_header_value($headers_arr, 'From'));
                    $to = $this->ss_header_value($headers_arr, 'To');
                    $cc = $this->ss_header_value($headers_arr, 'Cc');
                    $bcc = $this->ss_header_value($headers_arr, 'Bcc');
                    $rcpts_hdr = array();
                    foreach (array($to, $cc, $bcc) as $_list) {
                        $rcpts_hdr = array_merge($rcpts_hdr, $this->ss_extract_recipients($_list));
                    }
                    $rcpts_all = array_values(array_unique(array_merge($rcpts_hdr, $rcpts_meta)));
                    $this->log('worker draft recovery', array('id' => $id, 'recipients' => $rcpts_all));
                }
            }
            if (!count($rcpts_all)) {
                $this->log('worker recipients missing', array(
                    'id' => $id,
                    'header_names' => array_keys($headers_arr),
                    'to' => $to,
                    'cc' => $cc,
                    'bcc' => $bcc,
                    'meta_to' => isset($meta['to']) ? $meta['to'] : '',
                    'draft_uid' => isset($meta['draft_uid']) ? $meta['draft_uid'] : null,
                ));
            }

            // Date must represent the actual delivery attempt, not compose time.
            $this->ss_set_header_value($headers_arr, 'Date', $this->ss_actual_date_header());
            $this->ss_remove_header($headers_arr, 'X-SS-Patched-Date');

            if ($this->ss_header_value($headers_arr, 'Message-ID') === '' && !empty($env_from)) {
                $dom = substr(strrchr($env_from, '@'), 1);
                if (!$dom) $dom = 'localhost';
                $headers_arr['Message-ID'] = '<ss-'.bin2hex(random_bytes(8)).'@'.$dom.'>';
            }

            // Remove Bcc header for on-the-wire message
            $this->ss_remove_header($headers_arr, 'Bcc');
            $delivery_raw = $this->ss_rebuild_raw_message($headers_arr, $raw_body);

            $ok = false;
            $err = '';

            try {
                if ($delivery === 'smtp' && class_exists('rcube_smtp')) {
                    $smtp = new rcube_smtp($rc->config);
                    if (method_exists($smtp, 'send_mail')) {
                        if (empty($rcpts_all)) { $ok = false; $err = 'no recipients found'; }
                        else {
                            if (!$env_from) $env_from = isset($headers_arr['From']) ? $this->ss_sanitize_envelope_from($headers_arr['From']) : '';
                            if (!$env_from) { $ok = false; $err = 'no envelope sender'; }
                            if (!$env_from) $env_from = 'mailer-daemon@localhost';
                            $ok = $smtp->send_mail($env_from, $rcpts_all, $headers_arr, $raw_body);
                        }
                    } elseif (method_exists($smtp, 'send_message')) {
                        $ok = $smtp->send_message($env_from, $rcpts_all, $delivery_raw);
                    } else {
                        $ok = false;
                        $err = 'rcube_smtp: no send_* method';
                    }
                    if (!$ok && method_exists($smtp, 'get_error')) {
                        $e = $smtp->get_error();
                        if ($e) $err = json_encode($e);
                    }
                
                    if (!$ok && empty($err)) { $err = 'smtp send_mail returned false'; }

                if (!$ok) {
                    $prev_err = $err;
                    // SMTP failed: try PHP mail() as a fallback
                    $to_hdr = isset($headers_arr['To']) ? $headers_arr['To'] : (count($rcpts_all) ? implode(', ', $rcpts_all) : '');
                    $subject = isset($headers_arr['Subject']) ? $headers_arr['Subject'] : '(no subject)';
                    $hdr_arr = $headers_arr;
                    unset($hdr_arr['To'], $hdr_arr['Subject'], $hdr_arr['Bcc']);
                    $hdr_lines = array();
                    foreach ($hdr_arr as $k=>$v) $hdr_lines[] = $k.': '.$v;
                    $hdr_str = implode("\r\n", $hdr_lines);
                    $mail_env_from = $this->ss_sanitize_envelope_from($env_from);
                    $php_opts = $mail_env_from !== '' ? '-f' . $mail_env_from : '';
                    $ok = mail($to_hdr, $subject, $raw_body, $hdr_str, $php_opts);
                    if ($ok) {
                        $err = '';
                        $this->log('fallback mail() sent', array('id'=>$id));
                    } else {
                        if (empty($prev_err)) $prev_err = 'smtp send_mail returned false';
                        $err = 'smtp failed; mail() also failed: ' . $prev_err;
                    }
                }
} elseif ($delivery === 'mail' || $delivery === 'none' || !class_exists('rcube_smtp')) {
                    $this->log('mail attempt', array('id'=>$id,'delivery'=>$delivery,'have_smtp'=>class_exists('rcube_smtp')));
                    if ($delivery === 'none') {
                        $ok = true; // dry-run
                    } else {
                        // Basic mail() fallback
                        $to_hdr = isset($headers_arr['To']) ? $headers_arr['To'] : '';
                        $subject = isset($headers_arr['Subject']) ? $headers_arr['Subject'] : '';
                        // Build headers string (without To/Subject/Bcc)
                        unset($headers_arr['To'], $headers_arr['Subject'], $headers_arr['Bcc']);
                        $hdr_lines = array();
                        foreach ($headers_arr as $k=>$v) $hdr_lines[] = $k.': '.$v;
                        $hdr_str = implode("\r\n", $hdr_lines);
                        $mail_env_from = $this->ss_sanitize_envelope_from($env_from);
                        $php_opts = $mail_env_from !== '' ? '-f' . $mail_env_from : '';
                        $ok = mail($to_hdr, $subject, $raw_body, $hdr_str, $php_opts);
                        if (!$ok) $err = 'mail() returned false'; else if (empty($err)) { $err = 'mail() returned false (no details)'; }
                    }
                }
            } catch (Exception $ex) {
                $ok = false; $err = $ex->getMessage();
            }

            $processed++; if ($ok) {
                $sent_error = '';
                if (!$this->ss_append_to_sent($delivery_raw, $meta, $sent_error)) {
                    $meta['sent_saved'] = 0;
                    $meta['sent_append_pending'] = 1;
                    $meta['sent_save_error'] = $sent_error;
                    ss_debug(array('msg'=>'worker Sent append deferred','id'=>$id,'err'=>$sent_error));
                }

                $db->query(
                    "UPDATE $table SET status='sent', raw_mime=?, meta_json=?, last_error=NULL, updated_at=UTC_TIMESTAMP() WHERE id=?",
                    $delivery_raw,
                    json_encode($meta),
                    $id
                );
                $this->log('worker sent', array('id'=>$id)); $sent_ok++;
            } else {
                $err = (string)$err; if ($err === '') { $err = 'unknown failure'; }
                $db->query("UPDATE $table SET last_error=?, updated_at=UTC_TIMESTAMP(), status='queued', scheduled_at=UTC_TIMESTAMP()+INTERVAL 5 MINUTE WHERE id=?", (string)$err, $id);
                $this->log('worker retry scheduled', array('id'=>$id, 'delay'=>300, 'attempts'=>1));
                if (!empty($err)) { $this->log('worker retry reason', array('id'=>$id,'error'=>$err)); $last_err = (string)$err; } $failed++;
            }
        }

        return array('ok'=>true,'processed'=>$processed,'sent'=>$sent_ok,'failed'=>$failed,'last_error'=>$last_err);
    }
}
