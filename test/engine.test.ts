import { describe, expect, it } from 'vitest';
import { applyCommand, auditExport, baselineState, boardExport, buildBrief, CommandError, evaluateGate, isValidStoredState, LIMITS, materialFingerprint, ratio, summaryMarkdown } from '../src/engine/index.ts';
import type { State } from '../src/engine/index.ts';

function run(s: State, type: string, payload: unknown): State {
  return applyCommand(s, { type, expectedRevision: s.revision, payload }).state;
}
function refuse(s: State, type: string, payload: unknown, expectedRevision = s.revision): CommandError {
  try { applyCommand(s, { type, expectedRevision, payload }); } catch (e) { if (e instanceof CommandError) return e; throw e; }
  throw new Error(`expected ${type} to be refused`);
}
const codes = (s: State) => evaluateGate(s).blockers.map((b) => b.code);
const fp = (s: State) => evaluateGate(s).fingerprint;
const tickBank = (s: State) => run(s, 'set_checklist', { itemId: 'bank_callback', done: true, doneOn: s.asOf });

describe('vendor onboarding gate', () => {
  it('baseline is blocked only by the open critical bank call-back', () => {
    const g = evaluateGate(baselineState());
    expect(g.status).toBe('blocked');
    expect(g.blockers.map((b) => b.code)).toEqual(['checklist_critical_open']);
    expect(g.warnings.map((w) => w.code)).toEqual(['checklist_open']);
    expect(g.requiredRoles).toEqual(['budget_owner']);
    expect(g.annualisedMinor).toBe(2_220_000);
  });

  it('one critical item blocks even when most checks pass', () => {
    const g = evaluateGate(baselineState());
    expect(g.passed / g.total).toBeGreaterThan(0.8);
    expect(g.status).toBe('blocked');
  });

  it('refuses simulated onboarding while blocked', () => {
    const s = baselineState();
    const e = refuse(s, 'onboard', { expectedFingerprint: fp(s) });
    expect([e.status, e.code]).toEqual([422, 'gate_blocked']);
  });

  it('onboards once ready and replays idempotently', () => {
    let s = tickBank(baselineState());
    expect(evaluateGate(s).status).toBe('ready');
    s = run(s, 'onboard', { expectedFingerprint: fp(s) });
    expect(s.onboarding.status).toBe('onboarded');
    const again = applyCommand(s, { type: 'onboard', expectedRevision: s.revision, payload: { expectedFingerprint: fp(s) } });
    expect(again.replay).toBe(true);
    expect(again.state).toBe(s);
    expect(s.onboarding.history).toHaveLength(1);
  });

  it('a material change invalidates approval and onboarding, and re-approval recovers', () => {
    let s = tickBank(baselineState());
    s = run(s, 'onboard', { expectedFingerprint: fp(s) });
    const before = fp(s);
    s = run(s, 'update_vendor', { cost: { amountMinor: 245_000, currency: 'GBP', period: 'monthly' } });
    expect(fp(s)).not.toBe(before);
    expect(s.onboarding.status).toBe('invalidated');
    expect(s.onboarding.history[0].endedReason).toBe('material_change');
    expect(codes(s)).toEqual(['approval_stale', 'approval_missing']);
    expect(evaluateGate(s).requiredRoles).toEqual(['budget_owner', 'finance_lead']);
    s = run(s, 'record_approval', { role: 'budget_owner', approverId: 'P-TB', approvedOn: s.asOf, expectedFingerprint: fp(s) });
    expect(codes(s)).toEqual(['approval_missing']);
    s = run(s, 'record_approval', { role: 'finance_lead', approverId: 'P-JW', approvedOn: s.asOf, expectedFingerprint: fp(s) });
    expect(evaluateGate(s).status).toBe('ready');
    s = run(s, 'onboard', { expectedFingerprint: fp(s) });
    expect(s.onboarding.status).toBe('onboarded');
    expect(s.onboarding.history.map((h) => h.receiptId)).toEqual(['SIM-ONB-0100', 'SIM-ONB-0101']);
  });

  it.each([
    ['owner', { ownerId: 'P-AO' }],
    ['scope', { scope: 'Evening cleaning for two floors' }],
    ['legal name', { legalName: 'Halden and Rowe Facilities Ltd' }],
    ['agreement version', { agreement: { docRef: 'SA-HRO-0147', version: 2, signedOn: '2026-10-15', expiresOn: '2027-10-14', signedBy: 'P-TB' } }],
    ['category', { serviceCategory: 'catering' }],
  ])('changing %s makes the existing approval stale', (_n, patch) => {
    const s = run(tickBank(baselineState()), 'update_vendor', patch);
    expect(codes(s)).toContain('approval_stale');
  });

  it('non-material edits do not change the fingerprint', () => {
    const s = baselineState();
    const t = run(s, 'set_checklist', { itemId: 'service_checklist', done: true, doneOn: s.asOf });
    expect(materialFingerprint(t.vendor)).toBe(materialFingerprint(s.vendor));
  });

  it('approvals expire after 90 days', () => {
    const s = run(tickBank(baselineState()), 'set_as_of', { asOf: '2027-01-15' });
    expect(codes(s)).toContain('approval_expired');
  });

  it('a revoked approval blocks', () => {
    const s = run(tickBank(baselineState()), 'revoke_approval', { role: 'budget_owner' });
    expect(codes(s)).toEqual(['approval_missing']);
  });

  it('non-home currency blocks and requires finance review', () => {
    const s = run(tickBank(baselineState()), 'update_vendor', { cost: { amountMinor: 185_000, currency: 'EUR', period: 'monthly' } });
    expect(codes(s)).toContain('currency_not_home');
  });

  it('crossing the finance threshold adds a finance-lead approval', () => {
    const s = run(tickBank(baselineState()), 'update_vendor', { cost: { amountMinor: 3_000_000, currency: 'GBP', period: 'annual' } });
    expect(evaluateGate(s).requiredRoles).toEqual(['budget_owner', 'finance_lead']);
  });

  it('missing cost, owner or agreement each block', () => {
    const b = tickBank(baselineState());
    expect(codes(run(b, 'update_vendor', { cost: null }))).toContain('cost_missing');
    expect(codes(run(b, 'update_vendor', { ownerId: null }))).toContain('owner_missing');
    expect(codes(run(b, 'update_vendor', { agreement: null }))).toContain('agreement_missing');
  });

  it('expired, unsigned, future-signed and inverted agreements block', () => {
    const b = tickBank(baselineState());
    const ag = (o: object) => ({ agreement: { docRef: 'SA-HRO-0147', version: 1, signedOn: '2026-09-30', expiresOn: '2027-09-29', signedBy: 'P-TB', ...o } });
    expect(codes(run(b, 'update_vendor', ag({ expiresOn: '2026-10-01' })))).toContain('agreement_expired');
    expect(codes(run(b, 'update_vendor', ag({ signedOn: null })))).toContain('agreement_unsigned');
    expect(codes(run(b, 'update_vendor', ag({ signedOn: '2026-11-01', expiresOn: '2027-11-01' })))).toContain('agreement_future_signed');
    expect(codes(run(b, 'update_vendor', ag({ signedOn: '2026-09-30', expiresOn: '2026-09-01' })))).toContain('agreement_dates_inverted');
    expect(codes(run(b, 'update_vendor', ag({ expiresOn: null })))).toContain('agreement_expiry_unknown');
  });

  it('agreement close to expiry warns but does not block', () => {
    const b = tickBank(baselineState());
    const s = run(b, 'update_vendor', { agreement: { docRef: 'SA-HRO-0147', version: 1, signedOn: '2026-09-30', expiresOn: '2026-11-01', signedBy: 'P-TB' } });
    expect(evaluateGate(s).warnings.map((w) => w.code)).toContain('agreement_expiring');
  });
});

