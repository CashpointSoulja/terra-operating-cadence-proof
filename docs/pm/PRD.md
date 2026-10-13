# PRD: Operating Cadence Proof

*Independent concept by Ayo Ahmed. Not affiliated with or endorsed by Terra Industries. Synthetic data only.*

## Why I built this

The public Business Operations Lead posting for Terra's London office (see [SOURCE_LEDGER](../research/SOURCE_LEDGER.md)) describes one person spanning finance, HR, legal, vendor management, board materials, KPI tracking and leadership support. I do not know how Terra runs any of that today, and nothing here claims a problem exists. I picked two jobs from the posting that every early London office has to do, and built the smallest working version of how I would run them in my first weeks:

1. **Onboard an office-services vendor only when the evidence holds.** Signed agreement, approved cost in GBP, a named accountable owner, current approvals and a completed critical checklist.
2. **Run the weekly leadership cadence from one source.** Milestones, actions, owner follow-through and a versioned brief with explicit denominators, unknowns and decision requests.

The scope is civilian office administration only. There is no drone, surveillance, weapons, targeting, autonomy or defense-system content, and no Terra product data.

## Users

| User | Job to be done | What they need from the tool |
|---|---|---|
| Business operations lead (me, in the role) | Keep vendors, actions and the weekly brief honest without chasing people by memory | One record per vendor, gate reasons in plain words, a brief that can't silently drift from the data |
| Budget owner / founder's office | Approve spend once, for the thing they actually saw | Approval bound to the exact record; a clear ask when it needs re-approving |
| Finance lead | See every commitment over threshold before it starts | Automatic finance approval requirement above £25,000 a year, or when cost is unknown |
| Leadership meeting | Decide, not re-read status | Decision requests with owners, explicit KPI denominators, named unknowns |

## Scope (v1, built)

- **Vendor record**: legal name, service category, scope, accountable owner, cost (integer pence, currency, period), agreement (reference, version, signed date, expiry, signatory).
- **Material fingerprint**: SHA-256 over canonical JSON of the material fields. Every approval stores the fingerprint it was given for.
- **Gate**: fail-closed checks for reporting date, owner, cost, home currency, agreement presence/signature/dates, required approvals (role, authority, not the owner, matching fingerprint, dated, not future, under 90 days old) and every critical checklist item. A count like 7 / 8 is shown, but only all-critical-pass unblocks.
- **Simulated onboarding**: issues a `SIM-ONB-` receipt. No payment, no vendor contact. Repeating it is idempotent.
- **Invalidation and recovery**: a material change after onboarding marks the onboarding invalidated and every approval stale. Re-approval for the new fingerprint plus a fresh onboard recovers; history keeps both receipts.
- **Cadence**: milestones (past-due counts as late whatever the flag says), actions (late close counts as a miss), owner follow-through with a minimum sample of 3 before a rate is read.
- **Weekly brief**: content-hashed ID, KPI numerators and denominators, unknowns, decision requests. Issuing requires the reviewer to send the ID they reviewed.
- **Exports**: audit JSON (always), board-material JSON (only for the issued brief that still matches), readable Markdown summary.
- **Persistence**: one SQLite-backed Durable Object per visitor on Cloudflare Workers Free, compare-and-set on revision, bounded state, idle purge after 7 days.

## Out of scope (deliberately)

Real payments, bank verification, vendor contact, legal review, e-signature, HRIS/finance integrations, logins and roles, multi-vendor registers, notifications. These are v2 candidates in [V2_PLAN](V2_PLAN.md) and none are implied by v1.

## Acceptance criteria

| # | Criterion | Evidence |
|---|---|---|
| A1 | Baseline vendor is blocked by the open critical call-back step | eval E01, unit test |
| A2 | Missing, stale, expired, unauthorised, self- or future-dated approvals block or are refused | E06, E07, E11–E15 |
| A3 | Changing cost, owner, scope, name, category or agreement invalidates prior approval and onboarding | E04, unit tests |
| A4 | Re-approval of the new record recovers | E05, API check |
| A5 | KPIs always show numerator / denominator; zero denominator reads "no data" | E17, unit tests |
| A6 | Board export refuses a brief that is not issued or no longer current | E18–E20, API check |
| A7 | Visitors cannot see each other's workspace | API check (isolation) |
| A8 | Concurrent writes on one revision: exactly one lands | API check |
| A9 | Inputs outside the schema are refused whole (no partial writes) | unit tests |
| A10 | Every surface says synthetic, simulated, no payment, no legal advice | UI, summary export, audit export |

All of the above ran; output is in [TEST_RESULTS](../TEST_RESULTS.md).
