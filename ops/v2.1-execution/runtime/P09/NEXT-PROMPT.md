# P09 Next Prompt — Review and Integrate the Concrete Correction

Review the tip of `codex/v21-p09-school-inquiry-concrete` as one substantive
merge terminal. Verify its exact parents are, in order:

1. `ae3ced8a9daa11044d4278968c14cb6baa12a480`
2. `d9a4ce8082a028be81e234999deb43f659072a6d`

Confirm the cumulative first-parent delta is exactly the 18 authored paths plus
the required byte-identical carried `P09-migration-002` recorded in
`TASK-STATE.yaml`; the public School-inquiry `router.ts` and `router.test.ts`
remain unchanged; `P09-migration-002` has Git blob
`75cd8bb242eaaa59d7ebb215ea4d8881fb5354e1`; and
`P09-registration-001` remains Git blob
`042bb0b080703002a1743e725daa9deb3b590796`.

The focused P09 verification passed 7 files and 36 tests. Review the new Admin
router, canonical request binding, durable current and superseded-version
replay/mismatch behavior, optimistic create/update/readback,
`production_read_only` pre-denial, canonical migration-2256 repository SQL,
and explicit zero-effect result. Verify amended control
`321fd3482d5ee54bbad19d97205b54845d0d0aac`, READY digest
`6c1e0bd137ee03d0d816ee21cf2a23322a71ed485373b9b1e165533aee3a1be1`,
exact-scope SELECT-only history access, and zero production history mutation.
Do not request native PostgreSQL or broad-suite repetition in this P09 lane.

Disposition exactly these new immutable successors:

- `P09-server-registration-002`
- `P09-client-route-002`
- `P09-barrel-export-002`

Apply accepted successors only in the existing I36 shared-registration lane.
Do not revive `P09-registration-001`, rewrite `P09-migration-002`, add a School
role/portal/roster, or edit migration 2256. After composition, I36 must run its
touched-graph typecheck/build/static signed-out `/school` test.

If the terminal and three successors pass review, admit the terminal to
integration and leave P09 stopped. External effects remain `0/0/0`.
