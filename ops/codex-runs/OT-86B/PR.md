# [OT-86B] Human-approved Buffer social publishing

Packet id: OT-86B<br>
Branch: codex/ot86b-buffer-social<br>
Base SHA: 87a1bb7ffd6a2fa0d016a1831894d430aa2ee065<br>
Current head SHA: pending until final commit/push<br>
Generated UTC: 2026-07-15T17:50:30Z

## Summary

Adds the OT-86B social publishing pipeline stacked on OT-86A: signed approved-social event intake, durable source/draft/approval/command tables, immutable platform draft revisions, exact-revision human approval, scheduled Buffer command generation, read-only Buffer readiness, and safe correction/retraction handling.

## Stacked Dependency

Base: `codex/ot86a-vimeo-content-kb` at `87a1bb7ffd6a2fa0d016a1831894d430aa2ee065`.

## Migrations

Adds additive migration `2100_ot86b_social_publishing.sql` with new OT86B-only tables and indexes. No existing table is altered.

## Event And Privacy Gates

Only authenticated OT86A `content.approved_for_social` events are accepted. Wrong type/origin, invalid signature/checksum/schema, learner/private flags, and unsafe media are rejected before any draft/source write.

## Approval And Scheduler Model

Approvals bind exact revision hash, media order, destination snapshot, capability version, timezone, schedule, and privacy state. Edits invalidate approvals and pending commands. Scheduler selects due commands, reconciles before create, and records sanitized provider attempts.

## Buffer Readiness

Local canary is read-only and currently reports `unconfigured` because Buffer token, organization id, and destination ids are absent. No live post was attempted. Checkpoint is `WAITING_FOR_BUFFER_ACCOUNTS`.

## Tests

- `npm run typecheck` - pass
- `npm run lint` - pass
- `npx vitest run --config vitest.integration.config.ts tests/integration/social/ot86b-social-publishing.test.ts` - pass, 7 tests
- `npx vitest run --config vitest.integration.config.ts tests/integration/content/ot86-content-pipeline.test.ts tests/integration/content/content-library.test.ts` - pass, 11 tests
- `npx vitest run --config vitest.integration.config.ts tests/integration/telegram-db-foundation.test.ts` - pass, 2 tests
- `npm run build` - pass
- `npm run brand:check` - pass
- `npm run secret:scan` - pass
- `npx tsx scripts/ot86/social-performance-probe.ts --write-report` - pass all p95 budgets
- `npm run db:verify` - blocked locally by missing `DATABASE_URL`
- `npm run format` - existing repo-wide baseline fails; OT86B targeted Prettier check passes

## Performance

Probe fixture: 10,000 social sources, 50,000 draft revisions, 10,000 approvals, 10,000 scheduled commands. All p95 budgets pass: event receipt 26.219 ms, list/filter 173.347 ms, detail/preview 1.718 ms, due command selection 79.041 ms, duplicate reconciliation 1.658 ms.

## Rollout / Rollback

Keep Buffer env absent until accounts and destination ids are ready. OT86B can remain disabled without affecting OT86A. If rollback is needed before production adoption, drop/ignore only new `ot86b_*` tables and do not run the scheduler.

## Correction / Retraction

Corrections create new revisions and require new approval/schedule. Retraction reaches `retracted` only after provider confirmation; unsupported delete becomes `retraction_manual_required`.

## Independence

OT86A publication, content library, retrieval, and social outbox tests pass on this branch with Buffer unconfigured.
