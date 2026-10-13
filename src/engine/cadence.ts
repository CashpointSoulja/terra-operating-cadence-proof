import { canonicalJson, sha256Hex } from './sha256.ts';
import { dayNumber } from './dates.ts';
import { POLICY } from './policy.ts';
import { evaluateGate, formatMoney, personName } from './gate.ts';
import type { GateResult, State } from './types.ts';

export interface Ratio { numerator: number; denominator: number; percent: number | null; display: string; note: string }

export function ratio(numerator: number, denominator: number, note: string): Ratio {
  if (denominator === 0) return { numerator, denominator, percent: null, display: '— / 0', note: 'No data — denominator is 0. ' + note };
  const percent = Math.round((numerator / denominator) * 100);
  return { numerator, denominator, percent, display: `${numerator} / ${denominator}`, note: `${percent}% · n = ${denominator}. ${note}` };
}

export type ActionState = 'done_on_time' | 'done_late' | 'open_overdue' | 'open_due' | 'open_upcoming';

export function actionState(dueOn: string, completedOn: string | null, asOf: string): ActionState {
  const due = dayNumber(dueOn)!, now = dayNumber(asOf)!;
  if (completedOn) return dayNumber(completedOn)! <= due ? 'done_on_time' : 'done_late';
  if (due < now) return 'open_overdue';
  if (due === now) return 'open_due';
  return 'open_upcoming';
}

export type MilestoneView = 'done' | 'late' | 'at_risk' | 'on_track';

export function milestoneView(status: string, dueOn: string, completedOn: string | null, asOf: string): MilestoneView {
  if (status === 'done' && completedOn) return 'done';
  if (dayNumber(dueOn)! < dayNumber(asOf)!) return 'late';
  return status === 'at_risk' ? 'at_risk' : 'on_track';
}

export interface OwnerFollowThrough { ownerId: string | null; owner: string; due: number; onTime: number; late: number; overdueOpen: number; verdict: 'measured' | 'hold'; rate: Ratio }

export interface Brief {
  briefId: string;
  revision: number;
  fingerprint: string;
  weekStart: string;
  weekEnding: string;
  contentHash: string;
  kpis: { id: string; label: string; ratio: Ratio }[];
  milestones: { id: string; title: string; owner: string; dueOn: string; view: MilestoneView }[];
  lateActions: { id: string; title: string; owner: string; dueOn: string; completedOn: string | null; state: ActionState }[];
  followThrough: OwnerFollowThrough[];
  vendor: { name: string; status: string; gate: 'ready' | 'blocked'; checks: string; onboarding: string; blockers: string[] };
  unknowns: string[];
  decisions: { id: string; ask: string; why: string; owner: string }[];
  disclaimer: string;
}

export const DISCLAIMER = 'Synthetic data. Simulated onboarding only: no payment is made and no vendor is contacted. Not legal or financial advice. Independent concept by Ayo Ahmed, not affiliated with Terra Industries.';

