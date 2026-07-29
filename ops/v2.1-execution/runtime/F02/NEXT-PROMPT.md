MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Audit the exact F02 Lease A checksum-metadata correction release.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-f02-schema-state-migrations
Correction claim parent: 1ab8243fc4380104ae2431783f31792197f9ed77
Containing control: 02c58c4258a16f431953dc1e5e5a40a194c7d0d2
Sole acquisition: 174bc6656fbc2a1c0526e7bdec0e361dfd1e7c35
Claim: 937b224d-ee11-4936-82d7-719f177d31da
Shared lease: 08ae9549-daf0-42fc-8938-7c5e5b28030f
Both slots released: 2026-07-29T19:30:25Z
Producer audit: PASS

Require the claim-to-final delta to contain exactly:

- `ops/v2.1-execution/runtime/F02/MIGRATION-ALLOCATIONS-PROPOSAL.yaml`
- `ops/v2.1-execution/runtime/F02/TASK-STATE.yaml`
- `ops/v2.1-execution/runtime/F02/HANDOFF.md`
- `ops/v2.1-execution/runtime/F02/NEXT-PROMPT.md`

Recompute normalized-LF native checksums for SQL 2235 through 2238 as
`44223155…`, `4a9b04d9…`, `7b58a07f…`, and `78651746…`. Independently
reproduce the repository runner's PostgreSQL-only-block-stripped pg-mem
checksums as `abec9635…`, `4a9b04d9…`, `6ad635c5…`, and `58122d19…`.
Confirm the four protected SQL Git blobs remain exactly `70047dd5…`,
`8540bfda…`, `d1cff8b1…`, and `3f48e649…`.

Require YAML parsing, repository Prettier, package validation using Git bytes,
diff/secret hygiene, released MIGRATION_AUTHORITY and SCHEMA_CONTRACT slots,
and effects `0/0/0`. Stop for C00 admission. Do not edit SQL, allocate another
ordinal, apply a registration, inspect a provider, deploy, send, integrate, or
perform any external effect without fresh bounded authorization.
