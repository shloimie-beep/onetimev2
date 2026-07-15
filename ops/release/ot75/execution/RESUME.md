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

When running from an OT80 convergence branch instead of the standalone OT75
branch, pass the OT75 merge commit's first parent:

```powershell
node scripts/ot75/validate-release-readiness.mjs --scope-base d7bf846dda1c27aadd61f51c71aa163c70b2b871 --write-report
node scripts/ot75/check-predeploy-gates.mjs --scope-base d7bf846dda1c27aadd61f51c71aa163c70b2b871 --json
```

Do not deploy or mutate Railway, DNS, databases, providers, payments, messages,
real users, or BNA.

Draft PR:

```text
https://github.com/webcraft-media/onetimev2/pull/20
```
