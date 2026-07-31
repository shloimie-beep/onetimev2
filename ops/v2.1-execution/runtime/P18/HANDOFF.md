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
