const CATEGORIES = ['office_cleaning', 'reception_cover', 'catering', 'stationery_supplies', 'facilities_maintenance', 'mail_and_courier'];
const CURRENCIES = ['GBP', 'EUR', 'USD'];
const PERIODS = ['monthly', 'annual'];
const label = (s) => String(s).replace(/_/g, ' ');
const $ = (id) => document.getElementById(id);

let view = null;

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) el.append(kid instanceof Node ? kid : String(kid));
  return el;
}

function fill(el, ...kids) { el.replaceChildren(...kids.flat().filter((k) => k !== null && k !== undefined && k !== false)); }

function money(minor, cur) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: cur, maximumFractionDigits: 2, minimumFractionDigits: minor % 100 ? 2 : 0 }).format(minor / 100);
}

let toastTimer = 0;
function toast(msg, isError = false) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.toggle('error', isError);
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), isError ? 6500 : 3500);
}

async function load() {
  const res = await fetch('/api/state', { credentials: 'same-origin' });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error?.message ?? 'Could not load workspace');
  view = body;
  render();
}

async function send(type, payload) {
  const res = await fetch('/api/command', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-OCP-Request': '1' },
    body: JSON.stringify({ type, expectedRevision: view.revision, payload }),
  });
  const body = await res.json().catch(() => ({ error: { message: 'Unreadable response' } }));
  if (!res.ok) {
    const code = body.error?.code ?? 'error';
    toast(`${body.error?.message ?? 'Refused'} [${code}]`, true);
    if (res.status === 409) await load();
    return false;
  }
  view = body.view;
  render();
  toast(body.summary);
  return true;
}

function personOptions(select, selected, { allowNone = false } = {}) {
  fill(select,
    allowNone ? h('option', { value: '', selected: selected === null }, 'Unassigned') : null,
    view.people.map((p) => h('option', { value: p.id, selected: p.id === selected }, `${p.name} · ${p.team}`)));
}

function enumOptions(select, values, selected) {
  fill(select, values.map((v) => h('option', { value: v, selected: v === selected }, label(v))));
}

function chip(kind, text) { return h('span', { class: `chip ${kind}` }, text); }

function reason(r, warn = false) {
  return h('li', { class: warn ? 'warn' : null }, h('strong', {}, r.message), h('code', {}, `${r.code} · ${r.field}`));
}

function renderVendor() {
  const v = view.vendor;
  const f = $('vendor-form');
  if (!f.contains(document.activeElement)) {
    f.legalName.value = v.legalName;
    f.scope.value = v.scope;
    personOptions(f.ownerId, v.ownerId, { allowNone: true });
    enumOptions(f.serviceCategory, CATEGORIES, v.serviceCategory);
    f.amount.value = v.cost ? (v.cost.amountMinor / 100).toFixed(2) : '';
    enumOptions(f.currency, CURRENCIES, v.cost?.currency ?? 'GBP');
    enumOptions(f.period, PERIODS, v.cost?.period ?? 'monthly');
    f.docRef.value = v.agreement?.docRef ?? '';
    f.version.value = v.agreement?.version ?? '';
    f.signedOn.value = v.agreement?.signedOn ?? '';
    f.expiresOn.value = v.agreement?.expiresOn ?? '';
    personOptions(f.signedBy, v.agreement?.signedBy ?? null, { allowNone: true });
  }
  fill($('approvals'), v.approvals.length ? v.approvals.map((a) => h('li', { class: a.current ? 'ok' : 'warn' },
    h('strong', {}, `${label(a.role)}: ${a.approverName}, ${a.approvedOn}`),
    h('code', {}, `${money(a.amountMinor, a.currency)} ${a.period} · fp ${a.fingerprint.slice(0, 8)} · ${a.current ? 'matches current record' : 'STALE: record has changed'}`),
    h('button', { class: 'btn secondary small', type: 'button', onclick: () => send('revoke_approval', { role: a.role }) }, 'Revoke'))) : h('li', { class: 'warn' }, h('strong', {}, 'No approvals recorded.')));
  const af = $('approval-form');
  if (!af.contains(document.activeElement)) {
    personOptions(af.approverId, af.approverId.value || 'P-TB');
    af.approvedOn.value = view.asOf;
  }
  fill($('checklist'), v.checklist.map((i) => h('li', {},
    h('input', { type: 'checkbox', id: `chk-${i.id}`, checked: i.done, onchange: (e) => send('set_checklist', e.target.checked ? { itemId: i.id, done: true, doneOn: view.asOf } : { itemId: i.id, done: false }) }),
    h('label', { for: `chk-${i.id}` }, i.label, ' ', i.critical ? h('span', { class: 'tag' }, 'critical') : null, i.doneOn ? h('span', { class: 'muted small' }, ` · done ${i.doneOn}`) : null))));
}

