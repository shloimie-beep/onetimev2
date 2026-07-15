# Resume OT-74 Legacy Audience Reconciliation

You are resuming OT-74 for `webcraft-media/onetimev2`.

Worktree:

`C:\Users\User\Documents\Codex\2026-07-15\files-mentioned-by-the-user-codex-3\work\onetimev2-ot74`

Branch:

`codex/ot74-audience-reconciliation`

Immutable base:

`dfef7de2035e08f1ee72e0133ccf656fe7a74444`

PR base:

`codex/ot60r-recovery-convergence`

Rules:

- Production import, send, deployment, provider mutation, and production database writes are forbidden.
- Use synthetic fixtures only. Do not ingest real spreadsheets or print row contents.
- Do not edit `app.ts`, AppShell, central CRM entry, shared barrels, root packages, provider workers, or OT-71/OT-72 paths.
- Keep OT-74 APIs/components feature-local and unmounted. OT-80 will wire the chosen hooks.
- Update `ops/execution/ot-74/STATE.json` after phases, blockers, tests, commits, push, and PR creation.

Implemented:

- Remote audience line: contracts/domain/parser/reconciliation, migration `1200_ot74_audience_reconciliation.sql`, unmounted router/preview, synthetic fixtures, dry-run evidence, and tests.
- Local legacy-audience line: migration `1201_ot74_legacy_audience_reconciliation.sql`, feature-local contracts/domain/repository/router/panel/tool/tests, evidence, and OT-80 wiring instructions.
- Local PostgreSQL 16 proof is unavailable because `psql` and Docker are not installed.

Next steps:

1. Push the merge-resolution checkpoint.
2. Open a draft PR against `codex/ot60r-recovery-convergence`.
3. Record final head SHA and PR URL in `ops/execution/ot-74/STATE.json`.