describe('approval controls', () => {
  it('refuses an approver without the role', () => {
    const s = baselineState();
    const e = refuse(s, 'record_approval', { role: 'budget_owner', approverId: 'P-AO', approvedOn: s.asOf, expectedFingerprint: fp(s) });
    expect(e.code).toBe('approver_not_authorised');
  });
  it('refuses self-approval by the accountable owner', () => {
    const s = run(baselineState(), 'update_vendor', { ownerId: 'P-TB' });
    const e = refuse(s, 'record_approval', { role: 'budget_owner', approverId: 'P-TB', approvedOn: s.asOf, expectedFingerprint: fp(s) });
    expect(e.code).toBe('approver_is_owner');
  });
  it('the gate also refuses a stored self-approval', () => {
    const s = run(baselineState(), 'update_vendor', { ownerId: 'P-TB' });
    s.vendor.approvals = [{ ...s.vendor.approvals[0], fingerprint: fp(s) }];
    expect(codes(s)).toContain('approver_is_owner');
  });
  it('refuses future-dated approval', () => {
    const s = baselineState();
    expect(refuse(s, 'record_approval', { role: 'budget_owner', approverId: 'P-TB', approvedOn: '2026-10-17', expectedFingerprint: fp(s) }).code).toBe('future_date');
  });
  it('refuses approval against a fingerprint the approver did not see', () => {
    const s = baselineState();
    const e = refuse(s, 'record_approval', { role: 'budget_owner', approverId: 'P-TB', approvedOn: s.asOf, expectedFingerprint: '0'.repeat(64) });
    expect([e.status, e.code]).toEqual([409, 'fingerprint_mismatch']);
  });
});

