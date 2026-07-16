# OPS-02 Resume

Status: waiting_for_ot99_sha
Run ID: OPS-02-20260716T052528Z-610b585f
Packet: OPS-02-20260716T040144Z-40d638ea
Checkpoint branch: codex/ops-02-staging-activation-610b585f
Worktree: C:\Users\User\.ops02-worktrees\onetimev2-OPS-02-20260716T052528Z-610b585f

## Current Blocker

No eligible accepted integrated/OT-99 exact SHA has been found. The only OT-99-like ref discovered in this run was not eligible because it lacked acceptance and check evidence. Do not deploy, create Railway resources, mutate databases, change DNS, send messages, charge cards, create real users, copy production data, or output secrets until a future resolver run returns a non-null eligible SHA with the required evidence.

## Safe Rediscovery Commands

```powershell
git -C C:\Users\User\.ops02-worktrees\onetimev2-OPS-02-20260716T052528Z-610b585f fetch --all --prune --tags
git -C C:\Users\User\.ops02-worktrees\onetimev2-OPS-02-20260716T052528Z-610b585f remote get-url origin
node C:\Users\User\.ops02-worktrees\onetimev2-OPS-02-20260716T052528Z-610b585f\scripts\ops-02\candidate-resolver.mjs --repo C:\Users\User\.ops02-worktrees\onetimev2-OPS-02-20260716T052528Z-610b585f --out C:\Users\User\.ops02-worktrees\onetimev2-OPS-02-20260716T052528Z-610b585f\ops\codex-runs\OPS-02\OPS-02-20260716T052528Z-610b585f\evidence\candidate-resolution-rerun.json
Get-Content C:\Users\User\.ops02-worktrees\onetimev2-OPS-02-20260716T052528Z-610b585f\ops\codex-runs\OPS-02\OPS-02-20260716T052528Z-610b585f\evidence\candidate-resolution-rerun.json -Raw
```

If the rerun still returns `"eligible_candidate": null`, keep OPS-02 in `waiting_for_ot99_sha` and push only checkpoint improvements. If it returns an eligible SHA, record that exact SHA before any external action, create a fresh isolated worktree from that SHA, rerun the static validation suite, and only then proceed to isolated Railway staging preparation under the OPS-02 guard contracts.

## Validation Commands Already Run

```powershell
npm ci
npx prettier --check scripts/ops-02 ops/release/ops-02 .github/workflows/ops-02-static-validation.yml
npx eslint scripts/ops-02
npm run typecheck
node scripts/ops-02/validate-static.mjs ops/codex-runs/OPS-02/OPS-02-20260716T052528Z-610b585f/evidence/static-validation
node scripts/ops-02/evidence-scan.mjs --path ops/codex-runs/OPS-02 --path ops/release/ops-02 --path scripts/ops-02 --out ops/codex-runs/OPS-02/OPS-02-20260716T052528Z-610b585f/evidence/evidence-scan-all.json
git diff --check
```

Known inherited gaps outside this OPS-02 tooling checkpoint:

- `npm run lint` fails in existing product code at `packages/domain/src/lead/service.ts:5:55` for an unused `selectedChannels` import.
- `npm run unit` fails because the referenced `vitest.unit.config.ts` file is absent.
- No `secret:scan` npm script exists; OPS-02 used `scripts/ops-02/evidence-scan.mjs` instead.
