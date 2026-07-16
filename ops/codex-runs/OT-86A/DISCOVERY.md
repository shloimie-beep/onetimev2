# OT-86A Discovery

Packet id: OT-86A
Branch: codex/ot86a-vimeo-content-kb
Base SHA: a02d1d254ae0d17804fb657079a7871567260ea2
Generated UTC: 2026-07-15T16:26:41.878Z

## Repository

Repository root: `C:/Users/User/.ot86-worktrees/OT-86A`

Remote base resolved from `C:/Users/User/onetimev2` after `git fetch --all --prune`:

- Remote: `origin`
- Base ref: `refs/remotes/origin/codex/ot83-household-portals-foundation`
- Base SHA: `a02d1d254ae0d17804fb657079a7871567260ea2`

## Product Boundaries

This repository is the standalone One Time repository. `AGENTS.md` explicitly says not to copy BNA `server.js`, Operations shell, generated Operations assets, provider runtime, Studio, agents, memory, secrets, or broad migrations.

No BNA Express/Operations app root exists in this repository. The OT-86A implementation therefore treats BNA as an external publisher/control-plane integration and implements the shared wire contracts, server-side validation, One Time durable inbox/projection, local library/search/retrieval, and offline BNA-origin domain paths needed for tests. The missing BNA admin UI and real BNA outbox worker remain external integration work.

Concrete One Time roots:

- `apps/web`: Express 5 web app and Vite-built public/authenticated shells.
- `apps/worker`: background delivery worker conventions.
- `packages/domain`: domain services for content, portals, providers, delivery, CRM, auth, classes, billing, and lead capture.
- `packages/contracts`: zod runtime schemas and public/domain contracts.
- `packages/db`: PostgreSQL/pg-mem helpers and forward-only SQL migrations.
- `packages/config`: environment parsing and server config.

## Existing Conventions

- Runtime: Node.js 24, TypeScript ESM, Express 5, React/Vite for app bundles.
- Database: PostgreSQL through `pg`; tests use `pg-mem`; migrations are forward-only SQL under `packages/db/migrations` and recorded in `onetime.schema_migrations` with checksums.
- Transactions: `packages/db/src/index.ts` exposes `inTransaction`.
- Idempotency: existing content outcome admission uses `content_outcome_idempotency_records`; delivery worker uses `outbox_events`, `delivery_key`, claim leases, and audit rows.
- Authz: web API sessions use `otcrm_session` cookie, CSRF validation, and role checks in `apps/web/src/server/app.ts`; portal APIs resolve tenant/product from server config, not browser payloads.
- Current content library: `packages/domain/src/content/service.ts`, `packages/contracts/src/content/index.ts`, and migration `1400_ot71_content_library.sql`.
- Provider readiness: `packages/domain/src/providers/vimeo.ts` already contains redacted playback/readiness helpers; OT-86A needs a narrower content-upload/readiness adapter without exposing secrets.
- Outbox/worker: `packages/domain/src/outbox/sink.ts` and `apps/worker/src/delivery/*` show repository-native queued/event processing patterns.
- Search/index: no full-text engine exists; current content access is local SQL. OT-86A will implement a local, tenant-scoped SQL projection/search-document contract with bounded retrieval.
- Bundle/performance gates: package scripts include `lint`, `typecheck`, `build`, `test`, `performance`, and `secret:scan`; bundle checking lives in `scripts/check-bundles.ts`.

## Repo-Native Commands

- Install: `npm install`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Unit tests: `npm run unit`
- Integration tests: `npm run integration`
- Focused tests: `npx vitest run --config vitest.integration.config.ts <test-file>`
- Build: `npm run build`
- Secret scan: `npm run secret:scan`
- Migrations: `npm run db:migrate`, `npm run db:verify`

## Implementation Path

OT-86A will add:

- Versioned wire contracts under `contracts/content-pipeline/v1/`.
- Runtime zod schemas and helpers under `packages/contracts/src/content/`.
- Additive migration `packages/db/migrations/2000_ot86_content_pipeline.sql`.
- Domain services under `packages/domain/src/content/` for lifecycle transitions, Vimeo readiness/manual references, signed publish receipts/projection, approved KB retrieval, privacy gates, and social handoff events.
- Server endpoint `POST /internal/content-publications/v1/manifests` in `apps/web/src/server/app.ts`, using raw JSON bytes before normal JSON body parsing.
- Secret-safe canary wrapper `bin/ot86-vimeo-canary`.
- Focused tests under `tests/integration/content/` and a local performance probe under `scripts/ot86/`.

## External Readiness

Live Vimeo upload/canary requires server-side credentials, webhook secret, account id, and permission confirmation. In this local run those capabilities are treated as unavailable unless the canary proves otherwise. When offline gates pass without live Vimeo readiness, the correct checkpoint is `READY_FOR_VIMEO_CANARY`.
