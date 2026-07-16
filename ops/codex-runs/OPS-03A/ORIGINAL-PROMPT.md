# OPS-03A — NATURAL EMAIL ACTIVATION, LOGIN CLOSEOUT, AND PR #40 REPAIR

You are completing the natural account-login experience for the standalone One Time application.

## Required outcome

At completion:

1. The operator receives exactly one allowlisted staging activation email.
2. The email contains a secure, single-use link.
3. The operator opens the link, chooses a password, enrolls owner/admin MFA, saves recovery codes, and reaches the correct dashboard.
4. Forgot-password and reset-password work naturally.
5. Existing parent-managed student access remains intact.
6. PR #40 is fully green.
7. The exact new SHA is deployed to the existing isolated Railway staging project.
8. No production, DNS, Stripe, BNA runtime, Rabbi/customer messaging, or broad provider changes occur.

Do not stop merely because an optional provider credential is unavailable. Complete and publish every independent code/test/documentation step, preserve a resumable checkpoint, and report only the exact missing protected runtime setting.

## Canonical source

Repository:
`webcraft-media/onetimev2`

Existing branch and PR:
- Branch: `codex/ops03-staging-readiness-repair`
- Draft PR: https://github.com/webcraft-media/onetimev2/pull/40
- Required starting remote SHA:
  `fb3c397ce8ece100cf7873fdddcd940a1552ea9b`

PR base:
`integration/ot-99-final-semantic-convergence-20260716T122407Z`

Base SHA:
`96b429053d13a139595ed3bd0ea3c854cc2500e8`

Existing staging:
`https://ot99-web-staging.up.railway.app`

Railway project:
- Name: `one-time-ot99-staging-96b42905`
- Project ID: `7c8eee26-7a6a-4684-826d-9f4377d67d46`
- Web service: `ot99-web`
- Worker service: `ot99-worker`
- PostgreSQL 16 service: `ot99-pg16`

Continue the existing PR #40 branch in a new clean worktree. Do not create a competing implementation branch or duplicate PR.

Before editing, fetch the remote and confirm the branch is still at the required SHA. If it has advanced, inspect the new commits and continue only if they are an ordinary fast-forward of OPS-03 work.

Do not use or stage the dirty BNA checkout.

## Existing implementation that must be reused

Do not rewrite the account lifecycle from scratch.

Existing files include:

- `packages/db/migrations/1700_ot71_account_lifecycle.sql`
- `packages/contracts/src/accounts/index.ts`
- `packages/domain/src/accounts/lifecycle.ts`
- `packages/domain/src/portals/account-lifecycle-adapter.ts`
- `packages/domain/src/auth/service.ts`

The existing domain already supports much of the required security behavior:

- Owner/admin invitations
- Parent activation
- Parent-managed student setup/reset
- Hashed one-use tokens
- Token expiry and revocation
- Argon2 password updates
- Generic password-reset behavior
- Audit events
- Idempotency
- Session invalidation
- TOTP provisioning and activation primitives

Extend and wire these primitives. Do not create a second competing authentication system.

## Phase 1 — Repair PR #40 checks

1. Format:
   `ops/codex-runs/OPS-03/evidence/deployment/live-acceptance.json`

2. Run the repository’s actual Prettier check and ensure the committed evidence remains valid JSON.

3. Correct OT-75 workflow applicability without weakening or disabling its release standard.

The workflow must derive the applicable pull-request base/head from GitHub event data or a documented current merge base. It must not compare PR #40 against stale historical hardcoded SHAs.

If OT-75 truly does not apply to a change set, record a machine-readable `NOT_APPLICABLE` result based on explicit path/scope rules. Do not label a skipped evaluation as `READY`.

4. Push the CI-repair commit to the existing PR #40 branch and verify:
   - Node 24 CI executes through all steps and passes.
   - PostgreSQL assurance passes.
   - Learner-seat/concurrency proof passes.
   - OT-75 either passes against the correct scope or truthfully reports documented non-applicability.

## Phase 2 — Durable activation delivery

