# W12-100-10 Original Prompt

You are executing one parallel W12-100 launch-readiness lane in:

Repository: webcraft-media/onetimev2
Canonical starting commit:
0d8d7168f066668f035176d777bdaaa4dcc5accd

Do not start from main, PR #61, an individual W12 feature branch, or PR #72.
Fetch all refs and verify that the exact starting commit exists before creating work.

Create a new isolated git worktree and the branch specified by this lane. Do not reuse or modify another lane's worktree.

Required first reads:
1. AGENTS.md
2. ops/director/START-HERE.md
3. ops/director/PRODUCT-INVARIANTS.md
4. ops/codex-runs/W12-99/FINAL-REPORT.md
5. ops/codex-runs/W12-99/STATE.json
6. ops/codex-runs/W12-99/CAPABILITY-MATRIX.json
7. ops/codex-runs/W12-99/CANARY-REPORT.json
8. ops/codex-runs/W12-99/IMPORT-PREVIEW.json
9. ops/codex-runs/W12-99/ROLLBACK.md

Global safety contract:
- Do not deploy staging or production in this lane.
- Do not connect to or read private rows from the production database.
- Do not send email, WhatsApp, Telegram, provider webhooks, payments, posts, Zoom invitations, or external helper requests.
- Do not create, delete, upload, publish, or mutate provider resources.
- Never print, copy, screenshot, serialize, or commit secrets, database URLs, private destinations, private links, source rows, raw message bodies, student-sensitive data, tokens, or passwords.
- Use hashes, counts, statuses, synthetic fixtures, and redacted summaries for evidence.
- Keep BNA code, sessions, data, provider runtime, and branches out of this repository lane.
- Do not integrate W12-09 unless the lane explicitly says to assess it.
- Do not run repo-wide prettier --write or mass-format inherited files.
- Do not merge PRs, mark PRs ready, or alter production configuration.
- Stay inside the assigned ownership paths. When a required fix belongs to another lane, record it as a dependency instead of editing that lane's files.

Create:
ops/codex-runs/<LANE-ID>/ORIGINAL-PROMPT.md
ops/codex-runs/<LANE-ID>/STATE.json
ops/codex-runs/<LANE-ID>/FINAL-REPORT.md
ops/codex-runs/<LANE-ID>/RESUME.md
ops/codex-runs/<LANE-ID>/CHANGED-FILES.txt

STATE.json must classify every objective as:
- done
- already_satisfied
- blocked
- needs_operator_decision

For implementation lanes:
- Add focused automated tests.
- Run focused tests first.
- Then run secret scan, lint, typecheck, and all directly affected suites.
- Run broader gates where practical.
- Do not weaken an assertion or remove a safety check merely to get green.

Before completion:
1. Confirm git status is clean after commit.
2. Push the branch.
3. Open a draft PR against
   integration/w12-final-convergence-20260717T123715Z
4. Put exact tests, blockers, external actions count, and mutation count in the PR body.
5. External actions and production mutations must both be zero.

LANE-ID: W12-100-10
Branch: codex/w12-100-10-sre-launch-runbook

Exclusive ownership:
- scripts/w12-100/deploy/**
- scripts/w12-100/ops/**
- ops/runbooks/w12-100/**
- ops/codex-runs/W12-100-10/**

Do not deploy or alter Railway in this lane.

Build a fail-closed launch toolkit for Railway that requires explicit immutable
identity values before any command can mutate an environment.

The toolkit must:
- identify project, environment, web service, worker service, and database
- reject production during staging commands
- reject ambiguous or unlinked Railway state
- verify current /version before deployment
- require the exact candidate commit and expected image digest
- run migrations as a separate controlled operation
- verify /health, /ready, /version, and worker heartbeat
- check pending migration count
- check backup freshness metadata
- record deployment IDs and digests without env values
- support staging rollback to the exact pre-deploy source
- support roll-forward to the candidate
- refuse database deletion/replacement
- keep provider transports off
- emit machine-readable evidence

Design alert and observability checks for:
- web readiness
- worker heartbeat
- queue depth and oldest age
- delivery retries/dead letters
- database saturation
- rate-limit spikes
- login failures
- webhook verification failures
- class launch failures
- billing webhook failures
- backup age

Produce exact staging deploy, rollback, roll-forward, production promotion, and
post-deploy verification runbooks. State the known limitation that native
production rollback may not exist and source rebuild is the current fallback.

