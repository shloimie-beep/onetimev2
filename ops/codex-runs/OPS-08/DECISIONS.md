# OPS-08 Decisions

## Readiness Label

Use `PARTIALLY_READY_FOR_OPERATOR_TESTING`, not `READY_FOR_OPERATOR_TESTING`.

Reason: the integrated tree is locally validated, but required finish-line inputs are still incomplete or conflicting. Current PR #44 is pushed at `3871c38b75e7fc866f572ec80d3b2ec37cde6b6e`, but a merge-tree probe reports conflicts and no green check metadata was available to OPS-08. OT-113 remains absent/blocked. OT-114 is now pushed at `096dd614c9493cec1c29851e14f56166863ad26b`, but it conflicts in `apps/web/src/server/app.ts` and was not merged into this checkpoint.

## Integration Scope

- Created one external worktree and one integration branch only: `C:\Users\User\.overnight-20260717-worktrees\OPS-08` on `integration/ops08-overnight-final-20260716T230543Z`.
- Used `C:\Users\User\onetimev2` only for source verification and remote/worktree operations.
- Did not use the dirty BNA checkout as One Time source and did not stage, reset, clean, or switch it.
- Merged completed/safe inputs: OPS-04C, PR #42, PR #43, PR #45, PR #47, OT-112, OPS-05, OPS-06, and OPS-07.
- Did not merge current PR #44, OT-113, OT-114, or BNA-OPS-02.

## Product Fix Decisions

- Keep the CRM action coverage panel visible, but remove implementation detail (`action_id`, raw handler paths, capability IDs, and idempotency key sources) from normal UI.
- Keep session-expired modal copy where it is an explicit expired-session state, but make the shell's loading fallback neutral so normal loading does not show "Signed out", "Session expired", or "Checking session".
- Treat helper-unavailable copy as a product state, not a wiring confession. The fallback now says the helper is being prepared and points students/parents to the appropriate human route.
- Update OPS-05 provider-control test login to email challenge because OPS-03B retired the active TOTP login path.
- Adjust OPS-07 route gate to clear cookies between role checks and ignore only URL-specific expected protected-route 403s while preserving response URL checks for other failures.

## No-Deploy Decision

No staging or production deploy was attempted. The prompt allows staging only for an exact green candidate with protected isolated staging config and rollback evidence. This checkpoint is partial and lacks required input readiness.
