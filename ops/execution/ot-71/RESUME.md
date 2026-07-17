# Resume OT-71R Product Core Train

You are resuming OT-71R for `webcraft-media/onetimev2`.

1. Open `C:\Users\User\OneTimeOneTime-ot71-product-core-train`.
2. Verify repository identity and branch:

```powershell
git remote get-url origin
git branch --show-current
git rev-parse HEAD
git status --short
```

Expected origin: `https://github.com/webcraft-media/onetimev2.git`.

Expected branch: `codex/ot71-product-core-train`.

Expected base ancestry: this branch started from `dfef7de2035e08f1ee72e0133ccf656fe7a74444`.

3. Read these files before work:

```text
ops/execution/ot-71/STATE.json
ops/execution/ot-71/BASE-RESOLUTION.json
ops/execution/ot-71/REMAINING.md
ops/execution/ot-71/CHECKPOINT.md
ops/execution/ot-71/TEST-RESULTS.md
ops/execution/ot-71/INTEGRATION-MANIFEST.md
```

4. Continue at the first pending phase in `STATE.json`; after Phase 5 this is Phase 6 combined proof and publication.
5. Do not rerun the failed OT-71 preflight that required self-referential control-file SHAs.
6. Maintain prohibitions: no deployment, no production/provider mutation, no BNA modification, no production database, no real sends, no charges, no DNS changes, no real users.
7. After each implementation phase, update STATE, CHECKPOINT, IMPLEMENTED, REMAINING, BLOCKERS, TEST-RESULTS, INTEGRATION-MANIFEST, and RESUME; commit intentionally; push `codex/ot71-product-core-train`.

Current Phase 5 status: implemented locally and verified with focused dashboard integration tests, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test`, `npm run accessibility`, `npm run secret:scan`, and `git diff --check`. Next phase: Phase 6 combined proof/publication; prove the full synthetic journey, record CI/screenshots/budgets where available, verify every visible action maps to a real capability, confirm zero BNA/provider/PII leakage, then open one draft PR to `codex/ot60r-recovery-convergence` without merging or deploying.
