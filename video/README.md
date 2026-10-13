# Walkthrough: grounded script and deterministic flow

> **Historical pre-release record.** This page describes the state before deployment and before the walkthrough was published. The current release record is [LIVE_RELEASE.md](../docs/LIVE_RELEASE.md).

No public video is published from this repo. This folder holds what is needed to record one against the running app:

- [SCRIPT.md](SCRIPT.md): first-person narration, one line per caption, with the start times from a local rehearsal run.
- [walkthrough-flow.mjs](walkthrough-flow.mjs): drives the real UI from a fresh workspace with a visible pointer (yellow on click), holding each step for its narration line, and stops with an error if any expected state below is not reached.

## Steps and the state each one must show

Every step starts from the seeded baseline (a new browser context gets a new visitor workspace). All values come from `src/engine/seed.ts`.

| # | Action | Expected on screen |
|---|---|---|
| 1 | Open the app | Ayo-led header, unofficial Terra label, simulation banner |
| 2 | Scroll to the gate | `BLOCKED`, `7 / 8`, blocker `checklist_critical_open · checklist.bank_callback` |
| 3 | Tick "Bank details verified by call-back" | Gate `READY`, `8 / 8` |
| 4 | Onboard (simulated) | `ONBOARDED (SIMULATED)`, receipt `SIM-ONB-0100`, "No payment made, no vendor contacted" |
| 5 | Set cost to 2450.00, save | Toast "prior onboarding invalidated" |
| 6 | Read the gate | `7 / 9`, `approval_stale` (budget owner, £1,850 monthly), `approval_missing` (finance lead, annualised £29,400), onboarding `INVALIDATED` |
| 7 | Approve as Amara Okafor (budget owner role) | Refused: Amara Okafor cannot give budget owner approval |
| 8 | Approve as Tom Brennan (budget owner) | Toast "Tom Brennan gave budget owner approval for £2,450 monthly" |
| 9 | Approve as Jonah Whitlow (finance lead) | Gate `READY`, `9 / 9` |
| 10 | Onboard again | Receipt `SIM-ONB-0101`; both receipts in the audit trail |
| 11 | Cadence KPIs | `3 / 7` actions due this week closed on time |
| 12 | Owner follow-through | `HOLD` for owners under 3 actions due |
| 13 | Issue the brief | Brief chip `ISSUED · CURRENT` |
| 14 | Export board-material JSON | Preview starts `"kind": "operating-cadence-proof.board-material"` |
| 15 | Close action A-04, export board JSON again | Toast "A-04 closed 2026-10-16 (late)", then `Refused` with `brief_stale` |
| 16 | Footer | Synthetic-data, simulation, not-legal-advice and non-affiliation notices |

## Rehearsal evidence

On 13 October 2026 the flow ran end to end against `wrangler dev` on 127.0.0.1 and every expected state above was reached (the script asserts steps 3–5, 7–10, 13–15). That rehearsal is not a published video.
