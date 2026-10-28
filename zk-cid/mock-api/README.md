# ZK-CID Mock Sanctions API

A mock OFAC SDN-style sanctions feed consumed by the Chainlink CRE `compliance-lifecycle`
workflow. It stands in for the **issuer's re-screening feed**: the issuer re-screens its own
KYC'd customers against official lists off-chain and publishes the Semaphore commitments of
customers who became sanctioned. Names, documents and wallet links never leave the issuer;
the feed only carries commitments, which is why it can be public.

> This is a demo service with in-memory storage. It is **not** an authoritative screening
> source. Production needs a licensed, versioned feed, persistence, an audit trail, and human
> review for false positives (see `deliverables/LEGAL_MAPPING.md`).

Live deployment: <https://mock-api-topaz-zeta.vercel.app/api/sanctions-list>

Two implementations behave identically:

- **Express dev server**: `server.js`
- **Vercel serverless functions**: `api/sanctions-list.ts` + `api/admin.ts` (shared `lib/store.ts`)

## Run locally

```bash
cd mock-api
npm install
cp .env.example .env   # optional: PORT / ADMIN_TOKEN / SEED_SANCTIONED / CORS_ORIGINS
npm start              # = node server.js, http://localhost:3001
```

On Vercel, set `ADMIN_TOKEN` (and optionally `SEED_SANCTIONED`) as project environment
variables.

## Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/sanctions-list` | none | Unified schema: `{ sanctioned: string[], source: string, updatedAt: string }` |
| POST | `/api/admin` (Vercel) · `/api/admin/sanction` or `/api/admin` (Express) | `x-admin-token` header | Body `{ action, commitment? }` with `action ∈ add \| remove \| clear \| status`; returns `{ ok: true, data: <unified schema> }` |

The admin token comes from `ADMIN_TOKEN`. **In production (`NODE_ENV=production` or
`VERCEL_ENV=production`) a non-default token is mandatory**: admin requests are rejected
(HTTP 500) instead of falling back to the public `dev-token`. CORS is configured with
`CORS_ORIGINS` (same-origin only in production when unset). Admin endpoints have a
best-effort in-memory limit of 30 requests per IP per minute (`ADMIN_RATE_LIMIT`; not exact
across serverless instances).

### Input validation and storage limits

- `add` / `remove` require a `commitment` that is a 1–78 digit decimal strictly below the
  BN254 scalar field; anything else returns HTTP 400. The CRE workflow independently skips
  invalid entries and reports them as `invalidEntries`, so one bad row can never abort a
  screening run.
- Invalid entries in `SEED_SANCTIONED` / `seed.json` are dropped at startup.
- Storage is process-local (`globalThis`) for the demo, so Vercel instances and cold starts
  do not share state. Replace it with a KV/Redis store or a build-time list before any
  production use.

## How the CRE workflow uses it

`workflows/compliance-lifecycle/config.json` points `sanctionsApiUrl` at the GET endpoint.
Every DON node fetches the list and the results must be identical
(`consensusIdenticalAggregation`). The workflow reads the top-level `sanctioned` array
(decimal commitment strings) and `source`, then:

- **cron handler**: intersects the list with `ComplianceGate.getMembers()` and revokes every
  match on-chain;
- **issuance handler** (EVM log trigger on `UserAdded`): checks only the newly issued
  commitment and revokes it immediately if it is listed.

If you deploy the API elsewhere, update `sanctionsApiUrl` in `config.json`.

## Seeding a commitment before a demo

The service starts with an **empty list** unless seeded. Three ways to add an entry:

1. **Admin API** (recommended, works during a live demo):

   ```bash
   curl -X POST http://localhost:3001/api/admin/sanction \
     -H "x-admin-token: dev-token" \
     -H "Content-Type: application/json" \
     -d '{"action":"add","commitment":"<decimal on-chain commitment>"}'
   ```

2. **Environment seed**: set `SEED_SANCTIONED=<c1>,<c2>` in `.env` and restart (Express), or
   set the same variable on Vercel.

3. **seed.json** (Express only): write `["<c1>", "<c2>"]` or `{ "sanctioned": ["<c1>"] }` to
   `mock-api/seed.json` and restart.

Check the current list:

```bash
curl -X POST http://localhost:3001/api/admin/sanction \
  -H "x-admin-token: dev-token" -H "Content-Type: application/json" \
  -d '{"action":"status"}'
```

## Tests

```bash
yarn workspace zk-cid-mock-sanctions-api test   # 13 tests: response schema, caching, methods, admin auth, input validation
```

A Chinese copy of the original notes is kept in [`README.zh-CN.md`](./README.zh-CN.md).
