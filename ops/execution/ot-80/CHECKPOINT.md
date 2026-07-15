# OT-80 Checkpoint

Updated: `2026-07-15T12:35:00+03:00`

## Phase 0 Status

- Created fresh worktree:
  `C:\Users\User\OneTimeOneTime-ot80-one-shot-final-convergence`.
- Created branch: `codex/ot80-one-shot-final-convergence`.
- Base commit: `dfef7de2035e08f1ee72e0133ccf656fe7a74444`.
- Target remote branch did not exist at freeze time.
- Copied immutable OT80 execution prompt, input manifest, communications
  decisions, and Day-One communications ZIP into `ops/execution/ot-80/`.
- Generated `SOURCE-HEADS.json` from fetched `origin/*` refs.
- Searched fetched remote refs and local OneTime worktrees for the Day-One ZIP
  hash and message-catalog hash. Found no communications implementation lane by
  hash, so OT80 will implement directly from the preserved archive unless a
  later fetch finds a safe descendant lane.

## Frozen Source Heads

| Task  | Branch                                       | Head                                       | Descends from OT60R |
| ----- | -------------------------------------------- | ------------------------------------------ | ------------------- |
| OT-71 | `codex/ot71-product-core-train`              | `e357f5f0fa42d4087e8062113e619181226a5d57` | yes                 |
| OT-72 | `codex/ot72-provider-sandbox-train`          | `62ad1d39242f1a8745ad5da5c2a016301eb276c3` | yes                 |
| OT-73 | `codex/ot73-landing-intent-reconciliation`   | `ed2074254863468b4a70a0a3304490486ab2b71e` | yes                 |
| OT-74 | `codex/ot74-audience-reconciliation`         | `51cd99dc4434f0354ba229620ebe89558efeb120` | yes                 |
| OT-75 | `codex/ot75-release-observability-readiness` | `028a05f3e44a7b37c2395576aa3800f507dd5268` | yes                 |
| OT-76 | `codex/ot76-day-one-certification-harness`   | `b9ece3146d2de6edc9f386712fad146f17b18031` | yes                 |

Exact merge bases, commit counts, and changed-file lists are in
`SOURCE-HEADS.json`.

## Commands Run

- `git fetch origin --prune` - passed.
- Remote head freeze - passed.
- Source ancestry checks - passed for OT-71 through OT-76.
- Remote hash search for communications ZIP/catalog hash - no matches.
- Local OneTime worktree hash search for communications ZIP/catalog hash - no
  matches.
- `git worktree add -b codex/ot80-one-shot-final-convergence ...` - passed.

## Phase 0 Closeout

Phase 0 checkpoint was committed as `b90f481` and pushed to
`origin/codex/ot80-one-shot-final-convergence`.

## OT-71 Integration

- Merged `origin/codex/ot71-product-core-train` without conflicts.
- Source head:
  `e357f5f0fa42d4087e8062113e619181226a5d57`.
- Merge commit:
  `d3f60f76c15cc5c148c634bea1b6ff1066be72b4`.
- OT-71 source evidence says Phase 6 combined proof/publication remains
  pending; OT80 will complete that after all lanes converge.

Verification after merge:

- `npm ci` - PASS, 348 packages installed, 0 vulnerabilities.
- Initial checks before `npm ci` failed because the fresh worktree lacked
  `node_modules`; after install, the checks below passed.
- `npm run typecheck` - PASS.
- `npx vitest run --config vitest.unit.config.ts tests/unit/classes/schedule.test.ts tests/unit/content/redaction.test.ts tests/unit/delivery/eligibility.test.ts` - PASS, 25 tests.
- `npx vitest run --config vitest.integration.config.ts tests/integration/accounts/account-lifecycle.test.ts tests/integration/classes/class-fulfillment.test.ts tests/integration/content/content-library.test.ts tests/integration/dashboard/owner-dashboard.test.ts tests/integration/portals/portal-mount.test.ts tests/integration/lead-capture.test.ts tests/integration/telegram-db-foundation.test.ts` - PASS, 28 tests.
- `npm run secret:scan` - PASS after Phase 0 and before OT-71 merge.
- `git diff --check` - PASS after Phase 0 and before OT-71 merge.

## OT-74 Integration

- Merged `origin/codex/ot74-audience-reconciliation`.
- Source head:
  `51cd99dc4434f0354ba229620ebe89558efeb120`.
- Merge commit:
  `29ab2b1888ab2f6c00892f7f353921fe5aabb638`.
- Resolved one conflict in `ops/execution/registry.json`.
- Chose the legacy `audience-reconciliation` path as canonical.
- Retained `1201_ot74_legacy_audience_reconciliation.sql`.
- Removed duplicate generic `audience` import-preview product code and
  migration `1200_ot74_audience_reconciliation.sql` from the merge result.

Verification after canonicalization:

- `npm run typecheck` - PASS.
- `npx vitest run --config vitest.unit.config.ts tests/unit/ot74-audience-reconciliation.test.ts tests/unit/ot74-audience-panel.test.ts` - PASS, 6 tests.
- `npx vitest run --config vitest.integration.config.ts tests/integration/ot74-audience-repository.test.ts tests/integration/ot74-audience-router.test.ts` - PASS, 8 tests.
- `npx tsx scripts/ot74/audience-dry-run.ts --rows=10000` - PASS, counts-only output with no production side effects.

## OT-72 Integration

- Merged `origin/codex/ot72-provider-sandbox-train`.
- Source head:
  `62ad1d39242f1a8745ad5da5c2a016301eb276c3`.
- Merge commit:
  `bdddf576fc39615d9b6cb6414695651de33d331d`.
