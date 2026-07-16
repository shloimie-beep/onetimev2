# OT-86B Discovery

Packet id: OT-86B<br>
Branch: codex/ot86b-buffer-social<br>
Base SHA: 87a1bb7ffd6a2fa0d016a1831894d430aa2ee065<br>
Current head SHA: pending until final commit/push<br>
Generated UTC: 2026-07-15T17:50:30Z

## Source Packet

- OT86B-BUFFER-SOCIAL/CODEX-PROMPT.md was executed only after OT-86A reached `READY_FOR_VIMEO_CANARY`.
- The OT86B branch was created from exactly one remote base: `refs/remotes/origin/codex/ot86a-vimeo-content-kb` at `87a1bb7ffd6a2fa0d016a1831894d430aa2ee065`.
- The copied contract bundle lives at `contracts/social-publishing/v1/`.

## Existing Conventions Found

- Express raw webhook-style routes are mounted before `express.json()`, matching OT86A raw-byte signing.
- Domain packages own workflow logic; contracts own Zod schemas; migrations are additive SQL files under `packages/db/migrations/`.
- Integration tests use `createMemoryPool()` and `runMigrations()` for pg-mem migration coverage.
- Runtime config is loaded through `packages/config/src/index.ts` and `.env.example`.
- Provider secrets are server-only; client bundles are produced by Vite from `apps/web/src/client/*`.

## Implementation Decisions

- Reused OT86A signing primitives and approved-social event schema to keep transport compatible.
- Added a dedicated OT86B event inbox, source, draft, revision, approval, destination binding, command, provider-attempt, and audit model.
- Implemented owner/admin read APIs for readiness and draft lists, but no dedicated browser route; this keeps Buffer logic server-only and avoids dead controls before Buffer accounts exist.
- Added a read-only Buffer canary that performs no writes and reports missing token/org/destination capability classes.
- Added a pg-mem performance probe with production table names and indexes because external Buffer time and account setup are not part of local performance gates.
