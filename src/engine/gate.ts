import { canonicalJson, sha256Hex } from './sha256.ts';
import { dayNumber } from './dates.ts';
import { POLICY } from './policy.ts';
import type { ApprovalRole, Check, Cost, GateResult, Reason, State, Vendor } from './types.ts';

/** Fingerprint of the inputs an approval is given for. Any change invalidates approvals. */
export function materialFingerprint(v: Vendor): string {
  return sha256Hex(canonicalJson({
    id: v.id,
    legalName: v.legalName,
    serviceCategory: v.serviceCategory,
    scope: v.scope,
    ownerId: v.ownerId,
    cost: v.cost,
    agreement: v.agreement ? { docRef: v.agreement.docRef, version: v.agreement.version } : null,
  }));
}

export function annualise(cost: Cost | null): number | null {
  if (!cost) return null;
  return cost.period === 'monthly' ? cost.amountMinor * 12 : cost.amountMinor;
}

export function requiredRoles(cost: Cost | null): ApprovalRole[] {
  const annual = annualise(cost);
  const roles: ApprovalRole[] = ['budget_owner'];
  if (annual === null || annual > POLICY.financeLeadThresholdAnnualMinor) roles.push('finance_lead');
  return roles;
}

export function formatMoney(amountMinor: number, currency: string): string {
  const sym = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency + ' ';
  const whole = Math.floor(amountMinor / 100);
  const pence = amountMinor % 100;
  return sym + whole.toLocaleString('en-GB') + (pence ? '.' + String(pence).padStart(2, '0') : '');
}

export function personName(state: State, id: string | null): string {
  if (!id) return 'Unassigned';
  return state.people.find((p) => p.id === id)?.name ?? 'Unknown person';
}

