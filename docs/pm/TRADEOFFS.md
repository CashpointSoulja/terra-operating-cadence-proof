# Trade-offs

| Decision | What I chose | What I gave up | Why |
|---|---|---|---|
| Approval validity | Bind each approval to a SHA-256 fingerprint of the material fields | Approvers re-approve even for small price moves | A silent price change after approval is the failure I most want to rule out; re-approving costs one click |
| What is "material" | Legal name, category, scope, owner, cost, agreement ref/version | Payment terms, notice period, contact details are not covered | Kept the set small enough to explain in one sentence; v2 can widen it after discovery Q5 |
| Gate logic | Every critical check must pass; show the count but never unblock on it | A "90% done" vendor still waits | Aggregate scores hide the one step that matters (see eval negative control) |
| Finance threshold | £25,000 annualised, or unknown cost | Smaller vendors skip finance review | Placeholder until I learn the real delegation of authority (discovery Q1) |
| Currency | GBP only, others block | No EUR/USD vendors without a code change | Avoids FX assumptions in approvals; real policy unknown |
| Follow-through | Hold below n = 3 | Early weeks show little | A 0% or 100% on one action is noise that reads like judgement |
| Brief identity | Content hash, not revision | Two identical states share an ID | Issuing must not invalidate itself; identical content is the same brief |
| Storage | One SQLite Durable Object per visitor, JSON state row with compare-and-set | No cross-visitor reporting, no relational queries | Free tier, strong per-visitor isolation and serialised writes with no locking code |
| Identity | Anonymous HttpOnly cookie, no login | No roles; anyone in the workspace can approve as anyone | It is a demo: approver authority is modelled in data and enforced by the gate, not by authentication |
| Bounds | 60 actions, 20 milestones, 300 events, 12 briefs, 96 KB state, 8 KB body | Long-running real use would hit limits | Keeps the free tier safe from abuse; dropped events are counted and reported |
| Frontend | Vanilla JS, no build step, strict CSP | Less ergonomic than a framework | Smaller surface to audit; no inline script or style |