The current lifecycle intent records do not retain a deliverable token. Fix this securely with an additive migration.

Implement a dedicated lifecycle delivery outbox:

- Keep the existing token hash as the only verification value.
- Never store the raw token or activation URL in plaintext.
- Encrypt the delivery payload with authenticated encryption using a dedicated protected staging secret.
- Store key identifier/version, nonce, ciphertext, authentication tag, expiry, destination reference, state, attempts, lease metadata, and idempotency key.
- Never print ciphertext keys, raw tokens, URLs, passwords, TOTP secrets, or recovery codes.
- Clear encrypted token material after successful delivery or expiry.
- New issuance invalidates earlier unconsumed links for the same account and purpose.
- Invitation lifetime: 24 hours.
- Password-reset lifetime: 30 minutes.
- Consumption must be atomic and safe against replay/concurrent requests.

Add bounded worker processing with:

- Lease-safe claiming
- Idempotency
- Retry with bounded backoff
- Dead-letter state
- Restart safety
- Staging destination allowlist
- Provider-off/sink operation
- Exactly-one-canary authorization

Email is the activation channel for OPS-03A.

Do not expand this task into WhatsApp activation. WhatsApp may later send a “check your email” notification, but secure activation/reset links remain email-first.

## Phase 3 — Web experience

Implement branded, responsive routes:

- `/activate`
- `/forgot-password`
- `/reset-password`

Update `/login`:

- Remove the `CRM` subtitle.
- Use “Welcome back” rather than the generic legacy heading.
- Add “Forgot password?”
- Preserve CSRF, private/no-store caching, CSP, secure cookies, rate limiting, and safe return routes.
- Use the shared One Time design tokens/header/button styles.
- Ensure 360×800 and 390×844 mobile layouts work without horizontal overflow.

Activation and reset links should preferably place the secret in the URL fragment so it is not transmitted in ordinary HTTP request logs.

The client must:

1. Read the fragment.
2. Hold the token only in memory.
3. Clear the fragment using `history.replaceState`.
4. Never put it in localStorage, sessionStorage, analytics, screenshots, logs, error reporting, or referrers.

Implement:

- Non-consuming token validation
- Atomic activation completion
- Enumeration-safe forgot-password request
- Atomic password-reset completion
- Session revocation after password reset
- Friendly expired, invalid, already-used, and superseded-link states
- Safe resend behavior

## Phase 4 — Roles and MFA

Role rules:

- Owner and administrator are real separate account memberships.
- Do not implement “View as Rabbi.”
- Parent accounts activate through their email.
- Students do not receive independent recovery emails.
- Parents create, reset, and suspend each student’s separate login.
- A student session remains scoped to one learner and cannot infer siblings.

After owner/admin chooses a password:

1. Create a short-lived post-activation enrollment handoff.
2. Call the existing TOTP provisioning primitive.
3. Show a branded QR/manual setup screen.
4. Require a valid TOTP code.
5. Show recovery codes once.
6. Require acknowledgment that recovery codes were saved.
7. Activate MFA.
8. Only then establish the normal authenticated session and route to the dashboard.

Do not use `window.prompt` for MFA.

Never expose the TOTP secret or recovery codes in committed evidence, logs, screenshots, test output, or the final response.

## Phase 5 — Tests

Add focused unit, integration, browser, accessibility, and security tests covering:

- Invitation creation and resend
- Resend invalidating the prior link
- Activation success
- Expired token
- Used-token replay
- Concurrent consumption
- Wrong-purpose token
- Wrong-role behavior
- Generic forgot-password response for existing and nonexistent addresses
- Reset revoking previous sessions
- MFA enrollment and activation
- Recovery-code acknowledgment
- Parent activation
- Parent-managed student credential reset
- Sibling isolation
- Worker retry/restart/idempotency
- No plaintext tokens in database, logs, audit events, HTML state, screenshots, or evidence
- Staging destination allowlist
- Provider-off mode
- Exactly one authorized email canary
- 360×800, 390×844, tablet, and desktop layouts
- Keyboard and WCAG 2.2 AA behavior

