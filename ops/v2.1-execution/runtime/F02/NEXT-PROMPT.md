MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Finish and then audit the exact F02 migration Lease D1 result.

Require pushed split control `4ea98556cd03ccc0df1a5286d61ee3cfdbfb82b4`,
sole parent/controller `4b22c4704edc8bd21b0e0242ad00debfba67f5c2`,
authorized start `6d16d6eb2c901c58cc4d0c2bb3298b5543af3d9f`, claim
`3469667a-69e2-4c35-afac-5b1dfbbf417d`, MIGRATION_AUTHORITY lease
`7f2ab8d1-a53f-41da-8143-28da4b62b200`, and SCHEMA_CONTRACT lease
`9a3469a3-87c6-45b6-824f-c3b886a01b46`.

Require the exact six-path committed delta: migrations 2250 and 2251, the
allocation proposal, and the F02 runtime triplet. Confirm only
`P17-MIGRATION-002` and `P18-migration-003` were implemented, with exact
canonical digests `e4aed5ae...24ca` and `a7fea380...1960`. Treat the delegated
P17 `e4aed5d9...` value only as the confirmed transcription error. Confirm the
draft 2252 remains untracked and absent from both commits.

Require exact five/four P17/P18 table ownership, existing
`job_outbox`/`provider_operation_binding` reuse, and absence of a
`provider_operations` table. Rerun the complete disposable PGlite PostgreSQL
and repository-runner pg-mem 82/82 inventories plus 26/26 P17 fail-closed and
35/35 focused D1 semantic native probes. Verify both normalized-LF/native and
pg-mem checksum pairs, next ordinal 2252, YAML, formatting, secret scan, diff
hygiene, exact committed scope, dual-lease
release before `2026-07-30T13:34:41Z`, remote equality, and effects `0/0/0`.

Stop for C00 admission. Do not commit 2252, merge, allocate ordinal 2252,
inspect providers, deploy, send, or perform external effects.
