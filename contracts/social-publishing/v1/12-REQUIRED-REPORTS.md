# Exact OT-86B run reports

Create under `ops/codex-runs/OT-86B/`. Each Markdown report begins with packet id, branch, base SHA, current head SHA, and UTC generated time. Include exact commands and exit codes; never include provider secrets or private content.

1. `RUN.json` — atomic run ledger, status, actual remote base, steps, command results, checkpoint, push, and PR URL/error.
2. `DISCOVERY.md` — OT-86A contract/transport evidence; social/admin roots; existing queue/scheduler/authz/audit/provider conventions; implementation decisions.
3. `OWNED-ROOTS.json` — machine-readable changed-path allowlist.
4. `IMPLEMENTATION.md` — event inbox, data model, renderers/previews, approval invalidation, scheduler, adapter, correction/retraction, UI readiness, and OT-86A independence.
5. `DATA-MODEL.md` — entities, immutable revisions, keys/constraints/indexes, audit/retention, leases, provider reconciliation, and ownership.
6. `MIGRATIONS.md` — ids, additive proof, empty/upgrade commands, durations, effects, rollback/disable strategy.
7. `CONTRACT-VALIDATION.md` — exact OT-86A schema comparison, runtime validator paths, valid/invalid fixture matrix, publish-command schema, and compatibility result.
8. `TESTS.md` — exact unit/integration/lint/typecheck/build/migration/regression commands, exit codes, fixes, and external tests not run.
9. `SECURITY-PRIVACY.md` — B-NEG-001 through B-NEG-032 mapping; authz, privacy, preview escaping, no-auto-publish, secret-scan, server-only, and audit evidence.
10. `PERFORMANCE.md` — fixture scale, commands, p50/p95/max, query plans, scheduler contention, bundle delta, and each boundary result.
11. `BUFFER-READINESS.md` — safe adapter/readiness states, read-only canary result, destination capability classes, missing configuration classes, UI behavior, and explicit statement that no live post was attempted unless normal approved scheduling actually ran.
12. `OT86A-REGRESSION.md` — commands/results proving OT-86A publication, local library, retrieval, and outbox do not depend on OT-86B.
13. `PR.md` — exact PR body: summary, stacked dependency, migrations, event/privacy gates, approval/scheduler model, Buffer readiness, tests, performance, rollout/rollback, correction/retraction, and independence.
14. `CHECKPOINT` — present only when external account readiness is missing; exact content `WAITING_FOR_BUFFER_ACCOUNTS` plus newline.

`RUN.json` lists SHA-256 for every report. Status is `completed` only after all gates, commit, push, and PR succeed with live account readiness; `checkpoint_waiting_for_buffer_accounts` when only the permitted external account capability is missing; otherwise `failed`.
