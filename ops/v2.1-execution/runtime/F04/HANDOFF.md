# F04 Adult-Session and Household-Label Correction — Final Handoff

## Exact identity

- Branch: `codex/v21-f04-household-identity`
- Expected pre-correction remote head:
  `54a0ac28b51d271aacab60003451dbcc66ffcac8`
- Authorized integration start:
  `c0a1e04b8f3ffcaa65b8c6c2a1ec64edf7c1346a`
- Correction implementation:
  `dd5ce9ae49e2ef7800657289f7aa5bbc839163c4`
- Final runtime commit: derive with `git rev-parse HEAD`; C00 records the exact pushed remote head.
- Substantive control: `26f29aeb6734948dd8b80ab85a342831defaecc9`
- Claim: `ac096257-657d-40ab-88bb-80247126bf6b`
- Released `ACCOUNT_HOUSEHOLD_IDENTITY` lease:
  `ecf3aa70-8429-4846-ab39-c74816547e35`
- Task packet digest: `8129731ba92e32991ceda7c9e729196e82c4d9c8ac2cb8dfbee33a7c169d81f5`
- Context digest: `ee9e067b17a172c1a9c9886bffa7798e228359c08dbad4d8692b4d36518c1367`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- READY payload digest:
  `e78da256b221d8fe55a650246e57210497b6cd00235f67b549049ba0dd127f44`
- Two-artifact aggregate:
  `cd88df7415a8ef8643f4553b868dbe12410a93c1045ef32a958e2a43f6def9e9`

## Completed correction

F04 now provides an atomic PostgreSQL v2.1 Parent-session repository over the
unchanged migration-2235 table. Creation, access/refresh resolution, and
revocation bind the exact active AdultIdentity, HumanAccount, unrevoked Parent
membership, owned active household, product, runtime tier, verification
environment, security version, current canonical access readback, unrevoked
session, and live idle/absolute deadlines. Inactive canonical access remains a
valid authenticated Parent state so downstream routing can enforce the
specification's restricted billing/support/account allowlist.

Repository inputs accept only distinct lowercase SHA-256 access and refresh
digests. Raw opaque session material is absent from repository inputs, query
results, errors, logs, URLs, and runtime evidence. Revocation reasons use a
bounded vocabulary and increment the persisted session version exactly once.

The household context query no longer reads nonexistent
`v21_households.display_name`. It joins the exact active owner
`v21_adult_identities.display_name` and derives `<owner> household` for family
records or `<owner> school` for school records; the opaque household ID remains
authoritative.

## Verification

- Focused Vitest: six deterministic repository tests passed.
- Native PostgreSQL 16: one end-to-end proof passed after applying the exact,
  unchanged 2234 and 2235 migrations to an isolated disposable database.
- The native proof covered create, digest-only readback, exact resolution,
  wrong household, wrong security version, wrong digest, exact idle expiry,
  revoked membership, one-time revoke, and post-revoke denial.
- The exact disposable database and role were dropped after the proof.
- Workspace TypeScript typecheck, focused ESLint, focused Prettier, Git diff
  hygiene, artifact hashes, and the repository secret scan all passed.

## Remaining work and exact next action

C00 independently audits the exact pushed final for c0a1e04b ancestry, the
five authorized paths, two-artifact aggregate, focused and native proofs,
released lease, normal remote equality, and zero effects, then admits the
correction through I36. Candidate-bound staging/operator verification remains
outside this source-only phase; no further F04 implementation is authorized.

## External effects

Attempted `0`, succeeded `0`, reconciled `0`. No provider, deployment, DNS,
message, billing, migration, registration, or live-database effect occurred.
The only database mutation was inside an exact disposable local PostgreSQL
proof database, which was fully removed. No blocker remains.