describe('atomic input validation', () => {
  const s = baselineState();
  it.each([
    ['impossible date', 'set_checklist', { itemId: 'bank_callback', done: true, doneOn: '2026-02-30' }, 'invalid_date'],
    ['non-ISO date', 'complete_action', { id: 'A-04', completedOn: '16/10/2026' }, 'invalid_date'],
    ['future checklist date', 'set_checklist', { itemId: 'bank_callback', done: true, doneOn: '2026-10-20' }, 'future_date'],
    ['future close date', 'complete_action', { id: 'A-04', completedOn: '2026-10-17' }, 'future_date'],
    ['negative cost', 'update_vendor', { cost: { amountMinor: -1, currency: 'GBP', period: 'monthly' } }, 'invalid_number'],
    ['fractional pennies', 'update_vendor', { cost: { amountMinor: 10.5, currency: 'GBP', period: 'monthly' } }, 'invalid_number'],
    ['cost as string', 'update_vendor', { cost: { amountMinor: '185000', currency: 'GBP', period: 'monthly' } }, 'invalid_number'],
    ['oversized cost', 'update_vendor', { cost: { amountMinor: 50_000_001, currency: 'GBP', period: 'monthly' } }, 'invalid_number'],
    ['unknown currency', 'update_vendor', { cost: { amountMinor: 100, currency: 'BTC', period: 'monthly' } }, 'invalid_enum'],
    ['unknown field', 'update_vendor', { legalName: 'X Ltd', isAdmin: true }, 'unknown_field'],
    ['prototype key', 'update_vendor', JSON.parse('{"__proto__":{"polluted":true}}'), 'unknown_field'],
    ['empty patch', 'update_vendor', {}, 'empty_patch'],
    ['control characters', 'update_vendor', { legalName: 'Halden\u0000Rowe' }, 'control_characters'],
    ['over-long title', 'add_action', { title: 'x'.repeat(121), ownerId: 'P-AO', dueOn: '2026-10-20' }, 'too_long'],
    ['unknown person', 'add_action', { title: 'Something', ownerId: 'P-ZZ', dueOn: '2026-10-20' }, 'unknown_person'],
    ['duplicate open action', 'add_action', { title: 'draft kpi page for board pack', ownerId: 'P-AO', dueOn: '2026-10-20' }, 'duplicate_action'],
    ['bad doc ref', 'update_vendor', { agreement: { docRef: '../etc', version: 1, signedOn: null, expiresOn: null, signedBy: null } }, 'invalid_doc_ref'],
    ['array payload', 'set_as_of', ['2026-10-17'], 'invalid_shape'],
    ['as-of out of range', 'set_as_of', { asOf: '2030-01-01' }, 'out_of_range'],
    ['closing a closed action', 'complete_action', { id: 'A-01', completedOn: '2026-10-16' }, 'already_done'],
  ])('rejects %s', (_n, type, payload, code) => {
    expect(refuse(s, type as string, payload).code).toBe(code);
  });

  it('rejects unknown command types and envelope fields', () => {
    expect(refuse(s, 'drop_tables', {}).code).toBe('invalid_enum');
    expect(() => applyCommand(s, { type: 'reset', expectedRevision: 1, payload: { scenario: 'baseline' }, extra: 1 })).toThrow(/not an accepted field/);
  });

  it('rejects a stale revision with 409 and never mutates the input state', () => {
    const snapshot = JSON.stringify(s);
    const e = refuse(s, 'set_as_of', { asOf: '2026-10-17' }, s.revision - 1);
    expect([e.status, e.code]).toEqual([409, 'revision_conflict']);
    applyCommand(s, { type: 'set_as_of', expectedRevision: s.revision, payload: { asOf: '2026-10-17' } });
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it('a refused multi-field patch changes nothing (all or nothing)', () => {
    const e = refuse(s, 'update_vendor', { legalName: 'New Name Ltd', cost: { amountMinor: -5, currency: 'GBP', period: 'monthly' } });
    expect(e.code).toBe('invalid_number');
    expect(s.vendor.legalName).toBe('Halden & Rowe Office Services Ltd');
  });
});

describe('bounded state', () => {
  it('caps actions at the limit', () => {
    let s = baselineState();
    while (s.actions.length < LIMITS.maxActions) s = run(s, 'add_action', { title: `Synthetic task ${s.actions.length}`, ownerId: 'P-AO', dueOn: '2026-10-20' });
    expect(refuse(s, 'add_action', { title: 'One more', ownerId: 'P-AO', dueOn: '2026-10-20' }).code).toBe('limit_reached');
  });
  it('keeps at most maxEvents events and counts what it dropped', () => {
    let s = baselineState();
    for (let i = 0; i < LIMITS.maxEvents + 25; i++) s = run(s, i % 2 ? 'reopen_action' : 'complete_action', i % 2 ? { id: 'A-04' } : { id: 'A-04', completedOn: '2026-10-16' });
    expect(s.events).toHaveLength(LIMITS.maxEvents);
    expect(s.droppedEvents).toBe(26);
    expect(new TextEncoder().encode(JSON.stringify(s)).length).toBeLessThanOrEqual(LIMITS.maxStateBytes);
    expect(auditExport(s).droppedEvents).toBe(26);
  });
  it('rejects malformed stored state', () => {
    expect(isValidStoredState(baselineState())).toBe(true);
    expect(isValidStoredState({ schema: 1 })).toBe(false);
    expect(isValidStoredState(null)).toBe(false);
    expect(isValidStoredState({ ...baselineState(), actions: new Array(LIMITS.maxActions + 1).fill({}) })).toBe(false);
  });
});

describe('weekly cadence and brief', () => {
  it('reports explicit denominators', () => {
    const k = Object.fromEntries(buildBrief(baselineState()).kpis.map((x) => [x.id, x.ratio.display]));
    expect(k).toEqual({ actions_on_time: '3 / 7', overdue_open: '2 / 4', milestones_on_track: '1 / 3', vendor_checks: '7 / 8' });
  });
  it('shows no data rather than 0% when the denominator is zero', () => {
    const r = ratio(0, 0, '');
    expect(r.percent).toBeNull();
    expect(r.display).toBe('— / 0');
  });
  it('holds follow-through below the minimum sample and for unowned actions', () => {
    const f = buildBrief(baselineState()).followThrough;
    expect(f.find((x) => x.owner === 'Sam Kerrigan')!.verdict).toBe('measured');
    expect(f.find((x) => x.owner === 'Jonah Whitlow')!.verdict).toBe('hold');
    expect(f.find((x) => x.ownerId === null)!.verdict).toBe('hold');
  });
  it('counts a late close as a miss and a past-due milestone as late', () => {
    const b = buildBrief(baselineState());
    expect(b.lateActions.map((a) => a.id).sort()).toEqual(['A-02', 'A-04', 'A-05']);
    expect(b.milestones.find((m) => m.id === 'M-01')!.view).toBe('late');
  });
  it('lists unknowns and decision requests', () => {
    const b = buildBrief(baselineState());
    expect(b.unknowns.join(' ')).toMatch(/no owner: A-08/);
    expect(b.unknowns.join(' ')).toMatch(/not measured/);
    expect(b.decisions.map((d) => d.id)).toEqual(['overdue', 'milestone_M-01', 'unassigned']);
  });
  it('requests approval decisions after a material change', () => {
    const s = run(baselineState(), 'update_vendor', { cost: { amountMinor: 245_000, currency: 'GBP', period: 'monthly' } });
    expect(buildBrief(s).decisions.slice(0, 2).map((d) => d.id)).toEqual(['approve_budget_owner', 'approve_finance_lead']);
  });
  it('issues only the reviewed version; board export goes stale on any change', () => {
    let s = baselineState();
    expect(() => boardExport(s)).toThrow(/No brief has been issued/);
    expect(refuse(s, 'issue_brief', { expectedBriefId: 'B-deadbeef00' }).code).toBe('brief_changed');
    s = run(s, 'issue_brief', { expectedBriefId: buildBrief(s).briefId });
    expect(boardExport(s).brief.briefId).toBe(s.briefs[0].briefId);
    s = run(s, 'complete_action', { id: 'A-04', completedOn: '2026-10-16' });
    try { boardExport(s); throw new Error('expected refusal'); } catch (e) { expect((e as CommandError).code).toBe('brief_stale'); }
    expect(summaryMarkdown(s)).toMatch(/DRAFT\. Last issued brief .* is stale/);
  });
  it('brief id is deterministic for the same state', () => {
    expect(buildBrief(baselineState()).briefId).toBe(buildBrief(baselineState()).briefId);
  });
  it('escapes markdown and HTML in the readable summary', () => {
    const s = run(baselineState(), 'update_vendor', { legalName: 'Evil | <script>x</script> Ltd' });
    const md = summaryMarkdown(s);
    expect(md).not.toContain('<script>');
    expect(md).toContain('Evil \\| \\<script\\>');
  });
  it('summary carries the no-payment, no-legal-advice disclaimer', () => {
    expect(summaryMarkdown(baselineState())).toMatch(/no payment is made.*Not legal or financial advice/);
  });
});
