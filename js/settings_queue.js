
/* settings_queue.js - Scheduled Sending preferences page bindings */
(function() {
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(ch) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];
    });
  }

  function ensure_preview_modal() {
    if (!document.getElementById('ss-preview-style')) {
      var style = document.createElement('style');
      style.id = 'ss-preview-style';
      style.textContent =
        '.ss-preview-modal{display:none;position:fixed;z-index:9999;inset:0;background:rgba(0,0,0,.45);align-items:center;justify-content:center;padding:24px}' +
        '.ss-preview-dialog{background:#fff;color:#111;width:min(900px,96vw);max-height:92vh;display:flex;flex-direction:column;border:1px solid #aaa;box-shadow:0 8px 28px rgba(0,0,0,.35)}' +
        '.ss-preview-head{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid #ddd;background:#f4f4f4}' +
        '.ss-preview-head h3{margin:0;font-size:16px;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
        '.ss-preview-close{font-size:18px;line-height:1;min-width:30px}' +
        '.ss-preview-meta{padding:10px 12px;border-bottom:1px solid #e5e5e5;background:#fafafa}' +
        '.ss-preview-meta dl{display:grid;grid-template-columns:120px 1fr;gap:5px 10px;margin:0}' +
        '.ss-preview-meta dt{font-weight:bold;color:#555}.ss-preview-meta dd{margin:0;word-break:break-word}' +
        '.ss-preview-body{padding:12px;overflow:auto;min-height:240px}.ss-preview-body pre{white-space:pre-wrap;word-break:break-word;margin:0;font:13px/1.45 monospace}' +
        '.ss-preview-frame{width:100%;min-height:360px;border:1px solid #ddd;background:#fff}' +
        '.ss-preview-attachments{padding:0 12px 12px}.ss-preview-attachments h4{margin:8px 0}.ss-preview-attachments ul{margin:0;padding-left:20px}.ss-preview-attachments span{color:#666}';
      document.head.appendChild(style);
    }

    var modal = document.getElementById('ss-preview-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'ss-preview-modal';
    modal.className = 'ss-preview-modal';
    modal.innerHTML =
      '<div class="ss-preview-dialog" role="dialog" aria-modal="true">' +
        '<div class="ss-preview-head">' +
          '<h3></h3>' +
          '<button type="button" class="button ss-preview-close" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="ss-preview-meta"></div>' +
        '<div class="ss-preview-body"></div>' +
        '<div class="ss-preview-attachments"></div>' +
      '</div>';
    document.body.appendChild(modal);

    modal.addEventListener('click', function(ev) {
      if (ev.target === modal || (ev.target.classList && ev.target.classList.contains('ss-preview-close'))) {
        modal.style.display = 'none';
      }
    });

    return modal;
  }

  function meta_row(label, value) {
    if (!value) return '';
    return '<dt>' + esc(label) + '</dt><dd>' + esc(value) + '</dd>';
  }

  function show_preview(rcmail, data) {
    function t(key) { return (rcmail.gettext ? rcmail.gettext(key, 'scheduled_sending') : key); }
    var modal = ensure_preview_modal();
    var title = modal.querySelector('h3');
    var meta = modal.querySelector('.ss-preview-meta');
    var body = modal.querySelector('.ss-preview-body');
    var attachments = modal.querySelector('.ss-preview-attachments');

    title.textContent = data.subject || t('no_subject');
    meta.innerHTML = '<dl>' +
      meta_row(t('scheduled_at'), data.scheduled_local ? data.scheduled_local + ' ' + (data.scheduled_tz || '') : '') +
      meta_row(t('from'), data.from || '') +
      meta_row(t('to'), data.to || '') +
      meta_row('Cc', data.cc || '') +
      meta_row('Bcc', data.bcc || '') +
      meta_row(t('status'), data.status || '') +
    '</dl>';

    body.innerHTML = '';
    if (data.body_type === 'html' && data.body_html) {
      var frame = document.createElement('iframe');
      frame.className = 'ss-preview-frame';
      frame.setAttribute('sandbox', '');
      frame.setAttribute('referrerpolicy', 'no-referrer');
      frame.srcdoc = "<!doctype html><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; img-src data: cid:; style-src 'unsafe-inline'\"><base target=\"_blank\">" + data.body_html;
      body.appendChild(frame);
    } else {
      var pre = document.createElement('pre');
      pre.textContent = data.body_text || '';
      body.appendChild(pre);
    }

    var list = Array.isArray(data.attachments) ? data.attachments : [];
    if (list.length) {
      var html = '<h4>' + esc(t('attachments')) + '</h4><ul>';
      list.forEach(function(att) {
        var size = typeof att.size === 'number' ? ' (' + Math.ceil(att.size / 1024) + ' KB)' : '';
        html += '<li>' + esc(att.name || 'attachment') + ' <span>' + esc(att.type || '') + esc(size) + '</span></li>';
      });
      attachments.innerHTML = html + '</ul>';
    } else {
      attachments.innerHTML = '';
    }

    modal.style.display = 'flex';
  }

  function bind_preview_links(rcmail) {
    var nodes = document.querySelectorAll('.preview-scheduled-message');
    if (!nodes.length) return;

    Array.prototype.forEach.call(nodes, function(link) {
      link.addEventListener('click', function(ev) {
        ev.preventDefault();
        var id = this.getAttribute('data-id');
        if (!id) return;

        rcmail.http_post(
          'plugin.scheduled_sending.queue_preview',
          { id: id, _token: rcmail.env.request_token },
          rcmail.set_busy(true, 'loading')
        );
      });
    });
  }

  function bind_delete_links(rcmail) {
    var nodes = document.querySelectorAll('.delete-scheduled-message');
    if (!nodes.length) return;
    function t(key) { return (rcmail.gettext ? rcmail.gettext(key, 'scheduled_sending') : key); }

    Array.prototype.forEach.call(nodes, function(link) {
      link.addEventListener('click', function(ev) {
        ev.preventDefault();
        var id = this.getAttribute('data-id');
        if (!id) return;

        var ok = window.confirm(t('delete') + '?');
        if (!ok) return;

        rcmail.http_post(
          'plugin.scheduled_sending.queue_delete',
          { _id: id, _token: rcmail.env.request_token },
          rcmail.set_busy(true, 'loading')
        );
        setTimeout(function() {
          rcmail.http_post('plugin.scheduled_sending.queue_count', {});
        }, 400);

        // Optimistically remove the row
        var row = this.closest('tr');
        if (row && row.parentNode) {
          row.parentNode.removeChild(row);
        }
      });
    });
  }

  function bind_edit_links(rcmail) {
    var nodes = document.querySelectorAll('.edit-scheduled-message');
    if (!nodes.length) return;
    function t(key) { return (rcmail.gettext ? rcmail.gettext(key, 'scheduled_sending') : key); }

    Array.prototype.forEach.call(nodes, function(link) {
      link.addEventListener('click', function(ev) {
        ev.preventDefault();
        var id = this.getAttribute('data-id');
        var tsStr = this.getAttribute('data-ts') || '';
        var localStr = this.getAttribute('data-local') || '';
        if (!id) return;

        var defVal = localStr;
        if (tsStr) {
          var ts = parseInt(tsStr, 10);
          if (!defVal && ts > 0) {
            var d = new Date(ts * 1000);
            defVal = d.getFullYear() + '-' +
                     pad(d.getMonth() + 1) + '-' +
                     pad(d.getDate()) + ' ' +
                     pad(d.getHours()) + ':' +
                     pad(d.getMinutes());
          }
        }

        var promptLabel = t('reschedule_prompt');
        var val = window.prompt(promptLabel, defVal);
        if (!val) return;

        var normalized = val.replace(' ', 'T');
        var d2 = new Date(normalized);
        if (isNaN(d2.getTime())) {
          window.alert(t('reschedule_invalid'));
          return;
        }

        var nowSec = Math.floor(Date.now() / 1000);
        var newTs = Math.floor(d2.getTime() / 1000);
        if (newTs <= nowSec) {
          window.alert(t('reschedule_future'));
          return;
        }

        rcmail.http_post(
          'plugin.scheduled_sending.queue_reschedule',
          { id: id, at_ts: newTs, _token: rcmail.env.request_token },
          rcmail.set_busy(true, 'loading')
        );
        setTimeout(function() {
          rcmail.http_post('plugin.scheduled_sending.queue_count', {});
        }, 400);

        // Show a localized toast immediately; server will also send one
        try {
          var msg = rcmail.gettext('queue_resched_ok', 'scheduled_sending');
          if (msg) {
            rcmail.display_message(msg, 'confirmation');
          }
        } catch (e) {}

        // Reload so that the table shows the updated time
        setTimeout(function() {
          window.location.reload();
        }, 600);
      });
    });
  }

  function init() {
    if (!window.rcmail) return;
    var rcmail = window.rcmail;
    rcmail.addEventListener('plugin.scheduled_sending.preview_data', function(data) {
      show_preview(rcmail, data);
      rcmail.set_busy(false);
    });

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        bind_preview_links(rcmail);
        bind_delete_links(rcmail);
        bind_edit_links(rcmail);
      });
    } else {
      bind_preview_links(rcmail);
      bind_delete_links(rcmail);
      bind_edit_links(rcmail);
    }
  }

  init();
})();
