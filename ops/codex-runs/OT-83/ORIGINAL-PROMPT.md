# OT-83 — Codex Household, Parent/Student Identity, and Portal Foundation

## Run order

**Run this prompt directly in a fresh Codex window only after OT-82 has finished and published its remote branch.**

- Task ID: `OT-83`
- Repository: `webcraft-media/onetimev2`
- Required upstream branch: `codex/ot82-brand-system-foundation`
- Implementation branch: `codex/ot83-household-portals-foundation`
- Dedicated worktree: `C:\Users\User\OneTimeOneTime-ot83-household-portals-foundation`
- Run archive: `ops/codex-runs/OT-83/`
- Evidence: `ops/evidence/ot-83/`
- Draft PR title: `[OT-83] Household, parent/student identity, and portal foundation`

There are no handwritten SHA placeholders in this prompt. Resolve exact remote SHAs at runtime and record them in evidence. Do not ask the operator to locate or paste a SHA that Git/GitHub can resolve safely.

## Your role

Act as the principal product, security, database, frontend, and test engineer for OT-83. Implement the smallest complete household, parent-identity, student-identity, Parent Portal, and Student Portal foundation in the standalone One Time product.

This is an implementation task, not a contract-only audit. Inspect first, then build, test, checkpoint, push, and open or update a stacked draft PR. Do not merge or deploy.

Work autonomously within this scope. Do not stop merely because the current Codex window opened in the wrong repository, because another worktree is dirty, because BNA has an unrelated active run, because a provider is unavailable, or because local Chromium/PostgreSQL proof needs CI. Use the recovery rules below.

## Locked product intent

Implement these rules exactly unless the existing accepted One Time code is stricter:

1. One entitled family supports at most three active learner seats. The current commercial rule is `$67/month` for up to three learners, but OT-83 treats that as an entitlement seam. Do not add price copy to the landing-page hero and do not implement Stripe here.
2. A parent/guardian account, household, learner profile, and student login identity are separate concepts and, where persisted, separate records or clearly separated canonical entities.
3. Each learner has a separate profile and may have one separate student login identity. A learner profile may exist before student access is activated.
4. A student session resolves server-side to exactly one learner. A student cannot select, enumerate, infer, search for, or access siblings.
5. A parent may manage only learners connected to that parent's own household.
6. A parent may create learner access, rotate/reset a learner secret, suspend/reactivate access, and revoke learner sessions.
7. A parent cannot retrieve the learner's current secret after creation, cannot open the student's session, and cannot impersonate the student.
8. A reset or security change invalidates old activation material and existing student sessions through the canonical session-security/version mechanism.
9. Parent recovery uses the parent's verified email. There is no public student self-registration and no child-email recovery requirement in V1.
10. The maximum of three active learners is enforced atomically in PostgreSQL and again in service logic. Two concurrent fourth-seat attempts must not both succeed.
11. Define the seat effect of archive, suspension, restoration, and reactivation explicitly. Restoring or reactivating a learner must recheck capacity and write an audit event. Do not silently erase historical learner/class/progress records.
12. Rabbi Scheller is a real One Time owner. Shloimie is a real One Time administrator on that account. Both act through their own sessions. There is no `View as Rabbi`, browser role switch, hidden impersonation, or BNA super-admin projection.
13. Schools remain lead-only in V1. A school lead does not receive a household, learner, portal, class, content, reminder, billing, or subscriber-support entitlement.
14. Only an active or valid promotional entitled subscriber receives subscriber-only class/content access and the authenticated technical-support seam. Anonymous and non-subscriber users remain in lead-capture/help flows.
15. Guardian consent is versioned where learner data or participation requires it. Use data minimization throughout.
16. Private student questions are not automatically visible to a parent. Do not turn questions into unrestricted chat.

## Strict repository boundaries

- Build only in `webcraft-media/onetimev2`.
- Do not edit BNA product code, BNA run-control files, or the Academy application.
- Do not run BNA's `bna:run:*`, `chatgpt:dropoff:*`, or control-tower workflow for this task.
- Do not use a BNA login, cookie, session, workspace assertion, route shell, Operations bundle, or super-admin role inside the standalone product.
- Do not reset, clean, discard, overwrite, or force-push any existing worktree or user changes.
- Do not mass-format unrelated files.
- Do not create parallel authentication, session, user, portal, API, audit, or design-system stacks when accepted canonical code already exists.

