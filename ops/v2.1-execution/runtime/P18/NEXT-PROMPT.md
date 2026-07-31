MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: STOP

Audit P18's terminal post-COMMIT attendance projection callback correction.

Repository: `shloimie-beep/onetimev2`
Branch: `codex/v21-p18-attendance-projection-callback`
Authorized start: `d89a0f38dfe695c323f56a28e7c2b0bd890d4ef9`
Atomic claim: `8c48f3218c8e10aeab542fb478e87f13433f12c6`
Implementation: `633e3805150e9a4f4b8cce76d4304454bbb85d94`
Claim: `267308b4-66fa-4910-8597-00999c58a856`
Released EMBEDDED_CLASSROOM lease:
`94b15518-5638-4025-89b1-eabd2d4da07a`
Released at: `2026-07-31T10:58:50Z`
READY digest: `565882ee24deefdc5bc3e242e62548867596e4573a9e6ee7961991c66aa4b47d`
Eight-path ceiling digest:
`1dd57e7e6aed52361594eb355635aa799b9cc63aca5a52ab65f88b346d90af1a`
Source manifest:
`0bcc3c44d3516bb20b9a6fb9b3400e1c8c87528444b57832d7c11c4bf170ab88`

Verify the terminal head is a sole-parent metadata child of the implementation
head and the full start-to-terminal delta is exactly the authorized eight
paths. Verify mandatory port injection, DB-derived immutable payload,
COMMIT-before-callback, callback-failure exact-replay repair, older exact replay
after successor without a projection write, conflict/stale rollback without
callback, exact correction/null payload, deterministic equal-time correction
ordering, and pre-COMMIT metadata/binding validation.

Confirm 29 focused tests, typecheck, ESLint, Prettier, YAML, diff, secret,
locked-manifest, migration-tree, forbidden-delta, exact-scope, clean-push, and
local/tracking/live equality. Effects must be `0/0/0`.

C00 audits; I36 later derives P22 account/class/household/Admin bindings from
canonical server records. P18 must stop.