function renderGate() {
  const g = view.gate;
  const c = $('gate-chip');
  c.className = `chip ${g.status === 'ready' ? 'ready' : 'blocked'}`;
  c.textContent = g.status === 'ready' ? '● Ready' : '■ Blocked';
  $('gate-frac').textContent = `${g.passed} / ${g.total}`;
  const v = view.vendor;
  $('gate-cost').textContent = v.cost ? `${money(v.cost.amountMinor, v.cost.currency)} ${v.cost.period}` : 'unknown';
  $('gate-annual').textContent = g.annualisedMinor === null || !v.cost ? 'unknown' : money(g.annualisedMinor, v.cost.currency);
  $('gate-roles').textContent = g.requiredRoles.map(label).join(' + ');
  fill($('blockers'), g.blockers.length ? g.blockers.map((r) => reason(r)) : h('li', { class: 'ok' }, h('strong', {}, 'No blockers.')));
  $('warnings-h').classList.toggle('hidden', !g.warnings.length);
  fill($('warnings'), g.warnings.map((r) => reason(r, true)));
  const o = view.onboarding;
  fill($('onboarding-state'),
    o.status === 'onboarded' ? [chip('ready', 'Onboarded (simulated)'), ` Receipt ${o.receiptId} on ${o.onboardedOn}. No payment made, no vendor contacted.`]
      : o.status === 'invalidated' ? [chip('stale', '▲ Invalidated'), ` ${o.invalidatedReason} Receipt ${o.history.at(-1)?.receiptId ?? ''} no longer stands.`]
        : [chip('neutral', 'Not onboarded')]);
  const btn = $('onboard');
  const already = o.status === 'onboarded' && o.fingerprint === g.fingerprint;
  btn.disabled = g.status !== 'ready' || already;
  btn.textContent = already ? 'Onboarded (simulated)' : g.status === 'ready' ? 'Onboard (simulated)' : 'Onboard (blocked)';
  $('fingerprint').textContent = `rev ${view.revision} · fp ${g.fingerprint.slice(0, 12)}`;
}

