# Jobs to be done

*Independent concept by Ayo Ahmed. Not affiliated with or endorsed by Terra Industries. Synthetic data only.*

These are hypothesised jobs, built from the public posting's duties ([source ledger](../research/SOURCE_LEDGER.md), R1) and the users in the [PRD](PRD.md). **I haven't interviewed anyone at Terra or anywhere else for this.** Each job lists how I would validate it.

## Business operations lead (the role)

> **When** a new office supplier needs to start, **I want to** know the evidence and approvals cover exactly what we're signing up to, **so I can** let them start without chasing people from memory or finding out later that the terms changed.

- **Functional:** one record per supplier, gate reasons in plain words, a clear list of what's still blocking.
- **Emotional:** confidence that "approved" still means approved.
- **What the build does:** fail-closed gate, version-bound approvals, invalidation and recovery.
- **Validate by:** walking through the last few office supplier onboardings with whoever ran them ([Q2, Q6, Q8](DISCOVERY_QUESTIONS.md)).

> **When** the weekly leadership meeting is coming up, **I want to** produce a brief from one source that shows what's late, what's unknown and what needs deciding, **so I can** spend the meeting on decisions rather than reconciling status.

- **Functional:** milestones, actions and owner follow-through with denominators; a brief ID I can point at.
- **Social:** follow-through numbers that don't unfairly single anyone out on a tiny sample.
- **What the build does:** explicit denominators, minimum-sample hold, content-hashed brief, decision requests with owners.
- **Validate by:** asking who prepares the meeting today and what the leaders actually decide on ([Q9, Q10](DISCOVERY_QUESTIONS.md)).

## Budget owner / founder's office

> **When** I'm asked to approve office spend, **I want to** approve the specific terms I was shown, **so that** a later change comes back to me rather than riding on my earlier yes.

- **What the build does:** approvals stored with the fingerprint they were given for; stale approvals stop counting; the decision request states what changed.
- **Risk:** re-approval fatigue ([Risks](RISKS.md)).
- **Validate by:** asking how often terms change after approval and whether approvers want to see those changes ([H1](HYPOTHESES.md), [Q5](DISCOVERY_QUESTIONS.md)).

## Finance lead

> **When** a commitment crosses the finance threshold or has no known cost, **I want to** see it before it starts, **so I can** check it against budget and payment controls.

- **What the build does:** finance-lead approval required above a placeholder £25,000 a year, or when cost is unknown; costs held in integer pence; GBP only.
- **Validate by:** reading the actual delegation of authority and asking how bank details are verified ([Q1, Q3, Q8](DISCOVERY_QUESTIONS.md)).

## Leadership meeting / board audience

> **When** I read the weekly brief or board material, **I want to** know it's the reviewed version and what each number is out of, **so I can** decide without asking "of what?" or wondering whether it changed since review.

- **What the build does:** numerator / denominator on every KPI, "no data" for zero denominators, board export refused for unissued or stale briefs.
- **Validate by:** running the brief with and without denominators and counting clarification questions ([H3](HYPOTHESES.md)); diffing board packs against their sources ([H6](HYPOTHESES.md)).

## Jobs I am deliberately not doing

Making payments, verifying bank details for real, contacting suppliers, giving legal advice on agreements, or replacing the finance or contract systems of record. Those belong to existing systems and specialists ([Build versus buy](BUILD_VS_BUY.md)).
