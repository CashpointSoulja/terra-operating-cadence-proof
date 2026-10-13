import { canonicalJson, sha256Hex } from './sha256.ts';
import { buildBrief, DISCLAIMER } from './cadence.ts';
import { evaluateGate, formatMoney, personName } from './gate.ts';
import { CommandError } from './commands.ts';
import type { Brief } from './cadence.ts';
import type { State } from './types.ts';

export function stateHash(state: State): string { return sha256Hex(canonicalJson(state)); }

export function currentBriefStatus(state: State): { brief: Brief; issued: boolean; latestIssuedId: string | null; stale: boolean } {
  const brief = buildBrief(state);
  const latest = state.briefs[state.briefs.length - 1] ?? null;
  const issued = latest !== null && latest.briefId === brief.briefId;
  return { brief, issued, latestIssuedId: latest?.briefId ?? null, stale: latest !== null && !issued };
}

export function auditExport(state: State) {
  const gate = evaluateGate(state);
  return {
    kind: 'operating-cadence-proof.audit',
    schema: 1,
    revision: state.revision,
    asOf: state.asOf,
    stateHash: stateHash(state),
    vendorFingerprint: gate.fingerprint,
    gate: { status: gate.status, passed: gate.passed, total: gate.total, blockers: gate.blockers, warnings: gate.warnings, requiredRoles: gate.requiredRoles },
    onboarding: state.onboarding,
    approvals: state.vendor.approvals.map((a) => ({ ...a, approver: personName(state, a.approverId), current: a.fingerprint === gate.fingerprint })),
    briefsIssued: state.briefs,
    events: state.events,
    eventsRetained: state.events.length,
    droppedEvents: state.droppedEvents,
    disclaimer: DISCLAIMER,
  };
}

/** Board material is only exported for an issued brief that matches the current state. */
export function boardExport(state: State) {
  const { brief, issued, latestIssuedId } = currentBriefStatus(state);
  if (!issued) {
    throw new CommandError(409, latestIssuedId ? 'brief_stale' : 'brief_not_issued', latestIssuedId
      ? `Brief ${latestIssuedId} no longer matches the workspace (now ${brief.briefId}). Review and issue the current brief before exporting board material.`
      : 'No brief has been issued for the current version. Review and issue it first.', { currentBriefId: brief.briefId, latestIssuedId });
  }
  return { kind: 'operating-cadence-proof.board-material', schema: 1, revision: state.revision, stateHash: stateHash(state), brief };
}

const md = (s: string) => s.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ').replace(/([*_`#<>\[\]])/g, '\\$1');

export function summaryMarkdown(state: State): string {
  const { brief, issued, latestIssuedId } = currentBriefStatus(state);
  const gate = evaluateGate(state);
  const v = state.vendor;
  const lines: string[] = [];
  lines.push(`# Weekly operating brief — week ending ${brief.weekEnding}`, '');
  lines.push(`Version ${brief.briefId} · revision ${state.revision} · vendor fingerprint ${gate.fingerprint.slice(0, 12)}`);
  lines.push(issued ? 'Status: issued, current.' : latestIssuedId ? `Status: DRAFT. Last issued brief ${latestIssuedId} is stale.` : 'Status: DRAFT, not yet issued.', '');
  lines.push('## KPIs (numerator / denominator)', '', '| KPI | Value | Note |', '|---|---|---|');
  for (const k of brief.kpis) lines.push(`| ${md(k.label)} | ${md(k.ratio.display)} | ${md(k.ratio.note)} |`);
  lines.push('', '## Vendor onboarding', '');
  lines.push(`- ${md(v.legalName)} (${md(v.id)}), owner ${md(personName(state, v.ownerId))}`);
  lines.push(`- Cost: ${v.cost ? md(formatMoney(v.cost.amountMinor, v.cost.currency) + ' ' + v.cost.period) : 'unknown'}`);
  lines.push(`- Gate: ${gate.status.toUpperCase()} · ${gate.passed} / ${gate.total} checks · ${md(brief.vendor.onboarding)}`);
  for (const b of gate.blockers) lines.push(`  - BLOCKER ${b.code}: ${md(b.message)}`);
  lines.push('', '## Milestones', '', '| Milestone | Owner | Due | Status |', '|---|---|---|---|');
  for (const m of brief.milestones) lines.push(`| ${md(m.title)} | ${md(m.owner)} | ${m.dueOn} | ${m.view.replace('_', ' ')} |`);
  lines.push('', '## Late actions', '');
  if (!brief.lateActions.length) lines.push('- None');
  for (const a of brief.lateActions) lines.push(`- ${a.id} ${md(a.title)} — ${md(a.owner)}, due ${a.dueOn}, ${a.state === 'done_late' ? 'closed late ' + a.completedOn : 'still open'}`);
  lines.push('', '## Owner follow-through (actions due to date)', '', '| Owner | Due | On time | Late | Overdue open | Reading |', '|---|---|---|---|---|---|');
  for (const f of brief.followThrough) lines.push(`| ${md(f.owner)} | ${f.due} | ${f.onTime} | ${f.late} | ${f.overdueOpen} | ${f.verdict === 'hold' ? 'HOLD' : md(f.rate.display)} |`);
  lines.push('', '## Unknowns', '');
  for (const u of brief.unknowns) lines.push(`- ${md(u)}`);
  lines.push('', '## Decisions requested', '');
  if (!brief.decisions.length) lines.push('- None this week');
  for (const d of brief.decisions) lines.push(`- **${md(d.ask)}** (${md(d.owner)}) — ${md(d.why)}`);
  lines.push('', '---', '', DISCLAIMER, '');
  return lines.join('\n');
}
