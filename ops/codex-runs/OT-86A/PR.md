# [OT-86A] Vimeo content pipeline and approved-content KB

## Summary

- Adds OT-86A signed publication contracts, runtime schemas, and contract fixtures.
- Adds additive PostgreSQL tables/indexes for content lifecycle, Vimeo/provider receipts, publication inbox/outbox, local One Time projection, KB search documents, and retrieval audit.
- Adds raw-byte signed manifest endpoint at `POST /internal/content-publications/v1/manifests`.
- Adds domain services for lifecycle transitions, immutable approval, publish/correct/revoke projection, entitlement-scoped retrieval, approved-for-social event emission, and provider readiness.
- Adds secret-safe `bin/ot86-vimeo-canary` and local performance probe.

## Architecture Boundary

This branch implements the One Time receiving/projection/retrieval side in the standalone One Time repository. BNA ingest, provider upload/transcription/review, and publication intent remain external publisher/control-plane responsibilities. No BNA Operations runtime or client bundle dependency is added.

## Migrations

- New additive migration: `packages/db/migrations/2000_ot86_content_pipeline.sql`
- No destructive schema change.
- Real `npm run db:verify` is blocked locally by missing `DATABASE_URL`; pg-mem migration/application coverage passes through integration tests.

## Test Evidence

- `npm run typecheck` -> pass
- `npm run lint` -> pass
- `npm run secret:scan` -> pass
- `node --check bin\ot86-vimeo-canary` -> pass
- `npx vitest run --config vitest.integration.config.ts tests/integration/content/ot86-content-pipeline.test.ts tests/integration/content/content-library.test.ts` -> pass, 11 tests
- `npx vitest run --config vitest.integration.config.ts tests/integration/telegram-db-foundation.test.ts` -> pass, 2 tests
- `npm run brand:check` -> pass
- `npm run build` -> pass
- Targeted Prettier check for OT-86A parseable files -> pass
- Repo-wide `npm run format` remains blocked by pre-existing baseline formatting drift.

## Privacy And Security

- HMAC, delivery id, timestamp freshness, body checksum, manifest checksum, idempotency, and sequence are enforced before projection.
- Durable inbox receipt is stored before `202`.
- Retrieval authorizes before search and does not store raw learner questions.
- Learner/private-data flags block approval, KB, and social handoff.
- Secret scan passed; provider exception redaction is tested.

## Performance

Full local probe fixture: 1,000 items, 10,000 sections, 50,000 search documents, 30 samples, no BNA network dependency.

- Library list p95: 58.106 ms
- Content detail p95: 8.505 ms
- Deep link p95: 2.507 ms
- Retrieval/ranking p95: 24.319 ms
- Duplicate ack p95: 0.355 ms

## Vimeo Checkpoint

Read-only canary result is `unconfigured` because local Vimeo credentials/account permissions are absent. Checkpoint file is present with `READY_FOR_VIMEO_CANARY`. This PR does not claim live Vimeo provider success.

## Rollout/Rollback

Deploy schema first, configure publish signing keys, then enable BNA publication to the internal manifest endpoint. Rollback is feature-level: remove signing config/stop publication while leaving additive tables dormant.
