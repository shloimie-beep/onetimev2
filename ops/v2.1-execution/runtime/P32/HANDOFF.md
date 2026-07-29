# P32 Handoff

## Identity

- Branch: `codex/v21-p32-privacy-data-rights`
- Start SHA: `01cdb992660a1fbc20b204b829d28062fd044679`
- Implementation SHA before this handoff metadata commit: `888af54911ed583da99408cfcc791b485a728ddd`
- Current handoff commit: derive with `git rev-parse HEAD`; C00 records the observed remote head.
- Task packet digest: `a34f7c16bda5c68fc269cce7fbbb0eb574de64f4a9db66e272c3b99ff8a639f6`
- Context digest: `62e33c67682a9c6f3e9ce372e920abbdf05090f5a7bf81075aec766594b4f140`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`

## Completed behavior

P32 implements exact dependent and adult-self Student consent authority, immutable recording-participant evidence, actor-scoped data-rights workflows, dependent review, exact visible statuses, one-use 15-minute export downloads, closure/erasure separation, private-body-safe Parent disclosure, deterministic shared-media redaction, optional recognition anonymity, retention planning, hash-only purge chaining, dual-copy durability, restore gates, persistence adapters, safe UI, and registration-neutral server/worker modules.

Interface contract `1.0.0` is published for P18 at digest `76d0858798dbb7a14c93666ab9f0c647107d380464ec2d6b582657865eecf217`, implemented by `888af54911ed583da99408cfcc791b485a728ddd`.

## Remaining work

P32-owned implementation is complete. F02 must adjudicate `P32-migration-001`; I36 must adjudicate `P32-registration-001`; the infrastructure/security steward must adjudicate `P32-config-001`. Candidate-bound staging and operator-canary proof remains for verification waves.

## Exact next action

C00/I36 should validate and integrate the exact P32 interface checkpoint, adjudicate the three steward requests, and authorize P18 from the resulting integration head.

## Coverage

- Requirements: all five are implementation-ready.
- Acceptance cases: all eight have task-owned positive, negative, isolation, transition, replay, redaction, retention, and restore assertions; candidate-bound environment proof is intentionally not claimed.

## Changed files and migrations

All implementation paths remain within the seven owned P32 globs plus P32 runtime metadata and structured steward requests. No migration, root barrel, central route/worker composer, package manifest, lockfile, or infrastructure configuration is changed.

## Verification

Final re-run passed `npm run typecheck`, 21 focused Vitest assertions across domain/database/server/worker/UI, focused ESLint, focused Prettier, interface artifact/digest recomputation, and `git diff --check`.

## External effects

Authority `none`; attempted `0`, succeeded `0`, reconciled `0`. No provider or live effect occurred.

## Security, privacy, and data handling

No secrets, real identities, child data, private questions/support bodies, media, raw provider identifiers, raw export tokens, provider payloads, or bearer material were accessed or recorded. Purge contracts are hash/HMAC/tombstone metadata only.

## Blockers, deviations, and recovery

No blocker or deviation. The writer-slot lease was released at `2026-07-28T20:43:29Z`. Pending migration, central registration, and independent Object-Lock infrastructure are explicit steward requests, not hidden completion claims.
