'use strict';
'require view';
'require dom';
'require poll';
'require rpc';
'require ui';
'require fs';

var getHostHints = rpc.declare({
    object: 'luci-rpc',
    method: 'getHostHints',
    expect: { '': {} }
});

var RC = {};

return view.extend({
    title: _('Network Speed'),

    speed_label: function(b) {
        var val = b || 0;
        if (val <= 0) return '0.00 KB/s';
        if (val >= 1048576) return (val / 1048576).toFixed(2) + ' MB/s';
        if (val >= 1024) return (val / 1024).toFixed(2) + ' KB/s';
        return val.toFixed(0) + ' B/s';
    },

    bytes_label: function(b) {
        var val = b || 0;
        if (val >= 1099511627776) return (val / 1099511627776).toFixed(2) + ' TB';
        if (val >= 1073741824) return (val / 1073741824).toFixed(2) + ' GB';
        if (val >= 1048576) return (val / 1048576).toFixed(2) + ' MB';
        return (val / 1024).toFixed(1) + ' KB';
    },

    formatDiff: function(diff) {
        if (diff < 10) return null;
        if (diff < 60) return Math.floor(diff) + 's';
        if (diff < 3600) return Math.floor(diff / 60) + 'm';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h';
        return Math.floor(diff / 86400) + 'd';
    },

    load: function() {
        return Promise.all([
            L.resolveDefault(fs.read('/root/netmon/limits.json'), '{}'),
            L.resolveDefault(fs.read('/root/netmon/data/qstate.json'), '{}')
        ]);
    },

    showGlobalSettingsModal: function(s) {
        var self = this;
        s = s || {};
        var m = E('div', { 'class': 'nm-modal' }, [
            E('h3', {}, _('Global QoS Settings')),
            E('div', { 'class': 'nm-field' }, [
                E('label', {}, _('LAN Interface')),
                E('input', { 'type': 'text', 'id': 'g_lan_if', 'value': s.lan_if || 'br-lan' }),
                E('div', { 'class': 'nm-hint' }, _('Usually br-lan. Needed for download shaping.'))
            ]),
            E('div', { 'class': 'nm-field' }, [
                E('label', {}, _('WAN Interface')),
                E('input', { 'type': 'text', 'id': 'g_wan_if', 'value': s.wan_if || 'phy0-sta0' }),
                E('div', { 'class': 'nm-hint' }, _('Egress iface, e.g. phy0-sta0. Needed for upload shaping.'))
            ]),
            E('div', { 'class': 'nm-row' }, [
                E('div', { 'class': 'nm-field' }, [ E('label', {}, _('Max ISP Download (KB/s)')), E('input', { 'type': 'number', 'id': 'g_max_dl', 'value': s.max_dl || 12500 }) ]),
                E('div', { 'class': 'nm-field' }, [ E('label', {}, _('Max ISP Upload (KB/s)')), E('input', { 'type': 'number', 'id': 'g_max_ul', 'value': s.max_ul || 12500 }) ])
            ]),
            E('div', { 'class': 'nm-actions' }, [
                E('button', { 'class': 'nm-btn nm-btn-ghost', 'click': ui.hideModal }, _('Cancel')),
                E('button', { 'class': 'nm-btn nm-btn-primary', 'click': function() {
                    self.saveGlobalSettings(document.getElementById('g_max_dl').value, document.getElementById('g_max_ul').value,
                        document.getElementById('g_lan_if').value.trim(), document.getElementById('g_wan_if').value.trim());
                } }, _('Save Settings'))
            ])
        ]);
        ui.showModal(_('Global Settings'), m);
    },

    saveGlobalSettings: function(dl, ul, lan, wan) {
        var self = this;
        L.resolveDefault(fs.read('/root/netmon/limits.json'), '{}').then(function(res) {
            var limits = {}; try { limits = JSON.parse(res); } catch(e) {}
            limits['__global_settings'] = { max_dl: parseInt(dl), max_ul: parseInt(ul), lan_if: lan, wan_if: wan };
            return fs.write('/root/netmon/limits.json', JSON.stringify(limits, null, 2));
        }).then(function() {
            return L.resolveDefault(fs.exec('/bin/sh', ['/root/netmon/apply.sh']), {});
        }).then(function() {
            ui.hideModal();
            ui.addNotification(null, E('p', _('Global Settings updated.')), 'info');
        }).catch(function() { ui.hideModal(); });
    },

    showLimitModal: function(target, name, curLimits) {
        var self = this;
        var l = curLimits || {};
        var isNew = !target;
        var m = E('div', { 'class': 'nm-modal' }, [
            E('h3', {}, isNew ? _('Create Rule') : _('Rules for ') + (name || target)),
            isNew ? E('div', { 'class': 'nm-field' }, [ E('label', {}, _('Target IP')), E('input', { 'type': 'text', 'id': 'q_target', 'placeholder': '192.168.10.50' }) ]) : '',
            E('div', { 'class': 'nm-field' }, [
                E('label', {}, _('Device Name')),
                E('input', { 'type': 'text', 'id': 'q_name', 'value': l.name || '', 'placeholder': (name || target || '') }),
                E('div', { 'class': 'nm-hint' }, _('Optional. Shown instead of the auto-detected hostname.'))
            ]),
            E('div', { 'class': 'nm-group' }, _('Bandwidth (QoS)')),
            E('div', { 'class': 'nm-row' }, [
                E('div', { 'class': 'nm-field' }, [ E('label', {}, _('Download (KB/s)')), E('input', { 'type': 'number', 'id': 'q_dl', 'value': l.dl || '', 'placeholder': '0 = ∞' }) ]),
                E('div', { 'class': 'nm-field' }, [ E('label', {}, _('Upload (KB/s)')), E('input', { 'type': 'number', 'id': 'q_ul', 'value': l.ul || '', 'placeholder': '0 = ∞' }) ]),
                E('div', { 'class': 'nm-field' }, [
                    E('label', {}, _('Priority')),
                    E('select', { 'id': 'q_prio' }, [
                        E('option', { 'value': '1', 'selected': (l.prio == 1) }, _('High')),
                        E('option', { 'value': '4', 'selected': (!l.prio || l.prio == 4) }, _('Normal')),
                        E('option', { 'value': '7', 'selected': (l.prio == 7) }, _('Low'))
                    ]),
                    E('div', { 'class': 'nm-hint' }, _('When the link is busy'))
                ])
            ]),
            E('div', { 'class': 'nm-group' }, _('Data Quota')),
            E('div', { 'class': 'nm-row' }, [
                E('div', { 'class': 'nm-field' }, [
                    E('label', {}, _('Quota (MB)')),
                    E('input', { 'type': 'number', 'id': 'q_quota', 'value': l.quota_mb || '', 'placeholder': '0 = ∞' }),
                    E('div', { 'class': 'nm-hint' }, _('e.g. 2048 = 2 GB'))
                ]),
                E('div', { 'class': 'nm-field' }, [
                    E('label', {}, _('Reset Period')),
                    E('select', { 'id': 'q_period' }, [
                        E('option', { 'value': 'daily', 'selected': ((l.period || 'daily') === 'daily') }, _('Daily')),
                        E('option', { 'value': 'weekly', 'selected': (l.period === 'weekly') }, _('Weekly')),
                        E('option', { 'value': 'monthly', 'selected': (l.period === 'monthly') }, _('Monthly'))
                    ])
                ])
            ]),
            E('div', { 'class': 'nm-group' }, _('Allowed Time Window')),
            E('div', { 'class': 'nm-row' }, [
                E('div', { 'class': 'nm-field' }, [ E('label', {}, _('From')), E('input', { 'type': 'time', 'id': 'q_tstart', 'value': l.t_start || '' }) ]),
                E('div', { 'class': 'nm-field' }, [ E('label', {}, _('To')), E('input', { 'type': 'time', 'id': 'q_tend', 'value': l.t_end || '' }) ])
            ]),
            E('div', { 'class': 'nm-hint', 'style': 'margin:-6px 0 4px;' }, _('Leave both empty = no time limit. Outside the window the device is cut off (crossing midnight supported).')),
            E('div', { 'class': 'nm-actions' }, [
                !isNew ? E('button', { 'class': 'nm-btn nm-btn-danger', 'style': 'margin-right:auto;', 'click': function() { self.deleteLimit(target); } }, _('Delete Rule')) : '',
                E('button', { 'class': 'nm-btn nm-btn-ghost', 'click': ui.hideModal }, _('Cancel')),
                E('button', { 'class': 'nm-btn nm-btn-primary', 'click': function() {
                    var finalTarget = isNew ? document.getElementById('q_target').value.replace(/\s+/g, '') : target;
                    if (!finalTarget) { alert('Please enter an IP'); return; }
                    self.saveLimit(finalTarget, {
                        name: document.getElementById('q_name').value.trim(),
                        dl: document.getElementById('q_dl').value,
                        ul: document.getElementById('q_ul').value,
                        prio: document.getElementById('q_prio').value,
                        quota_mb: document.getElementById('q_quota').value,
                        period: document.getElementById('q_period').value,
                        t_start: document.getElementById('q_tstart').value,
                        t_end: document.getElementById('q_tend').value
                    });
                } }, _('Save & Apply'))
            ])
        ]);
        ui.showModal(isNew ? _('Add Rule') : _('Device Rules'), m);
    },

    deleteLimit: function(ip) {
        this.saveLimit(ip, { name:'', dl:0, ul:0, quota_mb:0, period:'daily', t_start:'', t_end:'' });
    },

    saveLimit: function(ip, v) {
        var self = this;
        L.resolveDefault(fs.read('/root/netmon/limits.json'), '{}').then(function(res) {
            var limits = {}; try { limits = JSON.parse(res); } catch(e) {}
            var dl = parseInt(v.dl) || 0, ul = parseInt(v.ul) || 0, quota = parseInt(v.quota_mb) || 0;
            var prio = parseInt(v.prio) || 4;
            var hasTime = !!(v.t_start && v.t_end);
            var nm = (v.name || '').trim();
            var entry = {
                name: nm, dl: dl, ul: ul, prio: prio, quota_mb: quota,
                period: v.period || 'daily',
                t_start: hasTime ? v.t_start : '', t_end: hasTime ? v.t_end : '',
                blocked: !!(limits[ip] && limits[ip].blocked)
            };
            var empty = !nm && !dl && !ul && !quota && !hasTime && !entry.blocked && prio === 4;
            if (empty) delete limits[ip]; else limits[ip] = entry;
            return fs.write('/root/netmon/limits.json', JSON.stringify(limits, null, 2));
        }).then(function() {
            return L.resolveDefault(fs.exec('/bin/sh', ['/root/netmon/apply.sh']), {});
        }).then(function() {
            return L.resolveDefault(fs.exec('/bin/sh', ['/root/netmon/enforce.sh']), {});
        }).then(function() {
            ui.hideModal();
            ui.addNotification(null, E('p', _('Rules updated & applied.')), 'info');
        }).catch(function() { ui.hideModal(); });
    },

    toggleBlock: function(ip, curBlocked) {
        var self = this;
        L.resolveDefault(fs.read('/root/netmon/limits.json'), '{}').then(function(res) {
            var limits = {}; try { limits = JSON.parse(res); } catch(e) {}
            var e = limits[ip] || { name:'', dl:0, ul:0, prio:4, quota_mb:0, period:'daily', t_start:'', t_end:'' };
            e.blocked = !curBlocked;
            limits[ip] = e;
            return fs.write('/root/netmon/limits.json', JSON.stringify(limits, null, 2));
        }).then(function() {
            return L.resolveDefault(fs.exec('/bin/sh', ['/root/netmon/enforce.sh']), {});
        }).then(function() {
            ui.addNotification(null, E('p', curBlocked ? _('Device unblocked.') : _('Device blocked.')), 'info');
        }).catch(function() {});
    },

    resetTraffic: function() {
        if (!confirm(_('Reset ALL traffic counters and saved usage? This cannot be undone.'))) return;
        L.resolveDefault(fs.exec('/bin/sh', ['/root/netmon/reset.sh']), {}).then(function() {
            RC = {};
            ui.addNotification(null, E('p', _('Traffic counters reset.')), 'info');
        }).catch(function() {});
    },

    render: function(res) {
        var self = this;
        var m = E('div', { 'class': 'nm-wrap' }, [
            E('style', {}, [
                ':root{--nm-accent:#6366f1;--nm-accent2:#8b5cf6;--nm-card:#ffffff;--nm-card2:#f1f5f9;--nm-border:#d7dce6;--nm-text:#0f172a;--nm-muted:#5b6b82;--nm-up:#d97706;--nm-down:#059669;--nm-danger:#dc2626;--nm-shadow:0 1px 2px rgba(15,23,42,.06),0 10px 28px rgba(15,23,42,.08);}',
                '@media (prefers-color-scheme:dark){:root{--nm-card:#161c28;--nm-card2:#212a3a;--nm-border:#3a4658;--nm-text:#f1f5f9;--nm-muted:#a9b6c8;--nm-up:#fbbf24;--nm-down:#34d399;--nm-danger:#f87171;--nm-shadow:0 1px 3px rgba(0,0,0,.5),0 12px 32px rgba(0,0,0,.4);}}',
                '.nm-wrap{max-width:1120px;margin:0 auto;padding:18px;color:var(--nm-text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,system-ui,sans-serif;}',
                '.nm-head{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:22px;}',
                '.nm-brand{display:flex;align-items:center;gap:12px;}',
                '.nm-logo{width:44px;height:44px;border-radius:13px;background:linear-gradient(135deg,var(--nm-accent),var(--nm-accent2));display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.4rem;box-shadow:var(--nm-shadow);}',
                '.nm-title{font-size:1.5rem;font-weight:800;margin:0;line-height:1.1;}',
                '.nm-sub{font-size:.8rem;color:var(--nm-muted);margin-top:3px;font-weight:500;}',
                '.nm-head-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap;}',
                '.nm-clock{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.82rem;color:var(--nm-text);background:var(--nm-card2);border:1px solid var(--nm-border);padding:8px 13px;border-radius:10px;font-weight:600;}',
                '.nm-btn{border:1.5px solid transparent;border-radius:11px;padding:10px 16px;font-size:.86rem;font-weight:700;cursor:pointer;transition:.16s;white-space:nowrap;line-height:1;}',
                '.nm-btn:active{transform:translateY(1px);}',
                '.nm-btn-primary{background:linear-gradient(135deg,var(--nm-accent),var(--nm-accent2))!important;color:#fff!important;box-shadow:0 4px 14px rgba(99,102,241,.4);}',
                '.nm-btn-primary:hover{filter:brightness(1.1);}',
                '.nm-btn-ghost{background:var(--nm-card)!important;color:var(--nm-text)!important;border-color:var(--nm-border)!important;}',
                '.nm-btn-ghost:hover{border-color:var(--nm-accent)!important;color:var(--nm-accent)!important;}',
                '.nm-btn-danger{background:var(--nm-card)!important;color:var(--nm-danger)!important;border-color:rgba(220,38,38,.5)!important;}',
                '.nm-btn-danger:hover{background:var(--nm-danger)!important;color:#fff!important;border-color:var(--nm-danger)!important;}',
                '.nm-btn-sm{padding:7px 12px;font-size:.78rem;border-radius:9px;}',
                '.nm-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:18px;}',
                '.nm-card{background:var(--nm-card);border:1px solid var(--nm-border);border-radius:16px;padding:18px 20px;box-shadow:var(--nm-shadow);position:relative;overflow:hidden;}',
                '.nm-card::before{content:"";position:absolute;top:0;left:0;right:0;height:4px;background:var(--nm-acc,var(--nm-accent));}',
                '.nm-card h4{margin:0 0 10px;font-size:.74rem;text-transform:uppercase;letter-spacing:.06em;color:var(--nm-muted);font-weight:800;}',
                '.nm-card .v{font-size:1.6rem;font-weight:800;letter-spacing:-.02em;}',
                '.nm-card .u{font-size:.8rem;color:var(--nm-muted);margin-top:5px;font-family:ui-monospace,monospace;font-weight:600;}',
                '.nm-panel{background:var(--nm-card);border:1px solid var(--nm-border);border-radius:16px;box-shadow:var(--nm-shadow);margin-bottom:18px;overflow:hidden;}',
                '.nm-panel-h{padding:15px 20px;border-bottom:1px solid var(--nm-border);font-size:1rem;font-weight:800;display:flex;align-items:center;gap:9px;}',
                '.nm-panel-h .dot{width:9px;height:9px;border-radius:50%;background:var(--nm-accent);}',
                '.nm-legend{margin-left:auto;display:flex;gap:14px;font-size:.74rem;font-weight:700;color:var(--nm-muted);}',
                '.nm-legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-left:5px;vertical-align:middle;}',
                '.nm-chart{padding:16px 20px;display:flex;flex-direction:column;gap:13px;}',
                '.nm-bar-row{display:flex;align-items:center;gap:12px;}',
                '.nm-bar-label{width:160px;flex-shrink:0;font-size:.84rem;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
                '.nm-bar-label small{display:block;font-weight:500;color:var(--nm-muted);font-size:.7rem;font-family:ui-monospace,monospace;}',
                '.nm-bar-track{flex:1;height:18px;background:var(--nm-card2);border:1px solid var(--nm-border);border-radius:9px;display:flex;overflow:hidden;}',
                '.nm-bar-down{height:100%;background:var(--nm-down);transition:width .5s;}',
                '.nm-bar-up{height:100%;background:var(--nm-up);transition:width .5s;}',
                '.nm-bar-val{width:96px;flex-shrink:0;text-align:right;font-family:ui-monospace,monospace;font-size:.8rem;font-weight:700;color:var(--nm-text);}',
                '.nm-table{width:100%;border-collapse:collapse;}',
                '.nm-table th{background:var(--nm-card2);padding:12px 16px;text-align:left;font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:var(--nm-muted);font-weight:800;border-bottom:1px solid var(--nm-border);}',
                '.nm-table td{padding:14px 16px;border-bottom:1px solid var(--nm-border);vertical-align:middle;font-size:.9rem;}',
                '.nm-table tr:last-child td{border-bottom:none;}',
                '.nm-table tbody tr{transition:.15s;}',
                '.nm-table tbody tr:hover{background:var(--nm-card2);}',
                '.nm-name{font-weight:800;font-size:.95rem;}',
                '.nm-meta{font-size:.76rem;color:var(--nm-muted);font-family:ui-monospace,monospace;margin-top:3px;font-weight:600;}',
                '.nm-pill{display:inline-flex;align-items:center;gap:6px;font-size:.7rem;font-weight:800;padding:4px 10px;border-radius:999px;text-transform:uppercase;letter-spacing:.03em;}',
                '.nm-pill .d{width:7px;height:7px;border-radius:50%;}',
                '.nm-pill.on{background:rgba(5,150,105,.15);color:var(--nm-down);}.nm-pill.on .d{background:var(--nm-down);}',
                '.nm-pill.off{background:rgba(91,107,130,.16);color:var(--nm-muted);}.nm-pill.off .d{background:var(--nm-muted);}',
                '.nm-pill.blk{background:rgba(220,38,38,.16);color:var(--nm-danger);}.nm-pill.blk .d{background:var(--nm-danger);}',
                '.nm-dl{color:var(--nm-down);font-weight:700;}.nm-ul{color:var(--nm-up);font-weight:700;}',
                '.nm-tot{display:flex;flex-direction:column;gap:2px;font-family:ui-monospace,monospace;font-size:.8rem;font-weight:700;}',
                '.nm-tot .all{color:var(--nm-accent);}',
                '.nm-qbar{height:8px;background:var(--nm-card2);border:1px solid var(--nm-border);border-radius:999px;overflow:hidden;margin-top:6px;}',
                '.nm-qbar>i{display:block;height:100%;border-radius:999px;transition:width .4s;}',
                '.nm-qtxt{font-size:.74rem;color:var(--nm-muted);font-family:ui-monospace,monospace;margin-top:4px;font-weight:600;}',
                '.nm-empty{text-align:center;padding:28px;color:var(--nm-muted);font-size:.9rem;font-weight:600;}',
                '.nm-modal{padding:6px;background:var(--nm-card);color:var(--nm-text);border-radius:14px;}', '.nm-modal h3{margin:0 0 16px;font-size:1.15rem;color:var(--nm-text);}',
                '.nm-group{margin:16px 0 8px;font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;color:var(--nm-accent);font-weight:800;border-top:1px solid var(--nm-border);padding-top:12px;}',
                '.nm-field{margin-bottom:12px;flex:1;}', '.nm-field label{display:block;font-size:.8rem;font-weight:700;margin-bottom:6px;color:var(--nm-text);}',
                '.nm-field input,.nm-field select{width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid var(--nm-border);border-radius:10px;background:var(--nm-card2);color:var(--nm-text);font-size:.9rem;font-weight:600;}',
                '.nm-field input:focus,.nm-field select:focus{outline:none;border-color:var(--nm-accent);}',
                '.nm-hint{font-size:.74rem;color:var(--nm-muted);margin-top:5px;}',
                '.nm-row{display:flex;gap:12px;}', '.nm-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:18px;}',
                '.nm-foot{text-align:center;font-size:.76rem;color:var(--nm-muted);padding:14px;font-weight:600;}',
                '@media(max-width:640px){.nm-cards{grid-template-columns:1fr;}.nm-row{flex-direction:column;gap:0;}.nm-bar-label{width:110px;}}'
            ].join('\n')),

            E('div', { 'class': 'nm-head' }, [
                E('div', { 'class': 'nm-brand' }, [
                    E('div', { 'class': 'nm-logo' }, '⚡'),
                    E('div', {}, [ E('h2', { 'class': 'nm-title' }, this.title), E('div', { 'class': 'nm-sub' }, _('Realtime traffic · quota · schedule · QoS')) ])
                ]),
                E('div', { 'class': 'nm-head-actions' }, [
                    E('span', { 'class': 'nm-clock', 'id': 'sys_time_el' }, '—'),
                    E('button', { 'class': 'nm-btn nm-btn-danger', 'click': function() { self.resetTraffic(); } }, _('↺ Reset Traffic')),
                    E('button', { 'class': 'nm-btn nm-btn-ghost', 'id': 'btn_global_settings' }, _('⚙ Global')),
                    E('button', { 'class': 'nm-btn nm-btn-primary', 'click': function() { self.showLimitModal(null, null, null); } }, _('+ Add Rule'))
                ])
            ]),

            E('div', { 'id': 'summary_area', 'class': 'nm-cards' }, [
                this.renderCard('Total', '0.00 KB/s', '—', '#6366f1'),
                this.renderCard('Download', '↓ 0.00 KB/s', '—', '#059669'),
                this.renderCard('Upload', '↑ 0.00 KB/s', '—', '#d97706')
            ]),

            E('div', { 'class': 'nm-panel' }, [
                E('div', { 'class': 'nm-panel-h' }, [
                    E('span', { 'class': 'dot' }), _('Usage by Device'),
                    E('span', { 'class': 'nm-legend' }, [ E('span', {}, [_('Download'), E('i', { 'style': 'background:var(--nm-down)' })]), E('span', {}, [_('Upload'), E('i', { 'style': 'background:var(--nm-up)' })]) ])
                ]),
                E('div', { 'class': 'nm-chart', 'id': 'chart_area' }, [ E('div', { 'class': 'nm-empty' }, '—') ])
            ]),

            E('div', { 'class': 'nm-panel' }, [
                E('div', { 'class': 'nm-panel-h' }, [ E('span', { 'class': 'dot' }), _('Rules · Quota · Schedule') ]),
                E('table', { 'class': 'nm-table' }, [
                    E('thead', {}, E('tr', {}, [ E('th', {}, _('Device')), E('th', {}, _('Bandwidth')), E('th', {}, _('Quota')), E('th', {}, _('Schedule')), E('th', { 'style':'text-align:center;' }, _('Status')), E('th', { 'style':'text-align:right;' }, _('Actions')) ])),
                    E('tbody', { 'id': 'qos_body' })
                ])
            ]),

            E('div', { 'class': 'nm-panel' }, [
                E('div', { 'class': 'nm-panel-h' }, [ E('span', { 'class': 'dot' }), _('Live Devices') ]),
                E('table', { 'class': 'nm-table' }, [
                    E('thead', {}, E('tr', {}, [ E('th', {}, _('Device')), E('th', {}, _('Download')), E('th', {}, _('Upload')), E('th', {}, _('Total · saved')), E('th', { 'style':'text-align:right;' }, _('Actions')) ])),
                    E('tbody', { 'id': 'device_body' })
                ])
            ]),


        ]);

        poll.add(L.bind(function() {
            return Promise.all([
                getHostHints(),
                L.resolveDefault(fs.exec('/usr/sbin/nft', ['-j', 'list', 'set', 'inet', 'fw4', 'nm_up']), {}),
                L.resolveDefault(fs.exec('/usr/sbin/nft', ['-j', 'list', 'set', 'inet', 'fw4', 'nm_down']), {}),
                L.resolveDefault(fs.exec('/bin/date', ['+%Y-%m-%d %H:%M:%S']), {}),
                L.resolveDefault(fs.read('/root/netmon/limits.json'), '{}'),
                L.resolveDefault(fs.read('/root/netmon/data/qstate.json'), '{}')
            ]).then(L.bind(function(r) { this.updateUI(r[0], r[1], r[2], r[3], r[4], r[5]); }, this));
        }, this), 2);

        return m;
    },

    updateUI: function(hints, upRes, downRes, dateRes, limitsStr, qstateStr) {
        var self = this;
        var el = document.getElementById('sys_time_el');
        if (el) el.innerText = (dateRes && dateRes.stdout) ? dateRes.stdout.trim() : '—';

        var upData = {}, downData = {}, limits = {}, qstate = {};
        try { upData = typeof upRes.stdout === 'string' ? JSON.parse(upRes.stdout) : {}; } catch(e) {}
        try { downData = typeof downRes.stdout === 'string' ? JSON.parse(downRes.stdout) : {}; } catch(e) {}
        try { limits = typeof limitsStr === 'string' ? JSON.parse(limitsStr) : {}; } catch(e) {}
        try { qstate = typeof qstateStr === 'string' ? JSON.parse(qstateStr) : {}; } catch(e) {}

        var btnGlob = document.getElementById('btn_global_settings');
        if (btnGlob) { btnGlob.onclick = function() { self.showGlobalSettingsModal(limits['__global_settings']); }; }

        var RA = {}, tDL = 0, tUL = 0, tDLB = 0, tULB = 0;

        var findInfo = function(ip) {
            var host = null;
            if (hints) Object.keys(hints).forEach(function(mac) {
                var h = hints[mac];
                if (h.ipaddrs && h.ipaddrs.indexOf(ip) >= 0) host = { name: h.name || ip, mac: mac };
            });
            return { name: (host && host.name) ? host.name : ip, mac: (host && host.mac) ? host.mac : '—' };
        };
        var periodLabel = function(p) { return p === 'weekly' ? _('wk') : (p === 'monthly' ? _('mo') : _('day')); };

        var qosRows = [];
        Object.keys(limits).forEach(function(target) {
            if (target === '__global_settings') return;
            var l = limits[target], st = qstate[target] || {}, info = findInfo(target);
            var dispName = l.name || info.name;
            var plabel = (l.prio == 1) ? _('High') : ((l.prio == 7) ? _('Low') : _('Normal'));
            var pcol = (l.prio == 1) ? 'var(--nm-accent)' : ((l.prio == 7) ? 'var(--nm-muted)' : 'var(--nm-text)');
            var bw = E('div', {}, [
                E('div', {}, [ E('span', { 'class': 'nm-dl' }, '↓ ' + ((l.dl > 0) ? l.dl + ' KB/s' : '∞')), E('span', { 'style':'margin-left:10px;' }), E('span', { 'class': 'nm-ul' }, '↑ ' + ((l.ul > 0) ? l.ul + ' KB/s' : '∞')) ]),
                E('div', { 'class': 'nm-meta', 'style': 'color:' + pcol }, '★ ' + plabel)
            ]);
            var quotaCell = E('span', { 'style': 'color:var(--nm-muted)' }, '—');
            if (l.quota_mb > 0) {
                var used = st.used_mb || 0, pct = Math.min(100, used / l.quota_mb * 100);
                var col = pct >= 100 ? 'var(--nm-danger)' : (pct >= 80 ? 'var(--nm-up)' : 'var(--nm-down)');
                quotaCell = E('div', {}, [
                    E('div', { 'class': 'nm-qbar' }, E('i', { 'style': 'width:' + pct.toFixed(0) + '%; background:' + col })),
                    E('div', { 'class': 'nm-qtxt' }, self.bytes_label(used * 1048576) + ' / ' + self.bytes_label(l.quota_mb * 1048576) + ' · ' + periodLabel(l.period))
                ]);
            }
            var sched = (l.t_start && l.t_end) ? (l.t_start + '–' + l.t_end) : '—';
            var blocked = !!st.blocked;
            var status = blocked ? E('span', { 'class': 'nm-pill blk' }, E('span',{class:'d'}), _('Blocked') + (st.reason ? '·' + st.reason : '')) : E('span', { 'class': 'nm-pill on' }, E('span',{class:'d'}), _('Active'));
            qosRows.push(E('tr', {}, [
                E('td', {}, [ E('div', { 'class': 'nm-name' }, dispName), E('div', { 'class': 'nm-meta' }, info.mac + ' · ' + target) ]),
                E('td', {}, bw),
                E('td', {}, quotaCell),
                E('td', {}, E('span', { 'style': 'font-family:ui-monospace,monospace;font-size:.82rem;font-weight:700;' }, sched)),
                E('td', { 'style': 'text-align:center;' }, status),
                E('td', { 'style': 'text-align:right;white-space:nowrap;' }, [
                    E('button', { 'class': 'nm-btn ' + (l.blocked ? 'nm-btn-danger' : 'nm-btn-ghost') + ' nm-btn-sm', 'click': function() { self.toggleBlock(target, !!l.blocked); } }, l.blocked ? _('Unblock') : _('Block')),
                    ' ',
                    E('button', { 'class': 'nm-btn nm-btn-ghost nm-btn-sm', 'click': function() { self.showLimitModal(target, dispName, l); } }, _('Edit'))
                ])
            ]));
        });
        if (qosRows.length === 0) qosRows.push(E('tr', {}, E('td', { 'colspan': '6', 'class': 'nm-empty' }, _('No rules yet — add one to set quota, schedule or QoS.'))));
        if (document.getElementById('qos_body')) dom.content(document.getElementById('qos_body'), qosRows);

        var process = function(json, type) {
            var set = (json.nftables || []).find(function(i) { return i.set; });
            if (!set || !set.set || !set.set.elem) return;
            set.set.elem.forEach(function(item) {
                var e = item.elem, ip = e.val;
                if (!RA[ip]) { RA[ip] = { dl:0, ul:0, t_dl:0, t_ul:0, expires:0, name: findInfo(ip).name, mac: findInfo(ip).mac }; }
                var bytes = (e.counter && e.counter.bytes) ? e.counter.bytes : 0;
                var rate = (RC[type + ip] && bytes >= RC[type + ip]) ? (bytes - RC[type + ip]) / 2 : 0;
                RC[type + ip] = bytes;
                if (e.expires) RA[ip].expires = Math.max(RA[ip].expires, e.expires);
                if (type === 'u') { RA[ip].ul = rate; RA[ip].t_ul = bytes; }
                else { RA[ip].dl = rate; RA[ip].t_dl = bytes; }
            });
        };
        process(upData, 'u'); process(downData, 'd');

        var rows = [];
        Object.keys(RA).sort(function(a, b) { return (RA[b].dl + RA[b].ul) - (RA[a].dl + RA[a].ul); }).forEach(function(ip) {
            var d = RA[ip]; tDL += d.dl; tUL += d.ul; tDLB += d.t_dl; tULB += d.t_ul;
            var ago = self.formatDiff(86400 - d.expires);
            var l = limits[ip], st = qstate[ip] || {};
            var isBlocked = !!st.blocked;
            var pill = isBlocked ? E('span', { 'class': 'nm-pill blk' }, E('span',{class:'d'}), _('Blocked'))
                : (!ago ? E('span', { 'class': 'nm-pill on' }, E('span',{class:'d'}), _('Online')) : E('span', { 'class': 'nm-pill off' }, E('span',{class:'d'}), ago));
            var dispName = (l && l.name) ? l.name : d.name;
            var nameChildren = [ E('div', {}, [ E('span', { 'class': 'nm-name' }, dispName), ' ', pill ]), E('div', { 'class': 'nm-meta' }, d.mac + ' · ' + ip) ];
            if (l && l.quota_mb > 0) {
                var used = st.used_mb || 0, pct = Math.min(100, used / l.quota_mb * 100);
                var col = pct >= 100 ? 'var(--nm-danger)' : (pct >= 80 ? 'var(--nm-up)' : 'var(--nm-down)');
                nameChildren.push(E('div', {}, [
                    E('div', { 'class': 'nm-qbar' }, E('i', { 'style': 'width:' + pct.toFixed(0) + '%; background:' + col })),
                    E('div', { 'class': 'nm-qtxt' }, _('quota') + ' ' + self.bytes_label(used * 1048576) + ' / ' + self.bytes_label(l.quota_mb * 1048576))
                ]));
            }
            var tu = (st.total_up_mb || 0) * 1048576, td = (st.total_down_mb || 0) * 1048576;
            var su = (st.sess_up_mb != null ? st.sess_up_mb * 1048576 : d.t_ul);
            var sd = (st.sess_down_mb != null ? st.sess_down_mb * 1048576 : d.t_dl);
            var totalCell = E('div', { 'class': 'nm-tot' }, [
                E('span', { 'class': 'nm-ul' }, '↑ ' + self.bytes_label(tu)),
                E('span', { 'class': 'nm-dl' }, '↓ ' + self.bytes_label(td)),
                E('span', { 'class': 'all' }, 'Σ ' + self.bytes_label(tu + td))
            ]);
            rows.push(E('tr', {}, [
                E('td', {}, nameChildren),
                E('td', {}, [ E('span', { 'class': 'nm-dl' }, '↓ ' + self.speed_label(d.dl)), E('div', { 'class': 'nm-meta' }, self.bytes_label(sd)) ]),
                E('td', {}, [ E('span', { 'class': 'nm-ul' }, '↑ ' + self.speed_label(d.ul)), E('div', { 'class': 'nm-meta' }, self.bytes_label(su)) ]),
                E('td', {}, totalCell),
                E('td', { 'style': 'text-align:right;white-space:nowrap;' }, [
                    E('button', { 'class': 'nm-btn ' + ((l && l.blocked) ? 'nm-btn-danger' : 'nm-btn-ghost') + ' nm-btn-sm', 'click': function() { self.toggleBlock(ip, !!(l && l.blocked)); } }, (l && l.blocked) ? _('Unblock') : _('Block')),
                    ' ',
                    E('button', { 'class': 'nm-btn nm-btn-ghost nm-btn-sm', 'click': function() { self.showLimitModal(ip, dispName, l); } }, l ? _('Edit') : _('Add'))
                ])
            ]));
        });
        if (rows.length === 0) rows.push(E('tr', {}, E('td', { 'colspan': '5', 'class': 'nm-empty' }, _('No active devices.'))));
        if (document.getElementById('device_body')) dom.content(document.getElementById('device_body'), rows);
        var sumSD = 0, sumSU = 0, sumTD = 0, sumTU = 0;
        Object.keys(qstate).forEach(function(ip) {
            var s = qstate[ip];
            sumSD += (s.sess_down_mb || 0) * 1048576; sumSU += (s.sess_up_mb || 0) * 1048576;
            sumTD += (s.total_down_mb || 0) * 1048576; sumTU += (s.total_up_mb || 0) * 1048576;
        });
        if (document.getElementById('summary_area')) dom.content(document.getElementById('summary_area'), [
            self.renderCard('Total', self.speed_label(tDL + tUL), '↓ ' + self.bytes_label(sumSD) + '  ↑ ' + self.bytes_label(sumSU), '#6366f1'),
            self.renderCard('Download', '↓ ' + self.speed_label(tDL), self.bytes_label(sumSD), '#059669'),
            self.renderCard('Upload', '↑ ' + self.speed_label(tUL), self.bytes_label(sumSU), '#d97706')
        ]);

        // Usage-by-device chart (from persistent saved totals)
        var chartEl = document.getElementById('chart_area');
        if (chartEl) {
            var devs = [];
            Object.keys(qstate).forEach(function(ip) {
                var s = qstate[ip];
                var up = (s.total_up_mb || 0) * 1048576, dn = (s.total_down_mb || 0) * 1048576;
                if (up + dn <= 0) return;
                var l = limits[ip], info = findInfo(ip);
                devs.push({ ip: ip, name: (l && l.name) ? l.name : info.name, mac: info.mac, up: up, down: dn, total: up + dn });
            });
            devs.sort(function(a, b) { return b.total - a.total; });
            var maxT = devs.length ? devs[0].total : 1;
            var bars = devs.slice(0, 12).map(function(dv) {
                return E('div', { 'class': 'nm-bar-row' }, [
                    E('div', { 'class': 'nm-bar-label' }, [ dv.name, E('small', {}, dv.ip) ]),
                    E('div', { 'class': 'nm-bar-track' }, [
                        E('div', { 'class': 'nm-bar-down', 'style': 'width:' + (dv.down / maxT * 100).toFixed(1) + '%' }),
                        E('div', { 'class': 'nm-bar-up', 'style': 'width:' + (dv.up / maxT * 100).toFixed(1) + '%' })
                    ]),
                    E('div', { 'class': 'nm-bar-val' }, self.bytes_label(dv.total))
                ]);
            });
            if (bars.length === 0) bars = [ E('div', { 'class': 'nm-empty' }, _('No usage recorded yet.')) ];
            dom.content(chartEl, bars);
        }
    },

    renderCard: function(title, val, usage, color) {
        return E('div', { 'class': 'nm-card', 'style': '--nm-acc:' + color }, [
            E('h4', {}, _(title)), E('div', { 'class': 'v', 'style': 'color:' + color }, val), usage ? E('div', { 'class': 'u' }, usage) : ''
        ]);
    }
});
