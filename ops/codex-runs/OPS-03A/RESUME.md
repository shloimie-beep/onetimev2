# OPS-03A Resume

Updated: 2026-07-16T22:14:30+03:00

## Current State

- Repo: `webcraft-media/onetimev2`
- Worktree: `C:\Users\User\.ops03-worktrees\OPS-03`
- Branch: `codex/ops03-staging-readiness-repair`
- PR: https://github.com/webcraft-media/onetimev2/pull/40
- Starting SHA: `fb3c397ce8ece100cf7873fdddcd940a1552ea9b`
- Current pushed SHA: `96a40e0008858ac4c9574f9a2c322637f4f2098c`
- Current local state: Phases 2-5 are implemented and verified locally. Commit/push/deploy is next.

## Completed

- Formatted `ops/codex-runs/OPS-03/evidence/deployment/live-acceptance.json`.
- Updated OT-75 workflow to use GitHub PR base/head env values.
- Updated OT-75 validator to emit `NOT_APPLICABLE` for mixed/non-OT-75 PR scopes.
- Added unit coverage for PR base/head and non-applicability reporting.
- Preserved the original OPS-03A prompt in `ops/codex-runs/OPS-03A/ORIGINAL-PROMPT.md`.
- Pushed commit `96a40e0008858ac4c9574f9a2c322637f4f2098c` to PR #40.
- GitHub checks passed: Node 24 verify, PostgreSQL 16 assurance harness, PostgreSQL 16 learner-seat proof, and Static release readiness gates.
- Added encrypted lifecycle delivery outbox and post-activation MFA handoff migrations.
- Added natural `/activate`, `/forgot-password`, and `/reset-password` routes and APIs.
- Removed prompt-based login MFA and replaced it with an inline code field.
- Wired owner/admin activation through password creation, TOTP enrollment, recovery-code acknowledgement, and then session creation.
- Wired generic forgot-password and password reset with session revocation.
- Wired lifecycle delivery processing into the existing sink worker loop.

## Verified Locally

- `node scripts/ot75/validate-release-readiness.mjs --scope-base 96b429053d13a139595ed3bd0ea3c854cc2500e8 --scope-head HEAD --branch-name codex/ops03-staging-readiness-repair`
- `npx vitest run --config vitest.unit.config.ts tests/unit/ot75/release-readiness.test.ts`
- `npx prettier --check .github/workflows/ot75-release-readiness.yml scripts/ot75/validate-release-readiness.mjs tests/unit/ot75/release-readiness.test.ts ops/codex-runs/OPS-03/evidence/deployment/live-acceptance.json`
- JSON parse check for `ops/codex-runs/OPS-03/evidence/deployment/live-acceptance.json`
- `npm run typecheck`
- `npm run build`
- `npx vitest run --config vitest.unit.config.ts tests/unit/account-lifecycle-sql.test.ts tests/unit/ot75/release-readiness.test.ts`
- `npx vitest run --config vitest.integration.config.ts tests/integration/accounts/account-lifecycle.test.ts tests/integration/accounts/account-lifecycle-web.test.ts`
- `npx playwright test tests/e2e/account-lifecycle-pages.spec.ts`
- `npx playwright test tests/accessibility/account-lifecycle-a11y.spec.ts`
- `npx prettier --check` on OPS-03A touched source/test files
- `git diff --check`

## Current Blocker

The real one-email canary is blocked by missing protected Railway variables on both `ot99-web` and `ot99-worker`:

- `ONE_TIME_OWNER_TEST_EMAIL`
- `ONE_TIME_LIFECYCLE_DELIVERY_KEY`
- `ONE_TIME_DELIVERY_TEST_CANARY_EMAIL`
- `RESEND_API_KEY`

No destination was inferred or substituted, and no real email was sent.

## Known Caveat

`npm run format` on Windows still reports broad pre-existing repository formatting/line-ending drift. Do not run `npm run format:write` repo-wide as an OPS-03A repair. GitHub Actions on Linux is the authoritative full-format check for PR #40.

## Next Commands

1. Commit and push the OPS-03A implementation checkpoint.
2. Deploy the exact pushed SHA to isolated Railway staging services `ot99-web` and `ot99-worker`.
3. Run migrations against isolated `ot99-pg16`.
4. Smoke `https://ot99-web-staging.up.railway.app/health`, `/ready`, and `/version`.
5. Leave the real email canary blocked until the protected runtime variables above are configured.

## Do Not Do

- Do not deploy production.
- Do not change DNS.
- Do not touch Stripe, payments, BNA runtime, Telegram, Zoom, Vimeo, Buffer, or support-ticket work.
- Do not send email/WhatsApp to the Rabbi or any customer.
- Do not consume the operator activation link in automation.
- Do not merge PR #40.