function renderCadence() {
  const b = view.brief;
  fill($('kpis'), b.kpis.map((k) => h('div', { class: 'kpi' }, h('div', { class: 'label' }, k.label), h('div', { class: 'frac' }, k.ratio.display), h('div', { class: 'den' }, k.ratio.note))));
  const msChip = { done: ['ready', 'Done'], late: ['blocked', 'Late'], at_risk: ['stale', 'At risk'], on_track: ['neutral', 'On track'] };
  fill($('milestones').tBodies[0], view.milestones.map((m) => h('tr', {},
    h('td', { 'data-label': 'Milestone' }, m.title, h('span', { class: 'muted small' }, ` ${m.id}`)),
    h('td', { 'data-label': 'Owner' }, m.ownerName),
    h('td', { 'data-label': 'Due' }, m.dueOn),
    h('td', { 'data-label': 'Status' }, chip(...msChip[m.view])),
    h('td', { 'data-label': 'Change' }, m.view === 'done' ? h('span', { class: 'muted small' }, `done ${m.completedOn}`)
      : h('button', { class: 'btn secondary small', type: 'button', onclick: () => send('set_milestone', { id: m.id, status: 'done', completedOn: view.asOf }) }, 'Mark done')))));
  const st = { done_on_time: ['ready', 'Closed on time'], done_late: ['stale', 'Closed late'], open_overdue: ['blocked', 'Overdue'], open_due: ['hold', 'Due today'], open_upcoming: ['neutral', 'Upcoming'] };
  fill($('actions').tBodies[0], view.actions.map((a) => h('tr', {},
    h('td', { 'data-label': 'Action' }, a.title, h('span', { class: 'muted small' }, ` ${a.id}`)),
    h('td', { 'data-label': 'Owner' }, a.ownerId ? a.ownerName : chip('hold', 'No owner')),
    h('td', { 'data-label': 'Due' }, a.dueOn, a.completedOn ? h('span', { class: 'muted small' }, ` · closed ${a.completedOn}`) : null),
    h('td', { 'data-label': 'State' }, chip(...st[a.state])),
    h('td', { 'data-label': 'Change' }, a.completedOn
      ? h('button', { class: 'btn secondary small', type: 'button', onclick: () => send('reopen_action', { id: a.id }) }, 'Reopen')
      : h('button', { class: 'btn secondary small', type: 'button', onclick: () => send('complete_action', { id: a.id, completedOn: view.asOf }) }, `Close ${view.asOf}`)))));
  const af = $('action-form');
  if (!af.contains(document.activeElement)) { personOptions(af.ownerId, af.ownerId.value || 'P-AO', { allowNone: true }); if (!af.dueOn.value) af.dueOn.value = view.asOf; }
  fill($('follow').tBodies[0], b.followThrough.map((f) => h('tr', {},
    h('td', { 'data-label': 'Owner' }, f.owner), h('td', { 'data-label': 'Due' }, f.due), h('td', { 'data-label': 'On time' }, f.onTime),
    h('td', { 'data-label': 'Late' }, f.late), h('td', { 'data-label': 'Overdue open' }, f.overdueOpen),
    h('td', { 'data-label': 'Reading' }, f.verdict === 'hold' ? [chip('hold', '◆ Hold'), h('span', { class: 'muted small' }, ` ${f.rate.note}`)] : [h('strong', {}, f.rate.display), h('span', { class: 'muted small' }, ` ${f.rate.percent}%`)]))));
}

function renderBrief() {
  const b = view.brief;
  $('brief-id').textContent = b.briefId;
  const c = $('brief-chip');
  if (view.briefIssued) { c.className = 'chip ready'; c.textContent = '● Issued · current'; }
  else if (view.briefStale) { c.className = 'chip stale'; c.textContent = '▲ Draft · last issued is stale'; }
  else { c.className = 'chip neutral'; c.textContent = 'Draft · not issued'; }
  $('brief-note').textContent = `Week ${b.weekStart} to ${b.weekEnding} · built from revision ${b.revision} · content hash ${b.contentHash.slice(0, 12)}` + (view.briefStale ? ` · last issued ${view.latestIssuedBriefId} no longer matches` : '');
  fill($('unknowns'), b.unknowns.map((u) => h('li', {}, u)));
  fill($('decisions'), b.decisions.length ? b.decisions.map((d) => h('li', {}, h('strong', {}, d.ask), h('span', { class: 'who' }, `${d.owner} · ${d.why}`))) : h('li', {}, 'No decisions requested.'));
  const btn = $('issue');
  btn.disabled = view.briefIssued;
  btn.textContent = view.briefIssued ? 'Issued' : 'Issue this brief';
}

function renderLog() {
  fill($('events'), view.events.length ? view.events.map((e) => h('li', {}, e.summary, h('span', { class: 'mono' }, `#${e.seq} · rev ${e.revision} · ${e.type} · fp ${e.fingerprintBefore.slice(0, 8)} → ${e.fingerprintAfter.slice(0, 8)}`)))
    : h('li', { class: 'muted' }, 'No changes yet. The baseline is the synthetic seed.'));
  if (view.droppedEvents) $('events').append(h('li', { class: 'muted small' }, `${view.droppedEvents} older events dropped by the retention bound.`));
}

