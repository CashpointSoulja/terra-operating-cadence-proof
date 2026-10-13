// Expected/actual evaluation of the onboarding gate and weekly brief, plus a negative control.
// Run: node --experimental-strip-types eval/run.ts   (writes eval/results.json and eval/RESULTS.md)
import { writeFileSync } from 'node:fs';
import { applyCommand, baselineState, boardExport, buildBrief, CommandError, evaluateGate } from '../src/engine/index.ts';
import type { State } from '../src/engine/index.ts';

type Step = [type: string, payload: (s: State) => unknown];
interface Expected { gate?: 'ready' | 'blocked'; blockersInclude?: string[]; blockersExactly?: string[]; onboarding?: string; refusedWith?: string; kpis?: Record<string, string>; boardExport?: string }
interface Case { id: string; title: string; steps: Step[]; finalStep?: Step; expected: Expected; boardCheck?: boolean }

const fp = (s: State) => evaluateGate(s).fingerprint;
const tick: Step = ['set_checklist', (s) => ({ itemId: 'bank_callback', done: true, doneOn: s.asOf })];
const onboard: Step = ['onboard', (s) => ({ expectedFingerprint: fp(s) })];
const raise: Step = ['update_vendor', () => ({ cost: { amountMinor: 245_000, currency: 'GBP', period: 'monthly' } })];
const approve = (role: string, who: string): Step => ['record_approval', (s) => ({ role, approverId: who, approvedOn: s.asOf, expectedFingerprint: fp(s) })];

const CASES: Case[] = [
  { id: 'E01', title: 'Baseline: critical bank call-back still open', steps: [], expected: { gate: 'blocked', blockersExactly: ['checklist_critical_open'], onboarding: 'not_started' } },
  { id: 'E02', title: 'All critical steps done, current approval', steps: [tick], expected: { gate: 'ready', blockersExactly: [] } },
  { id: 'E03', title: 'Simulated onboarding once ready', steps: [tick, onboard], expected: { gate: 'ready', onboarding: 'onboarded' } },
  { id: 'E04', title: 'Material cost change after onboarding', steps: [tick, onboard, raise], expected: { gate: 'blocked', blockersExactly: ['approval_stale', 'approval_missing'], onboarding: 'invalidated' } },
  { id: 'E05', title: 'Recovery: budget-owner and finance-lead re-approve new record', steps: [tick, onboard, raise, approve('budget_owner', 'P-TB'), approve('finance_lead', 'P-JW'), onboard], expected: { gate: 'ready', onboarding: 'onboarded' } },
  { id: 'E06', title: 'Partial recovery: only budget owner re-approves', steps: [tick, raise, approve('budget_owner', 'P-TB')], expected: { gate: 'blocked', blockersExactly: ['approval_missing'] } },
  { id: 'E07', title: 'Approval older than 90 days', steps: [tick, ['set_as_of', () => ({ asOf: '2027-01-15' })]], expected: { gate: 'blocked', blockersInclude: ['approval_expired'] } },
  { id: 'E08', title: 'Cost quoted in EUR', steps: [tick, ['update_vendor', () => ({ cost: { amountMinor: 185_000, currency: 'EUR', period: 'monthly' } })]], expected: { gate: 'blocked', blockersInclude: ['currency_not_home', 'approval_stale'] } },
  { id: 'E09', title: 'Agreement expired', steps: [tick, ['update_vendor', () => ({ agreement: { docRef: 'SA-HRO-0147', version: 1, signedOn: '2025-09-30', expiresOn: '2026-09-29', signedBy: 'P-TB' } })]], expected: { gate: 'blocked', blockersInclude: ['agreement_expired'] } },
  { id: 'E10', title: 'Accountable owner removed', steps: [tick, ['update_vendor', () => ({ ownerId: null })]], expected: { gate: 'blocked', blockersInclude: ['owner_missing'] } },
  { id: 'E11', title: 'Approval revoked', steps: [tick, ['revoke_approval', () => ({ role: 'budget_owner' })]], expected: { gate: 'blocked', blockersExactly: ['approval_missing'] } },
  { id: 'E12', title: 'Approver without budget authority', steps: [], finalStep: approve('budget_owner', 'P-AO'), expected: { refusedWith: 'approver_not_authorised' } },
  { id: 'E13', title: 'Owner approves own vendor', steps: [['update_vendor', () => ({ ownerId: 'P-TB' })]], finalStep: approve('budget_owner', 'P-TB'), expected: { refusedWith: 'approver_is_owner' } },
  { id: 'E14', title: 'Approval dated after the reporting date', steps: [], finalStep: ['record_approval', (s) => ({ role: 'budget_owner', approverId: 'P-TB', approvedOn: '2026-10-30', expectedFingerprint: fp(s) })], expected: { refusedWith: 'future_date' } },
  { id: 'E15', title: 'Approval for a record the approver did not see', steps: [], finalStep: ['record_approval', () => ({ role: 'budget_owner', approverId: 'P-TB', approvedOn: '2026-10-16', expectedFingerprint: 'f'.repeat(64) })], expected: { refusedWith: 'fingerprint_mismatch' } },
  { id: 'E16', title: 'Onboarding attempted while blocked', steps: [], finalStep: onboard, expected: { refusedWith: 'gate_blocked' } },
  { id: 'E17', title: 'Baseline KPI denominators', steps: [], expected: { kpis: { actions_on_time: '3 / 7', overdue_open: '2 / 4', milestones_on_track: '1 / 3', vendor_checks: '7 / 8' } } },
  { id: 'E18', title: 'Board export before any brief is issued', steps: [], boardCheck: true, expected: { boardExport: 'brief_not_issued' } },
  { id: 'E19', title: 'Board export after issue then a change', steps: [['issue_brief', (s) => ({ expectedBriefId: buildBrief(s).briefId })], ['complete_action', () => ({ id: 'A-04', completedOn: '2026-10-16' })]], boardCheck: true, expected: { boardExport: 'brief_stale' } },
  { id: 'E20', title: 'Board export for the issued current brief', steps: [['issue_brief', (s) => ({ expectedBriefId: buildBrief(s).briefId })]], boardCheck: true, expected: { boardExport: 'ok' } },
];

