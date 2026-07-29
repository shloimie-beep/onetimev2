# P10 Atomic Correction Claim

## Identity

- Branch: `codex/v21-p10-admin-directory`
- Authorized start: `49431959f58f284bdc13ca931acf09f980fc483a`
- Expected existing head and checkpoint sole parent:
  `92212a7b6873a9b6da5e7173b4fd1af88ef47293`
- Containing correction controller:
  `b0aeb1d1ba9ed25b27b7b519b9f06ba6bbbe7dfc`
- Correction ready parent/acquisition:
  `c743420931244135bcd61578ea1f322851b325a8`
- Correction ready-entry digest:
  `526ce8d0d61a88d2def1cf58d9d8d8e8375e03760e7c00db3dec5fab70168467`
- Claim mode: `resume_existing_branch`
- Correction claim: `0f061200-ff84-449d-aaa7-b0ebd7cd9c02`
- Writer: `codex-p10-worker-0f061200`
- ADMIN_DIRECTORY lease:
  `c3ee876e-793d-4c19-9a4c-40de4f27e758`
- Lease issued: `2026-07-29T01:39:10Z`
- Lease expiry: `2026-07-29T02:39:10Z`
- Last committed implementation SHA: `3abb4bb96929400838f0270586c5c459c8c6f9ed`
- Current handoff commit: derive with `git rev-parse HEAD`; C00 records the observed remote head
- Task packet digest: `fe7abc1af5110c1007c34927fe9909bc3643998dd10615c195046f30423f7e28`
- Context digest: `a27b3c710d277153d8273f82d5d8e745d620fdd5ecacc619f6f7b9a5772bab17`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Implementation artifact digest: `600eb180ae6aa873702ef0018353f89a3d647bf2ee1381d54bc78e1a824975a8`
- Steward-request digest: `37c19321fb6ceea660839bd1b117ec03ae834aa783d9b352e7ce4931f5d693f2`

## Verified correction claim

Fetched the exact control and task refs. Verified that controller
`b0aeb1d1ba9ed25b27b7b519b9f06ba6bbbe7dfc` has sole parent
`c743420931244135bcd61578ea1f322851b325a8`, independently recomputed the
canonical P10 ready payload digest, and matched the exact existing remote head,
claim, active writer lease, and empty effect-lock list.

This checkpoint changes only:

- `ops/v2.1-execution/runtime/P10/TASK-STATE.yaml`
- `ops/v2.1-execution/runtime/P10/HANDOFF.md`
- `ops/v2.1-execution/runtime/P10/NEXT-PROMPT.md`

No product, contract, test, steward-request, migration, configuration, shared
runtime, manifest, lockfile, or provider file was changed. No correction
implementation work has begun.

## Preserved implementation metadata

Implemented P10's additive v2.1 Admin directory contract and domain operations
for adult-contact and household create/edit/archive/restore, exact Admin and
Parent membership creation, Student create/edit/archive/restore, protected
Student credential replacement, and verified sole-household-ownership transfer.
The runtime boundary accepts only an F03 server-validated `admin` principal in
the same product, runtime tier, and verification environment. Adult/Parent
identity never becomes learner authorization; Student usernames are local and
email-free; Student password material is accepted only as an Argon2id hash and
never disclosed.

The server service checks canonical replay identity before running a mutation,
then performs all row-locked aggregate reads and domain validation inside the
same repository transaction as aggregate, credential/transfer, audit, and
receipt writes. A new service instance replays the durable receipt without
rerunning the mutation, proving the persistence seam used after refresh or
re-login.

The F07 workspace renders accessible English Admin navigation, bidirectional
names with `dir="auto"`, semantic table captions/headings, explicit create/edit/
archive/restore, ownership-transfer and credential-reset actions, and live
empty/error state announcements.

The exact prior implementation head remains
`3abb4bb96929400838f0270586c5c459c8c6f9ed`, its ten-artifact digest remains
`600eb180ae6aa873702ef0018353f89a3d647bf2ee1381d54bc78e1a824975a8`,
and the immutable steward-request digest remains
`37c19321fb6ceea660839bd1b117ec03ae834aa783d9b352e7ce4931f5d693f2`.

## Remaining work

C00 must first reconcile this exact correction-claim checkpoint. Correction
product, contract, test, and steward-request work must not begin before a new
explicit continuation authorization. Prior migration/registration requests and
candidate-bound persistent-staging and production-operator-canary proof remain
unchanged.

## Exact next action

Push this three-file checkpoint with sole parent
`92212a7b6873a9b6da5e7173b4fd1af88ef47293`, report the exact pushed head,
and stop. Do not change a product, contract, test, steward request, migration,
configuration, or shared file until C00 reconciles claim
`0f061200-ff84-449d-aaa7-b0ebd7cd9c02` and explicitly authorizes continuation.

## Coverage

All eight P10 requirements and exact acceptance cases are implementation-ready.
The focused suite maps one positive test to each exact case and adds role,
scope, stale-version, request-hash, replay, credential-secrecy, accessibility,
and fresh-service persistence denial/proof assertions.

## Prior verification preserved

- Reconciled C00 continuation, exact claim head, dependency bindings, and active lease: passed.
- Full workspace typecheck: passed.
- Full workspace lint: passed.
- Focused domain/server/client suite: 12/12 passed.
- Focused Prettier and diff hygiene: passed.
- Repository-wide secret scan: passed across 2719 text files.
- Exact implementation/steward Git-blob digest derivation: passed.

## External effects

Authority is `none`; attempted `0`, succeeded `0`, reconciled `0`.

## Security, privacy, and data handling

No live provider call, account mutation, credential reset, ownership transfer,
customer/child record, secret, message, deployment, or canary was accessed or
attempted. The implementation contains no provider adapter or fake fallback.

## Stop condition

Stop after the pushed correction-claim checkpoint. Lack of C00 reconciliation
blocks every correction implementation or steward-request change.
