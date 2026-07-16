# OPS-03A Resume

Updated: 2026-07-16T22:40:00+03:00

## Current State

- Repo: `webcraft-media/onetimev2`
- Worktree: `C:\Users\User\.ops03-worktrees\OPS-03`
- Branch: `codex/ops03-staging-readiness-repair`
- PR: https://github.com/webcraft-media/onetimev2/pull/40
- Starting SHA: `fb3c397ce8ece100cf7873fdddcd940a1552ea9b`
- Current pushed SHA: `f7647b9dad7b54e1e31fe38aa7a53c1b3a3b5e0b`
- Current local state: Implementation is deployed to isolated staging and PR #40 checks are green. Real canary remains blocked by protected runtime.

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
- Pushed implementation commit `b34eb0bf54c7583fff0ded11551cfbea7c33fc78`.
- Repaired the CI migration-ledger expectation and pushed commit `f7647b9dad7b54e1e31fe38aa7a53c1b3a3b5e0b`.
- PR #40 checks passed at `f7647b9dad7b54e1e31fe38aa7a53c1b3a3b5e0b`.
- Deployed local PR source to isolated Railway staging web deployment `7855ced9-5ece-4ca9-bc4c-2bc2659c4ed1` and worker deployment `213c84f9-6b6c-496f-bb1a-6b6c92444d45`.
- Applied migrations `2008_ops03a_lifecycle_delivery_outbox` and `2009_ops03a_activation_mfa_handoffs` to isolated `ot99-pg16`.
- Live smokes passed for `/health`, `/ready`, `/version`, `/activate`, `/forgot-password`, `/reset-password`, and `/login` copy.

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

## Staging Evidence

- URL: `https://ot99-web-staging.up.railway.app`
- `/version`: `ops03a-f7647b9`, commit `f7647b9dad7b54e1e31fe38aa7a53c1b3a3b5e0b`
- Web deployment ID: `7855ced9-5ece-4ca9-bc4c-2bc2659c4ed1`
- Worker deployment ID: `213c84f9-6b6c-496f-bb1a-6b6c92444d45`
- Migration `2008_ops03a_lifecycle_delivery_outbox`: `fa5bdd70675acfa26a6bb891f2606428263d266886de89f199ee298457883429`
- Migration `2009_ops03a_activation_mfa_handoffs`: `bdc3d4da2b1cca0b027119cc93609b87eba20a6eab8fce4320c140db9ef83f1b`

## Known Caveat

`npm run format` on Windows still reports broad pre-existing repository formatting/line-ending drift. Do not run `npm run format:write` repo-wide as an OPS-03A repair. GitHub Actions on Linux is the authoritative full-format check for PR #40.

## Next Commands

1. Leave the real email canary blocked until the protected runtime variables above are configured.
2. Do not merge PR #40 from automation.

## Do Not Do

- Do not deploy production.
- Do not change DNS.
- Do not touch Stripe, payments, BNA runtime, Telegram, Zoom, Vimeo, Buffer, or support-ticket work.
- Do not send email/WhatsApp to the Rabbi or any customer.
- Do not consume the operator activation link in automation.
- Do not merge PR #40.
