/**
 * Scheduled Sending: Queue viewer
 * Larry skin friendly; computes local times in browser
 */
(function() {
  if (!window.rcmail) return;

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(ch) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];
    });
  }

  function text(key) {
    return (rcmail.gettext ? rcmail.gettext(key, 'scheduled_sending') : key);
  }

  function ensurePreviewModal() {
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

  function metaRow(label, value) {
    if (!value) return '';
    return '<dt>' + esc(label) + '</dt><dd>' + esc(value) + '</dd>';
  }

  function showPreview(data) {
    var modal = ensurePreviewModal();
    var title = modal.querySelector('h3');
    var meta = modal.querySelector('.ss-preview-meta');
    var body = modal.querySelector('.ss-preview-body');
    var attachments = modal.querySelector('.ss-preview-attachments');

    title.textContent = data.subject || text('no_subject');
    meta.innerHTML = '<dl>' +
      metaRow(text('scheduled_at'), data.scheduled_local ? data.scheduled_local + ' ' + (data.scheduled_tz || '') : '') +
      metaRow(text('from'), data.from || '') +
      metaRow(text('to'), data.to || '') +
      metaRow('Cc', data.cc || '') +
      metaRow('Bcc', data.bcc || '') +
      metaRow(text('status'), data.status || '') +
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
      var html = '<h4>' + esc(text('attachments')) + '</h4><ul>';
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

  rcmail.addEventListener('plugin.scheduled_sending.preview_data', showPreview);

  // Command to open queue page
  rcmail.addEventListener('init', function() {
    rcmail.register_command('plugin.scheduled_sending.open_queue', function() {
      rcmail.goto_url('_task=mail&_action=plugin.scheduled_sending.queue');
    }, true);
  });

  // When queue template is loaded, fetch data
  rcmail.addEventListener('init', function() {
    if (rcmail.env && rcmail.env.action === 'plugin.scheduled_sending.queue') {
      // Fetch
      rcmail.http_post('plugin.scheduled_sending.queue_list', {}, rcmail.set_busy(true, 'loading'));
    }
  });

  // Receive data
  rcmail.addEventListener('plugin.scheduled_sending.queue_data', function(ev) {
    try {
      var rows = ev;
      if (!Array.isArray(rows)) rows = [];
      var root = document.getElementById('ssq-root');
      if (!root) return;

      // Build table
      function t(key) { return text(key); }
      var html = [];
      html.push('<table class="ssq-table" role="grid">');
      html.push('<thead><tr><th>'+t('id')+'</th><th>'+t('status')+'</th><th>'+t('local_time')+'</th><th>'+t('utc')+'</th><th>'+t('to')+'</th><th>'+t('subject')+'</th><th>'+t('actions')+'</th></tr></thead><tbody>');
      rows.forEach(function(r) {
        var dt = r.scheduled_ts ? new Date(r.scheduled_ts * 1000) : null;
        function pad(n){return (n<10?'0':'')+n}
        function fmt(dt){
          try { return new Intl.DateTimeFormat(undefined,{month:'short',day:'2-digit',year:'numeric',hour:'numeric',minute:'2-digit'}).format(dt); }
          catch(e){ var m=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][dt.getMonth()]; return m+' '+pad(dt.getDate())+', '+dt.getFullYear()+' '+((dt.getHours()+11)%12+1)+':'+pad(dt.getMinutes())+' '+(dt.getHours()<12?'AM':'PM'); }
        }
        var local = r.scheduled_local || (dt ? fmt(dt) : '');
        var utc = r.scheduled_utc || '';
        var actions = [];
        actions.push('<button class="button ssq-preview" data-id="'+r.id+'">'+t('preview')+'</button>');
        if (r.status === 'queued' || r.status === 'processing' || r.status === 'sending') {
          actions.push('<button class="button ssq-cancel" data-id="'+r.id+'">'+t('cancel')+'</button>');
          actions.push('<button class="button ssq-bump10" data-id="'+r.id+'">'+t('bump10')+'</button>');
        } else {
          actions.push('<span class="quiet">'+t('not_applicable')+'</span>');
        }
        html.push('<tr data-id="'+r.id+'"><td>'+r.id+'</td><td>'+esc(r.status)+'</td><td>'+esc(local)+'</td><td>'+esc(utc)+'</td><td>'+ esc(r.to||'') +'</td><td>'+ esc(r.subj||'') +'</td><td>'+actions.join(' ')+'</td></tr>');
      });
      html.push('</tbody></table>');
      if (!rows.length) html.push('<p class="ssq-empty">'+t('no_queued_messages')+'</p>');
      root.innerHTML = html.join('');

      root.onclick = function(e){
        var t = e.target;
        if (!t || !t.classList) return;
        var id = t.getAttribute('data-id');
        if (t.classList.contains('ssq-preview')) {
          rcmail.http_post('plugin.scheduled_sending.queue_preview', {id:id}, rcmail.set_busy(true, 'loading'));
        } else if (t.classList.contains('ssq-cancel')) {
          rcmail.http_post('plugin.scheduled_sending.queue_cancel', {id:id}, rcmail.set_busy(true, 'loading'));
          // refresh after short delay
          setTimeout(function(){ rcmail.http_post('plugin.scheduled_sending.queue_list', {}); }, 400);
        } else if (t.classList.contains('ssq-bump10')) {
          // Add 10 minutes from now
          var ts = Math.floor(Date.now()/1000) + 600;
          rcmail.http_post('plugin.scheduled_sending.queue_reschedule', {id:id, at_ts: ts}, rcmail.set_busy(true, 'loading'));
          setTimeout(function(){ rcmail.http_post('plugin.scheduled_sending.queue_list', {}); }, 400);
        }
      };
    } catch(e) {
      try { console.error(e); } catch(_) {}
    } finally {
      rcmail.set_busy(false);
    }
  });
})();
