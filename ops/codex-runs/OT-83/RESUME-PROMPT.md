# Resume OT-83

Repository: `webcraft-media/onetimev2`

Worktree: `C:\Users\User\OneTimeOneTime-ot83-household-portals-foundation`

Branch: `codex/ot83-household-portals-foundation`

Current checkpoint commit: `3c5c39327bcc6e4e96cba9016c7d5ea65110aed4`

Read first:

1. `ops/codex-runs/OT-83/ORIGINAL-PROMPT.md`
2. `ops/codex-runs/OT-83/STATE.json`
3. `ops/codex-runs/OT-83/CHECKPOINT.md`
4. `ops/evidence/ot-83/FINAL-REPORT.md`
5. `ops/evidence/ot-83/TEST-MATRIX.md`

Current state:

- Focused parent-managed `revoke_sessions` checkpoint is implemented and locally verified.
- Real local PostgreSQL proof is blocked without an explicitly safe target.
- CI workflow `.github/workflows/ot83-postgres-concurrency.yml` can run the real PostgreSQL 16 learner-seat proof after push/PR.

Exact next action:
Push the branch, open/update a stacked draft PR against `codex/ot82-brand-system-foundation`, then inspect CI for the OT83 PostgreSQL concurrency workflow result.
