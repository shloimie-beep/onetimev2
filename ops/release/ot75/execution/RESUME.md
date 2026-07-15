# Resume OT-75

Open:

```powershell
C:\Users\User\OneTimeOneTime-ot75-release-observability-readiness
```

Verify:

```powershell
git remote get-url origin
git branch --show-current
git rev-parse HEAD
git status --short
```

Expected branch:

```text
codex/ot75-release-observability-readiness
```

Run:

```powershell
node scripts/ot75/validate-release-readiness.mjs --write-report
node scripts/ot75/check-predeploy-gates.mjs --json
npx vitest run --config vitest.unit.config.ts tests/unit/ot75/release-readiness.test.ts
npm run secret:scan
```

Do not deploy or mutate Railway, DNS, databases, providers, payments, messages,
real users, or BNA.
