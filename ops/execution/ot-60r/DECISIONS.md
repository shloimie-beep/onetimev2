# OT-60R Decisions

## DEC-OT60R-001 - Use Fresh Worktree From Canonical PR #2 Base

Decision: use `C:\Users\User\OneTimeOneTime-crm-core-v1` only as the clean source clone and create a separate worktree at `C:\Users\User\OneTimeOneTime-ot60r-recovery-convergence`.

Reason: the prompt forbids reusing dirty worktrees and requires the target branch to start from exact SHA `4ac288968ba24e30a5c3f8c6924f492eedf4338f`.

Status: active.

## DEC-OT60R-002 - Initial Checkpoint Before Integration

Decision: create and commit the execution protocol, state files, and evidence placeholders before any cherry-pick or semantic porting.

Reason: the prompt explicitly requires a durable checkpoint before risky integration work.

Status: active.
