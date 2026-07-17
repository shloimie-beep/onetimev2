# W12-05 Resume

Status: code complete; activation and canary remain pending protected staging configuration and explicit operator approval.

Continue from:

- Worktree: `C:\Users\User\.w12-20260717-worktrees\W12-05`
- Branch: `codex/w12-05-telegram-operations`
- Base: `release/ops10-full-staged-production-launch-20260717T050800Z` at `c7d46066517d7a458d189f2c782cc06200f7861c`

Before any activation:

1. Review `RUNBOOK.md`.
2. Confirm the protected staging bot token, webhook secret, owner mapping, admin mapping, and canary chat are configured outside Git/chat.
3. Do not register or mutate production webhook configuration.
4. Do not run a real Telegram send unless a separate canary task explicitly authorizes the exact staging chat and message.

Recommended local verification after resume:

```powershell
npm run unit -- tests\unit\telegram\telegram-foundation.test.ts
npm run integration -- tests\integration\telegram-admin-runtime.test.ts
npm run typecheck
npm run secret:scan
```
