# W12-100 Staging Prompt

Use this prompt only after the draft convergence PR is reviewed and still kept draft unless the operator explicitly approves readiness.

## Prompt

You are picking up W12-100 launch-readiness convergence from branch `integration/w12-100-launch-readiness-convergence-20260717` based on W12-99 head `0d8d7168f066668f035176d777bdaaa4dcc5accd`. Do not deploy or mark any PR ready without explicit operator approval. First read `AGENTS.md`, `ops/director/START-HERE.md`, all `ops/codex-runs/W12-100-CONVERGENCE/*`, and the PR discussion/checks. Verify the exact branch head, clean worktree, and draft PR status. Re-run the blocked database checks only with approved staging/disposable database credentials. Keep providers in fake/sink/test mode unless the operator approves an exact canary. Record every external action in the external-action ledger.

## Required First Checks

- Confirm no PR #71 product code has entered the branch.
- Confirm OPS-13A artifacts entered through W12-100-00 only.
- Confirm `/app/communications` and `/app/support` are served by the protected app shell.
- Confirm `DATABASE_URL` points only to approved disposable/staging infrastructure before running database verification.
