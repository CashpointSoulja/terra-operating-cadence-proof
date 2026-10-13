# Metrics and denominators

Every rate in the app is shown as numerator / denominator with n. A denominator of zero shows "— / 0, no data", never 0%. All values in this repo are computed from synthetic fixtures and measure nothing real.

## In-product KPIs (weekly brief)

| KPI | Numerator | Denominator | Notes |
|---|---|---|---|
| Actions due this week closed on time | Actions due in the 7-day window ending on the reporting date, closed on or before their due date | All actions due in that window | A late close is a miss. Baseline: 3 / 7 |
| Open actions that are overdue | Open actions with due date before the reporting date | All open actions | Lower is better. Baseline: 2 / 4 |
| Open milestones on track | Open milestones not past due and not flagged at risk | All open milestones | A past-due milestone counts as late regardless of its flag. Baseline: 1 / 3 |
| Vendor onboarding checks passed | Gate checks passed | All gate checks | Informational only: every critical check must pass. Baseline: 7 / 8 |
| Owner follow-through | Actions due to date closed on time, per owner | Actions due to date, per owner | Shown as HOLD below n = 3 or when no owner is named |

## Metrics I would track if this ran for real (not measured here)

| Metric | Definition | Why |
|---|---|---|
| Onboardings with a gate exception | Onboardings recorded while any blocker was open / all onboardings | Should be 0 by construction; non-zero means someone worked around the tool |
| Re-approval cycle time | Days from material change to all required approvals on the new fingerprint | Shows whether invalidation creates friction worth reducing |
| Decision carry-over | Decision requests still open a week later / decision requests raised | Tests H5 |
| Brief reissues before the meeting | Briefs issued per week ending | High numbers mean data still changing late |

I have no baseline for any of these and claim no savings or speed-up.
