# Operations Guide

This guide covers the pieces that protect deployed environments from schema drift and silent sync failures.

## Imported property facts

MLS lookup supports both `{ listing }` and `{ property }` response envelopes,
including accompanying media. BBO's allowlisted `publicDetails` fields are mapped
into the existing `aiQaContext.propertyFacts` JSON snapshot: association fees and
their billing periods, estimated monthly maintenance, included services, schools,
pets, parking, building features and interior systems. Annual taxes and their tax
year remain separate facts. No database migration or new environment variables
are needed for these additive fields.

Co-op tax amounts are labeled as reported taxes: they may refer to the whole
building or already be included in maintenance. The cost text tells buyers to
confirm the unit's costs with management, including when an older snapshot
identifies ownership through its building type.

Financial values must be exact nonnegative numbers; explicit zero is preserved,
while blank or qualified values are unknown. A missing fee period is not treated
as monthly. Q&A, generated FAQs and seller reports use the same cost formatter.
They do not show the legacy `estimatedMonthlyCarry` total, because maintenance
and taxes can overlap and the imported charges may be incomplete.

Existing events keep their saved snapshots until an agent imports the listing
again. Reading an older snapshot does not invent a fee period or turn an old
calculated carrying total into a verified charge.

## Environment variables

In addition to the core app variables, production operators should set:

```bash
INTERNAL_OPS_TOKEN=...
KEVV_SYNC_BASE_URL=https://app.example.com
KEVV_SYNC_TOKEN=...
KEVV_SYNC_PATH=/api/internal/openhouse/signins
KEVV_SYNC_TIMEOUT_MS=8000
```

`INTERNAL_OPS_TOKEN` protects the internal ops routes:

- `GET /api/internal/ops/schema-check`
- `POST /api/internal/kevv-sync/run`

You can send it as either:

- `Authorization: Bearer <token>`
- `x-ops-token: <token>`

## Migration flow

The safest order is:

1. run schema changes in preview or staging
2. run `npm run db:check`
3. deploy the new app build
4. hit `/api/internal/ops/schema-check`
5. only then promote or cut production traffic

For production:

```bash
npx drizzle-kit push --config=drizzle.config.ts
npm run db:check
```

If the runtime endpoint returns `503`, the app and database are out of sync and you should finish the migration before trusting public capture flows.

## Runtime schema drift checks

Local check:

```bash
npm run db:check
```

HTTP check against a deployed app:

```bash
curl -i \
  -H "Authorization: Bearer $INTERNAL_OPS_TOKEN" \
  https://app.example.com/api/internal/ops/schema-check
```

The response returns the checked tables plus any missing tables, columns, or indexes for the highest-risk runtime paths:

- public sign-ins
- public funnel tracking
- public chat access grants
- shared rate-limit storage

## Kevv sync worker

OpenHouse writes sign-ins locally first. Kevv sync is intentionally asynchronous.

The worker reads sign-ins where `crmSyncStatus` is `pending` or `failed`, sends them to the Kevv endpoint, and writes back:

- `crmSyncStatus = synced` on success
- `kevvContactId` if the downstream system returns it
- `crmSyncStatus = failed` on error

Run it locally:

```bash
npm run kevv:sync -- --limit=25
```

Trigger it against a deployed app:

```bash
curl -i \
  -X POST \
  -H "Authorization: Bearer $INTERNAL_OPS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit":25,"includeFailed":true}' \
  https://app.example.com/api/internal/kevv-sync/run
```

Recommended cadence:

- every 1 to 5 minutes via Railway cron, GitHub Actions, or your job runner
- plus a manual run after bulk follow-up generation or operational backfills

The app automatically re-queues a sign-in for Kevv sync after:

- initial capture
- AI scoring updates
- follow-up draft or send updates

## GitHub runtime checks

The repository includes a scheduled/manual workflow at `.github/workflows/runtime-schema-drift.yml`.

Configure these GitHub Actions secrets if you want drift checks from GitHub:

- `OPENHOUSE_INTERNAL_OPS_TOKEN`
- `OPENHOUSE_PRODUCTION_BASE_URL`
- `OPENHOUSE_PREVIEW_BASE_URL`

The workflow skips any target that is not configured.

## Release checklist

Before shipping:

```bash
npm run lint
npm run test:smoke
npm run test:critical
npm run build
```

After deploy:

1. hit the public sign-in flow once
2. hit `GET /api/internal/ops/schema-check`
3. if Kevv sync is enabled, trigger one worker run
