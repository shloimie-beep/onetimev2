# 06-BNA-CONTROL

Canonical assignment:
`BOARD.yaml#tracks[id=audit_wave_06_bna_control_pointer]`.

## One-line continuation prompt

Continue 06-BNA-CONTROL from exact BNA `master` `cebbfc5781b92fcd9a5014df67f8ae4ba0b3a61c` and the current One Time Board row `audit_wave_06_bna_control_pointer`: change only `BNA-START-HERE.md`, `AGENTS.md`, `ops/control/CURRENT.yaml`, and `ops/control/BNA-BOARD.yaml`, prove one pointer/one Board and audit-first execution precedence, then open a bounded draft PR with zero product, provider, deployment, data, or One Time changes.

## Assignment

- Window ID: `06-BNA-CONTROL`
- Task ID: `BNA-CONTROL-POINTER-01`
- Repository: `shloimie-beep/bnei-neviim-academy`
- Start commit: `cebbfc5781b92fcd9a5014df67f8ae4ba0b3a61c`
- Branch: `codex/bna-control-pointer-repair-20260727`
- System: BNA current pointers and governance
- Concurrency lock: `BNA-CONTROL`
- Acceptance IDs: `BNA-CONTROL-POINTER-001`
- Result path: `ops/control/BNA-BOARD.yaml`
- Dependencies: accepted A07/A12 control findings, exact unchanged BNA master,
  current One Time Board assignment, and no second BNA control writer
- Exact write scope:
  - `BNA-START-HERE.md`
  - `AGENTS.md`
  - `ops/control/CURRENT.yaml`
  - `ops/control/BNA-BOARD.yaml`

## Required control model

`CURRENT.yaml` points to exactly one `BNA-BOARD.yaml`; that Board is the only
mutable BNA status map. The entrypoint is pointer-only. The Board records exact
master preservation, no BNA School feature assignment, PR #141 as a decision
gate, PR #142 as provider-off evidence, the July 12 run as historical One
Time-first evidence, standalone One Time as external truth, and no
decomposition/provider authority.

`AGENTS.md` must state that audit/review/discussion/analysis/plan-only/prompt-only
or preservation work never triggers execution. Goal-mode execution requires a
Board task, named writer, exact scope, stop condition, proof, and explicit
implementation authority.

## Verification

Parse both YAML files, prove the pointer resolves once, scan the four files for
copied mutable status, verify the exact changed-file allowlist, run scoped
Prettier and `git diff --check`, and return the exact commit and draft PR. No
application/browser/provider test matrix is required.

## Forbidden behavior and stop

Do not edit historical runs, application/runtime/scripts/tests/migrations,
providers, deployments, data, One Time, PR #141/#142 implementation, BNA
School, or archive/decomposition sources. Stop if master differs, policy
requires another accepted path, a second writer owns a file, or pointer repair
would need application changes. Do not merge or deploy.
