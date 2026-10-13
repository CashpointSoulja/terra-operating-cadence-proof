# Decision log

*Independent concept by Ayo Ahmed. Not affiliated with or endorsed by Terra Industries. Synthetic data only.*

These are choices already reflected in the repo. Each entry gives what I decided, why, what it cost and where to see it. They apply to the reviewed code commit `e954eb6fbd1fa4dd32d5b449afc075554434beb6`, published on 13 October 2026 (see [Live release](../LIVE_RELEASE.md)). The numeric values are placeholders listed in [Assumptions](ASSUMPTIONS.md); the decisions are about mechanism.

## D1. Civilian administration only

- **Decision:** The concept covers one office-services supplier and a weekly leadership cadence. No drone, surveillance, weapons, targeting, autonomy or defense-system content, and no Terra product data.
- **Why:** The public posting's duties (R1) are business operations: finance, HR, legal, vendors, board materials, KPIs. Those can be shown well without touching Terra's products, and staying out of that domain avoids implying knowledge I don't have.
- **Trade-off:** The sample says nothing about sector-specific operations or regulation. I list that as a gap in [Role viability](ROLE_VIABILITY.md).
- **Where:** [Source ledger, scope boundary](../research/SOURCE_LEDGER.md); disclaimers in the UI and every export.

## D2. Synthetic data only

- **Decision:** Every person, supplier, agreement, cost and action is fictional (`src/engine/seed.ts`). Onboarding is simulated with a `SIM-ONB-` receipt; no payment, no supplier contact, no legal advice.
- **Why:** I have no internal data and shouldn't imply any. Synthetic data also lets anyone reproduce every number in the docs.
- **Trade-off:** The KPIs and evaluations measure the logic, not any real outcome. I claim no savings or speed-up ([Metrics](METRICS.md)).
- **Where:** `src/engine/seed.ts`, footer and export disclaimers.

## D3. GBP-only, fail-closed

- **Decision:** A cost in any currency other than GBP blocks the gate (`currency_not_home`) instead of being converted.
- **Why:** Converting would mean picking a rate and a date, and an approval given at one rate shouldn't silently cover another. Blocking makes the person convert and re-approve, or escalate.
- **Trade-off:** EUR/USD suppliers can't be onboarded without a policy change. Real policy is unknown ([Q3](DISCOVERY_QUESTIONS.md)).
- **Where:** `src/engine/policy.ts` (`homeCurrency`), `src/engine/gate.ts`; evaluation E08.

## D4. Every critical check gates on its own

- **Decision:** The gate shows `passed / total` but only unblocks when every critical check passes. Missing, stale, expired, unauthorised, self- or future-dated approvals block or are refused.
- **Why:** An aggregate score hides the one step that matters. The baseline passes 7 of 8 checks and is still blocked by the open bank call-back.
- **Trade-off:** A supplier that is "nearly done" still waits.
- **Where:** `src/engine/gate.ts`; the negative control in [eval results](../../eval/RESULTS.md) is a count-based gate that accepts any approval on file, and it misses 6 of 11 gate cases.

## D5. Approvals bound to a material fingerprint

- **Decision:** Each approval stores a SHA-256 fingerprint of canonical JSON over the material fields (vendor ID, legal name, category, scope, owner, cost, agreement reference and version). A change makes prior approvals stale and invalidates any onboarding. Recovery means re-approving the new fingerprint and onboarding again; both receipts stay in history.
- **Why:** Approving "the supplier" rather than "these terms" lets the terms drift after sign-off. A fingerprint makes drift visible and mechanical.
- **Trade-off:** Small changes force re-approval, which risks rubber-stamping ([Risks](RISKS.md)). Payment terms and notice period are not in the fingerprint, to keep the rule explainable.
- **Where:** `src/engine/gate.ts` (`materialFingerprint`), `src/engine/commands.ts` (`fingerprint_mismatch`); evaluations E04, E05, E15.

## D6. Explicit denominators and minimum samples

- **Decision:** Every KPI shows numerator / denominator. A zero denominator reads "— / 0, no data", never 0%. Owner follow-through is held below n = 3. A late close counts as a miss; a past-due milestone counts as late whatever its flag says.
- **Why:** A percentage without a base invites the wrong conclusion, and 0 of 1 reads like a judgement about a person.
- **Trade-off:** Early weeks show little, and the brief is denser than a list of percentages.
- **Where:** `src/engine/cadence.ts` (`ratio`, `buildBrief`); evaluation E17; [Metrics](METRICS.md).

## D7. Content-hashed briefs and stale-brief refusal

- **Decision:** The weekly brief's ID is a hash of its content, not of the state revision. Issuing requires the reviewer to send the ID they reviewed. The board-material export refuses when no brief has been issued (`brief_not_issued`) or the issued one no longer matches (`brief_stale`).
- **Why:** Board material should be the version someone actually read. Hashing content rather than revision means issuing doesn't make the brief stale on its own.
- **Trade-off:** Any late change forces a re-issue before export, and two identical states share an ID (by design).
- **Where:** `src/engine/cadence.ts`, `src/engine/exports.ts`; evaluations E18–E20.

## D8. One SQLite-backed Durable Object per visitor

- **Decision:** Each anonymous visitor gets a workspace in a SQLite-backed Cloudflare Durable Object, named from a SHA-256 hash of a random 32-byte HttpOnly cookie. Writes carry an expected revision and use compare-and-set (conflicts return 409). Inputs are validated whole and applied atomically. State is bounded (96 KB state, 8 KB requests, 60 actions, 20 milestones, 300 events, 12 briefs), writes are rate-limited to 120 a minute, and idle workspaces are purged after 7 days. Writes need a same-origin request and a custom header.
- **Why:** It runs on the Workers Free plan, isolates visitors without logins, and serialises writes without locking code. The bounds keep a public demo safe from abuse.
- **Trade-off:** No cross-visitor reporting, no relational queries, and no real roles: anyone in a workspace can record an approval for any roster person, with authority enforced by the gate rather than by sign-in.
- **Where:** `src/worker.ts`, `wrangler.jsonc`; API checks (38/38 on the clean live re-run recorded in [Live release](../LIVE_RELEASE.md)).

## Decisions still open

These depend on discovery, not on me: the real delegation of authority, which steps are critical, what counts as material, the approval validity period, and which existing systems the workflow should live in ([Build versus buy](BUILD_VS_BUY.md)).