export function evaluateGate(state: State): GateResult {
  const v = state.vendor;
  const asOf = dayNumber(state.asOf);
  const fp = materialFingerprint(v);
  const blockers: Reason[] = [];
  const warnings: Reason[] = [];
  const checks: Check[] = [];
  const add = (id: string, label: string, failures: Reason[], critical = true) => {
    checks.push({ id, label, passed: failures.length === 0, critical });
    blockers.push(...failures);
  };

  if (asOf === null) blockers.push({ code: 'as_of_invalid', message: 'The reporting date is not a valid calendar date.', field: 'asOf' });

  // Accountable owner
  const owner = v.ownerId ? state.people.find((p) => p.id === v.ownerId) : undefined;
  add('owner', 'Accountable owner named', !v.ownerId
    ? [{ code: 'owner_missing', message: 'No accountable owner is named for this vendor.', field: 'vendor.ownerId' }]
    : !owner ? [{ code: 'owner_unknown', message: 'The named owner is not on the people roster.', field: 'vendor.ownerId' }] : []);

  // Approved cost and currency
  const costFail: Reason[] = [];
  if (!v.cost) costFail.push({ code: 'cost_missing', message: 'No cost has been entered, so nothing can be approved.', field: 'vendor.cost' });
  else {
    if (!Number.isSafeInteger(v.cost.amountMinor) || v.cost.amountMinor <= 0) costFail.push({ code: 'cost_invalid', message: 'Cost must be a positive whole number of pence.', field: 'vendor.cost.amountMinor' });
    if (v.cost.currency !== POLICY.homeCurrency) costFail.push({ code: 'currency_not_home', message: `Office vendors are approved in ${POLICY.homeCurrency}; this record is in ${v.cost.currency}. Convert and re-approve, or escalate.`, field: 'vendor.cost.currency' });
  }
  add('cost', 'Cost entered in GBP', costFail);

  // Agreement evidence
  const ag = v.agreement;
  const agFail: Reason[] = [];
  if (!ag) agFail.push({ code: 'agreement_missing', message: 'No signed agreement is on file.', field: 'vendor.agreement' });
  else {
    const signed = dayNumber(ag.signedOn);
    const expires = dayNumber(ag.expiresOn);
    if (signed === null) agFail.push({ code: 'agreement_unsigned', message: `Agreement ${ag.docRef} v${ag.version} has no valid signature date.`, field: 'vendor.agreement.signedOn' });
    if (!ag.signedBy || !state.people.some((p) => p.id === ag.signedBy)) agFail.push({ code: 'agreement_signatory_unknown', message: 'The agreement signatory is missing or not on the roster.', field: 'vendor.agreement.signedBy' });
    if (expires === null) agFail.push({ code: 'agreement_expiry_unknown', message: 'The agreement has no valid expiry date, so it cannot be shown to be current.', field: 'vendor.agreement.expiresOn' });
    if (asOf !== null && signed !== null && signed > asOf) agFail.push({ code: 'agreement_future_signed', message: 'The signature date is after the reporting date.', field: 'vendor.agreement.signedOn' });
    if (signed !== null && expires !== null && expires <= signed) agFail.push({ code: 'agreement_dates_inverted', message: 'The agreement expires on or before the day it was signed.', field: 'vendor.agreement.expiresOn' });
    if (asOf !== null && expires !== null && expires < asOf) agFail.push({ code: 'agreement_expired', message: `Agreement ${ag.docRef} expired on ${ag.expiresOn}.`, field: 'vendor.agreement.expiresOn' });
    else if (asOf !== null && expires !== null && expires - asOf <= POLICY.agreementExpiryWarningDays) warnings.push({ code: 'agreement_expiring', message: `Agreement expires within ${POLICY.agreementExpiryWarningDays} days (${ag.expiresOn}).`, field: 'vendor.agreement.expiresOn' });
  }
  add('agreement', 'Current signed agreement on file', agFail);

  // Approvals, each bound to the material fingerprint
  const roles = requiredRoles(v.cost);
  for (const role of roles) {
    const fails: Reason[] = [];
    const ap = v.approvals.find((a) => a.role === role);
    const label = role === 'budget_owner' ? 'Budget owner approval' : 'Finance lead approval';
    if (!ap) fails.push({ code: 'approval_missing', message: `${label} is required and has not been given.` + (role === 'finance_lead' ? ' Annualised cost is above £25,000 or unknown.' : ''), field: `approvals.${role}` });
    else {
      const approver = state.people.find((p) => p.id === ap.approverId);
      const day = dayNumber(ap.approvedOn);
      if (!approver || !approver.canApprove.includes(role)) fails.push({ code: 'approver_not_authorised', message: `${personName(state, ap.approverId)} cannot give ${label.toLowerCase()}.`, field: `approvals.${role}` });
      if (ap.approverId === v.ownerId) fails.push({ code: 'approver_is_owner', message: 'The accountable owner cannot approve their own vendor.', field: `approvals.${role}` });
      if (ap.fingerprint !== fp) fails.push({ code: 'approval_stale', message: `${label} was given for a different version of this vendor (${formatMoney(ap.amountMinor, ap.currency)} ${ap.period}). It no longer covers the current record.`, field: `approvals.${role}` });
      if (day === null) fails.push({ code: 'approval_date_invalid', message: `${label} has no valid date.`, field: `approvals.${role}` });
      else if (asOf !== null && day > asOf) fails.push({ code: 'approval_future_dated', message: `${label} is dated after the reporting date.`, field: `approvals.${role}` });
      else if (asOf !== null && asOf - day > POLICY.approvalMaxAgeDays) fails.push({ code: 'approval_expired', message: `${label} is older than ${POLICY.approvalMaxAgeDays} days.`, field: `approvals.${role}` });
    }
    add(`approval_${role}`, label + ' current', fails);
  }

  // Onboarding checklist: every critical item must be done, regardless of the overall count.
  for (const item of v.checklist) {
    const fails: Reason[] = [];
    const day = item.done ? dayNumber(item.doneOn) : null;
    if (item.done && (day === null || (asOf !== null && day > asOf))) fails.push({ code: 'checklist_date_invalid', message: `"${item.label}" is ticked with a missing or future date.`, field: `checklist.${item.id}` });
    if (!item.done && item.critical) fails.push({ code: 'checklist_critical_open', message: `Critical step not done: ${item.label}.`, field: `checklist.${item.id}` });
    if (!item.done && !item.critical) warnings.push({ code: 'checklist_open', message: `Non-critical step still open: ${item.label}.`, field: `checklist.${item.id}` });
    if (item.critical || fails.length) add(`checklist_${item.id}`, item.label, fails, item.critical);
  }
  if (!v.checklist.some((i) => i.critical)) blockers.push({ code: 'checklist_no_critical', message: 'The checklist has no critical items; refusing to treat an empty gate as passed.', field: 'checklist' });

  const passed = checks.filter((c) => c.passed).length;
  return { status: blockers.length === 0 && checks.length > 0 ? 'ready' : 'blocked', fingerprint: fp, checks, passed, total: checks.length, blockers, warnings, requiredRoles: roles, annualisedMinor: annualise(v.cost) };
}
