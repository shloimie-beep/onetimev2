# OT-104R Resume

Branch:
`codex/ot104r-vimeo-private-runtime`

Worktree:
`C:\Users\User\.batch-20260716-worktrees\OT-104R`

Current state:
Implementation and local sink-mode verification are complete. The only known
remaining blocker is a real read-only Vimeo canary because protected Vimeo
configuration and a dedicated staging fixture video are not present in this
environment.

To resume:

1. Verify branch and worktree:
   `git status -sb`
2. Re-run focused validation:
   `npx vitest run --config vitest.integration.config.ts tests/integration/content/ot104r-vimeo-private-runtime.test.ts`
3. Re-run broad validation if needed:
   `npm run integration`
4. Re-run static gates:
   `npm run typecheck`, `npm run lint`, `npm run secret:scan`
5. To run the read-only canary after protected config exists:
   `node bin/ot104r-vimeo-canary --mode read-only --json`

Real canary required variables:

- `VIMEO_ACCESS_TOKEN`
- `VIMEO_CLIENT_ID`
- `VIMEO_CLIENT_SECRET`
- `VIMEO_ACCOUNT_ID`
- `VIMEO_WEBHOOK_SECRET`
- `VIMEO_STAGING_CANARY_VIDEO_ID`

Do not run upload/publish/delete canaries for this lane. Do not mutate
production, DNS, BNA, Academy, payments, customer sends, or unrelated providers.
