# OT-85 Resume

## Current State

- Branch: `codex/ot85-whatsapp-lead-assistant`.
- Worktree: `C:\Users\User\.onetime-worktrees\ot85-whatsapp-lead-assistant`.
- Base SHA: `a02d1d254ae0d17804fb657079a7871567260ea2`.
- Checkpoint: `WAITING_FOR_WHATSAPP_CANARY_SECRET`.
- Code, tests, and build are complete locally.
- The remaining blocked item is the protected canary recipient secret and staging authorization.

## If Resuming

1. Confirm branch and worktree:

   ```bash
   git -C C:\Users\User\.onetime-worktrees\ot85-whatsapp-lead-assistant status -sb
   git -C C:\Users\User\.onetime-worktrees\ot85-whatsapp-lead-assistant branch --show-current
   ```

2. Re-run core checks:

   ```bash
   npm run typecheck
   npm run lint
   npm run secret:scan
   npm run test
   npm run build
   ```

3. Re-run canary readiness without printing the recipient:

   ```bash
   npx tsx scripts/ot85/canary-readiness.ts
   ```

4. Only if `ONETIME_CANARY_WHATSAPP_RECIPIENT_E164`, `ONETIME_WHATSAPP_CANARY_AUTHORIZED=true`, `ONE_TIME_WHATSAPP_PROVIDER_ENV=STAGING`, and `ONE_TIME_WHATSAPP_STAGING_ISOLATED=true` are present in protected runtime config, perform a single staging canary using the one-message budget.

## Important Boundaries

- No raw canary recipient or WhatsApp sender values should be written to logs, artifacts, command history, PR text, or test output.
- Do not implement OT89 technical tickets in this branch.
- Do not reuse Telegram runtime or Telegram identity tables for WhatsApp.
- Do not create private account reads, child/student data reads, billing reads, CRM reads, class links, portal access, provider mutations, or payment mutations from WhatsApp.
