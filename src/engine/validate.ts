import { dayNumber } from './dates.ts';
import { LIMITS } from './policy.ts';
import { SCHEMA_VERSION } from './types.ts';
import type { State } from './types.ts';

/** Cheap structural check on state loaded from storage; anything unexpected is discarded rather than trusted. */
export function isValidStoredState(s: unknown): s is State {
  if (typeof s !== 'object' || s === null) return false;
  const o = s as Partial<State>;
  return o.schema === SCHEMA_VERSION
    && Number.isSafeInteger(o.revision) && (o.revision as number) >= 1
    && dayNumber(o.asOf) !== null
    && Array.isArray(o.people) && Array.isArray(o.milestones) && Array.isArray(o.actions) && Array.isArray(o.events) && Array.isArray(o.briefs)
    && o.milestones.length <= LIMITS.maxMilestones && o.actions.length <= LIMITS.maxActions && o.events.length <= LIMITS.maxEvents
    && typeof o.vendor === 'object' && o.vendor !== null && Array.isArray(o.vendor.checklist) && Array.isArray(o.vendor.approvals)
    && typeof o.onboarding === 'object' && o.onboarding !== null;
}
