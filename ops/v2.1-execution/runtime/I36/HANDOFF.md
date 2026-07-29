# I36 P09 Full-Integration Release

## Identity

- Branch: `codex/v21-integration`
- Reconciled claim target:
  `e952671b1b214be51a01ef7f4abcaef6a50ce9da`
- Containing merge authorization:
  `aff7a46e8efc1a9756b5b0ef543916eb51f3c906`
- State-based authorization parent:
  `d633726e427e659adf55d71d009919ae4f6b4dde`
- P09 source: `33a21a45005271f1bbe09c8587df1e52fac1a95a`
- P09 merge head: `38307b26f243597df79ef18c928c9a3e935cd5fc`
- P09 rebound merge digest:
  `16559951b731a12e2a530b35a232c685eb8f6509e380e66dc111ee4d2942f3a5`
- Claim: `26d3ae42-c9c9-4913-9534-1d4c71b55f13`
- RELEASE_INTEGRATOR lease: `495eba01-e9b3-4e71-9e53-4864c9d93bac`
- Lease released: `2026-07-29T12:09:18Z`, before its
  `2026-07-29T13:06:14Z` expiry.
- Final metadata release head: derive with `git rev-parse HEAD`; C00 records the
  observed pushed remote head.

## Merge record

P09 was ancestry-merged with exact first parent
`e952671b1b214be51a01ef7f4abcaef6a50ce9da` and exact second parent
`33a21a45005271f1bbe09c8587df1e52fac1a95a` at
`38307b26f243597df79ef18c928c9a3e935cd5fc`. The source and required merge
base were both `088b40476bd5ceeb0af901b6f78a4cb8c556671b`. The first-parent
delta is exactly the 14 authorized queue paths, and the exact P09 source is an
ancestor of the merge result.

## Verification

- Exact P09 focused suite: 4 files and 16 tests passed.
- Workspace TypeScript typecheck passed.
- Focused ESLint, CRLF-aware Prettier, and diff hygiene passed.
- Repository secret scan passed across 2909 text files.
- Merge parents, source ancestry, required base, canonical rebound queue
  digest, and exact 14-path scope passed.
- This release checkpoint changes only I36 `TASK-STATE.yaml`, `HANDOFF.md`, and
  `NEXT-PROMPT.md`.

P09 migration and registration requests were admitted only as immutable source
artifacts. They remain assigned to later steward checkpoints and were not
applied. `P11-registration-001` also remains unapplied. No steward,
registration, provider, send, or external effect was performed.

## Next action

C00 should reconcile the exact pushed metadata release head and P09 merge head
above. I36 must stop after reporting this checkpoint.

## Effects

Authority none; attempted/succeeded/reconciled `0/0/0`.
