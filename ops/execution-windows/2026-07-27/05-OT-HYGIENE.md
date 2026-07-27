# 05-OT-HYGIENE

Canonical assignment:
`BOARD.yaml#tracks[id=audit_wave_05_preservation_census]`.

## One-line continuation prompt

Continue 05-OT-HYGIENE from the current Board row `audit_wave_05_preservation_census`: after the operator supplies distinct protected census and backup roots outside every repository, run metadata-only A05-T01, commit only the two sanitized manifest files, prove every source status hash unchanged, and keep all PR-closure, deletion, reset, prune, stash, force-push, and history-rewrite counters at zero.

## Assignment

- Window ID: `05-OT-HYGIENE`
- Task ID: `OT-LAUNCH-01-W05-PRESERVATION-CENSUS`
- Repository: `shloimie-beep/onetimev2`
- Branch: `codex/w05-preservation-census-20260727`
- System: protected local repository/worktree census
- Concurrency lock: `OT-HYGIENE`
- Acceptance IDs: `HYGIENE-CENSUS-001`
- Result path: `ops/preservation/2026-07-26/A05/inventory-summary.json`
- Dependencies: current Board assignment and operator-provided distinct
  protected census/backup roots outside every repository
- Exact write scope:
  - protected local metadata inventory
  - `ops/preservation/2026-07-26/A05/inventory-summary.json`
  - `ops/preservation/2026-07-26/A05/UNRESOLVED-BLOCKERS.json`

## Required behavior

Record only hashed paths and remote identities, canonical repository class,
HEAD/upstream, ahead/behind, status/ref/worktree/stash counts, and local-only
commit SHA/subject metadata. Separate One Time, BNA, legacy One Time, and
unknown repositories. Treat operator-supplied counts and SHAs as verification
targets until observed.

## Forbidden behavior

Never print raw paths/URLs, diff bodies, environment values,
credential-helper output, protected file content, private destinations,
customer/Student content, provider material, or untracked file bodies. Never
reset, clean, restore/checkout-overwrite, stash, rebase, prune, GC,
broad-stage, auto-commit dirty work, close/comment on PRs, delete, cross-push,
or force-push.

This task does not create bundles, patches, remote preservation refs, the final
preservation PR, semantic adjudication, comments, or PR closures.

## Required proof and stop

Prove before/after source status hashes are identical and all destructive and
closure counters are zero. Stop before reading if either protected root is
missing or inside a repository/cloud-served tree; stop on ambiguous identity,
protected-output risk, symlink escape, unmerged state, or any source mutation.
Only JSON/schema/checksum/privacy/diff verification is required.
