ONE-TIME-FINISH-NOW-CODEX-PROMPT.md


# CODEX MASTER TASK — Finish, Prove, and Release the One Time Product

## Outcome

Bring the existing One Time application from its current live-but-partially-activated state to a truthfully documented, operator-usable release. The operator must be able to receive a normal set-password/access email, log in as an administrator, and personally test separate parent and student experiences. The main CRM, contact cards, tagging, communications history, classes, content workspace, portals, and each configured provider lane must either work and be acceptance-proven or be explicitly disabled with one exact external prerequisite—not represented by vague placeholder UI.

Do not rewrite the application or build a new framework. Discover and finish the existing implementation.

## Target

- Canonical repository: `webcraft-media/onetimev2`
- Production origin: `https://join.onetimeonetime.com`
- Known staging origin: `https://ot99-web-staging.up.railway.app`
- Current exact branches, PRs, deployed source, Railway identities, migration head, and provider modes: **discover and verify at runtime**. Do not rely on stale SHAs copied into this prompt.

## Read these sources first

Search the expected One Time and BNA worktrees and Git history for:

- `ONE-TIME-PRODUCTION-READINESS-GAME-PLAN.md`
- `BNA-RAMBLE-PROTOCOL-RETROSPECTIVE.md`
- `RAW-20260719-001-onetime-production-readiness-and-ramble-protocol-audit.md`
- W13-100 through W13-103 final reports and handoffs
- PR #91 and every later One Time release/readiness PR
- generated/current release or director-state records
- production `/version`, `/health`, and `/ready`

The current high-level audit verdict is binding unless fresher evidence disproves it:

> Core runtime is live and healthy, but full production readiness still requires refreshed current truth, rerun launch-spine acceptance, current diagnostics/rollback evidence, and independent provider activation using protected private manifests.

If a named local audit file is unavailable, continue using repository and live evidence. Record the missing source; do not stop all work.

## Authorization ceiling for this task

Authorized:

- read-only inspection of One Time GitHub/Railway/provider configuration;
- isolated worktrees, code changes, tests, commits, pushes, and draft PRs;
- staging deployments and rollback rehearsal;
- production promotion only after the exact candidate passes the release gate and retains a proven rollback;
- production identity/access repair for the operator-owned administrator, parent-test, and student-test identities already represented in protected private manifests;
- one bounded transactional access/reset email to an allowlisted operator-owned address from a protected private manifest;
- sandbox/test provider objects and bounded canaries only to allowlisted operator-owned test identities;
- one real Zoom test meeting with no invitation or contact to unapproved people;
- one bounded Vimeo/content-ingestion test using an approved operator-owned test asset;
- Stripe **test mode only** objects/webhooks/checkout/subscription canary; never live charges;
- a dry-run real CRM import and an idempotent apply only when a protected approval manifest explicitly enables apply and identifies the approved sources/tag map;
- signed One Time-to-BNA support canary only when both endpoints and an allowlisted synthetic/operator-owned test identity are configured.

Not authorized:

- mass or broad email/WhatsApp/Telegram sends;
- contacting customers, students, parents, Rabbi Scheller, or third parties unless they are explicitly allowlisted test identities in the private manifest;
- live Stripe charges;
- broad production CRM import without the approved dry-run manifest;
- Buffer/social publication to a live audience without an approved Buffer account/channel and bounded post approval;
- DNS/domain changes;
- destructive migrations, history rewrites, or weakening role/privacy boundaries;
- staging or committing secrets, passwords, tokens, private manifests, contact rows, message bodies, or recovery material;
- modifying the dirty BNA checkout directly.

## Non-negotiable run durability

Before broad edits, create:

```text
ops/codex-runs/ONE-TIME-FINISH-NOW/
  ORIGINAL-PROMPT.md
  STATE.json
  DECISIONS.md
  CAPABILITY-MATRIX.json
  RESUME.md
  FINAL-REPORT.md
```

