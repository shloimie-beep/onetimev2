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

No product tests have run yet on OT-71 changes. The first product-code test set belongs to Phase 1.