export function buildBrief(state: State, gate: GateResult = evaluateGate(state)): Brief {
  const end = dayNumber(state.asOf)!;
  const start = end - (POLICY.briefWindowDays - 1);
  const inWeek = (d: string) => { const n = dayNumber(d)!; return n >= start && n <= end; };
  const acts = state.actions.map((a) => ({ ...a, st: actionState(a.dueOn, a.completedOn, state.asOf) }));
  const dueThisWeek = acts.filter((a) => inWeek(a.dueOn));
  const onTimeThisWeek = dueThisWeek.filter((a) => a.st === 'done_on_time').length;
  const open = acts.filter((a) => !a.completedOn);
  const overdue = open.filter((a) => a.st === 'open_overdue');
  const ms = state.milestones.map((m) => ({ ...m, view: milestoneView(m.status, m.dueOn, m.completedOn, state.asOf) }));
  const openMs = ms.filter((m) => m.view !== 'done');
  const onTrackMs = openMs.filter((m) => m.view === 'on_track').length;

  const kpis = [
    { id: 'actions_on_time', label: 'Actions due this week closed on time', ratio: ratio(onTimeThisWeek, dueThisWeek.length, `Due ${isoOf(start)} to ${state.asOf}; late closes count as misses.`) },
    { id: 'overdue_open', label: 'Open actions that are overdue', ratio: ratio(overdue.length, open.length, 'Lower is better. Denominator is all open actions.') },
    { id: 'milestones_on_track', label: 'Open milestones on track', ratio: ratio(onTrackMs, openMs.length, 'Past-due milestones count as late whatever their flag says.') },
    { id: 'vendor_checks', label: 'Vendor onboarding checks passed', ratio: ratio(gate.passed, gate.total, 'Every critical check must pass; the count alone does not unblock.') },
  ];

  const owners = new Map<string | null, OwnerFollowThrough>();
  for (const a of acts) {
    if (dayNumber(a.dueOn)! > end) continue;
    const key = a.ownerId;
    const row = owners.get(key) ?? { ownerId: key, owner: personName(state, key), due: 0, onTime: 0, late: 0, overdueOpen: 0, verdict: 'hold' as const, rate: ratio(0, 0, '') };
    row.due++;
    if (a.st === 'done_on_time') row.onTime++;
    else if (a.st === 'done_late') row.late++;
    else if (a.st === 'open_overdue') row.overdueOpen++;
    owners.set(key, row);
  }
  const followThrough = [...owners.values()].map((r) => {
    const verdict: 'measured' | 'hold' = r.ownerId && r.due >= POLICY.followThroughMinSample ? 'measured' : 'hold';
    const why = !r.ownerId ? 'No owner, so follow-through cannot be attributed.' : r.due < POLICY.followThroughMinSample ? `Hold: n = ${r.due}, minimum ${POLICY.followThroughMinSample} before reading a rate.` : 'Due to date, on-time closes only.';
    return { ...r, verdict, rate: ratio(r.onTime, r.due, why) };
  }).sort((a, b) => a.owner.localeCompare(b.owner));

  const unknowns: string[] = [];
  const unassigned = acts.filter((a) => !a.ownerId && !a.completedOn);
  if (unassigned.length) unknowns.push(`${unassigned.length} open action(s) have no owner: ${unassigned.map((a) => a.id).join(', ')}.`);
  const holds = followThrough.filter((f) => f.verdict === 'hold' && f.ownerId);
  if (holds.length) unknowns.push(`Follow-through not yet measurable for ${holds.map((h) => h.owner).join(', ')} (fewer than ${POLICY.followThroughMinSample} actions due).`);
  if (!state.vendor.cost) unknowns.push('Vendor cost is unknown.');
  if (state.vendor.agreement && !dayNumber(state.vendor.agreement.expiresOn)) unknowns.push('Agreement expiry date is unknown.');
  if (state.droppedEvents > 0) unknowns.push(`${state.droppedEvents} oldest audit events were dropped by the retention bound; the audit export says so.`);
  unknowns.push('Real spend, savings and cycle-time impact are not measured: every figure here is synthetic.');

  const decisions: Brief['decisions'] = [];
  const v = state.vendor;
  const stale = gate.blockers.filter((b) => b.code === 'approval_stale');
  const missing = gate.blockers.filter((b) => b.code === 'approval_missing');
  const costText = v.cost ? `${formatMoney(v.cost.amountMinor, v.cost.currency)} ${v.cost.period}` : 'an unknown cost';
  if (stale.length || missing.length) {
    for (const role of gate.requiredRoles) {
      const b = gate.blockers.find((x) => x.field === `approvals.${role}` && (x.code === 'approval_stale' || x.code === 'approval_missing'));
      if (!b) continue;
      const approver = state.people.find((p) => p.canApprove.includes(role));
      decisions.push({ id: `approve_${role}`, ask: `Approve ${v.legalName} at ${costText}?`, why: b.message, owner: approver ? approver.name : 'Unassigned' });
    }
  }
  if (gate.blockers.some((b) => b.code === 'agreement_expired' || b.code === 'agreement_missing' || b.code === 'agreement_unsigned')) decisions.push({ id: 'agreement', ask: `Re-paper the ${v.legalName} agreement before any onboarding?`, why: 'No current signed agreement is on file.', owner: personName(state, v.ownerId) });
  if (overdue.length) decisions.push({ id: 'overdue', ask: `Re-date or reassign ${overdue.length} overdue action(s)?`, why: overdue.map((a) => `${a.id} ${a.title} (${personName(state, a.ownerId)}, due ${a.dueOn})`).join('; '), owner: 'Leadership meeting' });
  for (const m of openMs.filter((x) => x.view === 'late')) decisions.push({ id: `milestone_${m.id}`, ask: `Accept a new date for "${m.title}"?`, why: `Due ${m.dueOn}, not marked done.`, owner: personName(state, m.ownerId) });
  if (unassigned.length) decisions.push({ id: 'unassigned', ask: 'Name an owner for unassigned actions?', why: unassigned.map((a) => `${a.id} ${a.title}`).join('; '), owner: 'Leadership meeting' });

  const onboardingText = state.onboarding.status === 'onboarded' ? `Onboarded (simulated) · receipt ${state.onboarding.receiptId}` : state.onboarding.status === 'invalidated' ? `Onboarding invalidated: ${state.onboarding.invalidatedReason}` : 'Not onboarded';
  const body = {
    fingerprint: gate.fingerprint, weekStart: isoOf(start), weekEnding: state.asOf,
    kpis, milestones: ms.map((m) => ({ id: m.id, title: m.title, owner: personName(state, m.ownerId), dueOn: m.dueOn, view: m.view })),
    lateActions: acts.filter((a) => a.st === 'done_late' || a.st === 'open_overdue').map((a) => ({ id: a.id, title: a.title, owner: personName(state, a.ownerId), dueOn: a.dueOn, completedOn: a.completedOn, state: a.st })),
    followThrough,
    vendor: { name: v.legalName, status: state.onboarding.status, gate: gate.status, checks: `${gate.passed} / ${gate.total}`, onboarding: onboardingText, blockers: gate.blockers.map((b) => b.code) },
    unknowns, decisions, disclaimer: DISCLAIMER,
  };
  // The id covers content only, so issuing a brief (which bumps the revision) does not make it stale by itself.
  const contentHash = sha256Hex(canonicalJson(body));
  return { briefId: `B-${contentHash.slice(0, 10)}`, contentHash, revision: state.revision, ...body };
}

function isoOf(day: number): string { return new Date(day * 86400000).toISOString().slice(0, 10); }
