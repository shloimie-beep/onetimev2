# OT-60R Remote State

Audited with `gh pr view` and `git` from the standalone `webcraft-media/onetimev2`
worktree. Sanitized raw PR metadata is stored under
`ops/evidence/ot-60r/remote-pr-json/` with commit author identity fields removed.

Canonical base:

- `origin/codex/crm-core-v1` -> `4ac288968ba24e30a5c3f8c6924f492eedf4338f`
- Required foundation ancestor `3465bd7d4c6b6829a6be6e4b4f8a003d608f3680`: verified.
- Required common integration ancestor `a73458d1884b8fcb4843c4852425009577f59ef7`: verified.

## PR/Head Inventory

| PR | State | Draft | Merge status | Head | Base | Merge base with canonical base | Files | Migration files | Evidence files |
| --- | --- | --- | --- | --- | --- | --- | ---: | --- | ---: |
| #2 | OPEN | true | UNSTABLE | `4ac288968ba2` | `codex/foundation-landing-lead-v1@3465bd7d4c6b` | `4ac288968ba2` | 39 | `0002_crm_auth_core.sql`, `0003_ot27_security_crm_repair.sql` | 12 |
| #3 | OPEN | true | DIRTY | `87f9b315c54e` | `codex/crm-core-v1@a73458d1884b` | `a73458d1884b` | 13 | `0003_first_slice_hardening.sql` | 1 |
| #4 | OPEN | true | CLEAN | `61d4755fe279` | `codex/crm-core-v1@a73458d1884b` | `a73458d1884b` | 32 | `0004_delivery_worker_claim_index.sql` | 2 |
| #5 | OPEN | true | DIRTY | `6ca5e568c328` | `codex/crm-core-v1@a73458d1884b` | `a73458d1884b` | 18 | none | 12 |
| #6 | OPEN | true | UNSTABLE | `0ea782d8551c` | `codex/crm-core-v1@4ac288968ba2` | `a73458d1884b` | 5 | none | 1 |
| #7 | OPEN | true | CLEAN | `c1584577780d` | `codex/ot35-app-shell-crm-clarity@6ca5e568c328` | `a73458d1884b` | 22 | none | 11 |
| #8 | OPEN | true | CLEAN | `571b18f36cdc` | `codex/ot36-delivery-sink-foundation@61d4755fe279` | `a73458d1884b` | 17 | `0004_delivery_worker_claim_index.sql` | 1 |
| #9 | OPEN | true | CLEAN | `245649523566` | `codex/ot34-first-slice-core-hardening@87f9b315c54e` | `a73458d1884b` | 25 | `0005_privileged_mfa_security_completion.sql` | 1 |
| #10 | OPEN | true | UNSTABLE | `9444176dbc55` | `codex/parallel-base-a73458d@a73458d1884b` | `a73458d1884b` | 13 | none | 13 |
| #11 | OPEN | true | CLEAN | `b2c159a060d` | `codex/parallel-base-ot39-c158457@c1584577780d` | `a73458d1884b` | 14 | `1000_ot42_crm_module_v1.sql` | 3 |
| #12 | OPEN | true | CLEAN | `f4e4fb1dc202` | `codex/parallel-base-a73458d@a73458d1884b` | `a73458d1884b` | 28 | `1300_ot46_billing_foundation.sql` | 13 |
| #13 | OPEN | true | CLEAN | `e235af05759f` | `codex/parallel-base-a73458d@a73458d1884b` | `a73458d1884b` | 26 | `1600_ot51_telegram_bot_foundation.sql` | 14 |
| #14 | OPEN | true | CLEAN | `76cae19be515` | `codex/parallel-base-ot40-571b18f@571b18f36cdc` | `a73458d1884b` | 40 | none | 25 |
| #15 | OPEN | true | CLEAN | `9594c228b9ac` | `codex/parallel-base-ot38-2456495@245649523566` | `a73458d1884b` | 35 | `1500_ot52_portal_households_learners.sql` | 24 |

## Required Commit Existence

All requested input commits resolved as Git commit objects:

- `6ca5e568c328ea116a9413b57ea5920400f8bc14`
- `c1584577780d7b5125bce4fb81d2a454c9e84096`
- `b2c159a060d8aa50ec6feb69f1cae003fd633bf3`
- `61d4755fe279ca47c37e7adbe8d1e6ce8b258dae`
- `571b18f36cdc645f757cc3be6b0519f1af3225f6`
- `76cae19be515ee896f22d0da976082a09d1d25d6`
- `f4e4fb1dc202f8b17bbf1747c82ae3b0c1c5c899`
- `e235af05759f0a97496552c6e8aabed7ba3eee18`
- `9594c228b9ac3047f42bb9e8c804384cc45a3e40`
- `0ea782d8551c26edd48b08d644b573e19b9835b1`
- `9444176dbc55e0c5af048ec1df2ea75ffa8dde33`

## Branch Absence Checks

- `git ls-remote --heads origin '*ot41*' '*OT41*' '*ot-41*' '*OT-41*'`: no matching heads.
- `git ls-remote --heads origin '*ot43*' '*OT43*' '*ot-43*' '*OT-43*'`: no matching heads.
- `git ls-remote --heads origin '*ot60*' '*OT60*' '*ot-60*' '*OT-60*'`: only the newly created `codex/ot60r-recovery-convergence` head. Before branch creation, explicit target-branch checks returned no local or remote branch.

## PR #4 Commit Range

Feature range `a73458d1884b8fcb4843c4852425009577f59ef7..61d4755fe279ca47c37e7adbe8d1e6ce8b258dae` contains:

1. `3a9588555f9159e4c1a7a554780be66499f2d2d8`
2. `61d4755fe279ca47c37e7adbe8d1e6ce8b258dae`
