# OPS-03B - Email activation and trusted-device login; retire mandatory TOTP

## Mission

Make the standalone One Time staging login natural and usable tonight. No user should be forced to install an authenticator app. Deliver an owner/admin activation email, a password setup flow, a normal login, and a separate parent-test activation without weakening role isolation.

## Exact source and branch

- Repository: `webcraft-media/onetimev2`
- Fetch and verify base branch: `codex/ops03-staging-readiness-repair`
- Required base SHA: `fb5f5eebc539afc9e93833e9417ee67524d62c36`
- Create clean isolated worktree/branch: `codex/ops03b-email-step-up-login`
- Draft PR base: `codex/ops03-staging-readiness-repair`
- Never commit on, force-push, amend, or rebase the base branch.

If repository identity or the exact SHA is not available, fix the remote/worktree selection and continue. Do not fall back to `C:\Users\User\BNA v2.0`.

## Frozen product policy

1. Remove the authenticator-app/TOTP requirement from active One Time UX for every role.
2. Parent and student logins remain password-only after activation. Do not introduce email OTP for them.
3. Owner/admin activation link: validate the single-use activation token, let the user set a password, rotate the session, and log them in directly. Do not show a QR code, authenticator secret, TOTP field, or recovery-code page.
4. Later owner/admin password login on an untrusted browser: send a short-lived single-use six-digit email code and also support the secure email link carried by the same challenge. Successful verification completes login.
5. Offer `Trust this device for 30 days`. Trusted browsers may use password-only login until trust expires or is revoked.
6. Sensitive owner/admin operations must require email assurance no older than ten minutes: changing admins/roles/email/password, provider credentials or mappings, billing configuration, CRM export, bulk messaging, Buffer publish/schedule, bulk delete/archive, session revocation, and security settings. Ordinary CRM viewing, content viewing/editing, navigation, and drafting do not re-prompt.
7. Keep legacy TOTP tables only for rollback/audit compatibility. Revoke or forward-disable active TOTP factors after email login is ready. Remove all active routes, policy requirements, and visible copy that ask for an authenticator. Old TOTP endpoints must be inaccessible or return a generic retired-method response.
8. The current schema assigns one role per account/email. Do not make one identity both admin and parent. Use a separate protected operator-controlled parent alias.

## Security behavior

- Reuse the existing OPS-03A lifecycle outbox and guarded Resend transport at the base SHA. Do not add another email provider.
- Add the next collision-free additive migration for hashed email challenges and trusted-device records.
- Challenge codes/tokens: cryptographically random, ten-minute expiry, maximum five failed attempts, single-use, and invalidated when a newer challenge is issued.
- Rate-limit by account, normalized email, and IP without creating account-enumeration differences.
- Store only hashes of challenge tokens and trusted-device tokens. Never log or audit raw codes/tokens; never persist them in browser storage or expose them in analytics/referrers.
- Trusted-device cookie: random opaque token, `HttpOnly`, `Secure`, `SameSite=Lax`, scoped to the One Time product, with server-side hash and expiry.
- Revoke trusted devices on password reset, email change, role/security-version change, logout-all, account suspension/disable, or explicit device revocation.
- Preserve Argon2id, CSRF, secure session cookies, session rotation, no-store private responses, noindex staging/auth pages, generic forgot/reset responses, and audit events.
- Give the code/link screen an accessible resend timer, paste/autofill support, clear expiration messaging, keyboard support, and responsive 360x800 behavior.

## Operator and parent test access

- Read the real operator destination only from protected `ONE_TIME_OWNER_TEST_EMAIL`. Do not infer, print, commit, or place it in evidence.
- If the operator account does not exist, create and issue activation. If it exists but is not activated, issue a fresh activation. If already activated and the password is unknown, issue a password reset. Send at most one authorized message in this run.
- Read the parent-test address only from protected `ONE_TIME_PARENT_TEST_EMAIL`. An operator-controlled plus-address alias is acceptable. Create a fictional staging household and parent identity with no production data, then send at most one parent activation if the variable and canary authorization exist.
- The parent account must be usable in an incognito window or second device and must see only its fictional household/learners. It must not see CRM/admin/content controls.
- Do not send to Rabbi Scheller, customers, imported leads, or any address that is not the exact allowlisted protected canary destination.

## Protected staging variables

Use existing protected staging secret storage. Never print values. Readiness should identify absent variable names only:

- `ONE_TIME_OWNER_TEST_EMAIL`
- `ONE_TIME_PARENT_TEST_EMAIL` (optional unless parent canary is requested)
- `ONE_TIME_LIFECYCLE_DELIVERY_KEY`
- `ONE_TIME_DELIVERY_TEST_CANARY_EMAIL`
- `RESEND_API_KEY`
- `ONE_TIME_EMAIL_FROM`
- `ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED=true`
- `ONE_TIME_RESEND_TRANSPORT_ENABLED=true`

If any provider variable is missing, implement and verify everything possible, deploy provider-off code if safe, commit and push the branch, open/update the draft PR, and write the exact resume instruction. Missing credentials are a canary blocker, not an implementation blocker.

## Tests and evidence

Cover at minimum:

- owner/admin activation ends in a valid session without TOTP;
- owner/admin untrusted login sends and validates email challenge;
- trusted-device reuse, expiry, logout, password reset, role change, and revocation;
- parent/student never see an OTP/TOTP/authenticator page;
- wrong, expired, replayed, superseded, and rate-limited codes;
- no account enumeration, open redirect, token leakage, or session fixation;
- owner/admin/parent/student role and data isolation;
- activation, forgot-password, reset-password, login, email-code, and device-management accessibility/mobile states;
- migration checksum/registry and real disposable PostgreSQL proof;
- full applicable CI.

Search the built output, route copy, screenshots, and source for `Authenticator`, `Scan this`, `TOTP`, `otpauth`, and `recovery code`. Explain any deliberate dormant backend compatibility references; active UX must contain none.

## Staging and handoff

After CI is green, deploy the exact branch SHA to the existing isolated One Time staging project only. Apply the additive migration. Verify `/version`, `/health`, `/ready`, activation, login, forgot/reset, owner/admin CRM access, parent portal isolation, and absence of authenticator UI. Send only the protected allowlisted activation/reset canaries.

Final report must state:

- exact branch/head/PR and deployed SHA;
- staging login and activation URLs;
- whether owner and parent canary messages were accepted by the provider, redacted;
- how the operator should complete activation without revealing the token;
- exact role behavior;
- tests and screenshots;
- deployment and rollback IDs;
- missing protected variable names, if any;
- confirmation that production, DNS, broad sends, live charges, and BNA were untouched.

## Persistent checkpoint protocol

Before implementation, create and maintain:

- `ops/codex-runs/OPS-03B/ORIGINAL-PROMPT.md`
- `ops/codex-runs/OPS-03B/STATE.json`
- `ops/codex-runs/OPS-03B/DECISIONS.md`
- `ops/codex-runs/OPS-03B/RESUME.md`
- `ops/codex-runs/OPS-03B/FINAL-REPORT.md`

At every material checkpoint update phase, exact source/input SHAs, files changed, migrations, tests, external mutations, blockers, and next command. If blocked or interrupted, commit/push the safe task-owned checkpoint and make `RESUME.md` sufficient for a different Codex window. Do not leave the only useful state in chat.
