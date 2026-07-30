# F02 Lease B Compatibility-Semantic Correction Release

- Claim parent: `24c327eaf06fc502d167d2d5863c5fbb05db5a2c`
- Containing continuation control: `5644d38395e86ea114197eb12415106994bbf3ea`
- Sole control acquisition parent: `fe0d60fa2807b02882390df960f3e75517672d11`
- Claim: `6b1e1632-e3d9-4f87-92b3-8b150a6715d2`
- Shared MIGRATION_AUTHORITY/SCHEMA_CONTRACT lease: `31e905c8-d5c2-4e3c-9e98-c2e8f78989ce`
- Released: `2026-07-30T00:37:21Z`, before expiry `2026-07-30T01:23:18Z`
- Effects: `0/0/0`

Migration 2239 now selects exactly one canonical series per account/product
scope without changing the selected series lifecycle. A sole paused series
remains paused; a sole archived series remains archived; an active series is
preferred when a scope contains multiple lifecycle states. Canonical schedule,
teacher, classroom, and recording fields are still normalized.

Direct native probes passed sole paused, sole archived, sole active, mixed-row
active preference, canonical normalization, and singleton fencing. Complete
disposable PGlite PostgreSQL and repository-runner pg-mem inventories passed
75/75.

Only migration 2239, its allocation checksum metadata, and the F02 runtime
triplet changed. Migrations 2234 through 2238 and 2240 through 2244 remain
byte-identical. Typecheck, lint, production build, format, YAML, secret, diff,
five-path scope, 200/200 package Git bytes, protected blobs, checksum pairs,
next ordinal 2245, lease release, and effects `0/0/0` passed.

Stop for independent and C00 audit. Do not merge, register, inspect providers,
deploy, send, or perform external effects.

# F02 Migration Lease C Atomic Claim

- Claim parent: `cd2d7c2fe3bfeb250c320bc02c9bfebb3bd04911`
- Containing control: `85100180449bf234a93f107eb66a1f7bc635b4f0`
- READY parent control: `fe95eacb2a958ba043cc9f89c1c27e09e20b9324`
- Claim: `0e98de00-4873-41cb-a06f-bd0ace918b89`
- MIGRATION_AUTHORITY lease: `7a7c792d-fe4b-4a83-bbd9-7c6448bf1c95`
- SCHEMA_CONTRACT lease: `b7ddd6c3-8a8e-4c9a-a304-5b4c15390fe1`
- READY digest: `5ab53779afff1e0a2a7ae4759818f9a98c259970298449ae767cee788a12b936`
- Effects: `0/0/0`

This atomic claim binds only P19, P20, P28, P08, and P09 migration requests to
ordinals 2245 through 2249. P17, P18, and P21 remain withheld. Only the F02
runtime triplet changed. Stop for C00 reconciliation before reading requester
bodies, editing the allocation proposal, authoring SQL, or performing effects.

# F02 Migration Lease C Release

- Sole parent: `ff35555611e7261d1b7b96fc2233eaf82a9f9fdf`
- Reconciliation control: `1b5e5dd662390dd5affc159990a59b3b8d99c127`
- Sole reconciliation parent: `85100180449bf234a93f107eb66a1f7bc635b4f0`
- Claim: `0e98de00-4873-41cb-a06f-bd0ace918b89`
- MIGRATION_AUTHORITY lease: `7a7c792d-fe4b-4a83-bbd9-7c6448bf1c95`
- SCHEMA_CONTRACT lease: `b7ddd6c3-8a8e-4c9a-a304-5b4c15390fe1`
- Released: `2026-07-30T04:45:00Z`, before expiry `2026-07-30T06:01:19Z`
- Effects: `0/0/0`

Implemented only the authorized P19, P20, P28, P08, and P09 requests as
forward-only migrations 2245 through 2249. The result provides bounded,
checksum-deduplicated content ingest; immutable versioned content processing;
adult-only communication preferences and governed reminder evidence; global
family-signup idempotency with fixed free access and separate consents; and
email-deduplicated school inquiries with explicit zero access before approval.
P17, P18, and P21 remained withheld from implementation.

Complete disposable PGlite PostgreSQL and repository-runner pg-mem inventories
passed 80/80. Focused probes passed ingest size/checksum bounds, processing
immutability, communication preference scope, family idempotency/access/consent,
school dedupe/zero-access separation, optimistic concurrency, append-only
enforcement, and IANA timezone validation.

The exact result is nine paths: five SQL files, the allocation proposal, and the
F02 runtime triplet. Typecheck, lint, focused unit contracts, YAML, checksum,
scope, diff, lease-release, and zero-effect gates passed. Focused integration
suites reached the pre-existing migration 2235 and stopped because their pg-mem
setup omits `btrim(text)`; the complete registered pg-mem and native inventories
passed all Lease C migrations.

Stop for independent and C00 audit. Do not merge, allocate ordinal 2250,
register, inspect providers, deploy, send, or perform external effects.

# F02 Migration Lease D1 Release

