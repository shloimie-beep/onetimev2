# W12-100-00 Original Prompt

```text
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
   LANE-ID: W12-100-00
   Branch: codex/w12-100-00-director-and-ops13a-convergence

   Ownership:
   - ops/director/**
   - ops/codex-runs/OPS-13A/**
   - ops/codex-runs/W12-100-00/**

   This is an operations-record lane only. Do not modify product source, tests, migrations, package manifests, or workflows.

   Audit current PR #72. Its recorded head was:
   d4f58801ebbb5fe8a41ef33621c7594f0ff6b2b4

   Verify its current head and changed-file set. It should contain only the eight
   ops/codex-runs/OPS-13A artifacts. Compare every artifact with W12-99 and the current repository state.

   Integrate the usable OPS-13A artifacts onto this branch with preserved provenance. Do not merge unrelated commits and do not run OPS-13B.

   Refresh the canonical director records to reflect:
   - W12-99 head 0d8d7168f066668f035176d777bdaaa4dcc5accd
   - PR #73 open draft status and current checks
   - W12-00 through W12-08 integrated
   - W12-09 excluded pending explicit decision
   - OPS-13A now available as a preflight input but not yet acceptance proof
   - no W12 staging deployment
   - no real import
   - no provider acceptance
   - production runtime is distinct from the W12 candidate
   - W12-100 owns staging and launch proof
   - BNA remains a separate convergence train

   Repair stale entries in:
   - CURRENT-STATE.json
   - CAPABILITY-MATRIX.json
   - DEPLOYMENTS.json
   - WORKSTREAMS.json
   - BRANCH-FLEET.json
   - DECISION-REGISTER.md
   - START-HERE.md
   - PRODUCT-INVARIANTS.md
   - NEW-CHAT-PROMPT.md

   Replace placeholder head values such as
   "recorded_by_git_branch_and_draft_pr_head_after_commit"
   where an exact immutable SHA is now known.

   Do not claim that source metadata counts are deduplicated people counts.
   Do not claim any provider or import lane is accepted.
   Validate every JSON file with Node and run scoped Prettier checks.
```
