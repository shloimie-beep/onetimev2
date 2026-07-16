# OT-86A Implementation

Packet id: OT-86A  
Branch: codex/ot86a-vimeo-content-kb  
Base SHA: a02d1d254ae0d17804fb657079a7871567260ea2  
Head SHA: pending until commit/push  
Generated UTC: 2026-07-15T17:15:21.808Z

## Components

- `contracts/content-pipeline/v1/`: committed the packet's versioned publication, social-event, Vimeo, KB, security, performance, and acceptance contracts.
- `packages/contracts/src/content/pipeline.ts`: runtime zod schemas for OT-86A lifecycle states, signed publication manifests, approved-for-social events, retrieval responses, provider readiness, and publish headers.
- `packages/domain/src/content/pipeline.ts`: central state machine, approval immutability, signed manifest receipt/projection, local retrieval, social-event outbox creation, Vimeo readiness inspection, provider-event receipt handling, checksum and HMAC helpers.
- `packages/db/migrations/2000_ot86_content_pipeline.sql`: additive tables, indexes, receipts, projection, outbox, provider receipts, search documents, and retrieval audit.
- `apps/web/src/server/app.ts`: raw-byte `POST /internal/content-publications/v1/manifests` before `express.json`, with HMAC/timestamp/checksum validation and durable inbox acknowledgement before `202`.
- `packages/config/src/index.ts` and `.env.example`: OT-86A publish-signing and Vimeo readiness environment names, without committing values.
- `bin/ot86-vimeo-canary`: read-only Vimeo readiness canary plus gated upload mode; missing credentials report `unconfigured` and perform no writes.
- `scripts/ot86/content-performance-probe.ts`: local corpus probe for library list, detail, deep links, retrieval, and duplicate acknowledgement.
- `tests/integration/content/ot86-content-pipeline.test.ts`: fixture validation, HMAC replay/conflict, lifecycle, projection, retrieval authorization, privacy blocks, immutable approval, provider replay, and raw Express route coverage.
- `tests/integration/telegram-db-foundation.test.ts`: migration-chain expectation updated so `2000_ot86_content_pipeline` is the newest migration.

## Workflow Mapping

- Ingest/control-plane state: represented by `ot86_content_items`, `ot86_content_versions`, `ot86_content_state_events`, and `OT86_ALLOWED_TRANSITIONS`.
- Provider seam: `inspectOt86VimeoReadinessFromEnv`, `recordOt86ProviderEventReceipt`, and `sanitizeOt86ProviderError`; no Vimeo SDK or token-bearing client enters shared/client code.
- Publication handoff: signed manifest validation creates `ot86_publication_inbox_receipts`; background application is represented by `applyNextOt86Publication`.
- Local One Time projection: active published versions, sections, artifacts, and search documents are stored locally and do not require BNA network access for reads.
- Student helper retrieval: `retrieveOt86ApprovedContent` requires tenant/principal entitlements before search and stores audit metadata without raw learner question text.
- Social handoff: `emitOt86ApprovedForSocialEvent` emits only after immutable approval and privacy attestation.

## Boundaries

This repository is the standalone One Time app. BNA ingest/provider operations are external publisher/control-plane dependencies. OT-86A implements the One Time receiving, projection, retrieval, and shared contract surfaces without copying BNA Operations runtime code.

## External Dependency

Live Vimeo readiness is blocked locally by missing Vimeo credentials/account permission. Offline gates pass to checkpoint `READY_FOR_VIMEO_CANARY`.
