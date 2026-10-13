import { dayNumber } from './dates.ts';
import { LIMITS, POLICY } from './policy.ts';
import { evaluateGate, formatMoney, materialFingerprint, personName } from './gate.ts';
import { buildBrief } from './cadence.ts';
import { baselineState } from './seed.ts';
import { APPROVAL_ROLES, COST_PERIODS, CURRENCIES, MILESTONE_STATUSES, SERVICE_CATEGORIES } from './types.ts';
import type { ApprovalRole, State } from './types.ts';

export class CommandError extends Error {
  status: number;
  code: string;
  details: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status; this.code = code; this.details = details;
  }
}

const bad = (code: string, message: string, details?: unknown) => new CommandError(400, code, message, details);

type Obj = Record<string, unknown>;

function isPlainObject(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
}

function exactKeys(o: unknown, required: string[], optional: string[], where: string): Obj {
  if (!isPlainObject(o)) throw bad('invalid_shape', `${where} must be a JSON object.`);
  for (const k of Object.keys(o)) if (!required.includes(k) && !optional.includes(k)) throw bad('unknown_field', `${where}.${k} is not an accepted field.`);
  for (const k of required) if (!(k in o)) throw bad('missing_field', `${where}.${k} is required.`);
  return o;
}

function str(v: unknown, field: string, max: number, opts: { nullable?: boolean } = {}): string | null {
  if (v === null && opts.nullable) return null;
  if (typeof v !== 'string') throw bad('invalid_type', `${field} must be a string.`);
  const t = v.trim();
  if (!t) throw bad('empty_value', `${field} cannot be empty.`);
  if (t.length > max) throw bad('too_long', `${field} is longer than ${max} characters.`);
  if (/[\u0000-\u001f\u007f]/.test(t)) throw bad('control_characters', `${field} contains control characters.`);
  return t;
}

function date(v: unknown, field: string, opts: { nullable?: boolean } = {}): string | null {
  if (v === null && opts.nullable) return null;
  if (dayNumber(v) === null) throw bad('invalid_date', `${field} must be a real calendar date in YYYY-MM-DD form.`);
  return v as string;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], field: string): T {
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) throw bad('invalid_enum', `${field} must be one of: ${allowed.join(', ')}.`);
  return v as T;
}

function int(v: unknown, field: string, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < min || v > max) throw bad('invalid_number', `${field} must be a whole number from ${min} to ${max}.`);
  return v;
}

function person(state: State, v: unknown, field: string, nullable = false): string | null {
  if (v === null && nullable) return null;
  if (typeof v !== 'string' || !state.people.some((p) => p.id === v)) throw bad('unknown_person', `${field} must be a person on the roster.`);
  return v;
}

function notAfterAsOf(state: State, d: string, field: string) {
  if (dayNumber(d)! > dayNumber(state.asOf)!) throw bad('future_date', `${field} is after the reporting date ${state.asOf}.`);
}

export const COMMAND_TYPES = ['reset', 'set_as_of', 'update_vendor', 'record_approval', 'revoke_approval', 'set_checklist', 'onboard', 'add_action', 'complete_action', 'reopen_action', 'set_milestone', 'issue_brief'] as const;
export type CommandType = (typeof COMMAND_TYPES)[number];

export interface CommandResult { state: State; summary: string; replay: boolean }

