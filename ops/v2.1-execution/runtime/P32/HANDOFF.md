# P32 Privacy Scope Compatibility Correction Release

## Identity

- Branch: `codex/v21-p32-privacy-data-rights`
- Start SHA: `01cdb992660a1fbc20b204b829d28062fd044679`
- Implementation SHA before this handoff metadata commit: `888af54911ed583da99408cfcc791b485a728ddd`
- Resume parent: `f4ae1c03c60917a23a825d46a4d0ec63ff4fc125`
- Containing control: `9d53cf1c581dcb67e30b2beb62d048a1839f23e2`
- Sole acquisition parent: `a6bc58cc4a35173fd1606124c0fa651dda2dac64`
- Reconciled claim head: `39a578ff9a8ba91c59ebe082dc6611a17c051b79`
- Continuation control: `5644d38395e86ea114197eb12415106994bbf3ea`
- Continuation acquisition parent: `fe0d60fa2807b02882390df960f3e75517672d11`
- Claim: `26390213-86c7-4085-8de0-1a5cc428b003`
- PRIVACY_DATA_RIGHTS lease: `0c5215bf-e4c5-49b3-9f99-9c7ed0cf1e8e`, expiring `2026-07-30T01:23:18Z`
- READY digest: `32b38115f94e6989832318a478adf88480cbe14a3d1975a815b4c14f0873eda4`
- Current handoff commit: derive with `git rev-parse HEAD`; C00 records the observed remote head.
- Task packet digest: `a34f7c16bda5c68fc269cce7fbbb0eb574de64f4a9db66e272c3b99ff8a639f6`
- Context digest: `62e33c67682a9c6f3e9ce372e920abbdf05090f5a7bf81075aec766594b4f140`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`

## Completed behavior

P32 implements exact dependent and adult-self Student consent authority, immutable recording-participant evidence, actor-scoped data-rights workflows, dependent review, exact visible statuses, one-use 15-minute export downloads, closure/erasure separation, private-body-safe Parent disclosure, deterministic shared-media redaction, optional recognition anonymity, retention planning, hash-only purge chaining, dual-copy durability, restore gates, persistence adapters, safe UI, and registration-neutral server/worker modules.

Interface contract `1.0.0` is published for P18 at digest `76d0858798dbb7a14c93666ab9f0c647107d380464ec2d6b582657865eecf217`, implemented by `888af54911ed583da99408cfcc791b485a728ddd`.

## Completed correction

Data-rights requests now carry a validated explicit trusted `product`, `runtime_tier`, and `verification_environment_id`. The server service supplies that scope after caller input so caller-conflicting scope cannot win. Export grants inherit the exact request scope. Repository request/grant inserts persist all three fields, request and grant updates are scope-fenced, and the database composite request/grant binding remains authoritative. Purge evidence must also match the approved request scope.

## Remaining work

Independent and C00 audit must admit the exact superseding correction head. No migration, registration, interface-checkpoint, steward-request, provider, deployment, send, merge, or external-effect work remains authorized here.

## Exact next action

Audit the exact remote correction head against parent `39a578ff9a8ba91c59ebe082dc6611a17c051b79`; do not integrate it before admission.

## Coverage

- Requirements: all five are implementation-ready.
- Acceptance cases: all eight have task-owned positive, negative, isolation, transition, replay, redaction, retention, and restore assertions; candidate-bound environment proof is intentionally not claimed.

## Changed files and migrations

The correction changes ten P32-owned privacy TypeScript files plus the P32 runtime triplet. No migration, root barrel, central composer, package manifest, lockfile, interface checkpoint, steward request, infrastructure configuration, or control file changed.

## Verification

Native PGlite PostgreSQL accepted valid isolated-staging and production request/grant pairs and returned exact composite scope readback. It rejected absent scope by NOT NULL, invalid tier/environment binding by CHECK, and mismatched grant/request scope by the composite foreign key; a conflicting request identity/scope returned the repository conflict result. Focused tests passed 24/24, full typecheck passed, focused Prettier/ESLint passed, the 2,562-file secret scan passed, and diff/scope hygiene passed.

## External effects

Authority `none`; attempted `0`, succeeded `0`, reconciled `0`. No provider or live effect occurred.

## Security, privacy, and data handling

No secrets, real identities, child data, private questions/support bodies, media, raw provider identifiers, raw export tokens, provider payloads, or bearer material were accessed or recorded. Purge contracts are hash/HMAC/tombstone metadata only.

## Blockers, deviations, and recovery

No blocker remains. The PRIVACY_DATA_RIGHTS lease was released at `2026-07-30T00:41:37Z`, before its `2026-07-30T01:23:18Z` expiry. Stop for independent audit.