- Resolved one conflict in `tests/integration/telegram-db-foundation.test.ts`.
- Preserved OT72 PostgreSQL assurance teardown guard.
- Renamed provider-truth migration from source-lane
  `1700_ot72_provider_truth.sql` to
  `1800_ot72_provider_truth.sql`.

Verification after renumbering:

- `npm run typecheck` - PASS.
- `npx vitest run --config vitest.unit.config.ts tests/unit/ot72-provider-adapters.test.ts` - PASS, 8 tests.
- `npx vitest run --config vitest.integration.config.ts tests/integration/ot72-provider-truth.test.ts tests/integration/telegram-db-foundation.test.ts` - PASS, 3 tests.

## Day-One Communications Integration

- Implemented directly from preserved archive
  `ops/execution/ot-80/audit-inputs/OT-DAYONE-COMMUNICATIONS-COPY-PACK.zip`.
- Product commit:
  `aae879aea3ddbfce2ecdf8356c36711ef6a5e016`.
- Added server-owned catalog source metadata and 19 source message keys.
- Replaced active delivery copy for Family acknowledgement, Family class
  reminder, and internal lead-alert paths.
- Removed active School public email/WhatsApp receipt paths from lead capture,
  delivery supported pairs, worker claim predicates, Communications filters,
  and visible UI options.
- Required protected One Time app route before class reminder delivery.

Verification:

- `npm run typecheck` - PASS.
- `npx vitest run --config vitest.unit.config.ts tests/unit/delivery/catalog.test.ts tests/unit/delivery/eligibility.test.ts tests/unit/lead-validation.test.ts tests/unit/communications/communications-contract.test.ts` - PASS, 37 tests.
- `npx vitest run --config vitest.integration.config.ts tests/integration/lead-capture.test.ts tests/integration/delivery/outbox-pipeline.test.ts tests/integration/delivery/postgres-repository.test.ts tests/integration/classes/class-fulfillment.test.ts tests/integration/communications/api.test.ts` - PASS, 38 tests.
- `npm run secret:scan` - PASS across 426 repo text files.
- `git diff --check` - PASS with line-ending warnings only.

## OT-73 Integration

- Merged `origin/codex/ot73-landing-intent-reconciliation`.
- Source head:
  `ed2074254863468b4a70a0a3304490486ab2b71e`.
- Merge commit:
  `ef16bd84ee4aaacd2a76ff7d0bbb97646dfbd4e2`.
- Preserved the corrected-addendum campaign ticker and removed stale price,
  trial, and no-card promotional copy from public landing surfaces.
- Retained local/self-hosted DM Serif Display assets and the OT73 public-page
  layout/copy changes.
- Reconciled signup success behavior with the Day-One communications catalog:
  Family and School success copy remain domain-owned; School submissions do
  not promise class access, reminders, portal accounts, or public email/WhatsApp
  sends.
- Updated the generated signup fallback success panel to use
  `successCopy('family')` instead of stale hardcoded class-details copy.
- Added OT73 public route/action coverage to the OT80 action-route registry.

Verification:

- `npm run typecheck` - PASS.
- `npx vitest run --config vitest.unit.config.ts tests/unit/lead-validation.test.ts tests/unit/delivery/catalog.test.ts` - PASS, 10 tests.
- `npm run build` - PASS, including public/app Vite builds, public page generation, and typecheck.
- `npx vitest run --config vitest.integration.config.ts tests/integration/lead-capture.test.ts tests/integration/communications/api.test.ts` - PASS, 14 tests.
- `npx playwright test tests/e2e/landing-signup.spec.ts --reporter=line` - PASS, 7 tests.

## OT-75 Integration

- Merged `origin/codex/ot75-release-observability-readiness`.
- Source head:
  `028a05f3e44a7b37c2395576aa3800f507dd5268`.
- Merge commit:
  `9ce81a9c5df4c3eb82af3954705d7b381d294c6e`.
- OT75 remained preparation-only: release contracts, observability contracts,
  runbooks, deployment descriptors, validation scripts, release-only unit test,
  and a unique static GitHub workflow.
- Added conductor-aware `--scope-base` / `OT75_SCOPE_BASE_SHA` support to the
  validator and no-runtime-composition drift gate. The default standalone OT75
  behavior still validates against the immutable OT60R base.
- No runtime wiring, database migration, provider code, package script, root
  deployment descriptor, deployment, send, payment, or real-user mutation was
  performed.

Verification:

- Initial unscoped `node scripts/ot75/validate-release-readiness.mjs --write-report` - EXPECTED FAIL in OT80 conductor mode because prior OT80 lanes are outside OT75-owned paths.
- `node scripts/ot75/validate-release-readiness.mjs --scope-base d7bf846dda1c27aadd61f51c71aa163c70b2b871 --write-report` - PASS, 327 checks.
- `node scripts/ot75/check-predeploy-gates.mjs --scope-base d7bf846dda1c27aadd61f51c71aa163c70b2b871 --json --out ops/release/ot75/evidence/predeploy-gates.local.json` - PASS in non-failing mode; 11 activation-only blockers, no-runtime-composition drift passed, zero external mutations.
- `node --check scripts/ot75/validate-release-readiness.mjs` - PASS.
- `node --check scripts/ot75/check-predeploy-gates.mjs` - PASS.
- `node --check scripts/ot75/render-release-manifest.mjs` - PASS.
- `npx vitest run --config vitest.unit.config.ts tests/unit/ot75/release-readiness.test.ts` - PASS, 6 tests.
- `npm run typecheck` - PASS.
- `npm run lint` - PASS.
- `npx prettier --check .github/workflows/ot75-release-readiness.yml ops/release/ot75 ops/observability/ot75 scripts/ot75 tests/unit/ot75` - PASS.

Next: commit and push this OT75 checkpoint, then integrate OT76 strict
certification harness.
