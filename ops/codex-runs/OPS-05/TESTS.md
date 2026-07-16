# OPS-05 Test Results

All commands ran in `C:\Users\User\.ops05-worktrees\OPS-05`.

| Command                                                                                                                                                                   | Result                  | Notes                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------- |
| `npm ci`                                                                                                                                                                  | Pass                    | Installed lockfile dependencies in the isolated worktree.                          |
| `npm run typecheck`                                                                                                                                                       | Pass                    | TypeScript strict check passed.                                                    |
| `npx vitest run --config vitest.unit.config.ts tests/unit/ops05/observability-contract.test.ts tests/unit/ops05/health-routes.test.ts`                                    | Pass                    | 6 OPS-05 tests passed before formatting.                                           |
| `npx vitest run --config vitest.unit.config.ts tests/unit/delivery/worker.test.ts`                                                                                        | Pass                    | 7 delivery worker tests passed after shared sanitizer change.                      |
| `npm run secret:scan`                                                                                                                                                     | Pass                    | Secret scan passed across 678 repo text files.                                     |
| `npx prettier --write <OPS-05 changed files>`                                                                                                                             | Pass                    | Formatted only scoped OPS-05 files.                                                |
| `npm run format`                                                                                                                                                          | Known pre-existing fail | Full repo has 455 pre-existing formatting warnings; no world-format was performed. |
| `npm run typecheck`                                                                                                                                                       | Pass                    | Re-run after formatting.                                                           |
| `npx vitest run --config vitest.unit.config.ts tests/unit/ops05/observability-contract.test.ts tests/unit/ops05/health-routes.test.ts tests/unit/delivery/worker.test.ts` | Pass                    | 13 tests passed after formatting.                                                  |
| `npm run secret:scan`                                                                                                                                                     | Pass                    | Re-run after formatting.                                                           |
| `npx prettier --check <OPS-05 changed files>`                                                                                                                             | Pass                    | All matched OPS-05 files use Prettier style.                                       |

Provider canaries, deploy checks, live monitoring configuration, production
data checks, and external sends were not run and are outside this checkpoint.
