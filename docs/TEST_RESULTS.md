# Test results

> **Historical pre-release record.** This page describes the state before deployment and before the walkthrough was published. The current release record is [LIVE_RELEASE.md](LIVE_RELEASE.md).

Run locally on 13 October 2026 with Node 24.19.0 and Wrangler 4.150.0. Raw output for every run is in [docs/evidence/](evidence/). Nothing has been deployed; the API checks ran against `wrangler dev` on 127.0.0.1.

| Check | Command | Result | Raw output |
|---|---|---|---|
| Type check | `npm run typecheck` | 0 errors | [typecheck.txt](evidence/typecheck.txt) |
| Engine and validation tests | `npm test` | 59 / 59 passed | [vitest.txt](evidence/vitest.txt) |
| Expected/actual evaluation | `npm run eval` | 20 / 20 cases match | [eval.txt](evidence/eval.txt), [eval/RESULTS.md](../eval/RESULTS.md) |
| Negative control | `npm run eval` | Naive count-based gate matched 5 / 11 gate cases; caught on 6 (E01, E04, E06, E07, E08, E09) | same |
| HTTP, security, isolation, concurrency | `npm run test:api` | 38 / 38 passed | [api-check.txt](evidence/api-check.txt), [api-check.json](evidence/api-check.json) |
| Cloudflare Workers Free dry run | `npm run cf:dry-run` | Bundled; bindings `WORKSPACE` (Durable Object) and `ASSETS`; exited before upload | [cf-dry-run.txt](evidence/cf-dry-run.txt) |
| Walkthrough flow | `node video/walkthrough-flow.mjs` (headless) | 16 / 16 steps reached their expected state | [video/README.md](../video/README.md) |
| Responsive render | Headless Chrome at 1366 px and 390 px | No horizontal overflow (scrollWidth 1366 / 390), no console errors | [screenshots/](screenshots/) |

## What the negative control shows

The control is a plausible but wrong gate: ready when cost, owner and agreement exist, any approval is on file, and at least 60% of the checklist is done. It agrees with the real gate on easy cases and wrongly passes the baseline (critical step open), a stale approval after a price change, an expired approval, a EUR cost and an expired agreement. If it had matched every case, the evaluation would not be able to tell the two apart, and `npm run eval` exits non-zero in that situation.

## Security checks covered

Cookie flags (HttpOnly, Secure, SameSite=Strict); CSP, nosniff, frame and referrer headers; refusal of writes without Origin, with a foreign Origin, with `Sec-Fetch-Site: cross-site`, without the `X-OCP-Request` header, as `text/plain`, without a cookie or with a malformed one; 413 over 8 KB; invalid JSON; `__proto__` keys; unknown routes and methods; visitor isolation; stale revision 409; two concurrent writes on one revision (exactly one lands); fingerprint-mismatch approvals; rate limiting at 120 attempts a minute.

## Not tested

- Behaviour on Cloudflare's network (not deployed).
- Screen-reader walkthrough; I checked semantics and focus styles but did not run assistive technology.
- Any real vendor, payment or legal process: none exists in this build.
