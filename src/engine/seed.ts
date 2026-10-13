import { SCHEMA_VERSION } from './types.ts';
import type { State } from './types.ts';
import { materialFingerprint } from './gate.ts';

// Every person, vendor, document and figure below is fictional.
export function baselineState(): State {
  const state: State = {
    schema: SCHEMA_VERSION,
    workspaceLabel: 'Synthetic London office · week ending 16 Oct 2026',
    revision: 1,
    asOf: '2026-10-16',
    people: [
      { id: 'P-RD', name: 'Ruth Desai', team: 'Office & People', canApprove: [] },
      { id: 'P-TB', name: 'Tom Brennan', team: "Founder's office", canApprove: ['budget_owner'] },
      { id: 'P-JW', name: 'Jonah Whitlow', team: 'Finance', canApprove: ['finance_lead'] },
      { id: 'P-AO', name: 'Amara Okafor', team: 'Business Operations', canApprove: [] },
      { id: 'P-SK', name: 'Sam Kerrigan', team: 'People', canApprove: [] },
    ],
    vendor: {
      id: 'VND-0147',
      legalName: 'Halden & Rowe Office Services Ltd',
      serviceCategory: 'office_cleaning',
      scope: 'Weekday evening cleaning and morning reception cover for one London office floor',
      ownerId: 'P-RD',
      cost: { amountMinor: 185_000, currency: 'GBP', period: 'monthly' },
      agreement: { docRef: 'SA-HRO-0147', version: 1, signedOn: '2026-09-30', expiresOn: '2027-09-29', signedBy: 'P-TB' },
      approvals: [],
      checklist: [
        { id: 'agreement_countersigned', label: 'Service agreement countersigned and filed', critical: true, done: true, doneOn: '2026-09-30' },
        { id: 'insurance_on_file', label: 'Public liability insurance certificate on file', critical: true, done: true, doneOn: '2026-10-02' },
        { id: 'data_terms', label: 'Data-protection terms confirmed for visitor log access', critical: true, done: true, doneOn: '2026-10-05' },
        { id: 'bank_callback', label: 'Bank details verified by call-back (simulated, no payment)', critical: true, done: false, doneOn: null },
        { id: 'access_induction', label: 'Building access induction booked', critical: false, done: true, doneOn: '2026-10-08' },
        { id: 'service_checklist', label: 'First-week service checklist agreed', critical: false, done: false, doneOn: null },
      ],
    },
    onboarding: { status: 'not_started', receiptId: null, onboardedOn: null, fingerprint: null, invalidatedReason: null, history: [] },
    milestones: [
      { id: 'M-01', title: 'Payroll provider handover complete', ownerId: 'P-SK', dueOn: '2026-10-14', status: 'on_track', completedOn: null },
      { id: 'M-02', title: 'London office vendor register live', ownerId: 'P-AO', dueOn: '2026-10-23', status: 'on_track', completedOn: null },
      { id: 'M-03', title: 'Q4 board pack first draft', ownerId: 'P-AO', dueOn: '2026-10-30', status: 'at_risk', completedOn: null },
      { id: 'M-04', title: 'Office insurance renewal bound', ownerId: 'P-JW', dueOn: '2026-10-09', status: 'done', completedOn: '2026-10-08' },
    ],
    actions: [
      { id: 'A-01', title: 'Send payroll cut-over checklist to provider', ownerId: 'P-SK', dueOn: '2026-10-10', milestoneId: 'M-01', completedOn: '2026-10-10' },
      { id: 'A-02', title: 'Reconcile September office card spend', ownerId: 'P-JW', dueOn: '2026-10-12', milestoneId: null, completedOn: '2026-10-14' },
      { id: 'A-03', title: 'Collect vendor W-8/VAT details for register', ownerId: 'P-AO', dueOn: '2026-10-13', milestoneId: 'M-02', completedOn: '2026-10-13' },
      { id: 'A-04', title: 'Draft KPI page for board pack', ownerId: 'P-AO', dueOn: '2026-10-15', milestoneId: 'M-03', completedOn: null },
      { id: 'A-05', title: 'Confirm payroll parallel-run results', ownerId: 'P-SK', dueOn: '2026-10-14', milestoneId: 'M-01', completedOn: null },
      { id: 'A-06', title: 'Book fire-warden training for new floor', ownerId: 'P-RD', dueOn: '2026-10-16', milestoneId: null, completedOn: '2026-10-15' },
      { id: 'A-07', title: 'Chase signed offer letters (two hires)', ownerId: 'P-SK', dueOn: '2026-10-09', milestoneId: null, completedOn: '2026-10-09' },
      { id: 'A-08', title: 'Pick a date for the leadership offsite', ownerId: null, dueOn: '2026-10-16', milestoneId: null, completedOn: null },
      { id: 'A-09', title: 'Agree accountant engagement letter scope', ownerId: 'P-JW', dueOn: '2026-10-21', milestoneId: null, completedOn: null },
    ],
    briefs: [],
    events: [],
    droppedEvents: 0,
    nextSeq: 1,
    nextId: 100,
  };
  const fp = materialFingerprint(state.vendor);
  state.vendor.approvals.push({ role: 'budget_owner', approverId: 'P-TB', approvedOn: '2026-10-01', fingerprint: fp, amountMinor: 185_000, currency: 'GBP', period: 'monthly' });
  state.events.push({ seq: 0, revision: 1, asOf: state.asOf, type: 'seed', summary: 'Synthetic baseline loaded', fingerprintBefore: fp, fingerprintAfter: fp });
  return state;
}
