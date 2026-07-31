# P18 Attendance Projection Callback Claim

## Identity

- Branch: `codex/v21-p18-attendance-projection-callback`
- Exact start: `d89a0f38dfe695c323f56a28e7c2b0bd890d4ef9`
- Live control: `ddd36a461481504219ac663cf464417eb2e6658b`
- Control state basis: `0a2e8c390d48da157be35a2f9d06f876a70b5e62`
- Claim: `267308b4-66fa-4910-8597-00999c58a856`
- Writer: `codex-p18-projection-callback-267308b4`
- EMBEDDED_CLASSROOM lease: `94b15518-5638-4025-89b1-eabd2d4da07a`
- Lease expiry: `2026-07-31T12:20:00Z`
- READY digest: `565882ee24deefdc5bc3e242e62548867596e4573a9e6ee7961991c66aa4b47d`
- Exact eight-path ceiling digest:
  `1dd57e7e6aed52361594eb355635aa799b9cc63aca5a52ab65f88b346d90af1a`

## Claim checkpoint

The target remote branch was absent after fetching the live control,
integration, P18, and P22 refs. The worktree was clean at the exact authorized
start. This sole-parent checkpoint changes only the P18 runtime triplet and is
the atomic first-branch claim required before any product source edit.

The locked manifest passed for all 200 entries. LF-normalized task, context,
prompt, and source-package digests match READY. The live READY payload digest
was independently reproduced from recursively key-sorted compact JSON.

## Exact next action

Create the remote branch with one normal non-force push. Then implement only
the narrower live correction: a mandatory post-COMMIT projection-change port,
exact replay repair including older-after-successor replay, rollback/no
callback for conflict or stale new writes, immutable P18-only payload,
deterministic correction ordering, and pre-COMMIT P22-compatible validation.

## External effects

Authority `none`; attempted `0`, succeeded `0`, reconciled `0`.

## Implementation checkpoint

Atomic claim head `8c48f3218c8e10aeab542fb478e87f13433f12c6` created the
remote branch before source work. The five authorized source/test paths now
implement the complete correction:

- `AttendanceProjectionChangePort` is a mandatory PostgreSQL factory
  dependency and receives only the three-dimensional P18 scope, occurrence,
  Student, stored source event ID/digest, and stored correction
  audit/reason/Admin fields or null.
- PostgreSQL `RETURNING` or an exact `FOR SHARE` replay read supplies callback
  identity; request-only account, class, household, role, source, and
  correction identity cannot enter the payload.
- New evidence writes its projection and commits before callback. Callback
  failure propagates after commit; exact replay performs no projection write,
  commits, and re-invokes the callback.
- Changed replay and genuinely stale new evidence roll back and invoke no
  callback. An older exact event after a successor remains a no-write callback
  success.
- Correction history uses observed time ascending, then attendance event ID
  ascending, and the final row. Canonical reason/audit/Admin metadata and exact
  projection/event binding are validated before commit.

Focused repository/domain tests pass 25/25. Workspace typecheck and focused
ESLint/Prettier pass. Effects remain `0/0/0`.

The exact next action is to push this implementation checkpoint, run terminal
hygiene and scope/digest checks, release the lease in the runtime triplet, and
push the ready-for-review final.

## Terminal ready-for-review checkpoint

- Atomic claim head: `8c48f3218c8e10aeab542fb478e87f13433f12c6`
- Implementation head: `633e3805150e9a4f4b8cce76d4304454bbb85d94`
- Terminal metadata head: derive with `git rev-parse HEAD`; C00 records the
  observed remote head.
- Source manifest:
  `0bcc3c44d3516bb20b9a6fb9b3400e1c8c87528444b57832d7c11c4bf170ab88`
- Lease released: `2026-07-31T10:58:50Z`, before
  `2026-07-31T12:20:00Z` expiry.

Terminal verification passed 29 focused assertions in three files, workspace
typecheck, focused ESLint and Prettier, YAML parsing, diff hygiene, secret scan
across 3,110 repository text files, all 200 locked-manifest entries, exact
eight-path scope, no forbidden delta, and unchanged migration tree
`040376c25e645b048afeb8e08d230a3084ab8566`.

Effects remain attempted `0`, succeeded `0`, reconciled `0`. No control,
migration, composer, config, barrel, steward request, integration, candidate,
provider, deployment, DNS, send, charge, or customer state changed.

C00 independently audits the exact pushed final. I36 later supplies the
server-owned adapter that derives account, class, household, and assigned Admin
bindings from canonical records before invoking P22. P18 must stop.
