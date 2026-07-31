# P12 Concrete Parent-Household Terminal Handoff

## Authority and ancestry

- Branch: `codex/v21-p12-parent-household-concrete`
- Containing control: `48f27d399d4ed714f6219487629c406af1fbb49f`
- Control parent and READY basis:
  `cc03a0c8f73339c05e3fbe0179661882169b32d9`
- READY digest:
  `3be08e42202e106064ba7b1c092615117ca3b7de60e4b4e07f8f872d7c1d9c61`
- Claim: `77d55d69-8496-4f7e-b441-6bed1e83f819`
- Writer: `codex-p12-concrete-correction-77d55d69`
- Sole PARENT_HOUSEHOLD_UI lease:
  `302b8602-ec7c-4e81-9562-f792c6fb6e4c`, released task-locally at
  `2026-07-31T15:08:37Z` before its `2026-07-31T16:52:38Z` expiry
- First parent: integration `ae3ced8a9daa11044d4278968c14cb6baa12a480`
- Required second parent: P12 source
  `9ada912c3238421e661f89e590c07c042dd6424b`
- The pre-correction merge tree matched
  `4e920e58567de5cdd18e8515e30edc0699c74315`; history was neither rewritten
  nor squashed.
- Derive the exact terminal merge commit and tree from the pushed remote and
  record them in control.

Effect locks were empty. External effects are `0/0/0`.

## Completed implementation

P12 now has a concrete PostgreSQL repository, service, authenticated HTTP
router, same-origin client API, and persisted Parent forms. Adult identity,
Parent role, session, and household ownership come only from the authenticated
server session. Bodies cannot choose household or adult scope, and sibling or
wrong-role targets remain concealed.

The repository locks the household revision and enforces the hard three-active-
Student limit under concurrent final-seat attempts. It atomically persists the
Student profile, service-account acceptance, canonical enrollment, canonical
audit, credential evidence, credential-version/session and classroom-access
revocation, revocation readback, household revision, and idempotency receipt.
An injected mid-transaction failure rolls every staged row back.

Idempotency distinguishes exact replay from changed-hash conflict. Both
preflight and commit-race replay write nothing, allocate no new Student, perform
no Argon2 work, and return `credential_handoff: null`, including replay after a
later credential reset. Receipt/audit hashing substitutes a domain-separated,
server-keyed HMAC-SHA256 password fingerprint for plaintext credentials, so
persisted request evidence is not an offline password oracle.

Create and edit persist required Unicode actual name plus optional display
name, relationship `self` or `dependent`, and a globally scoped human-readable
username. The forms include the exact **Myself** / **Someone I manage** choices
and exact Rabbi Eli actual-name guidance. They contain no date of birth, age,
age band, grade, Hebrew-specific name, Student email, or provider identity.

Only a newly committed create/reset may return the just-entered password in a
copy/print handoff. It is never persisted, audited, logged, emailed, or returned
by replay. Inactive households receive a status-only overview with no Student
rows; all mutation and replay paths fail closed, and the client renders no
Student rows, forms, controls, or credential handoff.

## Interface and immutable requests

Semantic interface `1.1.0` is ready. Its documented UTF-8/LF/no-final-newline
preimage is 515 bytes and hashes to
`778488b8ed4f8db8dacb24788ac88e44c2084e1f2b4523dc6370f1664c967c20`.

Normalized export hashes are:

- client index: `4aa586c1c19baf635e59c5043a834f8acb60c844b8354aac885dd05fcfbdbf19`
- server index: `05bde767efa55936e77d0efc73a73f884bb2310b532e7c5277e1917dc7ff99b9`
- contract index: `f3bde4279ea71f28bdf6b745aa672e0a243746a89706a476911500964c2036e6`
- domain index: `51c640862c1ca76639bdb528bc04cbd84ec9e2689ab41018414ddfef59f85962`

Immutable request inventory:

- `P12-registration-001` — superseded evidence only; never edit or apply;
  SHA-256 `501ae46b1ad26e933d2e15b4f13760f4c3c8ec93d2672dc7be0d7e372046e733`
- `P12-migration-001` — byte-identical carry from the second parent; fulfilled
  by integrated migration 2255; SHA-256
  `6f76b024f756b89ef430a21c0744b4dd43114c5d5e9213bd76582e2534d3bc17`
- `P12-server-registration-002` — pending I36; SHA-256
  `7613a0c268faca7cb1fac830b3f4f97f502677e0fe2254360f9342820cc1c00f`
- `P12-client-route-002` — pending I36; SHA-256
  `0731b9cc4dad55f26d26d9080b3eeba2b6e18739954de49b6a1d6c87d0e163c8`
- `P12-barrel-export-002` — pending I36; SHA-256
  `2a82d0963bff76d05e9290f8648c232468fb1d9f0078c958657bb44e1621322d`

Migration 2255 was integrated upstream and was not changed. Its raw SHA-256 is
`7f647a55f26b732bdb8b95771dbb0c43fe6c9a5833389d5dba0888f7f55aab32`.

## Verification

- Focused validation: 5 files, 28 tests passed; the 2 opt-in native cases were
  skipped in that invocation.
- Native PostgreSQL 16.14 through migration 2255: all 6 repository tests
  passed, including concurrent final-seat serialization and true rollback.
- Focused ESLint passed.
- The three successor requests passed strict YAML and canonical steward-request
  schema/traceability checks.
- Interface digest, normalized export hashes, immutable request bytes,
  migration checksum, two-parent scope, Prettier, diff hygiene, and repository
  secret checks passed.
- Workspace typecheck has no P12 diagnostic. It remains baseline-blocked by the
  existing Stripe `Status` widening diagnostic and duplicate Playwright type
  installations in `ot-52`, `ot-83`, and `w12-09`.

The disposable native database and login role contained only test fixtures and
were dropped after verification; they are not recoverable.

## Next action

C00 should review the exact pushed two-parent terminal merge and record its
commit/tree/interface bindings. I36 should disposition exactly the three `-002`
successor requests, compose P08/P12 centrally, and then run the full mounted
Parent refresh/logout/re-login persistence journey. Do not revive either
immutable `-001` request or edit migration, package, central composer, root
barrel, control, provider, or integration artifacts from this P12 branch.
