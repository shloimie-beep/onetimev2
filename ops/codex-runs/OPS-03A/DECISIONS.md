# OPS-03A Decisions

## 2026-07-16 - Continue PR #40, no competing branch

- Decision: Continue `codex/ops03-staging-readiness-repair` for PR #40.
- Reason: The prompt explicitly forbids a competing branch or duplicate PR.
- Evidence: Remote branch and PR #40 both resolved to starting head `fb3c397ce8ece100cf7873fdddcd940a1552ea9b`.

## 2026-07-16 - Keep BNA checkout untouched

- Decision: Use `C:\Users\User\.ops03-worktrees\OPS-03` for implementation and do not stage or commit the dirty BNA checkout.
- Reason: The prompt explicitly says not to use or stage dirty BNA work.

## 2026-07-16 - Phase 1 first

- Decision: Repair PR #40 checks before implementing the larger activation lifecycle.
- Reason: The prompt lists PR #40 repair as Phase 1, and CI must be green before staging activation closeout can be trusted.

## 2026-07-16 - OT-75 non-applicability is not readiness

- Decision: The OT-75 validator may exit successfully with `status: "NOT_APPLICABLE"` for mixed/non-OT-75 PR scopes, but it must not label that state `READY`.
- Reason: OPS-03A is not the OT-75 release readiness task. The OT-75 standard remains strict for OT-75 branches and OT-75-only changes.
