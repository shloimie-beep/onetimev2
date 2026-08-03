# Proposed execution wave 1

This is the smallest safe parallel wave supported by the reconciled audits. It
is not executable until the conductor records the assignments in `BOARD.yaml`.
The existing `02-OT-ZOOM` provider cleanup remains separate and is not
duplicated.

| Window           | Writer lock    | Work                                                                                                                   | Why now                                                                             |
| ---------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `03-OT-GHL`      | `GHL-PROVIDER` | Exhaustive read-only HighLevel inventory, with an explicit incomplete result when hidden/archived scope is unavailable | Blocks all repository sender design and provider mutation; requires zero mutation   |
| `04-OT-PRODUCT`  | `OT-PRODUCT`   | Canonical runtime/environment classification and fail-closed tuple tests                                               | P1 release boundary and prerequisite for later public diagnostic minimization       |
| `05-OT-HYGIENE`  | `OT-HYGIENE`   | Metadata-only protected clone/worktree census                                                                          | Preservation must precede closure; no source change or PR closure                   |
| `06-BNA-CONTROL` | `BNA-CONTROL`  | BNA pointer-only current-control repair from exact `master` checkpoint                                                 | Removes stale current-run authority without touching product/runtime/provider state |

`07-OT-PRODUCTION` is deliberately not assigned. Its packet must return
`NOT_RUNNABLE` until every dependency in `dependency-dag.yaml` is terminal and
fresh promotion authority exists.

## Test-efficiency contract

- `03-OT-GHL`: identity/coverage readback only; no repeated browser smoke,
  screenshots, or mutation path.
- `04-OT-PRODUCT`: focused configuration/auth/startup tests, typecheck, build,
  scoped formatting, secret scan, and a short operator checklist. No full
  repository E2E unless focused tests reveal shared auth/routing regression.
- `05-OT-HYGIENE`: metadata/checksum/schema/diff verification only; do not
  inspect or print raw diff bodies.
- `06-BNA-CONTROL`: YAML parsing, pointer resolution, stale-status scan, and
  `git diff --check`; no product/browser/provider test matrix.

## Global zero-effect counters

- provider mutations: 0
- customer sends: 0
- contact enrollments: 0
- payment actions: 0
- production actions: 0
- destructive actions: 0
- PR comments: 0
- PR closures: 0
- branch/worktree deletions: 0
- resets/prunes/force-pushes/history rewrites: 0