## Phase 0 — Preserve this task before any gate can stop it

Before repository preflight, preserve the exact prompt and a resumable state outside all existing repositories:

```text
C:\Users\User\OneTimeOneTime-run-packets\OT-83\ORIGINAL-PROMPT.md
C:\Users\User\OneTimeOneTime-run-packets\OT-83\STATE.json
C:\Users\User\OneTimeOneTime-run-packets\OT-83\CHECKPOINT.md
C:\Users\User\OneTimeOneTime-run-packets\OT-83\RESUME-PROMPT.md
```

`STATE.json` must always contain:

- `task_id` = `OT-83`;
- current status and phase;
- target repository;
- required upstream branch;
- resolved upstream SHA when available;
- OT-83 branch and current head when available;
- completed phases;
- remaining phases;
- files changed;
- migrations/checksums;
- commands run and concise results;
- blockers;
- external mutations;
- exact next action.

Use this phase state machine:

```text
INTAKE
BASE_RESOLVED
INVENTORY_COMPLETE
DATA_COMPLETE
AUTH_COMPLETE
API_COMPLETE
UI_COMPLETE
VERIFIED
PUBLISHED
```

When incomplete, use a precise resumable status such as:

```text
WAITING_FOR_OT82
BLOCKED_POSTGRES_PROOF
BLOCKED_BASELINE_CI
BLOCKED_EXTERNAL_AUTHORIZATION
```

Update the portable checkpoint after every meaningful phase and before any long-running or external step. After the OT-83 worktree exists, copy and commit the same records under:

```text
ops/codex-runs/OT-83/ORIGINAL-PROMPT.md
ops/codex-runs/OT-83/STATE.json
ops/codex-runs/OT-83/CHECKPOINT.md
ops/codex-runs/OT-83/DECISIONS.md
ops/codex-runs/OT-83/RESUME-PROMPT.md
```

`RESUME-PROMPT.md` must be self-contained so a completely new Codex window can continue without chat history.

If a preflight condition blocks code, preserve these local records first. Never make the operator recover the original prompt from this chat window.

## Phase 1 — Resolve the correct base without placeholders

1. Locate an existing clean clone of `webcraft-media/onetimev2`, or clone it to a new safe directory if needed. A current checkout of BNA is not a blocker and must not be reused as the target repository.
2. Fetch and prune `origin` without modifying an existing dirty worktree.
3. Resolve the exact remote ref `origin/codex/ot82-brand-system-foundation`.
4. If that exact branch is absent, query GitHub for an open draft PR in `webcraft-media/onetimev2` whose title begins exactly `[OT-82]`. Use it only if there is exactly one unambiguous candidate and its head belongs to this repository.
5. Verify OT-82 descends from the fetched remote head of `codex/ot81-dayone-certification-staging`, or verify an equivalent accepted OT-81 ancestry record in OT-82's repo-backed evidence. Record the exact OT-81 and OT-82 SHAs.
6. Never substitute `main`, the current checkout, OT-80, OT-81, BNA, or a guessed commit for OT-82.
7. If OT-82 is not published or is ambiguous, set `WAITING_FOR_OT82`, preserve the exact waiting checkpoint and resume prompt, make no product-code branch, and stop. State exactly: `OT-83 is saved; run it again after OT-82 publishes codex/ot82-brand-system-foundation.`

This missing-base behavior is the only acceptable early dependency stop. Do not invent an implementation on the wrong base.

## Phase 2 — Create or resume the isolated OT-83 lane

1. Check for an existing remote/local `codex/ot83-household-portals-foundation` branch and an existing `[OT-83]` PR.
2. If a legitimate OT-83 lane exists, inspect its committed run state and resume it. Do not open a duplicate branch or PR.
3. Otherwise create the dedicated worktree from the exact fetched OT-82 SHA:

```text
C:\Users\User\OneTimeOneTime-ot83-household-portals-foundation
```

4. Create branch:

```text
codex/ot83-household-portals-foundation
```

