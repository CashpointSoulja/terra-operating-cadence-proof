# Five whys (hypothesis chains)

*Independent concept by Ayo Ahmed. Not affiliated with or endorsed by Terra Industries. Synthetic data only.*

**Read this as a chain of hypotheses, not findings.** I have no internal access to Terra and have observed no failure there. Each "why" is a reason I think a fast-growing office *could* end up with the problem, written down so it can be tested and thrown away. The only Terra facts I rely on are in the [source ledger](../research/SOURCE_LEDGER.md): one public posting (R1) asking a single person to own finance, HR, legal and vendor processes plus "the operating cadence: board materials, KPI tracking, and cross-functional project tracking", and public statements about opening a London office (C1).

Each step lists how I would test it and what would make me drop it. If an early link fails, everything below it falls away too.

## Chain A: a supplier starts on terms nobody approved

**Problem I'm guarding against (hypothetical):** a supplier is approved at one price or scope, and the record later changes without anyone re-approving.

| Why | Hypothesis | How I would test it | Drop it if |
|---|---|---|---|
| 1. Why could a supplier run on unapproved terms? | The approval is recorded as "approved: yes" rather than against a specific version of the terms ([H1](HYPOTHESES.md)) | Compare recent office supplier approvals with the supplier's current terms ([discovery Q5, Q6](DISCOVERY_QUESTIONS.md)) | Every approval already references the exact version it covered |
| 2. Why would approvals not be tied to a version? | Approvals live in email or chat, separate from the record that changes | Ask where the last few approvals are recorded and whether they can be traced to a document version | Approvals are already captured in a system that versions the record |
| 3. Why would they live apart from the record? | Office spend is small and frequent, so a light-touch process grows up first, with no written delegation of authority ([Q1](DISCOVERY_QUESTIONS.md)) | Ask who can approve office spend, at what thresholds, and whether that is written down | A written delegation of authority exists and is followed |
| 4. Why would that light-touch process persist? | When one person spans finance, HR, legal and vendors (R1), the urgent work crowds out process design | Ask how much of the role's week goes to recurring admin versus new processes; R1 itself asks for "systems that hold up as headcount grows" | The process work is already owned by someone else |
| 5. Why does it matter now? | Headcount and supplier count grow when a new office opens (C1), and a process that worked for five suppliers starts to leak at twenty | Count active office suppliers and ask how many were added recently ([Q7](DISCOVERY_QUESTIONS.md)) | The supplier count is small and stable |

**What the prototype does about it:** every approval stores a SHA-256 fingerprint of the material fields, and a change to any of them makes the approval stale and blocks onboarding until fresh approval (evaluation cases E04, E05, E15 in [eval results](../../eval/RESULTS.md)). This shows the mechanism, not that the problem exists.

## Chain B: the leadership meeting re-reads status instead of deciding

**Problem I'm guarding against (hypothetical):** the weekly meeting spends its time working out what the numbers mean, and decisions carry over.

| Why | Hypothesis | How I would test it | Drop it if |
|---|---|---|---|
| 1. Why might decisions carry over? | Decision requests aren't written down with a named owner ([H5](HYPOTHESES.md)) | Track carried-over decisions for four weeks | Carry-over is already near zero |
| 2. Why might the meeting stall on status? | Rates appear without denominators, so "80%" prompts "of what?" ([H3](HYPOTHESES.md)) | Run two weeks with explicit denominators and two without; count clarification questions | No change in questions |
| 3. Why might rates mislead? | Small samples read like judgements: 0 of 1 looks like failure ([H4](HYPOTHESES.md)) | Show follow-through with and without the minimum-sample hold and ask leaders what they conclude | Leaders already discount small samples unprompted |
| 4. Why might the board pack differ from the data? | Late edits land after the brief was reviewed ([H6](HYPOTHESES.md)) | Diff recent board packs against the data they cite | Packs already match their sources |
| 5. Why would the brief drift at all? | The brief is written by hand from several places, so there is no single version to point at | Ask who prepares the meeting material and from which sources ([Q9, Q14](DISCOVERY_QUESTIONS.md)) | The brief is already generated from one source |

**What the prototype does about it:** every KPI shows numerator and denominator, zero denominators read "no data", follow-through is held below n = 3, and the board export refuses a brief that was never issued or has gone stale (E17–E20).

## Uncertainties I'm naming

- I don't know whether either chain describes Terra at all. Both are built from one public posting and general patterns, not observation.
- Even if link 1 holds, the cause might be different (for example, a finance system that already versions approvals but isn't used for office spend). The tests are written to find that out.
- The thresholds in the build (£25,000, 90 days, n = 3, 7-day window) are placeholders, not recommendations. See [Assumptions](ASSUMPTIONS.md).
