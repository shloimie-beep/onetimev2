# OT-88 Resume

Status: `PREFLIGHT_COMPLETE`.

Worktree:

```powershell
cd C:\Users\User\.ot88-worktrees\OT-88
git status --short --branch
git rev-parse HEAD
```

Expected branch: `codex/ot88-zoom-learner-classroom`.

Expected source commit: `f98103ecc3660dbda871a91485656e17580940a8`.

Required base PR branch: `codex/ot84-telegram-action-gateway`.

The controlling prompt is `ops/codex-runs/OT-88/TASK_PROMPT.md`. The selected packet is preserved under `ops/codex-runs/OT-88/packet/`, and the operator temp prompt is preserved as `ops/codex-runs/OT-88/ORIGINAL-PROMPT.md`.

Next safe step:

1. Inspect the existing portal, class, billing, provider, outbox, Telegram, and UI seams from the paths recorded in `STATE.json`.
2. Implement OT-88 in provider-off/sink mode first.
3. Do not run a real Zoom canary, real Telegram send, provider mutation, deployment, DNS change, payment mutation, production database mutation, or BNA runtime edit without explicit scoped authorization and protected test credentials.

Current protected prerequisites missing in this shell: Zoom SDK/API credentials, Telegram webhook/bot runtime credentials, and `DATABASE_URL`.

