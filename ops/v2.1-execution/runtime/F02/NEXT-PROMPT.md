MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Audit the exact F02 Migration Lease A release.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-f02-schema-state-migrations
Atomic claim head: 0708a09e7d979a10cfe3c0875cebeecca64a2847
Implementation commit: 7132cd81ea260558777859cd4c7485a357e8f5fb
Containing control: fa1330ff11955fe03ac9c1dfba8d29407cac11a8
Claim: dc6ba41d-f01a-43f5-b8d7-e43c6b8a7e54
Shared lease: 59450be9-031a-4db8-aec1-9a584ba04f2f

Require the atomic-claim-to-final delta to contain exactly four migrations
2235 through 2238, MIGRATION-ALLOCATIONS-PROPOSAL.yaml, TASK-STATE.yaml,
HANDOFF.md, and NEXT-PROMPT.md. Recompute all four checksums, verify the bound
F04/F05/P15/F06 request semantics and next ordinal 2239, and reject any edit to
an applied migration, ordinal 2231, registration, package/barrel, provider,
deployment, send, or unrelated path.

Reproduce the complete first migration apply in a fresh disposable database.
Treat the documented pg-mem replay limitation on the pre-existing
schema_migrations IF-NOT-EXISTS statement as a harness limitation only if no
failure originates in 2235-2238; prefer an isolated native PostgreSQL replay
when safely available. Run focused tests, typecheck, lint, formatting, build,
YAML/package validation, secret scan, ancestry/path/diff checks, released-lease
readback, and effects 0/0/0. Stop for C00 admission; do not integrate or perform
external effects without a fresh bounded authorization.
