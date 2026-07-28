# P27 Handoff

## Identity

- Branch: `codex/v21-p27-ghl-identity`
- Start SHA: `d35166838267711a514cf73822cd2ca49a3f3ded`
- Implementation SHA: `7d5edd687016b827769cc931b3766b2ae566507c`
- Current handoff commit: derive with `git rev-parse HEAD`; C00 records the observed remote head.
- Continuation authority: `538ee781fb805ac13b020a66dadf5573451d7af9`
- Claim ID: `83580db4-4a47-44d0-8d6d-83969ae7ccf5`
- GHL_IDENTITY lease: `62f708f5-43b5-4f50-8cc8-623c8f448a0a`
- Lease expiry: `2026-07-28T21:34:49Z`
- Task packet digest: `77c5a4de58a57dffea3f9cbe4aa7646ac75bc1f0462afebfff2c0279dc527a74`
- Context digest: `c1016b9b4f97895cc60c173a0cc69d409f16eef2d83d7680e35ee4d604cadf48`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Interface contract digest: `788e150f7819431fecd8036701d1e78d6fe0a39b818795b318d54e70998d5ce6`
- Contract artifact SHA-256: `0902595802bff7648b342eb44a65303a75d8bf68742b5140ff9d8cb98ed7044e`

## Completed behavior

P27 now exposes a versioned Adult-only GHL identity contract. A verified link
wins, followed by one exact normalized-email match. Link/email disagreement or
multiple matches produce a visible review case and zero provider intents; name
and phone are never merge keys. Classification is exactly active legacy,
former/canceled, opted-in lead, suppressed, or review, and active household
membership alone cannot establish legacy classification.

The planner creates household-keyed projections preserving lifecycle, access,
and applicable Stripe references. The parameterized PostgreSQL repository
persists the complete local plan transactionally with optimistic fencing. The
worker commits that local result before provider synchronization, preserves it
when a provider call fails, and schedules retry. Student input hard-stops before
intent creation, repository access, or provider invocation. The HighLevel
desired-state builder is pure; no live provider call was made.

## Remaining work

P27-owned implementation is complete. F02 must adjudicate
`P27-migration-001`; I36 must adjudicate `P27-registration-001` and integrate
the exact interface checkpoint. Candidate-bound provider proof remains for
later verification waves.

## Exact next action

Run final verification, publish `ready_for_review`, then C00/I36 may validate
and integrate the exact interface checkpoint for P28.

## Coverage

- Requirements: all three implementation-verified.
- Acceptance cases: 3 files and 10 task-owned assertions passed, including Adult classification, ambiguity quarantine, Student hard-stop, local-first ordering, provider-failure durability, and optimistic persistence fencing.

## Changed files and migrations

Fourteen implementation files and two structured steward requests were added
inside P27-owned paths, plus P27 runtime metadata. No migration, root barrel,
worker composer, provider registry, control state, or integration ledger was
edited. Migrations: none.

## Steward requests

- `P27-migration-001`: SHA-256 `a1d8d5bb025ed060673b2d3467a4be61d382e4a27ca4b410982210ace5be9474`.
- `P27-registration-001`: SHA-256 `d0b373150a99d03272b5b136510011adae603f5d66f27232965e135217522720`.

## Verification

- Full TypeScript typecheck: passed.
- Focused Vitest: 3 files, 10 assertions, all passed.
- Focused ESLint: passed.
- Focused Prettier: passed.
- Canonical interface contract and artifact digests: verified.
- Git diff check: passed.

## External effects

Authority `none`; attempted `0`, succeeded `0`, reconciled `0`. No provider or
live effect occurred.

## Security, privacy, and data handling

No secrets, provider payloads, customer data, child data, private questions,
email values, bearer material, or provider identities were accessed or
recorded.

## Blockers, deviations, and recovery

No P27-owned blocker. Migration and central registration are correctly routed
to their stewards and do not weaken the stable direct-import interface.
