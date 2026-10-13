export { baselineState } from './seed.ts';
export { applyCommand, CommandError, COMMAND_TYPES } from './commands.ts';
export { evaluateGate, materialFingerprint, requiredRoles, formatMoney, personName } from './gate.ts';
export { buildBrief, ratio, actionState, milestoneView, DISCLAIMER } from './cadence.ts';
export { auditExport, boardExport, summaryMarkdown, currentBriefStatus, stateHash } from './exports.ts';
export { isValidStoredState } from './validate.ts';
export { LIMITS, POLICY } from './policy.ts';
export type { State } from './types.ts';

import { evaluateGate, personName } from './gate.ts';
import { actionState, milestoneView } from './cadence.ts';
import { currentBriefStatus } from './exports.ts';
import type { State } from './types.ts';

/** Everything the UI renders, derived on the server from one revision. */
export function viewModel(state: State) {
  const gate = evaluateGate(state);
  const brief = currentBriefStatus(state);
  return {
    revision: state.revision,
    asOf: state.asOf,
    workspaceLabel: state.workspaceLabel,
    people: state.people,
    vendor: { ...state.vendor, ownerName: personName(state, state.vendor.ownerId), approvals: state.vendor.approvals.map((a) => ({ ...a, approverName: personName(state, a.approverId), current: a.fingerprint === gate.fingerprint })) },
    gate,
    onboarding: state.onboarding,
    milestones: state.milestones.map((m) => ({ ...m, ownerName: personName(state, m.ownerId), view: milestoneView(m.status, m.dueOn, m.completedOn, state.asOf) })),
    actions: state.actions.map((a) => ({ ...a, ownerName: personName(state, a.ownerId), state: actionState(a.dueOn, a.completedOn, state.asOf) })),
    brief: brief.brief,
    briefIssued: brief.issued,
    briefStale: brief.stale,
    latestIssuedBriefId: brief.latestIssuedId,
    events: state.events.slice(-12).reverse(),
    droppedEvents: state.droppedEvents,
  };
}
