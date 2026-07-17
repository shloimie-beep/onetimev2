# DIRECT CODEX EXECUTION PROMPT — OT-71R SELF-HEALING PRODUCT CORE

```text
TASK ID: OT-71R
MODE: IMPLEMENT; DO NOT REPEAT THE FAILED PREFLIGHT
TARGET REPOSITORY: https://github.com/webcraft-media/onetimev2.git
IMMUTABLE AUTHORIZED BASE: dfef7de2035e08f1ee72e0133ccf656fe7a74444
SOURCE PR: https://github.com/webcraft-media/onetimev2/pull/17
TARGET BRANCH: codex/ot71-product-core-train
TARGET WORKTREE: C:\Users\User\OneTimeOneTime-ot71-product-core-train
LIVE/PRODUCTION/EXTERNAL MUTATIONS: FORBIDDEN

## Operator resolution — binding and already decided

The previous OT-71 attempt stopped because three internal OT-60R files did not
equal the final remote head. That gate was incorrectly designed. A Git commit
cannot reliably store its own final SHA: changing the SHA inside the file creates
a new commit with a different SHA.

The operator now authorizes this exact immutable base:

dfef7de2035e08f1ee72e0133ccf656fe7a74444

It is the pushed head of PR #17 and its GitHub Node 24 and PostgreSQL 16 checks
were reported green. Use that exact commit as the source of OT-71. Do not require
`CANONICAL-CANDIDATE.json`, OT-60R `STATE.json`, or `registry.json` to equal the
commit containing those files. Their observed values are inherited metadata
drift:

- CANONICAL-CANDIDATE.json recorded 9e275e28a80cc8bf7fa82ade1092cd8cc21510d4
- OT-60R STATE.json recorded c4acd4b1f75f33e62088a9e3508fdb6890757f96
- registry.json described OT-60R as building

Record those facts in OT-71 evidence, but they are explicitly NON-BLOCKING. Do
not ask the operator to reconcile them first. Do not stop because a staging SHA,
OT-43 SHA, OT-47 SHA, OT-52 SHA, provider credential, pricing policy, or live
service is absent. This task implements the safe product core on an immutable
source and leaves external activation disabled.

## Repository bootstrap — current directory is untrusted

The initial Codex directory may be `C:\Users\User\BNA v2.0`. If so:

- do not run any BNA npm script;
- do not create BNA raw-input, task, memory, ledger, control-tower, or status
  files;
- do not edit, stage, commit, reset, clean, or otherwise mutate BNA;
- leave the BNA worktree exactly as found.

Locate a clone whose `origin` is exactly
`https://github.com/webcraft-media/onetimev2.git` (the `.git` suffix is
equivalent), or clone the target repository into a new safe directory. Fetch
origin and PR #17. Verify the immutable base object exists and is the PR #17
head or an ancestor of the fetched source branch.

Branch from the exact immutable SHA, not from whichever branch happens to be
checked out:

`dfef7de2035e08f1ee72e0133ccf656fe7a74444`

If the target worktree/branch does not exist, create it. If it already exists,
inspect `ops/execution/ot-71/STATE.json` and resume it only when its recorded base
is the exact immutable SHA. Never reset or overwrite unrelated dirty work. If an
abandoned incorrect OT-71 branch exists, preserve it and create a clearly named
recovery branch from the immutable base, then use that branch consistently.

Try normal fetch, PR-ref fetch, existing OneTime worktrees, and the local object
database before declaring the exact commit unavailable. A stale internal control
file is never a reason to stop.

## First commit: durable OT-71 state, without a global control-file collision

After the correct branch/worktree exists, create:

- `ops/execution/ot-71/ORIGINAL-PROMPT.md`
- `ops/execution/ot-71/BASE-RESOLUTION.json`
- `ops/execution/ot-71/STATE.json`
- `ops/execution/ot-71/INPUTS.json`
- `ops/execution/ot-71/CHECKPOINT.md`
- `ops/execution/ot-71/IMPLEMENTED.md`
- `ops/execution/ot-71/REMAINING.md`
- `ops/execution/ot-71/DECISIONS.md`
- `ops/execution/ot-71/BLOCKERS.json`
- `ops/execution/ot-71/TEST-RESULTS.md`
- `ops/execution/ot-71/INTEGRATION-MANIFEST.md`
- `ops/execution/ot-71/RESUME.md`
- one phase ledger per implementation phase

`BASE-RESOLUTION.json` must use separate, non-self-referential fields:

- `immutable_base_sha`
- `source_remote_ref`
- `source_remote_head_observed_at_start`
- `source_pr_number`
- `inherited_control_values`
- `control_drift_disposition: accepted_non_blocking_metadata_drift`

