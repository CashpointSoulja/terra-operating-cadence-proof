# Build versus buy

*Independent concept by Ayo Ahmed. Not affiliated with or endorsed by Terra Industries. Synthetic data only. Portfolio reasoning, not legal or financial advice.*

## My recommendation for real operations

**Use the vendor, finance and operations systems the company has already approved, and configure them. Don't build.** This prototype is not a candidate replacement for a finance system, a procurement tool, a contract repository or legal review. Its job is to show one idea clearly: **an approval and a checklist should be bound to the exact version of what was approved, and the gate should fail closed when that version changes.** If I were in the role, I'd look for that behaviour in the tools already paid for before considering anything new.

I don't know which tools Terra's London office uses (source ledger, "What I do not know"). I haven't evaluated, trialled or priced any product for this, so I don't name or compare products here.

## What each part of the prototype maps to in real operations

| Prototype capability | Where it should live for real | What I would check in the existing system |
|---|---|---|
| Supplier record (legal name, category, scope, owner, cost) | The finance or procurement system's supplier master | Can a change to cost, scope or owner trigger re-approval? |
| Version-bound approvals (fingerprint) | Approval workflow in the finance/procurement system | Does an approval reference a specific version of the terms, or just the supplier? |
| Agreement reference, version, signature, expiry | The contract repository or e-signature system already in use | Are expiry dates tracked and is the signed version identifiable? |
| Critical checklist (insurance, data terms, bank call-back) | Supplier onboarding workflow plus finance's bank-detail verification control | Can a critical step block activation on its own, rather than counting towards a percentage? |
| Bank call-back | Finance's existing control; the prototype only records that a simulated call-back happened | Who performs it and where is it evidenced ([Q8](DISCOVERY_QUESTIONS.md)) |
| Milestones, actions, owner follow-through | The project or task tool the leadership team already uses | Can it report on-time closes with denominators and hold small samples? |
| Weekly brief and board export | Generated from the same tools, reviewed by a named person | Can the issued version be pinned so later edits don't leak into the board pack? |
| Legal judgement on agreements | Outside counsel and internal legal, not software | Out of scope for any tool I'd build or configure |

## Options I would weigh

| Option | When it makes sense | Costs I'd expect (not quantified) |
|---|---|---|
| **Configure existing approved systems** (default) | Almost always first: already paid for, already trusted by finance and legal, already audited | Configuration time; some behaviours may be missing |
| **Process change only** (written delegation of authority, checklist, a fixed brief template) | If the gaps turn out to be about ownership rather than tooling | Ongoing discipline; no automatic fail-closed |
| **Add a dedicated tool** | Only if discovery shows a real gap the existing systems can't cover | New spend, approval, security review and another place for data to drift |
| **Build thin glue** (e.g. a check that compares the approved version with the current record) | Only if the existing systems expose the data but not the check | Maintenance and ownership; must not become a shadow finance system |
| **Build a full workbench like this prototype** | Not recommended for real operations | Duplicates systems of record and legal review |

## How I would decide

1. Answer [discovery Q16](DISCOVERY_QUESTIONS.md): which finance, HR, contract and task tools are already paid for.
2. For each row in the mapping table, check whether the behaviour exists and is switched on.
3. Run the relevant hypothesis test ([H1](HYPOTHESES.md), [H2](HYPOTHESES.md), [H6](HYPOTHESES.md)) to see whether the gap matters at all.
4. Only where a behaviour is missing *and* the gap matters, consider process change first, then glue, then a new tool.

## Uncertainties

- I have no pricing, contract terms or product trials, so any cost comparison would be invented. I have left it out on purpose.
- The existing systems may already do all of this, in which case the right answer is to switch on the setting and write the process down.
- The [v2 plan](V2_PLAN.md) describes how the prototype could grow. That's a design exercise, not a recommendation to build it instead of buying.
