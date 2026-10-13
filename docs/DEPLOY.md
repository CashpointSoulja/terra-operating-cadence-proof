# Cloudflare Workers Free: configuration and dry run

Not deployed. This page is for whoever deploys it after an independent review.

## What it uses

| Piece | Free-plan feature |
|---|---|
| `src/worker.ts` | One Worker |
| `public/` | Static assets (`assets` binding, worker runs first to add security headers) |
| `Workspace` class | SQLite-backed Durable Object (`new_sqlite_classes` migration `v1`), one per visitor |

No KV, D1, R2, Queues, paid bindings, secrets or environment variables are required. Observability is off.

## Checks to run before deploying

```sh
npm ci
npm run typecheck        # tsc, strict
npm test                 # vitest engine + validation tests
npm run eval             # expected/actual cases + negative control
npm run cf:dry-run       # wrangler deploy --dry-run --outdir dist
npx wrangler dev         # then, in another shell:
npm run test:api         # HTTP, security, isolation, concurrency checks against the local Worker
```

Recorded output from these runs is in [TEST_RESULTS](TEST_RESULTS.md).

## Deploying (when approved)

```sh
npx wrangler login
npx wrangler deploy
```

The first deploy applies migration `v1`, which creates the SQLite-backed `Workspace` class. The Worker is served on `*.workers.dev`; `preview_urls` is off.

## Data handling

- Each visitor gets a random 256-bit `ocp_vid` cookie (HttpOnly, Secure, SameSite=Strict, 7 days).
- The Durable Object name is SHA-256 of that cookie, so the cookie never appears in storage names.
- A workspace deletes itself 7 days after its last request (Durable Object alarm).
- Only synthetic data is seeded. Do not enter real vendor, bank or personal details.
