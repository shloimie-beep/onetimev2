# I36 F02 Lease A Micro-Integration Release

## Identity

- Branch: `codex/v21-integration`
- Atomic claim target:
  `1badb3430d171182da2e43314e286b594c2df538`
- Reconciled authorizing control:
  `c32912be90dfe7f7cd33b9cf5f4e74ba9ec37b78`
- Sole acquisition parent:
  `9f0fa8d1ac1a69e5b8728e1c1161e7292ec7e5f7`
- READY I36 digest:
  `abea17f9e9fc4a77f1a9dd8fc88252d5fd58596deab1d5b474227019103ec8eb`
- Claim: `a66df456-06ec-4c28-80fe-1ef48c0004f7`
- RELEASE_INTEGRATOR lease: `6e20c91b-828c-4008-993d-a58f2c1ff43b`
- Lease window: `2026-07-29T20:16:15Z` through
  `2026-07-29T21:31:15Z`
- Lease released: `2026-07-29T20:49:47Z`
- Phase scope: `F02_lease_A_micro_integration_atomic_claim_only`
- Release head: derive with `git rev-parse HEAD`; C00 records and audits the
  observed pushed head and its sole parent.

## Merge result

F02 Lease A merged at
`8d1405b4f6f5014364620bac0a2b5729c60aa2ac` from parents
`1badb3430d171182da2e43314e286b594c2df538` and
`e156003b243221f97f938a0aca16164c1dd86d2d`.

The merge preserves source ancestry and changes exactly the queued eight-path
scope. Its required merge base is
`e4673ff1c2e621e26ac93034be245b280c4da4fa`.

## Verification

The canonical queue item, exact source inventory, NUL-delimited manifest,
F02 task and state/handoff bindings, allocation proposal, next ordinal 2239,
four native/pg-mem checksum pairs, protected SQL blobs, lease, merge-after
ancestry, YAML syntax, and 0/0/0 effect admission passed.

All 69 migrations through 2238 applied and verified in a fresh disposable
pg-mem database with zero pending migrations. Repository typecheck, full
ESLint, production build, raw-Git-blob Prettier, the execution-package
validator with all structure/coverage counts, YAML parsing, secret scanning,
diff hygiene, exact merge parents, source ancestry, checksum and collision
checks, and eight-path scope passed.

## Scope and effects

Every migration and registration request remains committed but unapplied. No
new ordinal was allocated. No provider inspection, send, deployment, or
external effect occurred.

This release checkpoint changes only I36 `TASK-STATE.yaml`, `HANDOFF.md`, and
`NEXT-PROMPT.md` beyond the eight queued F02 paths.

## Next action

C00 must audit and reconcile the exact pushed release head and its sole parent.
I36 must stop after reporting it.

## Effects

Authority none; attempted/succeeded/reconciled `0/0/0`.
