// HTTP and security checks against a running local Worker (npx wrangler dev). Usage: BASE=http://127.0.0.1:8787 node scripts/api-check.mjs
const BASE = process.env.BASE ?? 'http://127.0.0.1:8787';
const results = [];
let failed = 0;
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

async function visitor() {
  const res = await fetch(`${BASE}/api/state`);
  const setCookie = res.headers.get('set-cookie') ?? '';
  const cookie = setCookie.split(';')[0];
  return { cookie, setCookie, view: await res.json() };
}
const writeHeaders = (cookie, extra = {}) => ({ 'Content-Type': 'application/json', 'X-OCP-Request': '1', Origin: BASE, Cookie: cookie, ...extra });
async function command(v, type, payload, { headers, expectedRevision } = {}) {
  const res = await fetch(`${BASE}/api/command`, { method: 'POST', headers: headers ?? writeHeaders(v.cookie), body: JSON.stringify({ type, expectedRevision: expectedRevision ?? v.view.revision, payload }) });
  const body = await res.json().catch(() => null);
  if (res.ok && body?.view) v.view = body.view;
  return { status: res.status, body };
}

const a = await visitor();
check('GET /api/state issues an HttpOnly, Secure, SameSite=Strict visitor cookie', /HttpOnly/.test(a.setCookie) && /Secure/.test(a.setCookie) && /SameSite=Strict/.test(a.setCookie) && /^ocp_vid=[a-f0-9]{64}$/.test(a.cookie), a.setCookie.replace(/=[a-f0-9]{64}/, '=<64 hex>'));
check('new workspace starts at revision 1 from the synthetic seed', a.view.revision === 1 && a.view.vendor.id === 'VND-0147');

const r1 = await fetch(`${BASE}/api/state`);
for (const h of ['content-security-policy', 'x-content-type-options', 'x-frame-options', 'referrer-policy']) check(`API sends ${h}`, !!r1.headers.get(h));
const page = await fetch(`${BASE}/`);
check('HTML page sends CSP with frame-ancestors none', /frame-ancestors 'none'/.test(page.headers.get('content-security-policy') ?? ''));
check('API responses are not cached', r1.headers.get('cache-control') === 'no-store');

const body = JSON.stringify({ type: 'set_as_of', expectedRevision: 1, payload: { asOf: '2026-10-17' } });
const post = (headers, b = body) => fetch(`${BASE}/api/command`, { method: 'POST', headers, body: b }).then(async (r) => ({ status: r.status, code: (await r.json().catch(() => ({}))).error?.code }));
let r = await post({ 'Content-Type': 'application/json', 'X-OCP-Request': '1', Cookie: a.cookie });
check('write without Origin is refused 403', r.status === 403 && r.code === 'bad_origin', `${r.status} ${r.code}`);
r = await post(writeHeaders(a.cookie, { Origin: 'https://evil.example' }));
check('cross-origin write is refused 403', r.status === 403 && r.code === 'bad_origin', `${r.status} ${r.code}`);
r = await post(writeHeaders(a.cookie, { 'Sec-Fetch-Site': 'cross-site' }));
check('Sec-Fetch-Site cross-site write is refused 403', r.status === 403, `${r.status} ${r.code}`);
r = await post({ 'Content-Type': 'application/json', Origin: BASE, Cookie: a.cookie });
check('write without X-OCP-Request header is refused 403', r.status === 403 && r.code === 'missing_request_header', `${r.status} ${r.code}`);
r = await post(writeHeaders(a.cookie, { 'Content-Type': 'text/plain' }));
check('form-style text/plain write is refused 415', r.status === 415, `${r.status} ${r.code}`);
r = await post(writeHeaders(''));
check('write without a workspace cookie is refused 401', r.status === 401 && r.code === 'no_workspace', `${r.status} ${r.code}`);
r = await post(writeHeaders('ocp_vid=../../etc'));
check('malformed cookie is treated as no workspace', r.status === 401, `${r.status} ${r.code}`);
r = await post(writeHeaders(a.cookie), JSON.stringify({ type: 'add_action', expectedRevision: 1, payload: { title: 'x'.repeat(9000), ownerId: 'P-AO', dueOn: '2026-10-20' } }));
check('body over 8 KB is refused 413', r.status === 413 && r.code === 'body_too_large', `${r.status} ${r.code}`);
r = await post(writeHeaders(a.cookie), '{"type":');
check('invalid JSON is refused 400', r.status === 400 && r.code === 'invalid_json', `${r.status} ${r.code}`);
r = await post(writeHeaders(a.cookie), JSON.stringify({ type: 'update_vendor', expectedRevision: 1, payload: JSON.parse('{"__proto__":{"admin":true}}') }));
check('prototype-pollution key is refused 400', r.status === 400 && r.code === 'unknown_field', `${r.status} ${r.code}`);
const nf = await fetch(`${BASE}/api/admin`);
check('unknown API route returns 404', nf.status === 404);
const mna = await fetch(`${BASE}/api/command`);
check('GET on /api/command returns 405', mna.status === 405);

const blocked = await command(a, 'onboard', { expectedFingerprint: a.view.gate.fingerprint });
check('blocked vendor cannot be onboarded (422 gate_blocked)', blocked.status === 422 && blocked.body.error.code === 'gate_blocked', `${blocked.status} ${blocked.body?.error?.code}`);
const board = await fetch(`${BASE}/api/export/board.json`, { headers: { Cookie: a.cookie } });
check('board export before issuing a brief is refused 409', board.status === 409 && (await board.json()).error.code === 'brief_not_issued');

