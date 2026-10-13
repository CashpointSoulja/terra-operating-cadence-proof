# ELI5: what this is, in plain words

*Independent concept by Ayo Ahmed. Not affiliated with or endorsed by Terra Industries. Synthetic data only. Portfolio reasoning, not legal or financial advice.*

## The short version

I built a small tool that does two office jobs.

1. **It only lets a new office supplier start when the paperwork is right.** Think of it like a school trip permission slip. The slip has to be signed, it has to be for *this* trip, and it has to be signed by the right grown-up. If someone changes the trip after the slip is signed (a different price, a different day), the old slip doesn't count any more and you need a new one.
2. **It writes the weekly "how are we doing" note for the leadership meeting.** Instead of "we're mostly on track", it says "3 of 7 things due this week were done on time". You always see both numbers, so nobody has to guess what "good" means.

## The supplier part

- The supplier in the demo is made up: *Halden & Rowe Office Services Ltd*, cleaning and reception cover for one office floor, £1,850 a month.
- Before it can start, the tool checks for a signed, in-date agreement, a price in pounds, a named person who owns the relationship, the right approvals, and every must-do step on the checklist.
- If even one must-do step is missing (in the demo, the bank call-back), the supplier stays blocked. Getting 7 of 8 checks right is not enough.
- Each approval is stamped with a fingerprint of exactly what was approved. If the price, owner, scope, name, category or agreement version changes, the fingerprint changes, the old approval stops counting, and the supplier has to be approved again.
- "Onboarding" here is pretend. No money moves, no one is contacted, and no legal judgement is made.

## The weekly note part

- It tracks milestones and actions, counts late ones as late, and treats a late finish as a miss.
- It won't show a person's follow-through rate until they have at least 3 actions, because 1 out of 1 says nothing about anyone.
- The note gets an ID made from its content. You issue the version you actually read. If anything changes afterwards, the board export refuses to go out until a fresh note is issued.
- It lists what we don't know and what we need someone to decide, with a name next to each decision.

## Why I made it

The public Business Operations Lead posting ([source ledger](../research/SOURCE_LEDGER.md), R1) asks for someone to own vendor management and the operating cadence (board materials, KPI tracking, project tracking). I wanted to show how I would make those two jobs hard to get quietly wrong, using only made-up data. I don't know how Terra does any of this today, and nothing here claims they have a problem.

## Where to look

- Live demo and walkthrough: [Live release](../LIVE_RELEASE.md)
- What it does in detail: [PRD](PRD.md)
- Why it works this way: [Decision log](DECISION_LOG.md)