- Pushed split control: `4ea98556cd03ccc0df1a5286d61ee3cfdbfb82b4`
- Sole control parent/controller: `4b22c4704edc8bd21b0e0242ad00debfba67f5c2`
- Authorized start: `6d16d6eb2c901c58cc4d0c2bb3298b5543af3d9f`
- Implementation checkpoint: `7a828767e68807a5b16c0b71a65218553a121856`
- Claim: `3469667a-69e2-4c35-afac-5b1dfbbf417d`
- MIGRATION_AUTHORITY lease: `7f2ab8d1-a53f-41da-8143-28da4b62b200`
- SCHEMA_CONTRACT lease: `9a3469a3-87c6-45b6-824f-c3b886a01b46`
- Lease expiry: `2026-07-30T13:34:41Z`
- Released: `2026-07-30T12:58:26Z`
- Effects: `0/0/0`

Implemented only the authorized corrected P17 and P18 migration requests as
forward-only ordinals 2250 and 2251. P17 owns exactly five Zoom preparation
tables and P18 owns exactly four disjoint embedded-classroom tables. The
migrations reuse the existing `job_outbox` and `provider_operation_binding`
authority and do not create `provider_operations`. The draft P21 migration 2252
is preserved untracked and excluded from every commit.

Pinned control and the immutable P17 request both bind
`P17-MIGRATION-002` to canonical digest
`e4aed5ae31c5143deb230aa3a9e76f6bca0fd6857d22a4bec7e815f3b78624ca`.
The conflicting `e4aed5d9...` value in the delegated task text was confirmed as
a transcription error and was not propagated.

Complete disposable PGlite PostgreSQL and repository-runner pg-mem inventories
passed 82/82. P17 missing-key/optional-reference probes passed 26/26. Focused
native D1 semantic probes passed 35/35 for immutable confirmation/scope,
state/quarantine fencing, one-use grants, monotonic live-session leases,
nonempty audit evidence, correction interval structure, and lowercase-hex
digests.

The exact committed batch is six paths: migrations 2250 and 2251, the
allocation proposal, and the F02 runtime triplet. Typecheck, lint, YAML,
repository Prettier, checksum, secret, diff, exact scope, release, and zero
effects passed.

Both writer leases were released before expiry. Stop for independent and C00
audit. Do not commit draft 2252, merge, allocate ordinal 2252, register,
inspect providers, deploy, send, or perform external effects.

# F02 Content-Publication Projection-v2 Migration Release

- Containing control: `f2b4a9faefdb5f780c9b620fedb413d408d27a19`
- Controller authorization: `f0ccbdc81e6962add93d0900dd159e24df7cf05f`
- Authorized integration parent: `c0a1e04b8f3ffcaa65b8c6c2a1ec64edf7c1346a`
- Prior F02 head: `39cacd4aeef63ba247902b1fc7051b6bd6ca0f23`
- READY digest: `3145d5b3fe237f0b9f62ae6ff6f5443a7f4f402c4322cc00f0c9d2183a59015f`
- Claim: `88a902de-af91-412f-9e38-6e82dac1d3d2`
- MIGRATION_AUTHORITY lease: `7de57120-0ed6-4e9d-8dcd-53cdbdf471b4`
- SCHEMA_CONTRACT lease: `e0a6dd90-820f-4625-9979-e057d0bdad1c`
- Lease expiry: `2026-07-30T19:03:38Z`
- Released: `2026-07-30T17:44:04Z`
- Effects: `0/0/0`

Implemented only immutable `P21-MIGRATION-003` as forward-only migration 2253.
The replacement validator requires the exact 27-field projection, exact
eight-field ordered artifact provenance, digest parity, explicit null metadata,
persisted P20 source/version/capture/participant/artifact evidence, current
artifact revisions, matching account/product/content/version scope, and public
seed parity. All five inherited publication guards now pass the exact content
identifier.

Migration 2252 and P21-MIGRATION-002 remain byte-identical historical evidence.
The allocation proposal now reconciles through immutable 2252, allocates exact
ordinal 2253, records native/repository-runner checksum pairs, and advances the
next available ordinal to 2254.

A fresh native PostgreSQL 16.14 database applied all 84 migrations, replayed
2253 cleanly, and passed the complete accept/replay plus malformed, missing,
extra, reordered, tampered, cross-scope, seed-mismatch, stale-revision,
persisted-evidence-mismatch, and five-guard rejection probe batch. The complete
repository pg-mem inventory also applied and verified 84/84 with zero pending
migrations using the repository harness registrations.

The exact result is five paths: migration 2253, the allocation proposal, and
the F02 runtime triplet. Typecheck, lint, focused migration verification, YAML,
runtime-document formatting, secret scan, checksum, exact scope, diff, remote
fencing, lease release, and zero-effect gates passed. Both bounded writer slots
were released at `2026-07-30T17:44:04Z`, before expiry.

Stop for independent and C00 audit. Do not merge, allocate ordinal 2254,
backfill, inspect providers, deploy, send, charge, or perform external effects.