5. Confirm the worktree is clean, `origin` is `webcraft-media/onetimev2`, and OT-82 is an ancestor before editing.
6. Commit and push meaningful checkpoints so another Codex window can resume. Use numbered task-identifiable messages, for example:

```text
[OT-83] archive execution state and inventory
[OT-83] add household and learner persistence
[OT-83] add parent and student authorization
[OT-83] build parent and student portals
[OT-83] add verification and evidence
```

Do not amend shared commits, rebase an active stacked branch, force-push, merge, or deploy.

## Phase 3 — Audit accepted code before designing anything

Inspect the fetched OT-82 tree and document the result in:

```text
ops/evidence/ot-83/PREIMPLEMENTATION-INVENTORY.md
```

Inventory at minimum:

- all migrations and the next collision-free additive migration identifier;
- existing accounts, memberships, roles, sessions, Argon2id, MFA, CSRF, activation/reset, rate limits, security-version invalidation, and audit code;
- existing CRM contact/lead identities and whether/how a signup contact becomes a parent account;
- existing household, guardian, learner, enrollment, class-access, entitlement, progress, reward, question, and portal code from older OT-20/OT-52 work;
- route/API naming conventions and typed contracts;
- OT-82's canonical tokens, typography, fonts, buttons, cards, forms, status components, navigation, header, footer, authenticated shell variants, breakpoints, RTL, reduced-motion, and accessibility behavior;
- current test helpers, PostgreSQL assurance harness, browser harness, accessibility checks, performance budgets, and bundle checks;
- the exact provider seams already defined for Stripe, Zoom, Vimeo/content, Telegram/helper, and BNA support.

For every planned entity/component/route, decide and record one of:

- reuse unchanged;
- extend canonically;
- migrate/replace with compatibility handling;
- create because no canonical implementation exists.

Do not duplicate a table, model, route namespace, auth flow, component, or token merely because older naming differs. Prefer adapting the accepted canonical implementation.

## Phase 4 — Implement the canonical household and learner model

Use existing canonical names where present. Add only the minimum additive PostgreSQL migrations and services required to establish these logical concepts:

- product/account-scoped household;
- guardian/parent membership in the household;
- learner profile;
- learner portal identity/access state;
- versioned guardian consent;
- enrollment/class-access relationship or stable seam;
- entitlement projection or stable seam;
- progress/reward projection or stable seam;
- private-question record or stable seam;
- session/security version and audit events.

Required persistence properties:

- every relevant row and query is scoped by the standalone One Time account/product and, where applicable, household;
- use opaque public identifiers rather than sequential database IDs in browser-facing DTOs;
- use composite foreign keys/constraints where they prevent cross-account or cross-household linkage;
- exact uniqueness constraints prevent multiple active student identities for one learner unless a documented accepted model already handles it more strictly;
- useful indexes support household learner lists, session lookup, entitlement checks, and student self-scope;
- optimistic concurrency protects editable learner/household records;
- idempotency protects learner creation and credential operations;
- migrations are additive, checksum-recorded, and safe to run exactly once;
- rollback/forward-fix policy is documented without destructive production action.

### Atomic learner-seat invariant

Enforce the three-active-learner limit in the database transaction and the domain service. Use a correct PostgreSQL locking/constraint strategy appropriate to the current schema. Do not rely only on a pre-insert `COUNT(*)`, frontend disabling, or an in-memory lock.

Provide a real PostgreSQL concurrency proof that starts with two seat-consuming learners and launches two simultaneous attempts to create or reactivate another seat. Exactly one may commit successfully; the other must receive the canonical non-destructive capacity conflict. Also prove archive/restore/reactivation semantics and audit records.

If a safe local PostgreSQL target is unavailable, implement the real test in the repository's PostgreSQL CI harness and let CI execute it. Do not replace it with `pg-mem` and claim equivalent proof.

## Phase 5 — Parent and student identity/security foundation

Reuse the accepted One Time authentication implementation. Do not build a second login/session system.

Required behavior:

