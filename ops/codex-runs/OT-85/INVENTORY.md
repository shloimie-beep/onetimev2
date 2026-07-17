# OT-85 Inventory

## Packet

- Source ZIP: `C:\Users\User\Downloads\OT85-whatsapp-assistant-codex-packet.zip`.
- Extracted folder: `C:\Users\User\Downloads\OT85-whatsapp-assistant-codex-packet-extracted-20260715-192025`.
- Checksum file: `SHA256SUMS.txt`; all listed packet files verified before implementation.
- Primary prompt: `01-DIRECT-CODEX-PROMPT.md`.
- Supporting files read: conversation state machine, intent/entity contract, consent/suppression rules, identity linking design, provider adapter contract, copy examples, negative tests, canary plan, resume report, acceptance checklist.
- The separate PRO factory artifact was not used.

## Repository And Base

- Repository slug: `webcraft-media/onetimev2`.
- Worktree: `C:\Users\User\.onetime-worktrees\ot85-whatsapp-lead-assistant`.
- Branch: `codex/ot85-whatsapp-lead-assistant`.
- Base: `origin/codex/ot83-household-portals-foundation` at `a02d1d254ae0d17804fb657079a7871567260ea2`.
- Base PR: `#27`, base branch `codex/ot82-brand-system-foundation`.

## Relevant Existing Architecture

- Web app: Express app in `apps/web/src/server/app.ts`.
- Config: `packages/config/src/index.ts`.
- Contracts: `packages/contracts/src/index.ts`.
- Domain services: `packages/domain/src`.
- Database: forward-only SQL migrations in `packages/db/migrations`; runtime schema creation is not used by web code.
- Existing lead capture: `packages/domain/src/lead/service.ts`; inspected and not reused for OT-85 persistence because it requires email semantics and can update archived contacts.
- Existing Telegram runtime: `packages/domain/src/telegram` and `apps/telegram-bot`; inspected for separation only and not reused for WhatsApp identity/runtime.
- Existing auth/session/CSRF: `packages/domain/src/auth/service.ts` and Express helpers in `apps/web/src/server/app.ts`; reused for the account-link consume route.
- Existing portal authorization tables: `portal_households` and `portal_guardian_relationships`; used for short-lived safe-status grants.

## Implemented Files

- `packages/db/migrations/2000_ot85_whatsapp_assistant.sql`
- `packages/contracts/src/whatsapp/index.ts`
- `packages/domain/src/whatsapp/crypto.ts`
- `packages/domain/src/whatsapp/intent.ts`
- `packages/domain/src/whatsapp/provider.ts`
- `packages/domain/src/whatsapp/public-facts.ts`
- `packages/domain/src/whatsapp/service.ts`
- `scripts/ot85/canary-readiness.ts`
- Express routes in `apps/web/src/server/app.ts`
- Config additions in `.env.example` and `packages/config/src/index.ts`
- Exports in `packages/contracts/src/index.ts` and `packages/domain/src/index.ts`
- Tests in `tests/unit/whatsapp` and `tests/integration/whatsapp`
