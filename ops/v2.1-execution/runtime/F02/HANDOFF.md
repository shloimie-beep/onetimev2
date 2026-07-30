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
