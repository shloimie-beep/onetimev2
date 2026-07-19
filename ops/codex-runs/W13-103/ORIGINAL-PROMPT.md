# W13-103 — Complete production administrator, parent, and student access now

Run this entire prompt in one fresh Codex session with Full Access and network enabled. This is a narrow operational continuation of W13-102. Do not reopen architecture, CRM import, provider fleet work, landing-page redesign, or broad release convergence.

## Exact starting state

- Repository: `webcraft-media/onetimev2`
- PR: `https://github.com/webcraft-media/onetimev2/pull/91`
- Branch: `release/w13-100-controlled-day-one-20260717T182046Z`
- Existing worktree: `C:\Users\User\OneTimeOneTime-w13-100-final-launch`
- Verified PR checkpoint/evidence head: `333ebd23376ea29edcbd6b5ba19c4dfa2125a03a`
- Exact deployed runtime source: `007e0215d1186ca51163dea3b1c15303bf52a860`
- Production version label: `w13-102-resend-webhook-007e021`
- Production URL/login: `https://join.onetimeonetime.com/login`
- W13-102 production web deploy: `9334b362-f00d-4170-9713-ecee0d22b85c`
- W13-102 production worker deploy: `f81e56ba-cf4d-4f92-99e5-f5f6be360494`
- Latest migration: `2203_w13_100_student_gamification`
- Existing production identity command: `scripts/w13-102/identity/production-identity-activation.ts`
- Existing private directory: `C:\Users\User\.onetime-w13-102-private\`
- Current blocker: the command is implemented/tested/dry-run safe, but production apply did not run because the private identity manifest was incomplete and transactional email was not configured.

Fetch and verify the current PR head and live runtime first. If the checkpoint advanced, preserve and record the relationship; never guess, reset, or overwrite dirty work. Do not run commands in the dirty BNA checkout.

## Required outcome

Finish this run only after producing the strongest safe version of all three:

1. a usable administrator production login for the existing operator-controlled administrator;
2. a distinct controlled parent production login attached to one clearly marked operator-test household;
3. a distinct student login, created/reset through the normal parent-managed learner-access flow and scoped to exactly one learner.

The operator must receive either a natural activation/reset email or an unconsumed one-time setup link stored only in a protected local handoff file. The final response must provide the public login URLs and private handoff-file location, never passwords or raw links.

Do not end with another audit, dry-run-only report, or generic request to configure email while a safe operator-only private-link handoff is possible.

## Authorization and boundaries

This prompt authorizes:

- counts-only/read-only discovery of production identity, membership, household, learner, session, activation, audit, and queue state;
- one fresh native production backup plus disposable restore proof;
- use of the existing tested W13-102 production identity command;
- creation/recovery of at most one administrator, one controlled parent, one operator-test household/learner, and one student access identity;
- one administrator activation/reset and one parent activation/reset maximum;
- a Railway private-network one-off task scoped to this operation;
- additive fixes, tests, staging validation, and production deployment only if the current command or UI has a real defect;
- exact task-owned commits, push, PR update, and sanitized evidence.

Not authorized:

- contacting the Rabbi owner or any third party in this run;
- broad sends, campaigns, reminders, WhatsApp, Telegram, Zoom, Vimeo, Buffer, BNA, CRM import, Stripe objects, or live charges;
- replacing passwords or copying password hashes;
- one identity pretending to be administrator, parent, and student;
- disabling authorization, adding a permanent production bypass, or weakening privileged step-up safeguards;
- exposing emails, phone numbers, usernames, passwords, tokens, activation/reset links, database URLs, secrets, or private file contents;
- destructive deletes, force pushes, or branch-protection bypasses.

## Durable records

Create `ops/codex-runs/W13-103/` immediately with:

- `ORIGINAL-PROMPT.md`
- `STATE.json`
- `RESUME.md`
- `BASELINE.json`
- `AUTHORIZATION-STATUS.json`
- `PROVISIONING-RESULT.json`
- `ROLE-ACCEPTANCE.json`
- `EXTERNAL-EFFECTS.json`
- `OPERATOR-HANDOFF.md`
- `FINAL-REPORT.md`
- `CHANGED-FILES.txt`

Create private material only under `C:\Users\User\.onetime-w13-103-private\`. Commit/push after each coherent phase. If interrupted, the next window must resume from Git plus this private directory without needing chat history.

## Phase 1 — Live baseline and backup

1. Verify PR #91, exact live `/version`, `/health`, `/ready`, deployment IDs, migration ledger, and release lineage.
2. Verify Railway access to the exact W13-102 production project/environment/services by live identity readback. Never print environment values.
3. Take a fresh native production backup and prove a disposable restore before identity writes.
4. Record counts only for the One Time account's users, roles, memberships, households, learners, student-access identities, sessions, activation/reset tokens, outbox states, and audit events.
5. Audit queues and keep every external transport disabled except a later exact-recipient email canary if it becomes available.

## Phase 2 — Build the private authorization manifest without asking chat for secrets

Create `C:\Users\User\.onetime-w13-103-private\identity-authorization.private.json`.

Populate it from already protected sources in this priority order:

1. the existing W13-102/W13-101 protected runtime and identity handoff files;
2. the existing verified production administrator identity and One Time membership;
3. an existing operator-controlled staging parent identity only when its protected metadata confirms operator control and reuse authorization;
4. protected Railway variables.

Never print or commit the resolved values.

The manifest must include exact production project/environment/account/product identity, expected runtime SHA, run ID, short expiry, mutation budget, and separate entries for:

- existing administrator: recover/reset rather than duplicate;
- controlled parent: distinct identity, marked operator acceptance data;
- student: parent-managed username/identifier and exactly one learner;
- per-recipient `operator_controlled`, `send_now`, expiry, and message budget.

Do not contact any destination merely because it exists. Only an operator-controlled entry with explicit `send_now=true` may receive email.

If no authorized distinct parent destination exists, create the parent as clearly marked operator-test data with external email delivery disabled and use only a protected local activation handoff, provided the existing auth model supports that safely. Do not invent a deliverable third-party address. If the schema strictly requires a unique email identifier, use only an existing protected operator-controlled alias; otherwise mark that single field blocked while completing administrator access.

The operator-test household/learner must be excluded from billing, campaigns, audience analytics, reminders, imports, and automated provider delivery. It must be unmistakably labeled in private/admin state without leaking test labels into public customer UX.

## Phase 3 — Production-safe one-off execution

Keep the existing production refusal as the default. Do not weaken it.

Use the current W13-102 command, or minimally repair it, so production apply requires all of:

- exact verified Railway production lineage;
- expected runtime/source SHA;
- the expiring private manifest;
- explicit one-time production authorization;
- `--apply`;
- exact account/product/role allowlists;
- a hard mutation budget;
- database advisory lock;
- transactional/idempotent domain-service execution;
- audit events with run ID and redacted identity hashes.

Run dry-run first. The preview must show only the allowed identities/household/learner and zero unrelated mutations.

Because local database access is blocked by Railway private DNS, execute apply as a non-public one-off Railway task inside the production private network using the exact tested source. Do not expose a public endpoint. Inject private authorization through protected task configuration without echoing it. Remove/disable the task-scoped authorization and any task-created service immediately after readback.

Behavior:

- existing active administrator → normal reset;
- expired administrator activation → revoke old token and issue one new activation;
- controlled parent absent → create through normal domain services, then issue activation;
- controlled parent active → normal reset;
- learner/student absent → create only the operator-test household/learner foundation, then let the parent flow create/reset student access;
- retry → no duplicate person, membership, household, learner, token, or audit side effect.

Tokens must be CSPRNG, hashed at rest, single-use, short-lived, replay-safe, and invalidate older outstanding tokens. Never print them or allow Railway logs to contain them.

## Phase 4 — Deliver the setup handoff

First inspect protected transactional-email readiness. The W13-102 Resend webhook route exists but is intentionally disabled until required configuration is present.

If protected Resend configuration is complete:

1. prove sink delivery;
2. enable only activation/reset events and exact administrator/parent allowlists;
3. send at most one administrator and one parent activation/reset;
4. verify HTTPS link host, webhook signature, idempotency, expiry, single use, and no redirect response;
5. disable the one-time recipient gate after delivery.

If Resend is not ready, do not block operator testing:

1. write the administrator and parent one-time setup URLs only to `C:\Users\User\.onetime-w13-103-private\LOGIN-HANDOFF.private.json` with restricted local permissions;
2. never print, log, commit, screenshot, or include the URLs in PR/evidence;
3. keep email provider disabled and truthfully report `private_handoff`, not `email_delivered`.

The Rabbi receives no activation/reset in W13-103.

## Phase 5 — Separate administrator, parent, and student acceptance

Use three genuinely isolated browser contexts. Never use impersonation as a substitute.

Administrator:

- consume a task-specific acceptance token or use a temporary acceptance credential stored only in the private handoff;
- set/login through the normal auth UI;
- prove logout, session revocation, password reset, dashboard and CRM authorization;
- prove routine login does not demand authenticator MFA while dangerous privileged actions retain approved step-up protection;
- at the end, revoke acceptance-only sessions and issue a fresh unconsumed operator setup/reset link for the handoff.

Parent:

- activate/login through the normal UI;
- see only the operator-test household;
- create or reset the student credential through the real parent learner-access UI;
- prove suspend, restore, and reset without retrieving the previous student secret;
- prove billing/campaign/provider exclusion for acceptance data;
- at the end, leave a usable parent login or fresh unconsumed setup link in the private handoff.

Student:

- log in separately using the parent-managed credential;
- resolve directly to exactly one learner;
- verify dashboard, classroom/content, progress, gamification/rewards, and logout;
- deny owner/admin/parent routes, sibling discovery, cross-household access, and raw provider/private data.

Run acceptance at 360×800, 390×844, tablet, and desktop. Check keyboard/focus, mobile navigation, loading/error states, and no PII in browser logs or URLs.

If an actual auth/portal defect prevents these journeys, implement the smallest correct fix, test it locally and on staging, prove rollback/roll-forward, back up production, deploy the exact staging-tested source, and rerun production acceptance. Do not redesign unrelated UI.

## Phase 6 — Cleanup, governance, and handoff

1. Revoke unused/expired activation tokens and acceptance-only sessions.
2. Remove the ephemeral production authorization and task-scoped service/config.
3. Confirm no campaigns, billing, CRM import, provider sends, or unrelated queue rows were created.
4. Confirm health/readiness/version and worker state remain green.
5. Push task-owned source/evidence changes to PR #91 and obtain applicable checks.
6. Update PR #91 with a sanitized checkpoint. Track deployed runtime SHA separately from evidence-only head.
7. Preserve the private handoff file with:
   - production login URL;
   - administrator setup status;
   - parent setup status;
   - student username/access status;
   - setup-link expiry and recovery instructions;
   - no committed secrets.

## Terminal statuses

- `PRODUCTION_ROLE_ACCESS_READY`: administrator, parent, and student production access are usable and role-isolation acceptance passed.
- `ADMIN_READY_PARENT_STUDENT_INPUT_PENDING`: administrator access works; one exact protected parent identity input remains genuinely unavailable.
- `ROLE_ACCESS_BLOCKED_CRITICAL_AUTH_FAILURE`: use only for a verified auth/data-integrity/role-isolation failure that prevents safe access.

Do not classify missing Resend credentials as a global blocker because the private operator-only handoff is authorized.

## Required final response

Start with exactly one terminal status. Then provide only sanitized information:

- production login URL;
- administrator, parent, and student status separately;
- whether setup was `email_delivered` or `private_handoff`;
- private handoff-file path;
- runtime SHA, evidence head, deploy IDs, backup/restore result, and migration state;
- tests and role-isolation journeys actually passed;
- exact counts of production identity/household/learner/session/token/email mutations;
- remaining single-field operator input, if any;
- `FINAL-REPORT.md` and `RESUME.md` paths.

Never include passwords, setup links, emails, usernames, tokens, secrets, or PII in the final response. Do not end by saying the next step is to create logins when the safe operator handoff can be completed now.