- parent activation and recovery use a verified parent email and non-enumerating responses;
- student access is created only by an authorized parent/admin flow after policy/consent checks;
- there is no public student registration;
- student secret material is hashed through the canonical Argon2id/password service;
- activation/reset artifacts are random, hashed at rest, single-use, expiring, revocable, and replay-safe;
- creating/resetting/suspending student access rotates the relevant security/session version and revokes old sessions;
- parents may set or reset but never retrieve the current student secret;
- parents cannot exchange their session for a student session;
- product-scoped secure HTTP-only cookies, session rotation, CSRF, private `no-store` responses, and rate limits apply through existing infrastructure;
- owner/admin MFA remains governed by the accepted privileged-auth implementation;
- no PII, credentials, activation material, provider URLs, or child data are stored in browser persistent storage, logs, analytics, screenshots, or evidence;
- shared-device logout, 401, and 403 clear protected in-memory UI state;
- every sensitive action creates a scoped audit event with actor, subject, account/product, result, and safe metadata.

Authorization is server-side. Hiding a button is not authorization.

## Phase 6 — Implement screen-oriented APIs and ports

Follow the repository's accepted API/version conventions. Do not force a duplicate namespace if canonical routes already exist.

Implement or complete typed, privacy-minimized APIs for:

### Parent

- current parent session/household overview;
- household learners list and seat state;
- create/update/archive learner profile;
- create/activate/reset/suspend/reactivate learner login;
- revoke learner sessions;
- learner schedule and access status;
- learner content/progress/attendance/reward summary;
- household billing-status/manage-billing capability seam;
- subscriber-only technical-support capability seam.

### Student

- current student session and own dashboard;
- own next-class/access state;
- own entitled class library and review-sheet projection;
- own progress, attendance, watch completion, and rewards;
- own permitted private-question history/submission seam;
- own scoped helper capability seam.

### Provider-safe ports/events

Define stable typed ports/events for later lanes without activating providers:

- billing entitlement/status and manage-billing destination;
- protected live-class join/player action;
- content/library/playback access;
- subscriber support submission;
- parent helper query;
- student helper query;
- private student question submission.

Provider-off or unavailable states must be truthful and usable. Never return raw Zoom, Vimeo, Stripe, Telegram, storage, or internal BNA destinations in ordinary HTML, JSON, logs, analytics, or support payloads.

For each API, test anonymous, wrong-role, wrong-household, sibling, suspended/archived learner, stale session, expired/replayed activation, malformed input, optimistic conflict, and idempotent replay behavior. Avoid object-existence and relationship oracles.

## Phase 7 — Build the Parent Portal with OT-82

Consume OT-82's authenticated shell, tokens, typography, components, and navigation. Do not recreate the brand kit in OT-83.

Canonical parent routes live under `/app/parent`. Use existing accepted route names where they already exist; otherwise implement this minimum coherent route set:

```text
/app/parent
/app/parent/household
/app/parent/learners
/app/parent/learners/new
/app/parent/learners/:learnerId
/app/parent/learners/:learnerId/access
/app/parent/learners/:learnerId/classes
/app/parent/learners/:learnerId/library
/app/parent/learners/:learnerId/review-sheets
/app/parent/learners/:learnerId/progress
/app/parent/updates
/app/parent/help
```

The V1 Parent Portal must provide:

- household overview and truthful entitlement/access state;
- zero-to-three learner cards and clear seat availability;
- create/update/archive learner profile;
- create/reset/suspend/reactivate learner login and revoke sessions;
- per-learner next class/schedule/access status;
- per-learner content, review-sheet, progress, attendance, watch, and reward summary using authoritative projections;
- billing-status/manage-billing seam only;
- subscriber-only support seam only;
- clear loading, empty, retryable error, partial data, offline, session-expired, wrong-role, and no-entitlement states.

A parent may select only server-authorized learners in that household. Switching learners must cancel or invalidate stale learner-specific requests before rendering the new learner. Do not flash sibling data during navigation. There is no parent-to-student session switch.

Do not render active buttons that lead nowhere. Capability-gate a later provider function and show a truthful safe state instead of a fake success or broken placeholder.

## Phase 8 — Build the Student Portal with OT-82

Canonical student routes live under `/app/student`:

```text
/app/student
/app/student/class
/app/student/library
/app/student/review-sheets
/app/student/progress
/app/student/questions
/app/student/questions/new
/app/student/updates
/app/student/help
```

The Student Portal must provide:

