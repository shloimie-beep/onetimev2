# W12-100 Isolated Staging Deployment Report

Generated: 2026-07-17T20:34:15.9828562+03:00

Status: `blocked_before_staging_mutation`

## Candidate

- Exact accepted W12-100 convergence commit recorded before external action: `ac02ce9cd4f690d3b305b30ec1eef4e18d48cd5c`
- Evidence branch: `codex/w12-100-isolated-staging-deployment-20260717`
- No production deployment, production database access, provider send, provider mutation, or real audience import was performed.

## Identity Readback

Read-only Railway status with explicit selectors matched the required isolated staging identities:

- Project: `one-time-ot99-staging-96b42905` / `7c8eee26-7a6a-4684-826d-9f4377d67d46`
- Environment: `staging` / `11edf8a2-0160-45b4-a039-b15b4beb4c10`
- Web: `ot99-web` / `9fb6d9f4-4f50-4df6-868b-c18a9b83d2f2`
- Worker: `ot99-worker` / `76e7fdc2-99b9-4a82-ba55-5dff3723398f`
- Database: `ot99-pg16` / `7dc5b2ec-03ff-4c22-821d-8df925fe63ee`

However, the local worktree is not Railway-linked. Per the operator stop rule, that blocks staging mutation.

## Before-State

- Staging `/version`: `ops11-1197673`, commit `1197673fa409bfc4c649c2683f782e86775caa5e`
- `/health`: 200
- `/ready`: 200, latest migration `2190_ot109_rabbi_content_publisher`
- Current web deployment: `6e3b45dc-761c-4f4b-a844-f8e4c7aabe6a`
- Current worker deployment: `914c18f8-4f59-4234-930a-932dd89790c4`
- Migration ledger: 35 applied, 3 pending, latest local migration `2202_w12_05_telegram_operations`
- Worker heartbeat: at least one fresh `delivery_outbox` heartbeat was present.

Before-state also reported `email_transport=ok` and `whatsapp_transport=ok` from `/ready`. No provider mode changes were made because the run stopped before any mutation.

## Backup Gate

Blocked before migration/deploy:

- `pg_dump` is not installed locally.
- Railway volume backup metadata could not be read with exact project/environment/service selectors because this CLI subcommand requires a linked project.
- Railway SSH could not be used because no registered SSH key is available.
- No approved backup/PITR metadata source was available through exact-selector read-only commands.

## Not Executed

- Migrations through 2202
- Staging web deploy
- Staging worker deploy
- No-provider smoke
- Rollback rehearsal
- Roll-forward rehearsal
- Draft-ready transition or production deployment

## Evidence

- `IMMUTABLE-CANDIDATE.json`
- `IDENTITY-CHECK.json`
- `BEFORE-STATE.json`
- `BACKUP-GATE.json`
- `EXTERNAL-ACTION-LEDGER.md`
- `live-evidence/*`
