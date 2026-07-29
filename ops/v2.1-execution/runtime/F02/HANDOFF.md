# F02 Lease A Checksum-Metadata Correction

## Identity

- Correction claim parent: `1ab8243fc4380104ae2431783f31792197f9ed77`
- Containing control: `02c58c4258a16f431953dc1e5e5a40a194c7d0d2`
- Sole control acquisition: `174bc6656fbc2a1c0526e7bdec0e361dfd1e7c35`
- Claim: `937b224d-ee11-4936-82d7-719f177d31da`
- Shared MIGRATION_AUTHORITY/SCHEMA_CONTRACT lease: `08ae9549-daf0-42fc-8938-7c5e5b28030f`
- Lease expiry: `2026-07-29T20:23:53Z`
- Both slots released: `2026-07-29T19:30:25Z`

## Corrected checksum evidence

`checksum_sha256` is the production/native SHA-256 of normalized-LF SQL
bytes. `pg_mem_checksum_sha256` is the repository migration runner's checksum
after stripping PostgreSQL-only blocks.

| Ordinal | `checksum_sha256`                                                  | `pg_mem_checksum_sha256`                                           |
| ------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| 2235    | `442231550a3aed2360772a9fbc4aebe96edf0510ee175e0b8c7d1097d94f7c1e` | `abec96358e5b7b35d253ed8314625ad6a7829fd0230fd5a2763ccb29b8c496b3` |
| 2236    | `4a9b04d9b6b822448b7a188fa1afd0d4e84b522efd4b9f7e2a3e3c46015e7fdd` | `4a9b04d9b6b822448b7a188fa1afd0d4e84b522efd4b9f7e2a3e3c46015e7fdd` |
| 2237    | `7b58a07ff8bb949260715bd630d02c34cb1f7188a7d0a9a9f52380d7a82eca86` | `6ad635c575ded4d57949e2f2f95b8fef2048b19e7153a3e87bd4bb1b4f8179ea` |
| 2238    | `78651746213caf2131310eac7305c61f94f9480cfcf5ff347ebc2a07bbc15f6e` | `58122d190463e293f2554fffca26feda7e755351b464c416bd89a8afbfd9e367` |

The four SQL files retain their exact Git blobs `70047dd5`, `8540bfda`,
`d1cff8b1`, and `3f48e649`; no SQL byte changed. The correction delta is
limited to the allocation proposal and F02 runtime triplet. External effects
remain attempted `0`, succeeded `0`, reconciled `0`.

## Audit result

**PASS.** YAML, repository Prettier, checksum derivation, protected SQL blobs,
the 200/200 Git-byte execution-package validator, secret scan, exact four-path
scope, diff hygiene, and a fresh disposable 69-migration first apply/verify
all passed. The pg-mem ledger reports 69 applied, 0 pending, and no issues.

## Next action

After this metadata-only release is independently audited and admitted, I36
may integrate the exact audited F02 head only under a fresh bounded
authorization. Do not allocate ordinal `2239`, edit SQL, apply registrations,
inspect providers, deploy, send, or perform an external effect.
