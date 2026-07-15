# OT-86B Tests

Packet id: OT-86B<br>
Branch: codex/ot86b-buffer-social<br>
Base SHA: 87a1bb7ffd6a2fa0d016a1831894d430aa2ee065<br>
Current head SHA: pending until final commit/push<br>
Generated UTC: 2026-07-15T17:50:30Z

## Passing Commands

| Command                                                                                                                                                          |                 Exit | Evidence                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------: | ----------------------------------------------------------------------------------- |
| `npm install`                                                                                                                                                    |                    0 | Dependencies installed in OT86B worktree.                                           |
| `npm run typecheck`                                                                                                                                              |                    0 | Final rerun passed.                                                                 |
| `npm run lint`                                                                                                                                                   |                    0 | Final rerun passed.                                                                 |
| `npx vitest run --config vitest.integration.config.ts tests/integration/social/ot86b-social-publishing.test.ts`                                                  |                    0 | 1 file, 7 tests passed.                                                             |
| `npx vitest run --config vitest.integration.config.ts tests/integration/content/ot86-content-pipeline.test.ts tests/integration/content/content-library.test.ts` |                    0 | 2 files, 11 tests passed.                                                           |
| `npx vitest run --config vitest.integration.config.ts tests/integration/telegram-db-foundation.test.ts`                                                          |                    0 | 1 file, 2 tests passed.                                                             |
| `npx tsx scripts/ot86/social-performance-probe.ts --write-report`                                                                                                |                    0 | All OT86B performance budgets passed.                                               |
| `npm run brand:check`                                                                                                                                            |                    0 | Manifest, token drift, routes, ticker allowlist, raw source scan passed.            |
| `npm run build`                                                                                                                                                  |                    0 | Production build and typecheck passed.                                              |
| `npm run secret:scan`                                                                                                                                            |                    0 | Secret scan passed across 665 repo text files.                                      |
| `node --check bin\ot86-buffer-canary`                                                                                                                            |                    0 | Canary syntax check passed.                                                         |
| `node bin\ot86-buffer-canary --mode read-only --json; Write-Output "LASTEXITCODE=$LASTEXITCODE"; exit 0`                                                         | 0 wrapper / 2 canary | JSON status `unconfigured`, writes false, missing access token/org/destination ids. |
| `npx prettier --check ...OT86B owned parseable files...`                                                                                                         |                    0 | All matched OT86B-owned files use Prettier style.                                   |

## Expected Blockers / Baseline

| Command             | Exit | Evidence                                                                                           |
| ------------------- | ---: | -------------------------------------------------------------------------------------------------- |
| `npm run db:verify` |    1 | Blocked by missing local `DATABASE_URL`.                                                           |
| `npm run format`    |    1 | Existing repo-wide Prettier baseline failed on 420 files at run time; targeted OT86B check passed. |

## Fixes During Validation

- Removed stale unused imports from the OT86B social integration test.
- Updated the migration foundation test to expect `2100_ot86b_social_publishing` as the newest migration while preserving the OT86A migration assertion.
- Added draft list tie-breaker to the production index and adjusted the performance fixture to measure filtered-list and due-batch paths.