Update `STATE.json` at every phase boundary. If interrupted or blocked, preserve every safe completed change in an isolated branch, commit/push a checkpoint when authorized, and make `RESUME.md` self-contained. Never require this Codex chat window to continue.

## Phase 0 — Establish current truth

1. Verify GitHub identity and fetch all relevant remote refs without mutating user worktrees.
2. Locate the canonical One Time repo by its remote, not by the currently open directory.
3. Preserve every dirty worktree. Create an isolated worktree from the newest semantically accepted release line that contains the deployed runtime plus later accepted fixes. Do not mechanically merge all open branches.
4. Read open PR ancestry, check runs, reports, migrations, and known supersession relationships.
5. Read production and staging `/version`, `/health`, and `/ready`.
6. Verify Railway project/environment/service/database/volume/deployment identities from authenticated state. Never guess them.
7. Produce `CAPABILITY-MATRIX.json` using:

```text
ABSENT | SPECIFIED | IMPLEMENTED | INTEGRATED | DEPLOYED |
CONFIGURED | ACCEPTED | BLOCKED | EXCLUDED
```

Track separately: public landing/signup, auth/recovery, administrator, CRM, real data, communications, owner dashboard, parent portal, student portal, classes/Zoom, content/Vimeo, knowledge helpers, gamification, email, WhatsApp, Telegram, Stripe, Buffer, BNA support, diagnostics, backup/restore, and rollback.
8. Generate one current-state record from real evidence. Do not maintain competing current-truth documents manually.

## Phase 1 — Repair normal production access

The operator must not need a terminal command, copied password, or authenticator app for ordinary access unless the accepted role policy explicitly requires MFA for that privileged role.

1. Verify the intended MFA policy. Ordinary parent/student users must not be forced into privileged MFA. If administrator MFA is required, provide a clear setup/recovery experience; do not silently remove a deliberate security boundary.
2. Verify `/login`, `/forgot-password`, `/activate`, and `/reset-password` in production.
3. Use protected private identity manifests. Never print their contents.
4. Ensure the operator-owned administrator identity exists with the correct product/account scope and verified email.
5. Ensure separate parent-test and student-test identities exist and resolve to one approved household/learner relationship with sibling isolation.
6. Generate a new, single-use, expiring activation/reset journey for the administrator. If transactional email is configured, send exactly one bounded set-password email to the allowlisted operator-owned address. If email remains unavailable, preserve the unconsumed link only in a protected local handoff file and report the exact missing email configuration.
7. Prove activation/reset invalidation, session revocation, CSRF, return-route safety, and normal login in clean browser sessions.
8. Produce a private operator handoff with only URLs and identity labels in the public report; secrets/links remain protected locally.

## Phase 2 — Prove the launch spine end to end

Run separate clean sessions at phone and desktop viewports.

### Public-to-CRM journey

1. Open the production landing page.
2. Submit one allowlisted operator-owned signup.
3. Verify canonical contact/lead persistence, tags, provenance, audit event, outbox intent, idempotent replay, and public confirmation.
4. Log in as administrator.
5. Find the new lead using private POST-body search or the accepted secure search contract.
6. Open the contact card/detail view.
7. Verify tags, status, source, contact fields, notes/tasks, communications timeline, loading/empty/error states, and safe edit/archive/version-conflict behavior.

### Administrator journey

Verify dashboard, CRM, contact detail, communications, classes, content, billing state, support, configuration/readiness, mobile shell, and permission handling. Replace unexplained developer placeholder labels with clear operator language only where the backend capability actually exists.

### Parent journey

Verify activation/login, household, learner list, class schedule/access, protected content, billing state, support eligibility, student access setup/reset/suspend/restore, sibling isolation, and shared-device privacy.

### Student journey

Verify direct resolution to exactly one learner, class schedule/access, protected playback/content, progress/gamification, questions/helper boundary, parent-managed credential reset, and inability to infer siblings/CRM/admin data.