const tick = await command(a, 'set_checklist', { itemId: 'bank_callback', done: true, doneOn: '2026-10-16' });
check('visitor A ticks the critical item (rev 1 → 2)', tick.status === 200 && a.view.revision === 2 && a.view.gate.status === 'ready');

const b = await visitor();
check('visitor B gets a different workspace cookie', b.cookie !== a.cookie);
check('visitor B does not see visitor A\'s change (isolation)', b.view.revision === 1 && b.view.gate.status === 'blocked');
const crossRead = await fetch(`${BASE}/api/state`, { headers: { Cookie: b.cookie } }).then((x) => x.json());
check('visitor B re-reads its own workspace only', crossRead.revision === 1);

const stale = await command(a, 'set_as_of', { asOf: '2026-10-17' }, { expectedRevision: 1 });
check('stale expectedRevision is refused 409 revision_conflict', stale.status === 409 && stale.body.error.code === 'revision_conflict' && stale.body.error.details.currentRevision === 2);

const rev = a.view.revision;
const [c1, c2] = await Promise.all([
  command(a, 'complete_action', { id: 'A-04', completedOn: '2026-10-16' }, { expectedRevision: rev }),
  command(a, 'complete_action', { id: 'A-05', completedOn: '2026-10-16' }, { expectedRevision: rev }),
]);
const statuses = [c1.status, c2.status].sort();
check('two concurrent writes on one revision: exactly one lands, one gets 409', statuses[0] === 200 && statuses[1] === 409, statuses.join(','));
const after = await fetch(`${BASE}/api/state`, { headers: { Cookie: a.cookie } }).then((x) => x.json());
check('workspace advanced by exactly one revision', after.revision === rev + 1, `rev ${rev} → ${after.revision}`);
a.view = after;

const onb = await command(a, 'onboard', { expectedFingerprint: a.view.gate.fingerprint });
check('ready vendor onboards (simulated receipt)', onb.status === 200 && /^SIM-ONB-/.test(a.view.onboarding.receiptId ?? ''));
const change = await command(a, 'update_vendor', { cost: { amountMinor: 245000, currency: 'GBP', period: 'monthly' } });
check('material cost change invalidates onboarding and prior approval', change.status === 200 && a.view.onboarding.status === 'invalidated' && a.view.gate.blockers.some((x) => x.code === 'approval_stale'));
const oldFp = await command(a, 'record_approval', { role: 'budget_owner', approverId: 'P-TB', approvedOn: '2026-10-16', expectedFingerprint: '0'.repeat(64) });
check('approval against an outdated fingerprint is refused 409', oldFp.status === 409 && oldFp.body.error.code === 'fingerprint_mismatch');
await command(a, 'record_approval', { role: 'budget_owner', approverId: 'P-TB', approvedOn: '2026-10-16', expectedFingerprint: a.view.gate.fingerprint });
await command(a, 'record_approval', { role: 'finance_lead', approverId: 'P-JW', approvedOn: '2026-10-16', expectedFingerprint: a.view.gate.fingerprint });
const re = await command(a, 'onboard', { expectedFingerprint: a.view.gate.fingerprint });
check('re-approval recovers: onboarding recorded again', re.status === 200 && a.view.onboarding.status === 'onboarded' && a.view.onboarding.history.length === 2);

const issue = await command(a, 'issue_brief', { expectedBriefId: a.view.brief.briefId });
check('current brief issues', issue.status === 200 && a.view.briefIssued === true);
const boardOk = await fetch(`${BASE}/api/export/board.json`, { headers: { Cookie: a.cookie } });
const boardJson = await boardOk.json();
check('board export works for the issued current brief', boardOk.status === 200 && boardJson.brief.briefId === a.view.brief.briefId && /attachment/.test(boardOk.headers.get('content-disposition') ?? ''));
const audit = await fetch(`${BASE}/api/export/audit.json`, { headers: { Cookie: a.cookie } }).then((x) => x.json());
check('audit export lists the seed event plus one event per accepted change, with fingerprints', audit.kind === 'operating-cadence-proof.audit' && audit.events.length === audit.revision && audit.events.every((e) => e.fingerprintBefore && e.fingerprintAfter), `${audit.events.length} events at rev ${audit.revision}`);
const md = await fetch(`${BASE}/api/export/summary.md`, { headers: { Cookie: a.cookie } });
const mdText = await md.text();
check('readable summary is markdown with denominators and disclaimer', /text\/markdown/.test(md.headers.get('content-type') ?? '') && / \/ /.test(mdText) && /Not legal or financial advice/.test(mdText));

const c = await visitor();
let limited = 0;
const burst = await Promise.all(Array.from({ length: 125 }, () => command(c, 'set_as_of', { asOf: '2026-10-17' }, { expectedRevision: 999 })));
limited = burst.filter((x) => x.status === 429).length;
check('more than 120 change attempts a minute are rate limited (429)', limited >= 5, `${limited} of 125 got 429`);

console.log(`\n${results.length - failed}/${results.length} API checks passed`);
if (process.env.OUT) (await import('node:fs')).writeFileSync(process.env.OUT, JSON.stringify({ base: BASE, passed: results.length - failed, total: results.length, results }, null, 2) + '\n');
process.exit(failed ? 1 : 0);
