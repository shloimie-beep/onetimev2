# Resume OT-60R Recovery Convergence

You are resuming OT-60R for `webcraft-media/onetimev2`.

1. Open `C:\Users\User\OneTimeOneTime-ot60r-recovery-convergence`.
2. Verify the repository and branch:

```powershell
git remote get-url origin
git branch --show-current
git rev-parse HEAD
git status --short
```

Expected origin: `https://github.com/webcraft-media/onetimev2.git`.

Expected branch: `codex/ot60r-recovery-convergence`.

3. Read these files before work:

```text
ops/execution/ot-60r/STATE.json
ops/execution/ot-60r/REMAINING.md
ops/execution/ot-60r/CHECKPOINT.md
ops/execution/ot-60r/TEST-RESULTS.md
ops/evidence/ot-60r/FINAL-REPORT.md
```

4. Continue at the first unfinished phase. Do not repeat completed integration units unless the state file says the prior attempt was reverted.
5. Maintain the prohibitions: no deployment, no production/provider mutation, no BNA modification, no production DB, no real sends, no charges, no DNS changes, no real users.
6. After every successful unit, update `STATE.json`, `CHECKPOINT.md`, `IMPLEMENTED.md`, `REMAINING.md`, `TEST-RESULTS.md`, evidence files, commit intentionally, and push `codex/ot60r-recovery-convergence`.

Current first unfinished phase after PR #6 / OT-37: push/check the GitHub Actions PostgreSQL proof, then continue PR #10 / OT-47 evidence-only handling.
