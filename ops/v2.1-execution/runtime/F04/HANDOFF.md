# F04 Handoff

## Identity

- Branch: `codex/v21-f04-household-identity`
- Start SHA: `d8b35b2aaa0dc4b687b6e88192c7eac6222ecdec`
- Implementation SHA before this handoff metadata commit: `81c0ee64072386db41aa5a40243c693762ab493a`
- Current handoff commit: derive with `git rev-parse HEAD`; C00 records the observed remote head.
- Task packet digest: `8129731ba92e32991ceda7c9e729196e82c4d9c8ac2cb8dfbee33a7c169d81f5`
- Context digest: `ee9e067b17a172c1a9c9886bffa7798e228359c08dbad4d8692b4d36518c1367`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Interface contract digest: `a57837379bfc8210188887ff31937ed7882befe10b80941499dc7ba305e7984d`

## Completed behavior

F04 now provides a versioned v2.1 contract and pure domain guard for one normalized adult identity, one HumanAccount, exact `admin`/`parent` memberships, explicit role context, server-authorized household context, and strict Parent/Student capability separation.

Ownership transfer is version-checked, idempotent, single-use, Admin-assisted, and atomic by construction. It blocks an outgoing active `self` Student, requires archive or same-adult owned-household relocation without identity/history/credential conversion, requires current replacement-owner attestations for every dependent, adds `parent` to an existing Admin login, and produces exact revocation/audit/provider-intent plans without changing financial identity. Server services enforce same-origin/CSRF and rotate context sessions; the PostgreSQL adapter uses parameterized SQL and never creates schema at runtime.

## Remaining work

F04-owned implementation is complete. F02 must adjudicate `F04-migration-001`; I36 must adjudicate `F04-registration-001`, integrate the exact interface checkpoint, and reconcile the F03 session seam. Candidate-bound browser/persistence proof remains for the verification waves.

## Exact next action

Run final verification, publish `ready_for_review`, then C00/I36 may validate and integrate the exact interface checkpoint.

## Coverage

- Requirements: all four implementation-verified.
- Acceptance cases: all four task-owned positive, negative, isolation, concurrency/version, idempotency, retry/replay, and recovery assertions passed; candidate-bound environment proof is intentionally not claimed.

## Changed files and migrations

Thirteen implementation/request files were added within F04-owned paths plus F04 runtime metadata. No migration or central registration file was edited. Two structured steward requests name the exact migration and registration work.

## Verification

- Full TypeScript typecheck: passed.
- Focused Vitest: 3 files, 14 assertions, all passed.
- Focused ESLint: passed.
- Focused Prettier: passed.
- Git diff check: passed.

## External effects

Authority `none`; attempted `0`, succeeded `0`, reconciled `0`. No provider or live effect occurred.

## Security, privacy, and data handling

No secrets, raw tokens, provider payloads, child data, private questions, email values from real users, or external identities were used. Runtime/verification scope is bound to the exact F02 isolation mapping.

## Blockers, deviations, and recovery

No F04-owned blocker. Migration and root registration are correctly routed to their stewards and do not weaken the stable direct-import interface.