/** Validates the whole envelope, applies it to a copy, and returns the new state. Never mutates the input. */
export function applyCommand(current: State, envelope: unknown): CommandResult {
  const env = exactKeys(envelope, ['type', 'expectedRevision', 'payload'], [], 'command');
  const type = oneOf(env.type, COMMAND_TYPES, 'command.type');
  const expected = int(env.expectedRevision, 'command.expectedRevision', 0, Number.MAX_SAFE_INTEGER);
  if (expected !== current.revision) throw new CommandError(409, 'revision_conflict', `This view is at revision ${expected} but the workspace is at revision ${current.revision}. Reload and try again.`, { currentRevision: current.revision });
  const p = env.payload;
  const s: State = structuredClone(current);
  const fpBefore = materialFingerprint(s.vendor);
  let summary = '';
  let replay = false;

  switch (type) {
    case 'reset': {
      const o = exactKeys(p, ['scenario'], [], 'payload');
      oneOf(o.scenario, ['baseline'] as const, 'payload.scenario');
      const fresh = baselineState();
      fresh.revision = current.revision + 1;
      fresh.events = current.events;
      fresh.droppedEvents = current.droppedEvents;
      fresh.nextSeq = current.nextSeq;
      Object.assign(s, fresh);
      summary = 'Workspace reset to the synthetic baseline';
      break;
    }
    case 'set_as_of': {
      const o = exactKeys(p, ['asOf'], [], 'payload');
      const d = date(o.asOf, 'payload.asOf')!;
      const n = dayNumber(d)!;
      if (n < dayNumber('2026-09-01')! || n > dayNumber('2027-12-31')!) throw bad('out_of_range', 'payload.asOf must fall between 2026-09-01 and 2027-12-31.');
      summary = `Reporting date moved from ${s.asOf} to ${d}`;
      s.asOf = d;
      break;
    }
    case 'update_vendor': {
      const o = exactKeys(p, [], ['legalName', 'serviceCategory', 'scope', 'ownerId', 'cost', 'agreement'], 'payload');
      if (Object.keys(o).length === 0) throw bad('empty_patch', 'payload must change at least one field.');
      const v = s.vendor;
      const changes: string[] = [];
      if ('legalName' in o) { v.legalName = str(o.legalName, 'payload.legalName', LIMITS.maxName)!; changes.push('legal name'); }
      if ('serviceCategory' in o) { v.serviceCategory = oneOf(o.serviceCategory, SERVICE_CATEGORIES, 'payload.serviceCategory'); changes.push('service category'); }
      if ('scope' in o) { v.scope = str(o.scope, 'payload.scope', LIMITS.maxScope)!; changes.push('scope'); }
      if ('ownerId' in o) { v.ownerId = person(s, o.ownerId, 'payload.ownerId', true); changes.push(`owner → ${personName(s, v.ownerId)}`); }
      if ('cost' in o) {
        if (o.cost === null) v.cost = null;
        else {
          const c = exactKeys(o.cost, ['amountMinor', 'currency', 'period'], [], 'payload.cost');
          v.cost = { amountMinor: int(c.amountMinor, 'payload.cost.amountMinor', 1, POLICY.maxCostAmountMinor), currency: oneOf(c.currency, CURRENCIES, 'payload.cost.currency'), period: oneOf(c.period, COST_PERIODS, 'payload.cost.period') };
        }
        changes.push(v.cost ? `cost → ${formatMoney(v.cost.amountMinor, v.cost.currency)} ${v.cost.period}` : 'cost cleared');
      }
      if ('agreement' in o) {
        if (o.agreement === null) v.agreement = null;
        else {
          const a = exactKeys(o.agreement, ['docRef', 'version', 'signedOn', 'expiresOn', 'signedBy'], [], 'payload.agreement');
          const docRef = str(a.docRef, 'payload.agreement.docRef', LIMITS.maxDocRef)!;
          if (!/^[A-Z0-9][A-Z0-9-]*$/.test(docRef)) throw bad('invalid_doc_ref', 'payload.agreement.docRef may contain only capital letters, digits and hyphens.');
          v.agreement = { docRef, version: int(a.version, 'payload.agreement.version', 1, 99), signedOn: date(a.signedOn, 'payload.agreement.signedOn', { nullable: true }), expiresOn: date(a.expiresOn, 'payload.agreement.expiresOn', { nullable: true }), signedBy: person(s, a.signedBy, 'payload.agreement.signedBy', true) };
        }
        changes.push(v.agreement ? `agreement → ${v.agreement.docRef} v${v.agreement.version}` : 'agreement removed');
      }
      summary = 'Vendor record changed: ' + changes.join('; ');
      break;
    }
    case 'record_approval': {
      const o = exactKeys(p, ['role', 'approverId', 'approvedOn', 'expectedFingerprint'], [], 'payload');
      const role = oneOf(o.role, APPROVAL_ROLES, 'payload.role') as ApprovalRole;
      const approverId = person(s, o.approverId, 'payload.approverId')!;
      const approvedOn = date(o.approvedOn, 'payload.approvedOn')!;
      notAfterAsOf(s, approvedOn, 'payload.approvedOn');
      const fp = materialFingerprint(s.vendor);
      if (o.expectedFingerprint !== fp) throw new CommandError(409, 'fingerprint_mismatch', 'The vendor record changed since you viewed it. Review the current record before approving.', { currentFingerprint: fp });
      const approver = s.people.find((x) => x.id === approverId)!;
      if (!approver.canApprove.includes(role)) throw bad('approver_not_authorised', `${approver.name} cannot give ${role.replace('_', ' ')} approval.`);
      if (approverId === s.vendor.ownerId) throw bad('approver_is_owner', 'The accountable owner cannot approve their own vendor.');
      if (!s.vendor.cost) throw bad('cost_missing', 'Enter a cost before approving.');
      s.vendor.approvals = s.vendor.approvals.filter((a) => a.role !== role);
      s.vendor.approvals.push({ role, approverId, approvedOn, fingerprint: fp, amountMinor: s.vendor.cost.amountMinor, currency: s.vendor.cost.currency, period: s.vendor.cost.period });
      summary = `${approver.name} gave ${role.replace('_', ' ')} approval for ${formatMoney(s.vendor.cost.amountMinor, s.vendor.cost.currency)} ${s.vendor.cost.period} (fp ${fp.slice(0, 8)})`;
      break;
    }
    case 'revoke_approval': {
      const o = exactKeys(p, ['role'], [], 'payload');
      const role = oneOf(o.role, APPROVAL_ROLES, 'payload.role');
      if (!s.vendor.approvals.some((a) => a.role === role)) throw bad('no_approval', `There is no ${role.replace('_', ' ')} approval to revoke.`);
      s.vendor.approvals = s.vendor.approvals.filter((a) => a.role !== role);
      summary = `${role.replace('_', ' ')} approval revoked`;
      break;
    }
    case 'set_checklist': {
      const o = exactKeys(p, ['itemId', 'done'], ['doneOn'], 'payload');
      const item = s.vendor.checklist.find((i) => i.id === o.itemId);
      if (!item) throw bad('unknown_item', 'payload.itemId is not on the checklist.');
      if (typeof o.done !== 'boolean') throw bad('invalid_type', 'payload.done must be true or false.');
      if (o.done) {
        const d = date(o.doneOn, 'payload.doneOn')!;
        notAfterAsOf(s, d, 'payload.doneOn');
        item.done = true; item.doneOn = d;
      } else {
        if ('doneOn' in o && o.doneOn !== null) throw bad('invalid_combination', 'payload.doneOn must be null when un-ticking.');
        item.done = false; item.doneOn = null;
      }
      summary = `Checklist: "${item.label}" ${item.done ? 'done ' + item.doneOn : 'reopened'}`;
      break;
    }
    case 'onboard': {
      const o = exactKeys(p, ['expectedFingerprint'], [], 'payload');
      const gate = evaluateGate(s);
      if (o.expectedFingerprint !== gate.fingerprint) throw new CommandError(409, 'fingerprint_mismatch', 'The vendor record changed since you viewed it.', { currentFingerprint: gate.fingerprint });
      if (s.onboarding.status === 'onboarded' && s.onboarding.fingerprint === gate.fingerprint) { replay = true; summary = `Onboarding already recorded as ${s.onboarding.receiptId}; nothing repeated`; break; }
      if (gate.status !== 'ready') throw new CommandError(422, 'gate_blocked', 'Onboarding is blocked. Clear every blocker first.', { blockers: gate.blockers });
      const receiptId = `SIM-ONB-${String(s.nextId++).padStart(4, '0')}`;
      s.onboarding = { status: 'onboarded', receiptId, onboardedOn: s.asOf, fingerprint: gate.fingerprint, invalidatedReason: null, history: [...s.onboarding.history, { receiptId, onboardedOn: s.asOf, fingerprint: gate.fingerprint, endedReason: null }] };
      summary = `Simulated onboarding recorded as ${receiptId} (no payment, no vendor contact)`;
      break;
    }
    case 'add_action': {
      const o = exactKeys(p, ['title', 'ownerId', 'dueOn'], ['milestoneId'], 'payload');
      if (s.actions.length >= LIMITS.maxActions) throw new CommandError(422, 'limit_reached', `This workspace holds at most ${LIMITS.maxActions} actions.`);
      const title = str(o.title, 'payload.title', LIMITS.maxTitle)!;
      const ownerId = person(s, o.ownerId, 'payload.ownerId', true);
      const dueOn = date(o.dueOn, 'payload.dueOn')!;
      let milestoneId: string | null = null;
      if ('milestoneId' in o && o.milestoneId !== null) {
        if (!s.milestones.some((m) => m.id === o.milestoneId)) throw bad('unknown_milestone', 'payload.milestoneId does not exist.');
        milestoneId = o.milestoneId as string;
      }
      if (s.actions.some((a) => a.title.toLowerCase() === title.toLowerCase() && !a.completedOn)) throw bad('duplicate_action', 'An open action with this title already exists.');
      const id = `A-${s.nextId++}`;
      s.actions.push({ id, title, ownerId, dueOn, milestoneId, completedOn: null });
      summary = `Action ${id} added for ${personName(s, ownerId)}, due ${dueOn}`;
      break;
    }
    case 'complete_action': {
      const o = exactKeys(p, ['id', 'completedOn'], [], 'payload');
      const a = s.actions.find((x) => x.id === o.id);
      if (!a) throw bad('unknown_action', 'payload.id does not exist.');
      if (a.completedOn) throw bad('already_done', `${a.id} is already closed.`);
      const d = date(o.completedOn, 'payload.completedOn')!;
      notAfterAsOf(s, d, 'payload.completedOn');
      a.completedOn = d;
      summary = `${a.id} closed ${d} (${dayNumber(d)! <= dayNumber(a.dueOn)! ? 'on time' : 'late'})`;
      break;
    }
    case 'reopen_action': {
      const o = exactKeys(p, ['id'], [], 'payload');
      const a = s.actions.find((x) => x.id === o.id);
      if (!a) throw bad('unknown_action', 'payload.id does not exist.');
      if (!a.completedOn) throw bad('not_done', `${a.id} is not closed.`);
      a.completedOn = null;
      summary = `${a.id} reopened`;
      break;
    }
    case 'set_milestone': {
      const o = exactKeys(p, ['id', 'status'], ['completedOn', 'dueOn'], 'payload');
      const m = s.milestones.find((x) => x.id === o.id);
      if (!m) throw bad('unknown_milestone', 'payload.id does not exist.');
      const status = oneOf(o.status, MILESTONE_STATUSES, 'payload.status');
      if (status === 'done') {
        const d = date(o.completedOn, 'payload.completedOn')!;
        notAfterAsOf(s, d, 'payload.completedOn');
        m.completedOn = d;
      } else {
        if ('completedOn' in o && o.completedOn !== null) throw bad('invalid_combination', 'payload.completedOn is only allowed when status is done.');
        m.completedOn = null;
      }
      if ('dueOn' in o) m.dueOn = date(o.dueOn, 'payload.dueOn')!;
      m.status = status;
      summary = `Milestone ${m.id} set to ${status.replace('_', ' ')}${'dueOn' in o ? `, due ${m.dueOn}` : ''}`;
      break;
    }
    case 'issue_brief': {
      const o = exactKeys(p, ['expectedBriefId'], [], 'payload');
      const brief = buildBrief(s);
      if (o.expectedBriefId !== brief.briefId) throw new CommandError(409, 'brief_changed', 'The brief you reviewed is not the current version. Review it again before issuing.', { currentBriefId: brief.briefId });
      if (s.briefs[s.briefs.length - 1]?.briefId === brief.briefId) { replay = true; summary = `Brief ${brief.briefId} already issued`; break; }
      s.briefs.push({ briefId: brief.briefId, revision: s.revision, contentHash: brief.contentHash, weekEnding: s.asOf, issuedAtRevision: s.revision + 1 });
      if (s.briefs.length > LIMITS.maxBriefs) s.briefs.splice(0, s.briefs.length - LIMITS.maxBriefs);
      summary = `Weekly brief ${brief.briefId} issued for week ending ${s.asOf}`;
      break;
    }
  }

  if (replay) return { state: current, summary, replay: true };

  const fpAfter = materialFingerprint(s.vendor);
  if (type !== 'reset' && s.onboarding.status === 'onboarded' && fpAfter !== s.onboarding.fingerprint) {
    s.onboarding.status = 'invalidated';
    s.onboarding.invalidatedReason = 'A material input changed after onboarding; prior approvals no longer cover the record.';
    const last = s.onboarding.history[s.onboarding.history.length - 1];
    if (last) last.endedReason = 'material_change';
    summary += ' · prior onboarding invalidated';
  }

  s.revision = current.revision + 1;
  s.events.push({ seq: s.nextSeq++, revision: s.revision, asOf: s.asOf, type, summary, fingerprintBefore: fpBefore, fingerprintAfter: fpAfter });
  if (s.events.length > LIMITS.maxEvents) {
    const drop = s.events.length - LIMITS.maxEvents;
    s.events.splice(0, drop);
    s.droppedEvents += drop;
  }
  const bytes = new TextEncoder().encode(JSON.stringify(s)).length;
  if (bytes > LIMITS.maxStateBytes) throw new CommandError(422, 'state_too_large', `Workspace would exceed ${LIMITS.maxStateBytes} bytes.`);
  return { state: s, summary, replay: false };
}
