MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Audit the exact F02 migration Lease C result.

Require sole parent `ff35555611e7261d1b7b96fc2233eaf82a9f9fdf`,
reconciliation control `1b5e5dd662390dd5affc159990a59b3b8d99c127`, sole
reconciliation parent `85100180449bf234a93f107eb66a1f7bc635b4f0`, claim
`0e98de00-4873-41cb-a06f-bd0ace918b89`, MIGRATION_AUTHORITY lease
`7a7c792d-fe4b-4a83-bbd9-7c6448bf1c95`, SCHEMA_CONTRACT lease
`b7ddd6c3-8a8e-4c9a-a304-5b4c15390fe1`, and READY digest
`5ab53779afff1e0a2a7ae4759818f9a98c259970298449ae767cee788a12b936`.

Require the exact nine-path delta: migrations 2245 through 2249, the allocation
proposal, and the F02 runtime triplet. Confirm only P19, P20, P28, P08, and P09
were implemented and that P17, P18, and P21 remained withheld.

Rerun complete disposable PGlite PostgreSQL and repository-runner pg-mem 80/80
inventories plus focused native and pg-mem probes. Verify all five
normalized-LF/native and pg-mem checksum pairs, next ordinal 2250, typecheck,
lint, YAML, diff, scope, lease release, and effects `0/0/0`. Treat the focused
integration-suite `btrim(text)` failure at pre-existing migration 2235 as a
test-harness baseline issue, not a Lease C migration failure.

Stop for C00 admission. Do not merge, allocate ordinal 2250, inspect providers,
deploy, send, or perform external effects.