Do not edit the shared OT-60R registry/control files on this parallel branch.
That would collide with OT-72. Final convergence will reconcile shared control
metadata. Commit and push this initial packet, but a temporary push failure does
not prohibit local product implementation; keep clean local commits and retry
before ending.

## Parallel ownership boundary with OT-72

OT-71 owns:

- classes/occurrences/fulfillment domain and provider-neutral launch contracts;
- provider-neutral content/library domain and accepted outcome contracts;
- account lifecycle integration using the canonical auth system;
- parent/student portal mounting and product UI;
- Rabbi owner/admin dashboard and ready-only shell wiring;
- product-core migrations, APIs, authorization, tests, and local sink/mocks.

OT-72 owns:

- Stripe, Resend/email, WhatsApp/WAPI, Zoom, Vimeo and Telegram provider
  transports/adapters;
- webhook verification and provider polling;
- provider credentials, secret/config loading and readiness diagnostics;
- sandbox/live provider activation and external service topology.

Do not edit OT-72-owned provider files. Define narrow interfaces in OT-71-owned
product-core paths. If an existing shared hotspot truly must change, make a
small clearly labeled integration commit and record it in
`INTEGRATION-MANIFEST.md`; do not stop the rest of the train.

## Workaround-first execution rule

A missing external system, credential, disposable database, business price, or
live environment blocks only its live proof. It does not block safe product
implementation.

Use these defaults:

- provider unavailable -> provider-neutral interface plus deterministic local
  sink/mock and truthful unavailable state;
- no live PostgreSQL locally -> complete code/tests, add PostgreSQL 16 CI proof,
  and continue other phases;
- unresolved price -> billing UI hidden or `Needs setup`, with no invented
  amount;
- unavailable route source -> do not expose the route/button;
- failed unrelated baseline test -> identify inherited failure, run scoped
  tests, continue task-owned phases, then retry the full suite;
- no deployment/staging -> complete local/CI evidence, do not deploy;
- ambiguous optional feature -> default off and record it, do not ask before
  continuing the rest.

Stop only the exact operation that would risk secrets, production data,
authorization integrity, or an irreversible external mutation. Always continue
independent phases. Checkpoint, commit, and push after each phase and whenever
one subphase is paused. Any fresh Codex window must be able to resume from
`RESUME.md` without this chat.

## Binding product invariants

- Rabbi Scheller is a real One Time owner; Shloimie is a real One Time
  administrator. No impersonation or View as Rabbi.
- This is standalone One Time, never the BNA Operations runtime.
- Main categories live in left navigation; current-category subsections live in
  the top bar. Never duplicate a choice in both.
- Use the canonical black/yellow tokens, header, toolbar, cards, forms, buttons,
  support/footer and state language.
- Mobile 360x800 and 390x844 is first-class: readable names, reachable filters,
  no horizontal page overflow, correct focus and reflow.
- Public signup stays fast and provider-independent.
- `join.onetimeonetime.com` remains the transition domain.
- School submissions are leads for human follow-up, never automatic class or
  portal entitlement.
- Parent access is relationship/household scoped. A student session resolves to
  exactly one learner and cannot enumerate siblings.
- Raw Zoom/Vimeo/Drive URLs, class targets, tokens, credentials and provider IDs
  never enter client DTOs, logs, analytics or evidence.
- Ordinary One Time routes perform zero synchronous BNA calls.
- Show only working routes/actions; no dead buttons or fake healthy/zero states.

## Phase 1 — canonical class occurrence and fulfillment

Audit existing class/delivery/outbox contracts, then implement one canonical
class series, occurrence, access-target and fulfillment model. Use migration
namespace 1100-1199 after confirming it is free.

Requirements:

- daily class time 19:00 Asia/Jerusalem with DST/local-calendar correctness;
- T-30 reminder time 18:30;
- before 18:30 target today's occurrence and schedule eligible T-30 intent;
- 18:30 through before 19:00 target today's occurrence and allow immediate,
  idempotent reminder satisfaction;
- at/after 19:00 target next local class day unless the current occurrence is
  explicitly still joinable;
- separate occurrence, acknowledgement, reminder, access, attendance, delivery
  and recording states;
- public signup commits first and never waits for target/provider resolution;
- family eligibility is derived server-side from committed signup/contact,
  consent, suppression and reminder preference;
- school submissions have no class target, reminder or access entitlement;
- public payloads never contain raw provider/class targets;
- idempotency prevents duplicate occurrences, fulfillment and reminders.

Add owner/admin class list/detail/readiness and portal adapter hooks using opaque
protected launch descriptors. Without Zoom, return truthful
`provider_unavailable`; do not stop. Add DST, boundary, replay, scope,
concurrency, API and browser tests. Commit and push Phase 1.

## Phase 2 — provider-neutral content and library

Implement real product code in migration namespace 1400-1499 after confirming
it is free. Lifecycle:

