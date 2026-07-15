# OT-71R Test Results

## Initial Verification

| Command                                                                    | Status | Summary                                                                                                 |
| -------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| `Get-Item C:\Users\User\Downloads\OT71-SELF-HEALING-CODEX-PROMPT-PACK.zip` | Passed | Verified the received ZIP exists, is 8306 bytes, and was last written on 2026-07-15 at 09:09:43 +03:00. |
| ZIP entry listing                                                          | Passed | Verified entries for START-HERE, manifest, main prompt, and SHA256 sums.                                |
| SHA256 validation                                                          | Passed | Verified the three input files match `OT71-SHA256SUMS.txt`.                                             |
| `git fetch origin pull/17/head:refs/remotes/origin/pr/17`                  | Passed | Fetched PR #17 into `origin/pr/17`.                                                                     |
| `git rev-parse origin/pr/17`                                               | Passed | Resolved to `dfef7de2035e08f1ee72e0133ccf656fe7a74444`.                                                 |
| `git cat-file -t dfef7de2035e08f1ee72e0133ccf656fe7a74444`                 | Passed | Verified immutable base exists as a commit.                                                             |
| `git worktree add -b codex/ot71-product-core-train ...`                    | Passed | Created the OT-71 worktree and branch from the immutable base.                                          |

## Product Verification

## Phase 1 Verification

| Command                                                                                                                                           | Status | Summary                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                                                                                                                          | Passed | Installed 348 packages from lockfile; npm reported 0 vulnerabilities.                                                                                    |
| `npx vitest run --config vitest.unit.config.ts tests/unit/classes/schedule.test.ts tests/unit/delivery/eligibility.test.ts`                       | Passed | 24 focused unit tests passed for DST/boundary scheduling and delivery eligibility.                                                                       |
| `npx vitest run --config vitest.integration.config.ts tests/integration/classes/class-fulfillment.test.ts tests/integration/lead-capture.test.ts` | Passed | 15 focused integration tests passed for class fulfillment, lead capture, school negatives, owner/admin APIs, portal descriptors, and replay/idempotency. |
| `npm run typecheck`                                                                                                                               | Passed | TypeScript completed successfully after Phase 1 changes.                                                                                                 |
| `npm run lint`                                                                                                                                    | Passed | ESLint completed successfully.                                                                                                                           |
| `npm run build`                                                                                                                                   | Passed | Clean build completed, including public/app Vite bundles, public page build, and typecheck.                                                              |
| `npm run secret:scan`                                                                                                                             | Passed | Secret scan passed across 325 repo text files.                                                                                                           |
| `git diff --check`                                                                                                                                | Passed | No whitespace errors detected.                                                                                                                           |
| `npm run test`                                                                                                                                    | Passed | Full unit and integration suites passed: 92 unit tests and 64 integration tests.                                                                         |
