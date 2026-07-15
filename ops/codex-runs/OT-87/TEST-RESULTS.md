# OT-87 Test Results

## Initial Environment

| Command                                                                                                                           | Exit | Result                                            |
| --------------------------------------------------------------------------------------------------------------------------------- | ---: | ------------------------------------------------- |
| `git remote get-url origin`                                                                                                       |    0 | `https://github.com/webcraft-media/onetimev2.git` |
| `git fetch origin refs/heads/codex/ot83-household-portals-foundation:refs/remotes/origin/codex/ot83-household-portals-foundation` |    0 | Source ref fetched.                               |
| `git ls-remote --heads origin refs/heads/codex/ot87-stripe-test-entitlements`                                                     |    0 | No target remote branch output; target absent.    |
| `git rev-parse refs/remotes/origin/codex/ot83-household-portals-foundation`                                                       |    0 | `a02d1d254ae0d17804fb657079a7871567260ea2`.       |
| `node --version`                                                                                                                  |    0 | `v24.13.0`.                                       |
| `npm --version`                                                                                                                   |    0 | `11.6.2`.                                         |

No product tests have been run yet. No protected Stripe configuration has been inspected.

## Local Verification

| Command                                                                                                                                                         | Exit | Result                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---: | ------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                                                                                                                             |    0 | TypeScript strict typecheck passed.                                                               |
| `npm run lint`                                                                                                                                                  |    0 | ESLint passed.                                                                                    |
| `npm run unit`                                                                                                                                                  |    0 | 20 files / 122 tests passed.                                                                      |
| `npm run integration`                                                                                                                                           |    0 | 19 files / 88 tests passed.                                                                       |
| `npm run secret:scan`                                                                                                                                           |    0 | Secret scan passed across 622 repo text files.                                                    |
| `npm run brand:check`                                                                                                                                           |    0 | Brand manifest, token drift, routes, ticker allowlist, and raw source scan passed.                |
| `npm run build`                                                                                                                                                 |    0 | Production client/pages/typecheck build passed; existing public font path warning emitted.        |
| `npx vitest run --config vitest.integration.config.ts tests/integration/ot87-billing-entitlements.test.ts tests/integration/ot46-billing-services.test.ts`      |    0 | 2 files / 11 tests passed.                                                                        |
| `npx vitest run --config vitest.unit.config.ts tests/unit/ot72-provider-adapters.test.ts tests/unit/ot46-billing-config-policy.test.ts`                         |    0 | 2 files / 25 tests passed.                                                                        |
| `npm run stripe:test:resources:validate -- --output=ops/codex-runs/OT-87/stripe-test-resources-validate.json` with `LIVE_STRIPE_CHARGES_AUTHORIZED=NO`          |    1 | Expected fail-closed waiting state; protected Stripe TEST resources absent; zero mutations.       |
| `npm run stripe:test:resources:setup -- --output=ops/codex-runs/OT-87/stripe-test-resources-setup-dry-run.json` with `LIVE_STRIPE_CHARGES_AUTHORIZED=NO`        |    1 | Expected dry-run blocked state; no setup authorization/protected store/resources; zero mutations. |
| `npm run billing:reconcile:test -- --scope=family --dry-run --output=ops/codex-runs/OT-87/reconciliation/dry-run.json` with `LIVE_STRIPE_CHARGES_AUTHORIZED=NO` |    1 | Expected fail-closed waiting state; Stripe TEST resources and `DATABASE_URL` absent; zero writes. |

## Known Non-Blocking Verification Note

- `npm run format` exits 1 because `prettier --check .` reports 359 pre-existing formatting warnings across unrelated files. The OT-87 edited TypeScript, JSON, CSS, and test files were formatted directly with `npx prettier --write`.