- exactly one server-derived learner context;
- own next-class card and protected join/player seam;
- own entitled class library, recordings/content seam, and review sheets;
- own attendance, watch progress, and factual rewards/accomplishments from authoritative product data;
- own private-question history/submission where policy permits;
- own scoped helper seam;
- age-appropriate technical-help direction;
- the same complete state handling required for the Parent Portal.

No student route may include or accept a selectable `learnerId`, `householdId`, sibling selector, role switcher, or BNA/admin context. Do not expose other roster members or sibling-derived counts/badges.

### Student helper seam

Define and test the helper boundary, but do not activate an AI provider in OT-83. The future helper must:

- search only the learner's authorized Rabbi-produced class knowledge base;
- have no open-web search;
- have no sibling/household-private access beyond the student's own permitted facts;
- have no general persistent personal conversational memory;
- cite the source class/content segment when available;
- abstain clearly when the approved corpus does not support an answer;
- derive progress/accomplishments from authoritative product records, not chat claims.

The parent helper seam is limited to parent-visible household, schedule, access, billing-status, and support facts.

## Phase 9 — UX, brand, accessibility, and performance acceptance

OT-82 is the source of truth for visual implementation. Reuse its components directly.

Require:

- canonical authenticated header, typography, fonts, buttons, fields, cards, focus styles, spacing, navigation, and status components;
- no public marketing header/footer inside authenticated portals unless OT-82 explicitly contracts it;
- no duplicated global/main categories and subsections;
- responsive proof at `360x800`, `390x844`, `768x1024`, and `1440x1000`;
- 44-by-44 minimum interactive targets where applicable;
- keyboard-only operation and visible focus;
- WCAG 2.2 AA automated and targeted manual checks;
- 200% reflow, RTL, long-name/long-content, reduced-motion, safe-area, and virtual-keyboard behavior;
- shared-device privacy and no protected content after logout/session loss;
- parent and student route-level code splitting;
- no CRM, public landing, BNA Operations, Telegram, Vimeo, Zoom, or Stripe implementation bundle on initial portal loads;
- route usability marks only after visible, actionable, post-paint UI is ready;
- request-count and bundle budgets consistent with OT-81/OT-82 performance contracts;
- no full Operations-shell fanout or broad background fetch before the current route is usable.

## Phase 10 — Required negative and concurrency proof

Add durable tests for at least:

### Domain/unit

- three-seat rules;
- archive/restore/reactivation capacity behavior;
- learner/profile/login separation;
- current secret is never retrievable;
- reset/revoke/session-version behavior;
- consent versions;
- capability matrix.

### Real PostgreSQL

- migrations and checksums;
- account/product/household constraints and foreign keys;
- two concurrent fourth-seat attempts with exactly one success;
- idempotent learner/credential operations;
- optimistic edit conflicts;
- archive/restore capacity;
- cross-scope linkage rejected.

### Integration/security

- parent cannot access another household;
- parent cannot access an unrelated learner;
- student cannot access or infer a sibling;
- parent cannot retrieve a learner secret;
- parent cannot enter or impersonate a student session;
- wrong roles fail closed;
- school lead and non-subscriber are denied portal/support/class entitlement;
- suspended/archived learner is denied as contracted;
- reset invalidates old sessions and activation material;
- private student questions are not parent-visible by default;
- DTOs and responses contain no raw provider URL, token, secret, internal path, or unneeded PII.

### Browser

- parent activation/login;
- create first through third learner;
- fourth-seat denial;
- reset/suspend/reactivate student access;
- student login and own dashboard;
- direct protected deep links and validated return route;
- wrong-role navigation;
- session expiry/logout and cache clearing;
- each required viewport, RTL, reduced motion, and keyboard journey.

Do not use actual child information. Fixtures use fictional `.example.test` identities and opaque identifiers.

## Phase 11 — Verification and recovery rules

Run the repository's canonical equivalents of:

```text
dependency install
secret scan
targeted Prettier/check formatting for touched files
lint
typecheck
unit tests
integration tests
real PostgreSQL assurance
production build
browser E2E
accessibility
performance/bundle checks
migration checksum/readback
git diff --check
```

Truthfully distinguish:

