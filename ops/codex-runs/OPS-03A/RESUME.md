# OPS-03A Resume

Updated: 2026-07-16T21:46:34.1645148+03:00

## Current State

- Repo: `webcraft-media/onetimev2`
- Worktree: `C:\Users\User\.ops03-worktrees\OPS-03`
- Branch: `codex/ops03-staging-readiness-repair`
- PR: https://github.com/webcraft-media/onetimev2/pull/40
- Starting SHA: `fb3c397ce8ece100cf7873fdddcd940a1552ea9b`
- Current local state: Phase 1 repair is implemented locally and not yet committed.

## Completed Locally

- Formatted `ops/codex-runs/OPS-03/evidence/deployment/live-acceptance.json`.
- Updated OT-75 workflow to use GitHub PR base/head env values.
- Updated OT-75 validator to emit `NOT_APPLICABLE` for mixed/non-OT-75 PR scopes.
- Added unit coverage for PR base/head and non-applicability reporting.
- Preserved the original OPS-03A prompt in `ops/codex-runs/OPS-03A/ORIGINAL-PROMPT.md`.

## Verified Locally

- `node scripts/ot75/validate-release-readiness.mjs --scope-base 96b429053d13a139595ed3bd0ea3c854cc2500e8 --scope-head HEAD --branch-name codex/ops03-staging-readiness-repair`
- `npx vitest run --config vitest.unit.config.ts tests/unit/ot75/release-readiness.test.ts`
- `npx prettier --check .github/workflows/ot75-release-readiness.yml scripts/ot75/validate-release-readiness.mjs tests/unit/ot75/release-readiness.test.ts ops/codex-runs/OPS-03/evidence/deployment/live-acceptance.json`
- JSON parse check for `ops/codex-runs/OPS-03/evidence/deployment/live-acceptance.json`

## Known Caveat

`npm run format` on Windows still reports broad pre-existing repository formatting/line-ending drift. Do not run `npm run format:write` repo-wide as an OPS-03A repair. GitHub Actions on Linux is the authoritative full-format check for PR #40.

## Next Commands

1. Commit the Phase 1 repair.
2. Push `codex/ops03-staging-readiness-repair`.
3. Re-check PR #40 checks with `gh pr checks 40 --repo webcraft-media/onetimev2 --watch`.
4. Continue Phase 2 durable lifecycle delivery only after Phase 1 CI is clean or after any new CI failure is repaired.

## Do Not Do

- Do not deploy production.
- Do not change DNS.
- Do not touch Stripe, payments, BNA runtime, Telegram, Zoom, Vimeo, Buffer, or support-ticket work.
- Do not send email/WhatsApp to the Rabbi or any customer.
- Do not consume the operator activation link in automation.
- Do not merge PR #40.
