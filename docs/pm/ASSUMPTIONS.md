# Assumptions

*Independent concept by Ayo Ahmed. Not affiliated with or endorsed by Terra Industries. Synthetic data only.*

Every assumption the build or the docs rest on, where it lives, how sure I am, and how I would test it. "Confidence" is my own judgement: **Sourced** means a row in the [source ledger](../research/SOURCE_LEDGER.md) supports it; **Placeholder** means I chose a value so the prototype could run; **Unknown** means I have no basis either way.

## About the role and company

| # | Assumption | Basis | Confidence | How I would test it |
|---|---|---|---|---|
| A1 | The role covers vendor management and the operating cadence (board materials, KPI tracking, project tracking) | Quoted duties in R1 | Sourced (one signed-out posting) | Confirm the brief and priorities with the hiring manager |
| A2 | The role is in London and office-based | R1 ("Willing to work from office location in London") | Sourced | Confirm in any first conversation |
| A3 | The role is still open | R2–R5 disagree on posting age; not on Terra's own careers page | **Unknown**; I make no freshness claim | Find it on a Terra-controlled channel before investing more time ([Role viability](ROLE_VIABILITY.md)) |
| A4 | Pay meets my floor | No source states a salary (R6); £60k target and £50k floor are my own numbers | **Unknown** | Ask for the range early |
| A5 | A new London office means more suppliers and more reporting load | C1 (London office), C3 (contract announcements) | Inference from public statements, not observed | Ask how many active office suppliers there are and how many were added recently ([Q7](DISCOVERY_QUESTIONS.md)) |
| A6 | The current vendor and cadence processes have gaps | None | **Unknown**; I claim no internal problem | See [Five whys](FIVE_WHYS.md) for the tests |

## Encoded in the prototype (`src/engine/policy.ts`, `src/engine/seed.ts`)

| # | Assumption | Value in build | Confidence | How I would test it |
|---|---|---|---|---|
| A7 | Finance-lead approval is needed above a spend threshold, or when cost is unknown | £25,000 annualised | Placeholder | Read the actual delegation of authority ([Q1](DISCOVERY_QUESTIONS.md)) |
| A8 | The budget owner always approves | Always required | Placeholder | Same as A7 |
| A9 | The accountable owner should not approve their own supplier | Self-approval refused | Placeholder, a common control | Confirm with finance |
| A10 | Office suppliers are approved in GBP only | Non-GBP blocks | Placeholder | Ask whether any office suppliers contract in EUR/USD ([Q3](DISCOVERY_QUESTIONS.md)) |
| A11 | An approval goes stale after 90 days even if nothing changes | 90 days | Placeholder | [Q4](DISCOVERY_QUESTIONS.md) |
| A12 | "Material" means legal name, category, scope, owner, cost, agreement reference and version | Fingerprint fields | Placeholder; payment terms and notice period are deliberately left out | [Q5](DISCOVERY_QUESTIONS.md), then widen or narrow the set |
| A13 | Four checklist steps are critical: countersigned agreement, insurance certificate, data-protection terms, bank call-back | Seed checklist | Placeholder | [Q2, Q8](DISCOVERY_QUESTIONS.md) |
| A14 | A late close counts as a miss | Yes | Placeholder | [Q12](DISCOVERY_QUESTIONS.md) |
| A15 | Follow-through rates need at least 3 actions to be fair | n = 3 | Placeholder | [Q13](DISCOVERY_QUESTIONS.md), and test H4 |
| A16 | The weekly brief covers a 7-day window ending on the reporting date | 7 days | Placeholder | [Q9, Q10](DISCOVERY_QUESTIONS.md) |
| A17 | Leadership wants decision requests with named owners in the brief | Brief includes them | Hypothesis (H5) | Track carry-over for four weeks |

## About the build itself

| # | Assumption | Confidence | How I would test it / what would change it |
|---|---|---|---|
| A18 | A reviewer can judge the gate logic from a single synthetic supplier | Reasonable for a work sample | A real version needs a register of many suppliers (v2) |
| A19 | Anonymous per-visitor workspaces are enough for a public demo | Fit for a demo; not for real use | Real use needs sign-in and roles ([v2 plan](V2_PLAN.md)) |
| A20 | Cloudflare Workers Free is enough for review traffic | Supported by the release record: Free plan, 38/38 clean live API checks on a re-run after an initial transient 30/38 ([Live release](../LIVE_RELEASE.md)) | Not a production SLA; I would watch error rates if traffic grew |

If discovery contradicts any placeholder, the policy value changes. The mechanism (version-bound approvals, every-critical-step gating, explicit denominators) is what I'm proposing, not the numbers.