- local proof;
- CI proof;
- provider-off seam proof;
- unexecuted proof;
- inherited unrelated baseline failures.

Recovery rules:

1. If local PostgreSQL is unavailable, complete the real test in CI, push the checkpoint, and use CI evidence. Do not fake PostgreSQL concurrency with an in-memory emulator.
2. If local Chromium is unavailable, complete browser suites and let CI run them. Do not discard browser tests.
3. If repo-wide formatting fails on inherited files, verify OT-83-owned files, record the exact baseline drift, and do not mass-format unrelated code.
4. If an unrelated accepted test is broken by the evolving stacked base, determine whether OT-83 caused it. Fix only in-scope regressions and record upstream blockers precisely.
5. If a later provider is unavailable, finish the stable port, capability gate, unavailable UI, and tests; do not abandon household/portal work.
6. If interrupted, commit/push the last coherent checkpoint when safe and update `STATE.json`, `CHECKPOINT.md`, and the self-contained `RESUME-PROMPT.md` before stopping.

## Explicit OT-83 exclusions

OT-83 defines safe ports/seams but does not implement, activate, deploy, or mutate:

- Stripe checkout, charges, subscriptions, portal, webhook endpoints, products, or prices;
- Zoom meeting creation, registrants, custom links, embedded player, chat, attendance ingestion, or reminders;
- Telegram or WhatsApp live bots/transports;
- Vimeo upload, ingestion, transcription, parsing, or RAG indexing;
- Buffer or social publishing;
- BNA support-ticket delivery/control-plane mutations;
- live OpenAI/helper-model calls;
- school tenancy or school portal;
- Studio, agent-prompt configuration, broad workflows, or integration settings;
- impersonation or view-as;
- production migrations, Railway deployment, DNS, live sends, or provider mutation.

These lanes come after OT-83 and must consume OT-83's stable identities, authorization, and ports.

## Phase 12 — Evidence, publication, and completion

Create at minimum:

```text
ops/evidence/ot-83/PREIMPLEMENTATION-INVENTORY.md
ops/evidence/ot-83/FINAL-REPORT.md
ops/evidence/ot-83/TEST-MATRIX.md
ops/evidence/ot-83/SECURITY-AUTHORIZATION-MATRIX.md
ops/evidence/ot-83/PERFORMANCE.json
ops/evidence/ot-83/MIGRATION-LEDGER.json
ops/evidence/ot-83/CHANGED-FILES.txt
ops/evidence/ot-83/screenshots/**
```

Record:

- resolved OT-81 and OT-82 refs/SHAs;
- OT-83 base/head SHA;
- migration filenames and SHA-256 checksums;
- exact changed files;
- implemented routes and journeys;
- security/privacy negative results;
- PostgreSQL concurrency result;
- accessibility/performance/bundle/request evidence;
- provider-off seams and explicit exclusions;
- external mutations;
- remaining blockers and exact resume path.

Push the clean OT-83 branch and open or update one stacked draft PR against the actual resolved OT-82 branch. The PR title must be exactly:

```text
[OT-83] Household, parent/student identity, and portal foundation
```

The PR body must include exact base/head SHAs, migrations/checksums, journeys, tests, evidence paths, exclusions, blockers, and external mutations.

Only GitHub branch/checkpoint/draft-PR publication is authorized. Do not merge, deploy, run a production migration, alter Railway/DNS, call live providers, send messages, create payment access, or mutate BNA runtime state.

The final Codex response must begin exactly:

```text
# OT-83 — Household and Portals Result
```

It must report:

- status;
- repository/worktree;
- resolved OT-82 base branch and SHA;
- OT-83 branch/head SHA;
- draft PR URL;
- exact git status;
- completed scope;
- migrations/checksums;
- verification and CI;
- screenshots/evidence;
- known seams/blockers;
- checkpoint/resume paths;
- external mutations.

Only state this completion signal when the branch is pushed, the stacked draft PR exists, the worktree is clean, and required local/CI evidence is green:

```text
OT-83 COMPLETE — OT-84/OT-85/OT-86/OT-87 MAY START
```

Otherwise report the exact resumable state, preserve every completed phase, and provide the self-contained repo-backed resume path. Never reduce a partial implementation to a chat-only explanation.
