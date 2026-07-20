# Student Experience Preview Milestone

Generated: 2026-07-20T17:16:25.5728777+03:00

## Accepted

- ACCEPTED_BRANCH: isolated branch `codex/student-experience-preview` was created from PR #92 head `5ddd7b604c01744dd562050ae9b51124f7732594`.
- ACCEPTED_PR94_INTEGRATION: PR #94 head `ebd28c65fab5f11b2a334937ef10bdf1da7b62f3` was integrated semantically into the PR #92 branch.
- ACCEPTED_LOGIN_IDENTIFIER: login now uses a neutral email-or-username identifier while keeping legacy email payload compatibility.
- ACCEPTED_STUDENT_USERNAME_AUTH: students can sign in by parent-managed username without a student email credential.
- ACCEPTED_PARENT_RESET_REVOCATION: parent reset updates the linked student principal, revokes active student sessions, and preserves legacy email-linked student identity when no username is supplied.
- ACCEPTED_GENERIC_FAILURES: invalid student username/password/disabled states return generic invalid-credential responses.
- ACCEPTED_OWNER_ADMIN_EMAIL_CHALLENGE: privileged owner/admin email challenge behavior remains intact.
- ACCEPTED_LOCAL_BROWSER_EVIDENCE: local synthetic admin, parent, and student browser journeys passed with screenshots and zero critical/serious a11y findings.
- ACCEPTED_NO_PROVIDER_BLEED: provider transports stayed off/sink/mock; no GHL, LeadConnector, production data, payment, provider, or send mutation was performed.

## Blocked

- BLOCKED_STAGING_DEPLOYMENT: Railway is not linked and exact isolated staging IDs were not available.
- BLOCKED_STAGING_MIGRATIONS: no safe staging database context or authorized Railway service context was available.
- BLOCKED_PROTECTED_OPERATOR_INBOX: no protected operator inbox/send path was available.
- BLOCKED_REAL_PREVIEW_CREDENTIALS: no staging preview was deployed, so no real staging credentials were generated.
- BLOCKED_GITHUB_ACTIONS_ACCOUNT_BILLING: GitHub Actions did not start PR #96 jobs because repository account billing or spending limit requires owner action.

## Verification

- `npm ci`: passed.
- `npm run typecheck`: passed.
- `npm run unit -- tests/unit/learning-product-portals.test.ts`: passed, 4 tests.
- `npm run integration -- tests/integration/portals/portal-mount.test.ts tests/integration/auth-crm.test.ts`: passed, 2 files and 14 tests.
- `npm run build`: passed.
- `npm run brand:check`: passed.
- `npm run secret:scan`: passed.
- `npx playwright test tests/e2e/w12-03-portal-test-lab.spec.ts`: passed, 2 tests.
- `gh pr view 96 --json statusCheckRollup` plus check-run annotations: blocked externally; all failed GitHub Actions checks share the annotation that jobs were not started because recent account payments failed or the spending limit needs to be increased.

## Artifacts

- State: `ops/codex-runs/STUDENT-EXPERIENCE-PREVIEW/STATE.json`
- Public handoff: `ops/codex-runs/STUDENT-EXPERIENCE-PREVIEW/HANDOFF.json`
- Private handoff shell: `C:/Users/User/.onetime-student-preview/PREVIEW-HANDOFF.private.json`
- Screenshots:
  - `ops/codex-runs/STUDENT-EXPERIENCE-PREVIEW/screenshots/admin-preview-1440x1000.png`
  - `ops/codex-runs/STUDENT-EXPERIENCE-PREVIEW/screenshots/parent-preview-1440x1000.png`
  - `ops/codex-runs/STUDENT-EXPERIENCE-PREVIEW/screenshots/student-preview-1440x1000.png`
