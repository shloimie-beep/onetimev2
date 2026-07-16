# OT-104R Final Report

## Scope

Implemented the One Time private Vimeo provider runtime for
`rabbi_sheller_provider` / `one_time_mishnah_class` only. BNA, Academy content,
production deployment, DNS, broad sends, live charges, and unrelated providers
were untouched.

Base:
`fb5f5eebc539afc9e93833e9417ee67524d62c36`

Branch:
`codex/ot104r-vimeo-private-runtime`

## Implementation

- Added OT-104R Vimeo schemas for literal scope, readiness, registration,
  processing state, and safe playback projections.
- Added a provider runtime with:
  - provider-off readiness and deterministic sink adapter;
  - real adapter factory that fails closed unless explicitly configured;
  - existing private-video registration;
  - controlled upload intent creation that stores only server-side opaque IDs;
  - polling/reconciliation with leases, bounded backoff, terminal dead-letter,
    and operator retry;
  - HMAC webhook verification with content-type, request-size, timestamp,
    replay/idempotency, account, and event allowlist checks;
  - safe unknown-event acknowledgement;
  - text-track import with size/type/UTF-8 validation, normalized text, source
    revision hashes, and sanitized metadata;
  - server-authorized playback projection with no raw provider URL/token.
- Added migration `2010_ot104r_vimeo_private_runtime.sql`.
- Added read-only canary `bin/ot104r-vimeo-canary`.

## Files

- `packages/contracts/src/content/vimeo-runtime.ts`
- `packages/contracts/src/content/index.ts`
- `packages/domain/src/content/vimeo-private-runtime.ts`
- `packages/domain/src/index.ts`
- `packages/db/migrations/2010_ot104r_vimeo_private_runtime.sql`
- `tests/integration/content/ot104r-vimeo-private-runtime.test.ts`
- `tests/integration/telegram-db-foundation.test.ts`
- `bin/ot104r-vimeo-canary`
- `ops/codex-runs/OT-104R/*`

## Adapter Contract

`Ot104rVimeoAdapter` exposes:

- `readiness`
- `registerExistingPrivateVideo`
- `createUploadIntent`
- `inspectVideo`
- `listTextTracks`
- `downloadTextTrack`

Browser-facing results return booleans, digests, server-owned route refs, and
safe reason codes. Raw private Vimeo URLs, download URLs, upload links, tokens,
webhook secrets, and full provider payloads are not returned.

## Verification

Passed:

- `npx vitest run --config vitest.integration.config.ts tests/integration/content/ot104r-vimeo-private-runtime.test.ts`
  - 5 tests passed.
- `npm run integration`
  - 28 test files passed, 140 tests passed.
- `npm run typecheck`
- `npm run lint`
- `npm run secret:scan`
- Changed-file Prettier check for touched TS/JS files.

Blocked or not applicable:

- `npm run format` repo-wide is blocked by pre-existing formatting drift in 609
  files. Touched TS/JS files pass Prettier.
- Disposable real PostgreSQL path is blocked because `DATABASE_URL` is not set
  in this environment. The pg-mem integration path applies all migrations,
  including `2010_ot104r_vimeo_private_runtime`.

## Canary

Command run:
`node bin/ot104r-vimeo-canary --mode read-only --json`

Result:
unconfigured, no writes performed.

Missing protected variables:

- `VIMEO_ACCESS_TOKEN`
- `VIMEO_CLIENT_ID`
- `VIMEO_CLIENT_SECRET`
- `VIMEO_ACCOUNT_ID`
- `VIMEO_WEBHOOK_SECRET`
- `VIMEO_STAGING_CANARY_VIDEO_ID`

## Later Convergence Notes

- Mount playback/status UI through a server-authorized route backed by
  `projectOt104rPlaybackAccess`.
- Use `registerOt104rVimeoSource`, `reconcileNextOt104rVimeoSource`,
  `receiveOt104rVimeoWebhook`, `importOt104rVimeoTextTrack`, and
  `retryOt104rVimeoSource` as the narrow provider boundary.
- Keep all caller-provided browser payloads out of account/product scope
  selection; the runtime enforces One Time scope.