/** Negative control: a plausible but naive gate that counts checks and accepts any approval on file. */
function naiveGate(s: State): 'ready' | 'blocked' {
  const done = s.vendor.checklist.filter((i) => i.done).length / s.vendor.checklist.length;
  return s.vendor.cost && s.vendor.ownerId && s.vendor.agreement && s.vendor.approvals.length > 0 && done >= 0.6 ? 'ready' : 'blocked';
}

function apply(s: State, [type, payload]: Step): State {
  return applyCommand(s, { type, expectedRevision: s.revision, payload: payload(s) }).state;
}

interface Row { id: string; title: string; expected: Expected; actual: Expected; pass: boolean; naive?: { expected: string; actual: string; pass: boolean } }

function actualFor(c: Case): { actual: Expected; state: State } {
  let s = baselineState();
  for (const step of c.steps) s = apply(s, step);
  const actual: Expected = {};
  if (c.finalStep) {
    try { s = apply(s, c.finalStep); actual.refusedWith = 'accepted'; } catch (e) { actual.refusedWith = e instanceof CommandError ? e.code : 'crash'; }
  }
  const g = evaluateGate(s);
  const codes = g.blockers.map((b) => b.code);
  if (c.expected.gate) actual.gate = g.status;
  if (c.expected.blockersExactly) actual.blockersExactly = codes;
  if (c.expected.blockersInclude) actual.blockersInclude = c.expected.blockersInclude.filter((x) => codes.includes(x));
  if (c.expected.onboarding) actual.onboarding = s.onboarding.status;
  if (c.expected.kpis) actual.kpis = Object.fromEntries(buildBrief(s).kpis.map((k) => [k.id, k.ratio.display]));
  if (c.boardCheck) { try { boardExport(s); actual.boardExport = 'ok'; } catch (e) { actual.boardExport = (e as CommandError).code; } }
  return { actual, state: s };
}

const rows: Row[] = CASES.map((c) => {
  const { actual, state } = actualFor(c);
  const pass = JSON.stringify(actual, Object.keys(c.expected).sort()) === JSON.stringify(c.expected, Object.keys(c.expected).sort())
    && Object.keys(c.expected).every((k) => JSON.stringify((actual as Record<string, unknown>)[k]) === JSON.stringify((c.expected as Record<string, unknown>)[k]));
  const row: Row = { id: c.id, title: c.title, expected: c.expected, actual, pass };
  if (c.expected.gate) { const n = naiveGate(state); row.naive = { expected: c.expected.gate, actual: n, pass: n === c.expected.gate }; }
  return row;
});

const passed = rows.filter((r) => r.pass).length;
const control = rows.filter((r) => r.naive);
const controlPassed = control.filter((r) => r.naive!.pass).length;
const controlCaught = control.length - controlPassed;
const fmt = (e: Expected) => Object.entries(e).map(([k, v]) => `${k}=${Array.isArray(v) ? '[' + v.join(', ') + ']' : typeof v === 'object' ? Object.values(v as object).join(' · ') : v}`).join('; ');

const md: string[] = ['# Evaluation results', '', `Generated by \`npm run eval\` from the synthetic baseline. Engine: **${passed} / ${rows.length}** cases match expected.`, '', `Negative control (naive count-based gate that accepts any approval on file): **${controlPassed} / ${control.length}** gate cases match expected, so the evaluation catches it on **${controlCaught}** case(s). A control that scored ${control.length} / ${control.length} would mean these cases cannot tell a correct gate from a naive one.`, '', '| Case | Scenario | Expected | Actual (engine) | Engine | Naive control |', '|---|---|---|---|---|---|'];
for (const r of rows) md.push(`| ${r.id} | ${r.title} | ${fmt(r.expected)} | ${fmt(r.actual)} | ${r.pass ? 'PASS' : 'FAIL'} | ${r.naive ? `${r.naive.actual} (${r.naive.pass ? 'match' : 'MISS'})` : 'n/a'} |`);
md.push('');
writeFileSync(new URL('./RESULTS.md', import.meta.url), md.join('\n'));
writeFileSync(new URL('./results.json', import.meta.url), JSON.stringify({ engine: { passed, total: rows.length }, negativeControl: { passed: controlPassed, total: control.length, caught: controlCaught }, rows }, null, 2) + '\n');

for (const r of rows) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.id} ${r.title}${r.naive ? `   [control: ${r.naive.pass ? 'match' : 'MISS'}]` : ''}${r.pass ? '' : `\n      expected ${fmt(r.expected)}\n      actual   ${fmt(r.actual)}`}`);
console.log(`\nengine ${passed}/${rows.length}; negative control matched ${controlPassed}/${control.length} (caught on ${controlCaught})`);
const ok = passed === rows.length && controlCaught > 0;
if (!ok) console.log(controlCaught === 0 ? 'FAIL: negative control was not detected' : 'FAIL: engine mismatches');
process.exit(ok ? 0 : 1);
