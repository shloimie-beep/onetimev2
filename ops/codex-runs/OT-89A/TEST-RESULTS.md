# OT-89A Test Results

## Preimplementation Integrity

| Command                                                                                                                           | Result                            | Acceptance       |
| --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ---------------- |
| Packet ZIP safe path and `SHA256SUMS.txt` validation                                                                              | Pass                              | CONTRACT-01      |
| Python `jsonschema` validation of copied contract example plus negative schema cases                                              | Pass                              | CONTRACT-01      |
| `git ls-remote --exit-code --heads https://github.com/webcraft-media/onetimev2.git refs/heads/codex/ot84-telegram-action-gateway` | Pass                              | BASE-01          |
| `gh auth status`                                                                                                                  | Pass, token masked by tool output | GIT-01 preflight |

## Implementation Validation

| Command                                                                                                                                          | Result                                                                                                                                     | Acceptance                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `npx tsx -` migration smoke using `createMemoryPool()` and `runMigrations()`                                                                     | Pass; last migration `2100_ot89a_subscriber_support_producer`, checksum `b928f174ff622b380e7ba609d16db90f28a53e304bd6789e013f6024e05960f0` | MIG-01                                                                                                                      |
| `npx vitest run --config vitest.unit.config.ts tests/unit/support`                                                                               | Pass; 2 files, 6 tests                                                                                                                     | CONTRACT-01, ATT-01, ATT-02, ATT-03, PRIV-01, OUTBOX-03                                                                     |
| `npx vitest run --config vitest.integration.config.ts tests/integration/support/ot89a-subscriber-support.test.ts`                                | Pass; 1 file, 8 tests                                                                                                                      | AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, ASYNC-01, OUTBOX-01, OUTBOX-02, OUTBOX-03, ATT-04, STATUS-01, IDEM-01, IDEM-02 |
| `node -e "JSON.parse(require('fs').readFileSync('ops/day-one/visible-action-registry.json','utf8')); console.log('visible-action-registry ok')"` | Pass                                                                                                                                       | TASK-01                                                                                                                     |
| `npx vitest run --config vitest.unit.config.ts tests/unit/day-one/visible-action-registry.test.ts`                                               | Pass; 1 file, 4 tests                                                                                                                      | TASK-01                                                                                                                     |

## Full Local Verification

| Command                                                    | Result                                                                                                                                                                                         | Acceptance                  |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `npm run secret:scan`                                      | Pass; scanned 646 repo text files                                                                                                                                                              | PRIV-01, GIT-01             |
| `npm run lint`                                             | Pass                                                                                                                                                                                           | GIT-01                      |
| `npm run typecheck`                                        | Pass                                                                                                                                                                                           | GIT-01                      |
| `npm run build`                                            | Pass; emitted `assets/app-support.js` and completed typecheck                                                                                                                                  | UI-01, STATUS-01, GIT-01    |
| `npm run brand:check` after build                          | Pass                                                                                                                                                                                           | SCOPE-01                    |
| `npm run test`                                             | Pass; 19 files, 94 tests                                                                                                                                                                       | AUTH/OUTBOX/ATT/PRIV/STATUS |
| `CI=1 npm run e2e`                                         | Pass; 22 browser tests                                                                                                                                                                         | UI-01, SCOPE-01             |
| `CI=1 npm run accessibility`                               | Pass; 6 browser tests                                                                                                                                                                          | UI-01                       |
| `CI=1 npm run performance`                                 | Pass; 6 browser tests plus `scripts/check-bundles.ts`                                                                                                                                          | GIT-01                      |
| `npx prettier --check` on OT-89A-touched source/test files | Pass                                                                                                                                                                                           | GIT-01                      |
| `npm run format`                                           | Local Windows checkout failure; 377 pre-existing files reported by repo-wide Prettier check. OT-89A-touched files were formatted and checked separately. PR CI remains the authoritative gate. | GIT-01 tracked caveat       |

## Branch/PR Verification

- Push to `codex/ot89a-subscriber-support-producer`: pass.
- Existing draft PR #36 update: pass via GitHub API fallback after `gh pr edit` required an unrelated `read:project` scope.
- Remote checks observed green on head `ef52728f8b4cca24bb4ce63f4f235cffe7b641ff`:
  - `Node 24 verify`: pass.
  - `PostgreSQL 16 assurance harness`: pass.
  - `PostgreSQL 16 learner-seat proof`: pass.
- Final closeout documentation commit will be pushed and rechecked before handoff.
