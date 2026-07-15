# OT-84 Resume

## Current Checkout

- Repository: `webcraft-media/onetimev2`
- Worktree:
  `C:\Users\User\OneTimeOneTime-ot84-telegram-action-gateway`
- Branch: `codex/ot84-telegram-action-gateway`
- Base ref: `origin/codex/ot83-household-portals-foundation`
- Resolved base SHA: `a02d1d254ae0d17804fb657079a7871567260ea2`
- Current head at initialization:
  `a02d1d254ae0d17804fb657079a7871567260ea2`

## Completed

- Verified `origin` points to `https://github.com/webcraft-media/onetimev2.git`.
- Created a clean isolated One Time worktree from the resolved OT83 base.
- Copied the complete OT-84 Codex prompt into `PROMPT.md`; SHA-256 matches the
  packet manifest.
- Created initial `STATE.json`, `RESUME.md`, `FINAL.md`, and `DECISIONS.md`
  before implementation code.
- No BNA product code, Telegram provider mutation, real send, production data
  write, or secret read has occurred.

## Next Safe Action

Commit the initial run artifacts, then inspect the repository architecture:
migrations, database helpers, authorization context, CRM/tasks/classes/content
services, outbox/worker conventions, logging/redaction, tests, and CI scripts.

Then update `DECISIONS.md` and `STATE.json` before implementing the smallest
repository-native OT-84 gateway.

## Required Guardrails

- Do not modify any BNA/Academy checkout for product behavior.
- Do not print or store Telegram bot tokens, webhook secrets, numeric Telegram
  IDs/chat IDs, raw Telegram updates, full contact values, or local credential
  paths.
- Do not create a second staging bot.
- Do not use long polling in production webhook mode.
- Do not implement BNA bot, OT88 question-provider, or OT89 subscriber-alert
  consumer logic in this branch.
- Missing protected Telegram secrets should checkpoint as
  `WAITING_FOR_TELEGRAM_SECRET` only after non-secret-dependent implementation,
  tests, synthetic canary, branch push, and draft PR are complete.

## Commands To Recheck

```bash
git remote get-url origin
git branch --show-current
git status --short --branch
git rev-parse refs/remotes/origin/codex/ot83-household-portals-foundation
git merge-base --is-ancestor a02d1d254ae0d17804fb657079a7871567260ea2 HEAD
```