function render() {
  $('rev').textContent = `rev ${view.revision}`;
  $('asof').textContent = `reporting date ${view.asOf}`;
  renderVendor(); renderGate(); renderCadence(); renderBrief(); renderLog();
}

function vendorPatch(f) {
  const v = view.vendor;
  const patch = {};
  const trimmed = (x) => x.value.trim();
  if (trimmed(f.legalName) !== v.legalName) patch.legalName = trimmed(f.legalName);
  if (trimmed(f.scope) !== v.scope) patch.scope = trimmed(f.scope);
  const owner = f.ownerId.value || null;
  if (owner !== v.ownerId) patch.ownerId = owner;
  if (f.serviceCategory.value !== v.serviceCategory) patch.serviceCategory = f.serviceCategory.value;
  const amt = trimmed(f.amount);
  let cost = null;
  if (amt !== '') {
    if (!/^\d{1,7}(\.\d{1,2})?$/.test(amt)) throw new Error('Cost amount must be a number with at most two decimals.');
    cost = { amountMinor: Math.round(Number(amt) * 100), currency: f.currency.value, period: f.period.value };
  }
  if (JSON.stringify(cost) !== JSON.stringify(v.cost ? { amountMinor: v.cost.amountMinor, currency: v.cost.currency, period: v.cost.period } : null)) patch.cost = cost;
  const ref = trimmed(f.docRef);
  let ag = null;
  if (ref !== '') {
    const ver = Number(trimmed(f.version));
    ag = { docRef: ref, version: Number.isInteger(ver) ? ver : trimmed(f.version), signedOn: f.signedOn.value || null, expiresOn: f.expiresOn.value || null, signedBy: f.signedBy.value || null };
  }
  const cur = v.agreement ? { docRef: v.agreement.docRef, version: v.agreement.version, signedOn: v.agreement.signedOn, expiresOn: v.agreement.expiresOn, signedBy: v.agreement.signedBy } : null;
  if (JSON.stringify(ag) !== JSON.stringify(cur)) patch.agreement = ag;
  return patch;
}

function wire() {
  $('vendor-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    let patch;
    try { patch = vendorPatch(e.target); } catch (err) { toast(err.message, true); return; }
    if (!Object.keys(patch).length) { toast('Nothing changed.'); return; }
    document.activeElement?.blur();
    await send('update_vendor', patch);
  });
  $('approval-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    document.activeElement?.blur();
    await send('record_approval', { role: f.role.value, approverId: f.approverId.value, approvedOn: f.approvedOn.value, expectedFingerprint: view.gate.fingerprint });
  });
  $('onboard').addEventListener('click', () => send('onboard', { expectedFingerprint: view.gate.fingerprint }));
  $('issue').addEventListener('click', () => send('issue_brief', { expectedBriefId: view.brief.briefId }));
  $('reset').addEventListener('click', () => send('reset', { scenario: 'baseline' }));
  $('action-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    document.activeElement?.blur();
    if (await send('add_action', { title: f.title.value, ownerId: f.ownerId.value || null, dueOn: f.dueOn.value })) f.title.value = '';
  });
  for (const b of document.querySelectorAll('[data-export]')) {
    b.addEventListener('click', async () => {
      const path = b.dataset.export;
      const res = await fetch(path, { credentials: 'same-origin' });
      const text = await res.text();
      const pre = $('export-preview');
      if (!res.ok) {
        let msg = text;
        try { const j = JSON.parse(text); msg = `${j.error.message} [${j.error.code}]`; } catch { /* keep raw */ }
        pre.textContent = `Refused: ${msg}`;
        toast(msg, true);
        return;
      }
      pre.textContent = path.endsWith('.json') ? JSON.stringify(JSON.parse(text), null, 2) : text;
      const blob = new Blob([text], { type: path.endsWith('.md') ? 'text/markdown' : 'application/json' });
      const a = h('a', { href: URL.createObjectURL(blob), download: path.split('/').pop().replace('audit.json', 'audit-export.json').replace('board.json', 'board-material.json').replace('summary.md', 'weekly-operating-brief.md') });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
  }
}

wire();
load().catch((e) => toast(e.message, true));