Use fictional `.example.test` accounts for automated tests.

Do not consume the real operator’s emailed activation link during automation.

## Phase 6 — Staging configuration and one-email canary

Use the existing isolated Railway staging project only.

Retrieve the operator destination only from protected runtime configuration. Do not infer it from source history, screenshots, Git commits, or conversation text.

Preferred protected variables:

- `ONE_TIME_OWNER_TEST_EMAIL`
- `ONE_TIME_LIFECYCLE_DELIVERY_KEY`
- Existing protected email-provider credential
- Exact staging origin:
  `https://ot99-web-staging.up.railway.app`
- Explicit canary authorization limiting delivery to one message and one allowlisted destination

If the email provider credential or protected destination is missing:

- Continue all implementation, migration, UI, tests, sink proof, CI repair, and staging deployment.
- Commit and push completed work.
- Store the exact missing variable name in the state report.
- Do not ask for the secret value in chat.
- Do not substitute a guessed email.
- Do not broadly enable provider delivery.

If configuration exists:

1. Deploy the exact tested commit to the existing staging web and worker.
2. Confirm `/version` reports the exact new SHA.
3. Run migrations on the isolated PostgreSQL 16 database.
4. Issue one administrator invitation to the allowlisted operator destination.
5. Send exactly one activation email.
6. Record only a redacted destination and provider delivery/message ID.
7. Leave the operator link unconsumed.
8. Tell the operator to open the email and complete password/MFA setup.

Do not email the Rabbi or any customer in this task.

## Staging protection

Set staging public pages to:

`noindex, nofollow`

Do not change production metadata or DNS.

Preserve the existing private handoff login until the natural activation flow has been human-confirmed. It is the emergency staging fallback and must not be deleted prematurely.

## Authorization boundaries

Authorized:

- Changes within `webcraft-media/onetimev2`
- Pushing additional commits to PR #40’s branch
- Additive staging migration
- Updating the existing isolated Railway staging services
- Protected staging environment variables required for this feature
- Exactly one activation email to the protected allowlisted operator test destination
- Automated sink/test messages to fictional recipients

Not authorized:

- Production deployment
- Root or join-domain DNS changes
- Stripe/webhook/payment changes
- Charges
- BNA runtime or dirty BNA worktree changes
- Rabbi/customer emails or WhatsApp messages
- Broad provider activation
- Production imports
- Telegram, Zoom, Vimeo, Buffer, or support-ticket work
- Merging PR #40

## Persistent execution record

Create and maintain:

- `ops/codex-runs/OPS-03A/ORIGINAL-PROMPT.md`
- `ops/codex-runs/OPS-03A/STATE.json`
- `ops/codex-runs/OPS-03A/DECISIONS.md`
- `ops/codex-runs/OPS-03A/RESUME.md`
- `ops/codex-runs/OPS-03A/FINAL-REPORT.md`

Update `STATE.json` after each phase.

If blocked after making safe progress:

- Do not discard work.
- Run relevant tests.
- Commit and push the checkpoint.
- Write the exact completed phase, remaining phase, blocker, branch, SHA, and next command in `RESUME.md`.
- Do not require continuation in the same Codex conversation.

## Definition of done

Do not report `READY` unless:

- PR #40’s exact head has complete green applicable checks.
- The new routes return 200.
- Activation/reset security tests pass.
- The exact SHA is deployed to staging.
- `/health`, `/ready`, and `/version` pass.
- Staging is noindex/nofollow.
- A synthetic end-to-end activation succeeds.
- Exactly one real allowlisted activation email is accepted by the provider.
- No unauthorized external action occurred.

The final response must state:

- Final branch and exact SHA
- PR #40 status and all check results
- Deployed staging SHA
- Migration names/checksums
- Activation, reset, and MFA routes
- Test totals
- Email canary result with redacted destination
- Whether the operator email is waiting to be used
- Exact login URL
- Remaining blocker, if any
- Rollback deployment IDs
- Confirmation that production, DNS, Stripe, BNA, Rabbi/customer sends, and other providers were untouched