For every journey capture browser, accessibility, negative-authorization, loading, empty, error, and session-expiry evidence. Human-readable acceptance steps must be short enough for the operator to repeat.

## Phase 3 — Real CRM reconciliation

Do not load fictional CRM data as the final experience.

1. Locate approved spreadsheets/exports and legacy contact/message sources referenced in existing contracts/audits. Do not print row contents.
2. Inventory source names, hashes, row counts, columns, and authority.
3. Define canonical identity, email/phone normalization, precedence, provenance, lead/customer/old-system/active-user tags, suppression, consent, and manual-review rules.
4. Reconcile old users who must also be marked as leads.
5. Deduplicate contacts and lead records without destroying source provenance.
6. Produce a dry-run report containing counts, conflicts, duplicates, invalid rows, and proposed tag/status results—no unnecessary PII.
7. Apply only if a protected approval manifest names the accepted dry-run hash and sets apply authorization true.
8. Make apply idempotent, transactional/batched, audited, resumable, and rollback-aware.
9. Reconcile post-import counts and bounded operator-approved samples.
10. Prove the resulting CRM cards, filters, saved views, tags, and timelines in the actual UI.

Missing apply authorization blocks only the apply step; complete inventory, mapping, preview, code, and tests.

## Phase 4 — Activate and prove provider lanes independently

Each provider must have its own private manifest, owner, account/environment identity, mode, allowlisted test target, budget/rate limit, idempotency, kill switch, rollback, and evidence. A blocker in one lane must not stop another.

### Transactional email

- Configure/verify Resend or the accepted provider in the correct environment.
- Verify domain/sender status, webhook signature, bounce/complaint/suppression intake, idempotency, retries, and audit.
- Send only the bounded access email and test receipts authorized above.

### WhatsApp

- Verify webhook/signature/deduplication and product-scoped identity.
- Test natural lead-capture behavior only with an allowlisted operator-owned number from the private manifest.
- No broad sends.

### Telegram

- Prove the Rabbi/administrator bot identity mappings and deny-by-default capabilities.
- Prove contact/status/class/content/task lookup, confirmation for mutations, audit, deduplication, single-consumer token ownership, and product isolation.
- If a separate operator One Time bot token is absent, finish provider-off code/UI/config validation and produce the exact protected setup checklist; do not invent a token.

### Zoom

- Create one real test meeting using the approved provider account and no unapproved invitees.
- Verify protected family/learner access, seat/link limits, expiry/revocation, no raw provider URL leakage, portal launch behavior, and reminder scheduling in sink/test mode.
- Prove classroom question routing without exposing student data to unauthorized users.

### Vimeo/content/knowledge

- Use one approved operator-owned test video/source.
- Prove ingestion, upload/reference, transcript, provenance/confidence, review/correction, approval, published content, portal visibility, and scoped knowledge retrieval.
- Prove that generated worksheets/newsletters/social drafts cite/derive from approved content and that unapproved drafts cannot publish.

### Stripe

- Test mode only.
- Fix/verify the exact HTTPS webhook route; never use a redirecting origin root as the endpoint.
- Verify signature, replay/idempotency, checkout/session/subscription lifecycle, entitlement change, invoice failure/cancellation/refund behavior, and customer portal in sandbox.
- No live charges.

### Buffer/social

- If no authorized Buffer account/channel exists, keep publishing disabled.
- Complete provider interface, secure configuration/readiness UI, draft/review/approval flow, idempotency, preview, and test coverage.
- If an approved sandbox/test target exists, perform one bounded test; otherwise report the single account-connection prerequisite.

### BNA support bridge

- Use the strict current versioned contract; do not weaken an existing strict v1 schema to accept a different payload.
- From an isolated BNA worktree, prove one signed/deduplicated support event and reverse status with a synthetic/operator-owned identity if both sides are authorized.
- Only entitled subscribers may create technical support tickets. Anonymous/non-subscribers use lead support only.
- Do not touch or stage the existing dirty BNA checkout.

## Phase 5 — Product and brand consistency

