# F02 Migration Lease B Semantic-Correction Release

- Claim parent: `9daa5251acf9b6d2c4c932d9864d894ded2bdd2d`
- Containing control: `87179bc537935cd316414764ff7ed86c67e0e4e1`
- Sole control authorization parent: `35704c887c45309eb03506d4f654afd2bfbed84c`
- Renewal claim: `2002fc61-531d-4b4c-b0c0-c65b3468b8c5`
- Shared MIGRATION_AUTHORITY/SCHEMA_CONTRACT lease: `4d52c050-fd00-4240-a029-48d4f27f6820`
- Released: `2026-07-29T23:33:32Z`, before expiry `2026-07-30T00:39:23Z`
- Effects: `0/0/0`

The exact six forward-only migrations 2239 through 2244 now implement the
bound P16, P32, P10, P23, P24, and P27 contracts. The semantic correction
preserves legacy classroom evidence, adds exact scoped privacy and directory
constraints, enforces notification and support privacy invariants, and derives
GHL identity scope from authoritative adult/household bindings.

Disposable PGlite PostgreSQL and repository-runner pg-mem both passed all
75 migrations. Seeded native legacy reconciliation passed 5/5, the combined
native contract suite passed 19/19, and the pg-mem focused suite passed 5/5.
All six native/pg-mem checksum pairs match the allocation proposal; next
available ordinal is 2245 and ordinal 2231 remains forbidden.

Typecheck, lint, production build, YAML, Prettier, secret scan, diff hygiene,
exact ten-path scope, protected 2234-2238 blobs, and the 200/200 locked package
Git-byte gate passed. No provider, deployment, send, integration, or external
effect was attempted.

Stop for independent and C00 audit. I36 integration requires a fresh bounded
admission, atomic claim reconciliation, and exact merge item.
