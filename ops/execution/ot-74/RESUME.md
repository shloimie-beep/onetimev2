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
- Keep OT-74 APIs/components feature-local and unmounted. OT-80 will wire them.
- Update `ops/execution/ot-74/STATE.json` after phases, blockers, tests, commits, push, and PR creation.

Next steps:

1. Verify migration namespace `1200-1299` is free.
2. Implement feature-local legacy audience reconciliation schema/domain/import dry-run foundation.
3. Add synthetic fixtures/tests/evidence and OT-80 wiring instructions.
4. Commit and push phase checkpoints, then open a draft PR against `codex/ot60r-recovery-convergence`.
