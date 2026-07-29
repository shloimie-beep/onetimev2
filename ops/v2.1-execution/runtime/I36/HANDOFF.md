# I36 P23 Full-Integration Release

## Identity

- Branch: `codex/v21-integration`
- Reconciled claim target: `f75b0922c3b9db11a8ca4beacc9f45a285ac8f0e`
- Containing merge authorization:
  `4017049c4caa6b252c60d75cfc111367fd58e63f`
- State-based authorization parent:
  `90c5406f047cbcf06b86f9aa4395ffc5044a7a2c`
- P23 source: `32f3a4649632c5768b46430c13b4cb2a3546cfc3`
- P23 merge head: `3d31cb5f460a0b103d5d0433d7bdb8228b68fa02`
- P23 merge digest:
  `7abbd657a3e4089ff5478f77fab356517c5fd090cb496a6ee53ea2cba5fae197`
- Claim: `4f275da3-6bac-4149-8f0d-42206f5d238e`
- RELEASE_INTEGRATOR lease: `5f617e0e-7f87-4eba-9dd0-1361227d272a`
- Lease released: `2026-07-29T10:07:21Z`
- Final metadata release head: derive with `git rev-parse HEAD`; C00 records the
  observed pushed remote head.

## Merge record

The P23 source was ancestry-merged with exact first parent `f75b0922` and exact
second parent `32f3a464`. Its required merge base was `cecc1c0d`; its
first-parent delta is exactly the 19 authorized queue paths. The source commit
is an ancestor of the merge result.

## Verification

- Exact P23 focused suite: 4 files and 22 tests passed.
- Workspace TypeScript typecheck passed.
- Merge parents, source ancestry, required base, canonical queue digest, and
  exact 19-path scope passed.
- This release checkpoint changes only I36 `TASK-STATE.yaml`, `HANDOFF.md`, and
  `NEXT-PROMPT.md`.

The P23 steward-request files were admitted as immutable source artifacts only.
No migration, registration, or steward request was applied. No provider, send,
or external effect was attempted.

## Next action

C00 should reconcile the exact pushed metadata release head and P23 merge head
above. I36 must stop after reporting this checkpoint.

## Effects

Authority none; attempted/succeeded/reconciled `0/0/0`.
