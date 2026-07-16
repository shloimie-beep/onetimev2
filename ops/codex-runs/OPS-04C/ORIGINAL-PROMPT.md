You are Worker OPS-04C, the single integration/convergence owner for the One Time immediate access/content batch. Execute only OPS-04C in the external repo, not BNA.

Critical context:
- Current date: 2026-07-16/17 Asia/Jerusalem.
- External repo: C:\Users\User\onetimev2, remote https://github.com/webcraft-media/onetimev2.git.
- Batch source extracted at C:\Users\User\AppData\Local\Temp\codex-one-time-batch-20260716-safe\One-Time-Immediate-Access-and-Content-Batch-2026-07-16.
- Read 00-READ-ME-FIRST.md, BATCH-MANIFEST.json, and OPS-04C-CONTENT-CONVERGENCE\CODEX-PROMPT.md completely before editing.
- Also read any AGENTS.md or equivalent instructions in the external repo/worktree.
- Required leaf remote heads currently fetched:
  - origin/codex/ops03b-email-step-up-login = 25b2a95aa4e3ae82aad20537dc300e9978c15b56 (implementation head recorded inside as 22a5faba49a073e42828c9bdea7a076c3af58038)
  - origin/codex/ot104r-vimeo-private-runtime = ae01fe70e0cd8954b4d9f5175789cc4af442741a
  - origin/codex/ot101r-telegram-admin-runtime = dbff29bbc2d5434f7eecab61e4f081481e1cccaa
  - origin/codex/ot110a-admin-content-workspace = 8fdbc7b51008773e1051b717a686b98137a813cb
  - origin/codex/ot111-legacy-activation-campaign = 15da6650673c1e58852f0937a02adf9efef78365
- Required additional product inputs to inspect/reconcile where not already contained:
  - PR #44 head 560a07c66baddc99df38441299f3e57107d02137 student helper
  - PR #46 head 4155ee706fce2eabc6db5225b5c8ce41a8c1dfd1 Buffer runtime
  - PR #48 head a62d6a73553e175871f6d3124badb96573cdabe7 Rabbi content publisher
- Use final green OPS-03B head as preferred integration base if possible. Create a clean isolated worktree, recommended path C:\Users\User\.batch-20260716-worktrees\OPS-04C, branch name `integration/ops04c-one-time-access-content-convergence-<UTC timestamp>`.
- You are not alone in the codebase. Do not revert/overwrite unrelated work. Own only the OPS-04C integration branch/worktree and ops/codex-runs/OPS-04C checkpoint files.
- Do not modify C:\Users\User\BNA v2.0 or BNA product code.
- Do not perform production deployment, root/join DNS change, broad sends, live charges, real customer imports, or BNA runtime mutations.
- Staging deployment is requested only if the repo/tooling/config permits and remains within isolated One Time staging. If required protected vars/credentials are absent, integrate available completed inputs, run all possible local tests, push a resumable checkpoint, and record exact blockers. At most allowlisted owner/parent activation messages are permitted only if the required protected variables and explicit authorization are present; otherwise no sends.

Deliverables:
- Persist ops/codex-runs/OPS-04C/{ORIGINAL-PROMPT.md,INPUTS.json,STATE.json,DECISIONS.md,CONFLICT-LEDGER.md,RESUME.md,ROLLBACK.md,FINAL-REPORT.md}.
- Semantically integrate the five leaf branches and named product inputs where available; do not blindly merge unrelated sides.
- Run applicable lint/typecheck/unit/integration/e2e/accessibility/performance/build/secret scan and DB/migration proof as possible. Repair task-owned failures; document baseline/config blockers.
- Commit, push, open/update draft PR.
- Final response: branch, candidate head SHA, PR URL if created, exact integrated inputs, tests/results, staging/deploy/canary status, missing protected variables/blockers, and safety guardrails.
