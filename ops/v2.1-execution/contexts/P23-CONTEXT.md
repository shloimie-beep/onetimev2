# P23 — Student In-App Notifications and Audible Cue — Locked Context

**Outcome:** Implement exact Student notification lifecycle, unread/read behavior, safe action routing, and optional foreground audible cue while leaving email launch functionality independent.

**Source package lock:** `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e` (digest of source `SHA256SUMS.txt`)  
**Reviewed repository head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Primary writer slots:** `STUDENT_NOTIFICATIONS`

This file is a generated, checksum-bound subset of the v2.1 source package. It reduces rereading; it does not override the source documents. If its digest matches the task packet and package lock, do not globally re-audit the repository or reconsider locked decisions.

## Task-specific instructions

- Apply the exact task packet and execution contract.

## Dependency gates

- Start after: `F05, F07`
- Full merge after: `F05, F07`
- Candidate integration partners (non-ordering): `P17, P21, P22`
- Candidate acceptance after: `None`

## Machine-enforced owned globs

- `apps/web/src/client/app/student/notifications/**`
- `apps/web/src/server/features/notifications/student/**`
- `packages/contracts/src/notifications/student/**`
- `packages/db/src/notifications/student/**`
- `packages/domain/src/notifications/student/**`

Scope notes below explain intent but do not grant additional path authority:

