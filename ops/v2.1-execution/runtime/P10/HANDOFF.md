# P10 Handoff

## Identity

- Branch: `codex/v21-p10-admin-directory`
- Authorized start: `49431959f58f284bdc13ca931acf09f980fc483a`
- Atomic claim head: `4260209637d4ddf931b8724dc32dc85691e35601`
- Last committed implementation SHA: `3abb4bb96929400838f0270586c5c459c8c6f9ed`
- Current handoff commit: derive with `git rev-parse HEAD`; C00 records the observed remote head
- Task packet digest: `fe7abc1af5110c1007c34927fe9909bc3643998dd10615c195046f30423f7e28`
- Context digest: `a27b3c710d277153d8273f82d5d8e745d620fdd5ecacc619f6f7b9a5772bab17`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Claim: `f7e5889d-4db4-4818-a47f-5f26927597ae`
- ADMIN_DIRECTORY lease: `45e45c29-d8eb-49e2-960b-b1c2a545398f`, released task-locally at `2026-07-29T01:13:26Z`
- Reconciled continuation control: `d8639ce20ce92a0f49ce8d69b57b09b355d09246`
- Continuation control sole parent/acquisition: `629577e2ea6da2fdeca7754a6f314b6b254e952e`
- Ready payload digest: `91d515fb029f45f7263b8aec6ee6ef39bac2066ab160428b5c253c94ff137587`
- Implementation artifact digest: `600eb180ae6aa873702ef0018353f89a3d647bf2ee1381d54bc78e1a824975a8`
- Steward-request digest: `37c19321fb6ceea660839bd1b117ec03ae834aa783d9b352e7ce4931f5d693f2`

## Completed behavior

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

## Remaining work

I36 must integrate the implementation head and disposition the structured
migration and registration requests. Those requests cover the real database
adapter/migration, root barrels, authenticated/CSRF route composition, legacy
role-surface replacement, and central client registration. Candidate-bound
persistent-staging and production-operator-canary proof remains with the
assigned verification/release lanes.

## Exact next action

Review and integrate `3abb4bb96929400838f0270586c5c459c8c6f9ed`, independently
recompute implementation artifact digest
`600eb180ae6aa873702ef0018353f89a3d647bf2ee1381d54bc78e1a824975a8`,
then disposition `P10-MIGRATION-001` and `P10-REGISTRATION-001`.

## Coverage

All eight P10 requirements and exact acceptance cases are implementation-ready.
The focused suite maps one positive test to each exact case and adds role,
scope, stale-version, request-hash, replay, credential-secrecy, accessibility,
and fresh-service persistence denial/proof assertions.

## Verification

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

## Blockers and deviations

No task-local blocker. Shared migration, database adapter, barrels, central
composition, and legacy route replacement are represented by the two immutable
steward requests rather than out-of-scope edits.
