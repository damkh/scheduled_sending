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

  function ensureTaskbarStyle() {
    if (document.getElementById('ss-taskbar-style')) return;

    var style = document.createElement('style');
    style.id = 'ss-taskbar-style';
    style.textContent =
      '#ss-taskbar-item{height:112px;min-height:112px;max-height:112px;overflow:visible}' +
      '#ss-taskbar-button{position:relative;box-sizing:border-box}' +
      '#ss-taskbar-button .ss-taskbar-icon{display:block;width:28px;height:28px;object-fit:contain;margin:0 auto 7px auto}' +
      '#ss-taskbar-button .ss-taskbar-badge{position:absolute;top:18px;right:30px;min-width:18px;height:18px;padding:0 5px;border-radius:10px;background:#d93025;color:#fff;font:bold 10px/18px Arial,sans-serif;text-align:center;box-shadow:0 0 0 2px rgba(255,255,255,.9);box-sizing:border-box}' +
      '#ss-taskbar-button .ss-taskbar-badge:empty{display:none}' +
      '#ss-taskbar-button .ss-taskbar-label{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;pointer-events:none}' +
      '#ss-taskbar-button.ss-taskbar-plain{display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:112px;padding:8px 3px;text-align:center;text-decoration:none;line-height:1.15}' +
      '#ss-taskbar-button.ss-taskbar-plain:hover{text-decoration:none}';
    document.head.appendChild(style);
  }

  function taskUrl() {
    return './?_task=settings&_action=preferences&_section=scheduled_sending&_ss_section=scheduled_sending';
  }

  function inlineIcon() {
    return '<svg class="ss-taskbar-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/>' +
      '<path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>';
  }

  function findTaskLink(task) {
    var selectors = [
      '#taskbar a.button-' + task,
      '#taskbar a[href*="_task=' + task + '"]',
      '#taskbar a[onclick*="_task=' + task + '"]',
      '#taskmenu a.button-' + task,
      '#taskmenu a[href*="_task=' + task + '"]',
      '#taskmenu a[onclick*="_task=' + task + '"]',
      'a.button-' + task + '[href*="_task=' + task + '"]',
      'a[href*="_task=' + task + '"].button-' + task
    ];

    for (var i = 0; i < selectors.length; i++) {
      var node = document.querySelector(selectors[i]);
      if (node) return node;
    }

    return null;
  }

  function createTaskbarButton(reference) {
    var refItem = reference && reference.parentNode && reference.parentNode.tagName &&
      reference.parentNode.tagName.toLowerCase() === 'li' ? reference.parentNode : null;
    var item = refItem ? document.createElement('li') : null;
    var link = document.createElement('a');

    link.id = 'ss-taskbar-button';
    link.href = taskUrl();
    link.className = 'ss-taskbar-plain button-scheduled_sending';
    link.setAttribute('title', text('scheduled_nav'));
    link.setAttribute('aria-label', text('scheduled_nav'));
    link.innerHTML = inlineIcon() + '<span class="ss-taskbar-label">' + esc(text('scheduled_nav')) + '</span><span class="ss-taskbar-badge"></span>';
    link.addEventListener('click', function(ev) {
      ev.preventDefault();
      window.location.href = taskUrl();
    });

    if (item) {
      item.id = 'ss-taskbar-item';
      item.className = (refItem.className || '').replace(/\b(selected|active|focused)\b/g, '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
      item.appendChild(link);
      return item;
    }

    return link;
  }

  function ensureTaskbarButton() {
    if (document.getElementById('ss-taskbar-button')) return;
    if (rcmail.env && rcmail.env.task === 'settings') return;
    ensureTaskbarStyle();

    var settings = findTaskLink('settings');
    var contacts = findTaskLink('addressbook') || findTaskLink('contacts');
    var reference = settings || contacts;
    if (!reference || !reference.parentNode) return;

    var buttonNode = createTaskbarButton(reference);
    var targetNode = reference.parentNode && reference.parentNode.tagName &&
      reference.parentNode.tagName.toLowerCase() === 'li' ? reference.parentNode : reference;

    if (settings) {
      targetNode.parentNode.insertBefore(buttonNode, targetNode);
    } else {
      targetNode.parentNode.insertBefore(buttonNode, targetNode.nextSibling);
    }
  }

  function requestedSettingsSection() {
    var query = window.location.search || '';
    var match = query.match(/[?&]_ss_section=([^&]+)/);
    return match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : '';
  }

  function loadSettingsSectionFrame(section) {
    try {
      var frameName = rcmail.env.contentframe || 'preferences-frame';
      var frame = window.frames && window.frames[frameName] ? window.frames[frameName] : null;
      var url = (rcmail.env.comm_path || './?_task=settings') + '&_action=edit-prefs&_section=' + encodeURIComponent(section) + '&_framed=1';
      if (frame) {
        frame.location.href = url;
        return true;
      }
    } catch(e) {}

    return false;
  }

  function activateSettingsSection() {
    var section = requestedSettingsSection();
    if (!section || !rcmail.env || rcmail.env.task !== 'settings') return;
    if (window.__ssSettingsSectionActivated) return;

    var row = document.getElementById('rcmrow' + section) ||
      document.querySelector('[data-id="' + section + '"], [rel="' + section + '"], a[href*="_section=' + section + '"]');
    if (row) {
      try {
        row.click();
        window.__ssSettingsSectionActivated = true;
        setTimeout(function() { loadSettingsSectionFrame(section); }, 100);
        return;
      } catch(e) {}
    }

    try {
      if (rcmail.sections_list && rcmail.sections_list.select && rcmail.section_select) {
        rcmail.sections_list.select(section);
        rcmail.section_select(rcmail.sections_list);
        window.__ssSettingsSectionActivated = true;
        setTimeout(function() { loadSettingsSectionFrame(section); }, 100);
        return;
      }
    } catch(e) {}

    if (loadSettingsSectionFrame(section)) {
      window.__ssSettingsSectionActivated = true;
    }
  }

  function activateSettingsSectionSoon() {
    var tries = 0;
    var timer = setInterval(function() {
      tries++;
      activateSettingsSection();
      if (window.__ssSettingsSectionActivated || tries >= 20) {
        clearInterval(timer);
      }
    }, 150);
  }

  function requestQueueCount() {
    if (!window.rcmail || !rcmail.http_post) return;
    try {
      rcmail.http_post('plugin.scheduled_sending.queue_count', {});
    } catch(e) {}
  }

  function updateQueueBadge(payload) {
    var badge = document.querySelector('#ss-taskbar-button .ss-taskbar-badge');
    if (!badge) return;

    var count = payload && typeof payload.count !== 'undefined' ? parseInt(payload.count, 10) : 0;
    if (!isFinite(count) || count < 0) count = 0;
    badge.textContent = count > 0 ? (count > 99 ? '99+' : String(count)) : '';
    badge.setAttribute('aria-label', count + ' ' + text('scheduledmessages'));
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
  rcmail.addEventListener('plugin.scheduled_sending.queue_count', updateQueueBadge);
  rcmail.addEventListener('plugin.scheduled_sending.success', function() {
    setTimeout(requestQueueCount, 500);
  });

  // Command to open queue page
  rcmail.addEventListener('init', function() {
    ensureTaskbarButton();
    setTimeout(ensureTaskbarButton, 250);
    activateSettingsSectionSoon();
    requestQueueCount();

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
          setTimeout(requestQueueCount, 450);
        } else if (t.classList.contains('ssq-bump10')) {
          // Add 10 minutes from now
          var ts = Math.floor(Date.now()/1000) + 600;
          rcmail.http_post('plugin.scheduled_sending.queue_reschedule', {id:id, at_ts: ts}, rcmail.set_busy(true, 'loading'));
          setTimeout(function(){ rcmail.http_post('plugin.scheduled_sending.queue_list', {}); }, 400);
          setTimeout(requestQueueCount, 450);
        }
      };
    } catch(e) {
      try { console.error(e); } catch(_) {}
    } finally {
      rcmail.set_busy(false);
    }
  });
})();
