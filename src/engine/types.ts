export const SCHEMA_VERSION = 1;

export const SERVICE_CATEGORIES = ['office_cleaning', 'reception_cover', 'catering', 'stationery_supplies', 'facilities_maintenance', 'mail_and_courier'] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];
export const CURRENCIES = ['GBP', 'EUR', 'USD'] as const;
export type Currency = (typeof CURRENCIES)[number];
export const COST_PERIODS = ['monthly', 'annual'] as const;
export type CostPeriod = (typeof COST_PERIODS)[number];
export const APPROVAL_ROLES = ['budget_owner', 'finance_lead'] as const;
export type ApprovalRole = (typeof APPROVAL_ROLES)[number];
export const MILESTONE_STATUSES = ['on_track', 'at_risk', 'done'] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export interface Person { id: string; name: string; team: string; canApprove: ApprovalRole[] }

export interface Cost { amountMinor: number; currency: Currency; period: CostPeriod }

export interface Agreement { docRef: string; version: number; signedOn: string | null; expiresOn: string | null; signedBy: string | null }

export interface Approval { role: ApprovalRole; approverId: string; approvedOn: string; fingerprint: string; amountMinor: number; currency: Currency; period: CostPeriod }

export interface ChecklistItem { id: string; label: string; critical: boolean; done: boolean; doneOn: string | null }

export interface Vendor {
  id: string;
  legalName: string;
  serviceCategory: ServiceCategory;
  scope: string;
  ownerId: string | null;
  cost: Cost | null;
  agreement: Agreement | null;
  approvals: Approval[];
  checklist: ChecklistItem[];
}

export interface OnboardingRecord {
  status: 'not_started' | 'onboarded' | 'invalidated';
  receiptId: string | null;
  onboardedOn: string | null;
  fingerprint: string | null;
  invalidatedReason: string | null;
  history: { receiptId: string; onboardedOn: string; fingerprint: string; endedReason: string | null }[];
}

export interface Milestone { id: string; title: string; ownerId: string; dueOn: string; status: MilestoneStatus; completedOn: string | null }

export interface Action { id: string; title: string; ownerId: string | null; dueOn: string; milestoneId: string | null; completedOn: string | null }

export interface IssuedBrief { briefId: string; revision: number; contentHash: string; weekEnding: string; issuedAtRevision: number }

export interface AuditEvent {
  seq: number;
  revision: number;
  asOf: string;
  type: string;
  summary: string;
  fingerprintBefore: string;
  fingerprintAfter: string;
}

export interface State {
  schema: number;
  workspaceLabel: string;
  revision: number;
  asOf: string;
  people: Person[];
  vendor: Vendor;
  onboarding: OnboardingRecord;
  milestones: Milestone[];
  actions: Action[];
  briefs: IssuedBrief[];
  events: AuditEvent[];
  droppedEvents: number;
  nextSeq: number;
  nextId: number;
}

export interface Reason { code: string; message: string; field: string }

export interface Check { id: string; label: string; passed: boolean; critical: boolean }

export interface GateResult {
  status: 'ready' | 'blocked';
  fingerprint: string;
  checks: Check[];
  passed: number;
  total: number;
  blockers: Reason[];
  warnings: Reason[];
  requiredRoles: ApprovalRole[];
  annualisedMinor: number | null;
}
