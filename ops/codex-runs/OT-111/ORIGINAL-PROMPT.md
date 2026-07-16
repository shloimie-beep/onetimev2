# OT-111 Original Prompt

Worker OT-111 for the One Time batch.

External repo: `C:\Users\User\onetimev2`, remote `https://github.com/webcraft-media/onetimev2.git`.

Batch source: `C:\Users\User\AppData\Local\Temp\codex-one-time-batch-20260716-safe\One-Time-Immediate-Access-and-Content-Batch-2026-07-16`.

Required reads before editing:

- `00-READ-ME-FIRST.md`
- `BATCH-MANIFEST.json`
- `OT-111-LEGACY-ACTIVATION-CAMPAIGN\CODEX-PROMPT.md`
- Any external repo `AGENTS.md` or equivalent

Required base: `origin/codex/ops03-staging-readiness-repair` at `fb5f5eebc539afc9e93833e9417ee67524d62c36`.

Branch: `codex/ot111-legacy-activation-campaign`.

Recommended isolated worktree: `C:\Users\User\.batch-20260716-worktrees\OT-111`.

Scope:

- Execute only OT-111 in the external repo, not BNA.
- Own only legacy audience reconciliation, activation campaign controls, import adapters, tests, evidence, and `ops/codex-runs/OT-111` files.
- Do not import real customer data, broadly email real users, deploy production, change DNS, perform live charges, or mutate BNA.

Deliverables:

- Implement the prompt as completely as possible.
- Maintain `ops/codex-runs/OT-111/{ORIGINAL-PROMPT.md,STATE.json,DECISIONS.md,RESUME.md,FINAL-REPORT.md}`.
- Run focused and applicable tests.
- Commit, push, and open/update a draft PR if tooling/auth permits.
- Final response must include branch, head SHA, PR URL if created, changed files, tests, real audience/import/send status, and remaining blockers.
