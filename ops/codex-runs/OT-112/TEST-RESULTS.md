# OT-112 Test Results

## Passed

| Command                                                                                      | Outcome                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run brand:fixtures`                                                                     | Passed. Generated `visual-fixture-gallery.html` and `visual-matrix.json` with 15 component contracts and 864 matrix rows.                                                                                 |
| `npm run brand:check`                                                                        | Passed. Manifest, token drift, 27 branded routes, ticker allowlist, raw source scan, navigation labels, low-opacity scan, touch target budget, component coverage, and pre-usable screenshot bans passed. |
| `npx vitest run --config vitest.unit.config.ts tests/unit/brand-system/brand-system.test.ts` | Passed. 4 tests.                                                                                                                                                                                          |
| `npm run brand:visual`                                                                       | Passed. 2 Playwright tests. Captured OT-112 fixture screenshots under `ops/evidence/ot-112/screenshots/`.                                                                                                 |
| `npm run typecheck`                                                                          | Passed.                                                                                                                                                                                                   |
| `npm run lint`                                                                               | Passed.                                                                                                                                                                                                   |
| `npm run secret:scan`                                                                        | Passed. 916 repo text files scanned.                                                                                                                                                                      |
| `npm run build`                                                                              | Passed. Vite emitted the inherited runtime font-resolution warning for `/assets/fonts/dm-serif-display-latin.woff2`; build completed and typecheck passed.                                                |
| `npx tsx scripts/check-bundles.ts`                                                           | Passed. Public JS 12,083 bytes raw / 3,787 gzip; public CSS 16,485 raw / 4,464 gzip; public pages do not include app CRM bundle.                                                                          |
| `PORT=3112 npx playwright test tests/e2e/brand-system.spec.ts`                               | Passed. 4 tests. OT-82 evidence artifacts were restored afterward because they are outside OT-112 scope.                                                                                                  |
| `PORT=3113 npx playwright test tests/accessibility/public-a11y.spec.ts`                      | Passed. 3 tests.                                                                                                                                                                                          |
| `PORT=3114 npx playwright test tests/performance/public-performance.spec.ts`                 | Passed. 3 tests.                                                                                                                                                                                          |
| `npx prettier --check <OT-112 changed files and generated evidence>`                         | Passed after targeted formatting.                                                                                                                                                                         |

## Blocked Or Inherited

| Command          | Outcome                                                                                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run format` | Failed on 595 pre-existing repo files outside this lane, plus broad historical artifacts. OT-112-owned changed files and generated evidence pass targeted Prettier checks. |

## Guardrail Proof

- No deployment was attempted.
- No provider, Stripe, Zoom, Telegram, WhatsApp, Vimeo, Buffer, member access, production data, BNA file, broad send, live charge, or DNS mutation was performed.
- PR #47 head `c64a58ae9a72515fc6135cc2be0f72340c30f49c` was inspected only and not merged.
- Work was performed in isolated worktree `C:\Users\User\.overnight-20260717-worktrees\OT-112`.
