# OT-88 Resume

Status: `READY_FOR_OT99`.

Worktree:

```powershell
cd C:\Users\User\.ot88-worktrees\OT-88
git status --short --branch
git rev-parse HEAD
```

Expected branch: `codex/ot88-zoom-learner-classroom`.

Resumed audited head: `80a67b93c61e9d5fb127789dadc0739917f21555`.

Existing PR: `#34`.

The controlling prompt is `ops/codex-runs/OT-88/TASK_PROMPT.md`. The selected packet is preserved under `ops/codex-runs/OT-88/packet/`, and the operator temp prompt is preserved as `ops/codex-runs/OT-88/ORIGINAL-PROMPT.md`.

Implementation state:

1. Provider-off/sink-mode Zoom learner classroom implementation is complete.
2. Local scoped validation passed; see `ops/codex-runs/OT-88/evidence/local-validation.json`.
3. PR #34 CI passed on implementation head `d6cba56f539eb87c2f5edb1908a5f0fa3956df85`.
4. The final `READY_FOR_OT99` status commit must keep the same PR checks green.

Next safe step:

1. Push the `READY_FOR_OT99` status-only commit to `codex/ot88-zoom-learner-classroom`.
2. Verify PR #34 checks through GitHub Actions on that final status commit.

Current protected prerequisites missing in this shell: Zoom SDK/API credentials, Telegram webhook/bot runtime credentials, and `DATABASE_URL`.

Do not run a real Zoom canary, real Telegram send, provider mutation, deployment, DNS change, payment mutation, production database mutation, or BNA runtime edit without explicit scoped authorization and protected test credentials.