1. Audit public, login/recovery, administrator, CRM, contact detail, communications, classes, content, parent, and student surfaces against canonical tokens/components.
2. Use one shell and component system per role family; no route-local substitute buttons, filters, cards, tables, dialogs, drawers, or feedback states.
3. Verify mobile 360x800 and 390x844, tablet, desktop, keyboard, 200% zoom/reflow, reduced motion, RTL-safe layout where required, and virtual keyboard behavior.
4. Verify landing-page performance and authenticated bundle separation.
5. Fix genuine broken/duplicated assets and layout defects, but do not let optional cosmetic polishing delay a working accepted launch spine.
6. Add or update Storybook/equivalent stories for canonical components and key page states when the repository already supports that lane; do not rewrite the app solely to adopt a new framework.

## Phase 6 — Diagnostics, backup, rollback, and release truth

1. Refresh `/health`, `/ready`, `/version`, migration readback, web/worker logs, queue status, provider readiness, and feature-flag/capability readback.
2. Run fresh native backup/restore proof against the authorized environment.
3. Prove rollback in staging using the exact candidate artifact/image/source strategy used for production.
4. Generate one canonical current release record with source SHA, artifact/image identity, migration head, deployments, provider modes, capability states, acceptance results, backup/restore, rollback target, and timestamp.
5. Generate reports/PR summaries from that record rather than manually duplicating state.

## Phase 7 — Integrate, stage, accept, and release

1. Integrate semantically from the accepted current release line. Do not merge superseded branches mechanically.
2. Resolve migration prefix and shared-file collisions explicitly.
3. Run repository-required full verification plus focused provider/import/role tests.
4. Deploy exact candidate to staging.
5. Run every applicable Phase 2 journey and authorized provider canary on staging.
6. Roll back and roll forward successfully.
7. If all core release gates pass, promote the exact candidate to production under the authorization ceiling above.
8. Run production `/version`, `/health`, `/ready`, public, auth, role, CRM, portal, and bounded provider smokes.
9. Keep optional unavailable providers disabled and report them precisely; do not mislabel the core release as failed if accepted core journeys work.
10. Push the final checkpoint, open/update the canonical draft PR, and leave the task worktree clean.

## Definition of done

Do not end with only `READY`, `PARTIALLY_READY`, or a list of code changes. Finish all authorized actions and report a capability matrix.

Core completion requires:

- production source/runtime truth agrees with GitHub and the generated release record;
- administrator receives or has a protected normal set-password/access path and passes browser login;
- separate parent and student experiences pass in clean sessions;
- public signup appears correctly in a usable CRM contact card with tags/provenance/timeline;
- launch-spine journeys pass desktop/mobile/accessibility/negative-role checks;
- fresh backup/restore and rollback evidence exists;
- every provider is explicitly `OFF`, `SINK`, `SANDBOX/TEST`, `BOUNDED_CANARY`, or enabled, with evidence and no vague “setup” placeholder;
- authorized canaries are actually executed;
- unavailable private configuration is reduced to one exact prerequisite per lane;
- no secrets or personal row contents are printed or committed;
- run state and resume are durable outside this window;
- final worktree is clean and exact branch/head/PR/deployment identities are recorded.

## Final response format

Lead with:

```text
CORE_RELEASE: RELEASED | BLOCKED_BY_CORE_SAFETY_GATE
ADMIN_ACCESS: ACCEPTED | BLOCKED(<exact reason>)
PARENT_ACCESS: ACCEPTED | BLOCKED(<exact reason>)
STUDENT_ACCESS: ACCEPTED | BLOCKED(<exact reason>)
CRM_REAL_DATA: ACCEPTED | PREVIEW_READY | BLOCKED(<exact reason>)
```

Then provide the capability/provider matrix, exact production and staging source/deployment identities, URLs safe to share, private handoff path without its contents, tests/acceptance, import counts without PII, external mutations, disabled/degraded lanes, backup/rollback, branch/head/PR, and exact next operator action.