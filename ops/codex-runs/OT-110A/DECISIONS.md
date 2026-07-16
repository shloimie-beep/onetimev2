# OT-110A Decisions

## Scope

- Implemented only in `C:\Users\User\.batch-20260716-worktrees\OT-110A`.
- Did not edit BNA product code, Academy content, production config, DNS, payment, sends, or provider accounts.
- Kept the feature under first-party One Time admin Content routes and APIs.

## Architecture

- Added `packages/contracts/src/content/admin-workspace.ts` for shared request/response contracts.
- Added `packages/domain/src/content/admin-workspace.ts` for feature-local admin orchestration, provider-off ports, prompt registry logic, explicit capability resolution, artifact revision writes, and audit events.
- Added migration `packages/db/migrations/2010_ot110a_admin_content_workspace.sql`, the next collision-free migration after base `2009_ops03a_activation_mfa_handoffs.sql`.
- Kept OT-86A publication/projection and OT-86B social tables as upstream sources instead of creating a second provider implementation.
- Did not merge PR #48, #46, or #44 wholesale. OT-110A exposes an admin workspace that OPS-04C can later wire to those branches.

## Authorization

- Owners receive all OT-110A Content capabilities.
- Admins receive only base operational capabilities: `content.view`, `transcript.review`, `artifact.generate`, and `artifact.edit`.
- `prompt.manage`, `social.approve`, `social.schedule`, and `content.revoke` require owner capability or explicit grant rows.
- Parent/student roles are denied from `/api/v1/admin/content/*`.

## Provider-Off Posture

- Vimeo, generation, knowledge index, Buffer, and Telegram are represented by narrow provider-off ports.
- Provider-off ports report missing variable names and `can_mutate_provider=false`.
- Local generation creates deterministic review drafts only and records `provider_mode=provider_off`.
- No queued/sink action claims external provider success.

## UI

- Replaced the old `/app/content` read-only list surface with a lazy route chunk.
- The initial CRM/dashboard/classes routes do not fetch admin content detail, transcripts, social, knowledge, or prompts.
- Detail data loads only for `/app/content/:sourceKey`; other tabs use their own bounded endpoints.

## Verification Decision

- Full repo `db:verify` was attempted and blocked by missing `DATABASE_URL`.
- pg-mem migration proof is covered by focused and adjacent integration tests.
- E2E/accessibility/performance browser sweeps were not run in this lane because the focused server/domain/app build checks passed and a disposable authenticated browser fixture was not available.