- received
- transcribing
- processing
- review_needed
- published
- failed
- superseded

BNA retains Studio/slideshows, Drive intake, media editing, transcription
execution, social repurposing and provider administration. One Time receives
versioned, authenticated, idempotent, redacted asynchronous outcomes and never
waits for BNA on ordinary routes.

Implement class/content linkage, revision-safe outcome admission, approved
transcript/source/review-sheet metadata, owner/admin library review/status,
entitled published parent/student library and review sheets, protected playback
interface, deterministic sink/mock, audit/redaction/retention, bounded indexed
APIs, replay/order/scope/volume tests. Do not make Vimeo calls. Commit and push.

## Phase 3 — account and credential lifecycle integration

Reuse the canonical auth/MFA/session runtime. Do not build a second auth model.
Implement or finish default-off/sink-capable owner/admin invitation, parent
activation, parent-managed student setup/reset/suspend/restore, password reset,
privileged TOTP MFA lifecycle, session-family invalidation, hashed expiring
single-use tokens, durable rate limits, audit and idempotent delivery intents.

Parent cannot retrieve a student's current secret or enter the student session.
Learner profile and login identity remain separate. No real invitation or send
is authorized. Prove local state transitions and commit/push.

## Phase 4 — mount and finish parent/student portals

Integrate the recovered portal module with canonical auth, shell, class, content,
support and optional billing interfaces.

Parent portal:

- household overview, maximum three active learners;
- learner create/edit/archive/restore with concurrency protection;
- student access setup/reset/suspend/restore;
- upcoming classes and auditable protected launch-for-learner;
- published library/review sheets/progress/rewards;
- billing status/portal seam only when enabled;
- updates/support.

Student portal:

- exactly one server-resolved learner;
- schedule/next class and protected launch;
- entitled published library/review sheets;
- progress, rewards, updates, private question/support seam;
- no household billing, sibling selector, CRM, parent or admin controls.

Mount only implemented routes. Add wrong-role, deep-link, expiry, offline,
cross-household and sibling-isolation negatives. Commit/push.

## Phase 5 — Rabbi owner/admin dashboard and ready-only shell

Build the canonical dashboard and navigation using bounded APIs. Day-one
categories may include only integrated, working surfaces:

- Dashboard
- CRM
- Classes
- Communications
- Content/Library
- Products/Billing status
- Tasks only if a real task capability exists
- Reports only if a real report source exists
- Support

Do not expose Studio, agent fleets, provider secrets/config, BNA integration
internals, fake reports, dead filters, or Coming Soon controls as usable
features.

Dashboard states may include new leads, next class, communications/delivery,
content review, portal/account setup, billing readiness and tasks/repairs.
Missing sources show `Unavailable` or `Needs setup`, never a fabricated zero or
healthy state.

Create a visible-action registry mapping every route/button/form to role,
server capability, handler, idempotency/audit and loading/success/error/
permission/offline states. Verify navigation uniqueness, mobile filters,
readable names, consistency, focus, keyboard, RTL, reduced motion and 200%
reflow. Commit/push.

## Phase 6 — combined proof and publication

Prove with synthetic data:

1. Family signup -> one contact/lead -> truthful sink intents.
2. School signup -> lead only, no entitlement.
3. Owner/admin activation/login/MFA -> dashboard -> CRM.
4. Class occurrence/reminder calculation -> protected unavailable/mock launch.
5. Content outcome -> review -> publish -> entitled library.
6. Parent activation -> learner link -> student setup.
7. Parent/student portals with strict negative isolation.
8. Logout/reset/suspension/role change clears protected state.
9. Every visible action maps to a real capability.
10. Zero BNA requests and zero provider URL/secret/PII leaks.

Run fresh and upgrade PostgreSQL 16 CI, unit/integration/e2e/accessibility/
performance/build checks, 360/390/tablet/desktop screenshots, request/bundle
budgets, sanitized query-plan evidence, and `git diff --check`. Do not fabricate
unavailable measurements; record them and keep all other proof moving.

Open one draft PR from the OT-71 branch to
`codex/ot60r-recovery-convergence`. Do not merge or deploy.

Before ending for any reason:

1. update STATE, CHECKPOINT, IMPLEMENTED, REMAINING, BLOCKERS, TEST-RESULTS,
   INTEGRATION-MANIFEST and RESUME;
2. commit task-owned changes;
3. push the branch or, if authentication blocks push, create a git bundle or
   format-patch and record its stable path;
4. make RESUME fully self-contained for a fresh Codex window;
5. report the draft PR/branch/base/head, phase matrix, exact tests, deferred
   live-only proof, external mutation count, resume path and exact git status.

The repository packet is the durable handoff. Do not require the operator to
return to this Codex window.
```
