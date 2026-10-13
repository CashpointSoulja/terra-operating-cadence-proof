# Risks

## Product risks

| Risk | Likelihood | Impact | Mitigation in v1 | Residual |
|---|---|---|---|---|
| Re-approval fatigue: leaders rubber-stamp every invalidation | Medium | High | Decision request states exactly what changed and the new cost | Real thresholds for "material" still unknown |
| Synthetic thresholds mistaken for policy | Medium | Medium | Every threshold is in `src/engine/policy.ts` and labelled synthetic in docs | Needs discovery Q1–Q4 |
| Follow-through rates read as performance scores | Medium | High | Minimum-sample hold; late closes shown separately from overdue | Social risk remains; v2 would make the view leader-only |
| Brief seen as admin overhead | Medium | Medium | Brief is generated, not written; issuing is one click | Unvalidated (H3) |

## Build and security risks

| Risk | Mitigation | Test |
|---|---|---|
| Cross-site write (CSRF) | Same-origin `Origin`, `Sec-Fetch-Site`, custom `X-OCP-Request` header, JSON content type, `SameSite=Strict` cookie | API checks 9–13 |
| Visitor reads another's data | Workspace name is SHA-256 of a 256-bit random cookie; no IDs in URLs | API isolation checks |
| Lost update under concurrency | Expected revision on every command plus SQL compare-and-set in a single-threaded Durable Object | API concurrency check |
| Partial writes | Command validated and applied to a copy; saved in one transaction or not at all | Unit "all or nothing" test |
| Oversized or hostile input | 8 KB body, exact-key schemas, control-character, length, enum, integer and date checks | Unit + API checks |
| XSS via vendor text | DOM built with `textContent` only; strict CSP without inline script; Markdown export escapes `| < > * _` | Unit escape test |
| Abuse of free tier | 120 change attempts per minute per workspace; bounded state; 7-day idle purge alarm | API rate-limit check |
| Brand confusion | Ayo's identity first; Terra wordmark secondary with "Unofficial, not affiliated" label on every page | Visual review at 1366 px and 390 px |

## Claim risks

I make no claim about Terra's internal processes, vendors, spend, savings, or the posting's freshness or salary. The source ledger records what each public source said and where they disagree.