- packages/db/src/notifications/student/** except migrations and central index
- notification lifecycle/a11y tests
- steward requests for route/migration/registration changes

## Deliverables

- notification center and unread state
- safe deep-link/action routing
- optional foreground audible cue
- exact copy integration points

## Relevant locked decisions (2)

| Decision | Status | Exact decision |
|---|---|---|
| DEC-111 | LOCKED | Student devices receive in-app notices relevant to the Student. |
| DEC-112 | INFERRED | Launch includes an in-app notification center, unread badge, and an optional audible cue while the Student portal is open. Background mobile push/PWA notification is deferred. |

## Acceptance requirements and exact cases (2 requirements)


### OTV2-NOTIFY-203

Student in-app notifications implement the exact category copy/action catalog, source-version dedupe, unread/read/expired/archive transitions, stale-action denial, mark-all-read, and optional foreground-only sound.

- Area: `NOTIFY`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `notifications`
- Semantic acceptance dependencies: `OTV2-AUTH-008, OTV2-EMAIL-143`
- Source references: `09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-NOTIFY-203-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - student
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - real actor, target resource, and denial-scope fixture exist
  steps:
  - sign in as the named actor
  - perform the visible action
  - refresh and sign in again to prove persistence
  - repeat against sibling/cross-household/wrong-role target
  expected_results:
  - Student in-app notifications implement the exact category copy/action catalog, source-version dedupe, unread/read/expired/archive
    transitions, stale-action denial, mark-all-read, and optional foreground-only sound.
  forbidden_effects:
  - cross-scope read or write
  - UI-only success without persistence
  - duplicate write on resubmit
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-NOTIFY-237

Every Student notification category uses its specified copy, action, lifetime, 30-day expired visibility, source-version dedupe, mark-all-read semantics, and default-off foreground-only sound.

- Area: `NOTIFY`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `notifications`
- Semantic acceptance dependencies: `OTV2-AUTH-008, OTV2-EMAIL-143, OTV2-NOTIFY-203`
- Source references: `08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md, 09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-NOTIFY-237-CATEGORY-LIFETIME
  kind: state_matrix
  environment: &id001
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - student
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - real actor, target resource, and denial-scope fixture exist
  steps:
  - render class reminder, class change, cancellation, recording, question, support, badge, and announcement notifications
    with representative source data
  - verify each exact title/body pattern, authorized internal action, and configured active lifetime
  - expire each category, inspect All for 30 days with disabled action/No longer available, then advance to archive
  - revoke authorization before natural expiry and attempt the action/deep link
  expected_results:
  - every category matches WNC-8 exactly and no private answer body or provider URL appears
  - expired notices remain under All for 30 days with disabled actions, then leave the normal center
  - authorization loss disables the action immediately and direct links reauthorize
  forbidden_effects:
  - wrong category copy
  - action after expiry/revocation
  - private body
  - external/provider deep link
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
- case_id: OTV2-NOTIFY-237-DEDUPE-READ-SOUND
  kind: idempotency
  environment: *id001
  actors:
  - student
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - real actor, target resource, and denial-scope fixture exist
  steps:
  - deliver the same event_type/entity/recipient/version repeatedly and inspect rows/unread count
  - deliver a later version and a cancellation that supersedes its reminder
  - use mark one and mark all read repeatedly across Unread/Read/All
  - with sound default off, attempt background/pre-interaction sound, then explicitly enable and create one foreground
    unread notice
  expected_results:
  - the exact dedupe key prevents duplicate rows and unread increments; later version/supersession creates truthful
    current state
  - mark-all-read is idempotent and affects the visible active set
  - sound is default-off, foreground-only after interaction, and always paired with a visual notice
  forbidden_effects:
  - duplicate unread count
  - background push
  - pre-interaction sound
  - sound without visual equivalent
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

## Embedded normative source sections

These exact source-package sections are embedded so this task does not need to rediscover its workflow/journey/certification contract.

### WNC-8 exact in-app notification catalog and lifecycle

## WNC-8. In-app notifications

Each in-app notification stores stable ID, recipient and scope, category, source entity/version, exact rendered title/body, safe internal action, created/read/expired/archived timestamps, and dedupe key.

### WNC-8.1 Student notification catalog

| Category | Title/body pattern | Action | Active lifetime |
|---|---|---|---|
| `class_reminder` | **Class begins in 30 minutes** / `Rabbi Eli’s class begins at {{student_local_time}}.` | **Open class** → own occurrence detail | Until occurrence close |
| `class_changed` | **Class schedule updated** / `Your class is now {{student_local_time}}. {{admin_message}}` | **Open schedule** | Until occurrence close |
| `class_canceled` | **Class canceled** / `The class scheduled for {{student_local_time}} was canceled. {{admin_message}}` | **Open schedule** | Until occurrence close |
| `recording_available` | **New recording available** / `{{content_title}} is ready in your library.` | **Watch recording** | Until content is unpublished or archived |
| `question_updated` | **Your question was updated** / `Status: {{student_safe_status}}.` | **Open question** | Until 90 days after terminal resolution |
| `support_updated` | **Support request updated** / `Your request has a new status or reply.` | **Open support request** | Until 90 days after terminal resolution |
| `badge_awarded` | **You earned {{badge_name}}** / `Open Progress to see what you achieved.` | **View progress** | 30 days |
| `announcement` | `{{approved_title}}` / `{{approved_short_body}}` | Optional approved internal route | Configured expiry, never more than 90 days |

`student_safe_status` uses only the canonical Student-visible lifecycle label. Private answer text never appears in a notification body or lock-screen-like browser surface.

### WNC-8.2 Parent notification catalog

Parents may receive household/Student-management, attendance-summary, access/billing, newsletter-archive, and support notices. Every Parent notification deep-links only to a Parent-authorized route. A Parent notice may name the owned Student when operationally required, but never includes private question/support bodies, a recording playback URL, Student credentials, or provider secrets.

### WNC-8.3 State, dedupe, action, and sound

- The dedupe key is exactly `event_type + source_entity_id + recipient_student_or_parent_id + source_version`. Retrying the same source version returns the existing notification and never increments unread count twice.
- A later source version creates or updates the category-defined current notice and marks a superseded action stale; cancellation supersedes the corresponding reminder.
- Active notices appear under **Unread** or **Read** and **All**. **Mark all as read** marks every currently visible active notice and is idempotent.
- At active-lifetime expiry, the notice remains under **All** for 30 additional days with its action disabled and the label **No longer available**. It then becomes archived and disappears from the normal center.
- If authorization changes before expiry, the action is disabled immediately; opening a stale deep link reauthorizes and shows a neutral unavailable state.
- Audible cue is off by default, is a per-Student preference, may play only for a newly created unread notification while the authenticated portal is in the foreground and browser interaction permits audio, and always has a simultaneous visual equivalent.
- There is no background push, PWA notification, email to a Student, or attempt to play sound before user interaction.

## Cross-cutting invariants

- Exact assignable roles are `admin`, `parent`, and `student`.
- Students have username/password credentials and no required email; no Student is a GHL contact.
- A Parent never becomes a learner session; an adult learner uses a separate Student seat.
- One adult identity may own multiple independently billed households; authorization remains household-scoped.
- No preview/demo/test product lane, fictional customer, Class Helper, Buffer/social publisher, public WhatsApp assistant, or active Tisha funnel route.
- GHL is adult CRM/campaign/operator billing workflow; Stripe is financial truth; One Time stores a minimum verified access projection and never mutates financial objects.
- Email must complete launch workflows even while WhatsApp is dormant.
- Zoom and Vimeo bearers/URLs never appear in UI URLs, email, GHL, logs, handoffs, or evidence.
- Production evidence must bind one immutable candidate; each case uses only an environment allowed by its acceptance contract and records exact environment/runtime/deployment/provider identity. The 265 cases are not required to share one environment.
- Automated production-safety verification is required even though demo/test product surfaces are prohibited.
