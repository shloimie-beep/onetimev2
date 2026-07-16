# OT-88 Domain and Data Model

This model is relational in presentation but should be adapted to the One Time repository’s existing persistence and naming conventions. Preserve the invariants even if the physical schema differs.

## Aggregate map

```text
Household
  └─ HouseholdEntitlement (family plan; max 3 active learner seats)
       └─ LearnerSeat / LearnerEnrollment (named learner)

ClassSeries (19:00 Asia/Jerusalem; optional T-30 reminder)
  └─ ClassOccurrence (immutable schedule snapshot)
       ├─ ProviderMeeting
       │    └─ ProviderRegistrantIdentity (learner scoped, when supported)
       ├─ AppLaunchGrant (single learner + occurrence + purpose)
       │    └─ AttendanceAttempt / AttendanceEvent
       ├─ StudentQuestion
       │    └─ QuestionModerationAction / TelegramAlertIntent
       └─ ReminderDeliveryIntent

ProviderConfiguration
  └─ ProviderReadinessAssessment

AuditEvent (append-only references to all security-relevant actions)
```

## Core invariants

1. A qualifying household entitlement permits at most three active, named learner seats.
2. A seat belongs to exactly one household and one learner. It is not a reusable slot token or URL.
3. Learner authentication is distinct. A guardian or sibling session cannot consume another learner’s launch grant.
4. A class occurrence is immutable as a schedule fact. Corrections cancel/supersede; they do not rewrite history.
5. Every launch grant binds one authenticated learner, one occurrence, one purpose, and one short validity interval.
6. A launch grant is consumed at most once. Rejoin requires a new grant and a new authorization decision.
7. Provider credentials and tokens are never used as application identifiers.
8. Provider join URLs are never persisted as ordinary data. If a provider API returns one, parse it server-side and discard it.
9. A student question belongs to one learner and one occurrence; only that learner can see its learner-safe state.
10. Rabbi actions are authorized independently from learner sessions.
11. Reminder and Telegram deliveries are represented by idempotent intents/outbox records before any external call.
12. Audit events are append-only, redacted, and contain opaque application IDs rather than provider secrets.

## Entity definitions

### `household_entitlement`

Represents the purchased family entitlement.

| Field | Type / notes |
|---|---|
| `id` | Opaque application ID. |
| `household_id` | FK to household. |
| `product_code` | Stable code for the $67 family plan. Do not key policy on display price text. |
| `status` | `PENDING`, `ACTIVE`, `PAST_DUE`, `SUSPENDED`, `EXPIRED`, `REVOKED`. |
| `max_active_learners` | Integer; value `3` for this product; DB check `1..3` unless shared table serves other products. |
| `starts_at`, `ends_at` | Entitlement validity. |
| `source` | Billing/admin source enum. |
| `version` | Optimistic-concurrency/version field. |
| `created_at`, `updated_at` | Audit timestamps. |

Constraints:

- one current entitlement per household/product according to existing billing rules;
- seat activation must lock or serialize on this row;
- inactive entitlement blocks new launch grants immediately.

### `learner_seat`

A named seat assignment, not a bearer credential.

| Field | Type / notes |
|---|---|
| `id` | Opaque seat/enrollment ID. |
| `household_entitlement_id` | FK. |
| `household_id` | Denormalized only if existing conventions allow; must be consistency-checked. |
| `learner_id` | FK to learner profile. |
| `status` | `ACTIVE`, `SUSPENDED`, `REVOKED`, `ENDED`. |
| `activated_at`, `revoked_at`, `ended_at` | Lifecycle timestamps. |
| `created_by_actor_id` | Guardian/admin application actor, not provider identity. |
| `version` | Concurrency field. |

Constraints:

- unique active seat for `(household_entitlement_id, learner_id)`;
- transactionally enforce `count(active seats) <= max_active_learners`;
- the fourth concurrent activation must fail deterministically;
- revoked/suspended seat cannot issue or consume launch grants.

### `class_series`

Defines the recurring product schedule.

| Field | Type / notes |
|---|---|
| `id` | Opaque series ID. |
| `name` | Learner-safe display name. |
| `timezone` | IANA zone; `Asia/Jerusalem`. |
| `local_start_time` | `19:00:00`. |
| `duration_minutes` | Required product configuration; do not infer from Zoom. |
| `join_open_offset_minutes` | Recommended default `-15`; configurable. |
| `join_close_offset_minutes` | Recommended default `+15` relative to scheduled end; configurable. |
| `reminder_offset_minutes` | `-30` when enabled. |
| `status` | `ACTIVE`, `PAUSED`, `ENDED`. |
| `schedule_version` | Increment on future schedule policy changes. |

Use timezone-aware recurrence generation. Never produce occurrences by adding fixed 24-hour UTC intervals because Israel daylight-saving transitions must preserve 19:00 local time.

### `class_occurrence`

Immutable schedule snapshot.

| Field | Type / notes |
|---|---|
| `id` | Opaque occurrence ID. |
| `class_series_id` | FK. |
| `local_date` | Calendar date in the series timezone. |
| `timezone_snapshot` | `Asia/Jerusalem`. |
| `starts_at`, `scheduled_ends_at` | UTC instants resolved from the local schedule. |
| `join_opens_at`, `join_closes_at` | UTC policy window. |
| `schedule_version` | Series version used to create the occurrence. |
| `status` | `SCHEDULED`, `CANCELLED`, `ENDED`, `SUPERSEDED`. |
| `superseded_by_occurrence_id` | Nullable self-reference. |
| `created_at` | Generation timestamp. |

Constraints:

- unique `(class_series_id, local_date, schedule_version)` or the equivalent existing recurrence key;
- `starts_at`, `scheduled_ends_at`, timezone snapshot, and join window never update in place;
- cancellation/status updates do not alter the schedule fields;
- correction creates a new occurrence and links the old occurrence as superseded.

### `provider_meeting`

Server-only provider mapping.

| Field | Type / notes |
|---|---|
| `id` | Opaque application ID. |
| `provider` | `ZOOM`. |
| `class_series_id` / `class_occurrence_id` | Exactly one scope according to chosen recurring-meeting strategy. |
| `provider_account_ref` | Encrypted or opaque configuration reference. |
| `provider_meeting_ref_ciphertext` | Encrypted meeting number/ID; never log. |
| `provider_passcode_ciphertext` | Nullable encrypted passcode. |
| `provider_meeting_uuid_ciphertext` | Nullable, if reconciliation needs it. |
| `registration_mode` | `PER_LEARNER`, `ACCOUNT_IDENTITY`, `NONE_UNPROVEN`. |
| `status` | `UNCONFIGURED`, `CONFIGURED`, `DISABLED`, `DEGRADED`, `REVOKED`. |
| `configuration_version` | Version of provider setup. |
| `verified_at` | Last successful readiness/canary verification. |

Do not store a full `join_url`. Do not expose this entity through learner APIs.

### `provider_registrant_identity`

Per-learner identity where supported.

| Field | Type / notes |
|---|---|
| `id` | Opaque application ID. |
| `provider_meeting_id` | FK. |
| `learner_seat_id` | FK. |
| `provider_registrant_id_ciphertext` | Encrypted provider identifier. |
| `registrant_token_ciphertext` | Encrypted `tk`; server-only. |
| `provider_identity_alias_ciphertext` | Optional provider email/alias under existing privacy rules. |
| `status` | `PENDING`, `ACTIVE`, `REVOKED`, `FAILED`. |
| `last_verified_at` | Readiness timestamp. |
| `failure_code` | Internal coarse code, no provider response body. |

Constraints:

- unique active identity for `(provider_meeting_id, learner_seat_id)`;
- token plaintext exists only within a bounded server operation or launch bootstrap assembly;
- provider response URLs are discarded immediately after token extraction.

### `app_launch_grant`

One Time authorization object, distinct from the Meeting SDK JWT.

| Field | Type / notes |
|---|---|
| `id` | Opaque public grant ID or random handle. |
| `secret_digest` | Hash/HMAC of a high-entropy bearer secret if the route uses a compound token; never store plaintext. |
| `learner_id` | Authorized learner. |
| `learner_seat_id` | Authorized seat. |
| `class_occurrence_id` | Authorized occurrence. |
| `purpose` | `JOIN_CLASS`. |
| `status` | `ISSUED`, `CONSUMED`, `EXPIRED`, `REVOKED`. |
| `issued_at`, `expires_at`, `consumed_at`, `revoked_at` | Lifecycle. |
| `attendance_attempt_id` | Preallocated opaque attempt ID. |
| `session_binding_digest` | Optional HMAC binding to authenticated session/device risk signal; never raw cookie/IP. |
| `idempotency_key_hash` | Hash of caller idempotency key. |
| `policy_version` | Authorization policy version. |
| `denial_context` | Not stored for successful grant; denials go to redacted audit. |

Recommended application grant TTL: 60–120 seconds; use 90 seconds unless repository policy dictates otherwise.

State machine:

```text
ISSUED ──consume atomically──> CONSUMED
   ├────expiry sweep/access──> EXPIRED
   └────revocation───────────> REVOKED

CONSUMED, EXPIRED, REVOKED are terminal.
```

Consumption transaction re-checks authentication, learner identity, seat, entitlement, occurrence window, revocation, and rate limits. Authorization is not assumed merely because issuance previously succeeded.

### `attendance_attempt`

Application-owned join attempt.

| Field | Type / notes |
|---|---|
| `id` | Opaque attempt ID. |
| `learner_id`, `learner_seat_id`, `class_occurrence_id` | Scope. |
| `launch_grant_id` | FK. |
| `selected_view` | `CLIENT`, `COMPONENT`, `CLIENT_FALLBACK`. |
| `status` | `AUTHORIZED`, `BOOTSTRAPPED`, `WAITING`, `JOINED`, `RECONNECTING`, `LEFT`, `ENDED`, `FAILED`. |
| `authorized_at`, `bootstrap_at`, `joined_at`, `left_at`, `ended_at` | Nullable timestamps. |
| `reconnect_count` | Coarse count. |
| `failure_category` | Application-safe category. |
| `provider_error_code` | Restricted optional numeric/code value; no provider message/credentials. |
| `client_capability_class` | Coarse, e.g. `MOBILE_WEB`, `DESKTOP_SUPPORTED`, not full fingerprint. |

### `attendance_event`

Append-only minimized telemetry.

| Field | Type / notes |
|---|---|
| `id` | Opaque event ID. |
| `attendance_attempt_id` | FK. |
| `sequence` | Monotonic attempt-local sequence. |
| `event_type` | Allowlisted enum only. |
| `occurred_at` | Client event time bounded/validated. |
| `received_at` | Server time. |
| `details` | Small validated object with coarse network/permission/error category. |
| `idempotency_key_hash` | Deduplication. |

Never store media, captions, Zoom chat, participant lists, display names, raw IP addresses, user agent strings, meeting numbers, or tokens in attendance events.

### `student_question`

One Time question queue record.

| Field | Type / notes |
|---|---|
| `id` | Opaque question ID safe for Telegram preview. |
| `learner_id`, `learner_seat_id`, `class_occurrence_id` | Scope. |
| `body_ciphertext` | Encrypted original short question. |
| `body_normalized_hash` | Optional duplicate/abuse detection hash, keyed if appropriate. |
| `redacted_preview` | Server-generated preview with PII/contact-pattern redaction and strict maximum length. |
| `status` | `SUBMITTED`, `QUEUED`, `FEATURE_NEXT`, `ANSWERED`, `DISMISSED`, `MODERATION_HOLD`. |
| `moderation_reason_code` | Restricted enum; never exposed to learner. |
| `submitted_at`, `updated_at` | Timestamps. |
| `idempotency_key_hash` | Prevent duplicate submit. |
| `rate_limit_bucket_ref` | Optional opaque reference. |

Recommended hard maximum: 280–500 Unicode characters according to existing UX conventions. Reject markup/attachments/URLs according to the child-safety and abuse policy. Do not send the body to Zoom chat.

### `question_moderation_action`

| Field | Type / notes |
|---|---|
| `id` | Opaque action ID. |
| `student_question_id` | FK. |
| `actor_type` | `RABBI`, `SYSTEM`. |
| `actor_id` | Authorized One Time identity mapped from OT84 Telegram or moderator session. |
| `action` | `FEATURE_NEXT`, `ANSWERED`, `DISMISS`, `OPEN_MODERATION`, `RESTORE_QUEUE`. |
| `source` | `TELEGRAM_OT84`, `RABBI_PORTAL`. |
| `idempotency_key_hash` | Required. |
| `occurred_at` | Timestamp. |
| `notes_ciphertext` | Optional moderator-only note; avoid unless existing product needs it. |

At most one current `FEATURE_NEXT` selection per occurrence unless the product explicitly supports an ordered queue. Enforce with a transaction/unique partial constraint or a domain lock.

### `telegram_alert_intent`

Outbox record handed to OT84.

| Field | Type / notes |
|---|---|
| `id` | Opaque intent ID. |
| `student_question_id` | FK. |
| `authorized_recipient_ref` | Reference to the approved Rabbi Telegram identity; no arbitrary chat ID from request. |
| `payload_version` | Contract version. |
| `redacted_preview` | Redacted/truncated only. |
| `opaque_question_id` | Application ID. |
| `status` | `PENDING`, `SENT`, `RETRY`, `DEAD_LETTER`, `CANCELLED`. |
| `attempt_count`, `next_attempt_at` | Retry state. |
| `idempotency_key` | Stable One Time-generated key. |
| `last_error_category` | Coarse category. |

### `reminder_preference`

| Field | Type / notes |
|---|---|
| `learner_id` or approved guardian target | Follow existing account policy. |
| `class_series_id` | Scope. |
| `enabled` | Explicit opt-in/setting. |
| `channel` | Existing supported channel. |
| `authorized_destination_ref` | Internal reference; not arbitrary input at send time. |
| `updated_at` | Timestamp. |

### `reminder_delivery_intent`

| Field | Type / notes |
|---|---|
| `id` | Opaque intent ID. |
| `class_occurrence_id`, `learner_seat_id` | Scope. |
| `scheduled_for` | 18:30 local resolved to UTC. |
| `channel` | Supported channel. |
| `status` | `PENDING`, `SENT`, `SKIPPED`, `RETRY`, `DEAD_LETTER`. |
| `eligibility_snapshot` | Coarse policy facts/version, no secrets. |
| `idempotency_key` | Unique `(occurrence, learner seat, channel, reminder type)`. |
| `attempt_count`, `last_error_category` | Delivery state. |

Reminder copy opens One Time; it never includes a Zoom link, meeting number, passcode, registrant token, or launch grant.

### `provider_configuration`

| Field | Type / notes |
|---|---|
| `id` | Opaque config ID. |
| `provider` | `ZOOM`. |
| `environment` | `TEST`, `PRODUCTION`; OT-88 verification may use TEST only. |
| `secret_reference` | Secret-manager reference, not secret value. |
| `account_ref_ciphertext` | Encrypted/opaque account identity. |
| `meeting_strategy` | `RECURRING_SERIES`, `PER_OCCURRENCE`, etc. |
| `registration_required` | Configuration assertion, must be verified. |
| `mutations_enabled` | Default false. |
| `canary_allowlist` | Internal references; do not store child PII in flags. |
| `status` | `DISABLED`, `UNCONFIGURED`, `CONFIGURED`. |
| `updated_at` | Timestamp. |

### `provider_readiness_assessment`

| Field | Type / notes |
|---|---|
| `id` | Opaque assessment ID. |
| `provider_configuration_id` | FK. |
| `class_occurrence_id` | Optional scoped check. |
| `state` | See readiness states below. |
| `checks` | Allowlisted booleans/version strings, no secrets. |
| `assessed_at`, `expires_at` | Freshness. |
| `evidence_ref` | Path/reference to restricted canary evidence. |

Readiness states:

```text
DISABLED
UNCONFIGURED
SDK_CREDENTIALS_MISSING
HOST_ACCOUNT_UNVERIFIED
APP_AUTHORIZATION_UNVERIFIED
MEETING_UNPROVISIONED
REGISTRATION_UNVERIFIED
UI_PRIVACY_UNVERIFIED
SDK_VERSION_UNSUPPORTED
READY_FOR_ZOOM_CANARY
CANARY_FAILED
READY
DEGRADED
```

Only `READY` enables general join. `READY_FOR_ZOOM_CANARY` enables only explicit test identities/occurrences through a separate canary gate.

### `audit_event`

Append-only record for security-relevant application actions.

Required fields:

- opaque audit ID;
- actor type and application actor ID;
- action enum;
- target application type and ID;
- household/learner/occurrence scope where authorized;
- decision `ALLOW` / `DENY` / `ERROR`;
- policy version and coarse reason code;
- request correlation ID;
- server timestamp;
- redacted metadata allowlist.

Never include question text, provider URLs, meeting numbers, passcodes, SDK signatures/secrets, registrant/ZAK/OBF tokens, cookies, authorization headers, or raw Telegram payloads.

## Relationship and authorization checks

Every protected request resolves relationships from server data:

```text
session principal
  -> authenticated learner identity
  -> learner seat belongs to that learner
  -> seat belongs to household entitlement
  -> entitlement is active now
  -> occurrence belongs to entitled class product
  -> occurrence join window/status permits action
```

Client-submitted household, learner, seat, entitlement, provider, or recipient IDs are untrusted selectors. They never establish authorization.

## Concurrency requirements

- Seat activation: lock entitlement or use serializable transaction; fourth activation loses deterministically.
- Launch consumption: compare-and-set `ISSUED -> CONSUMED` in one transaction with policy re-check.
- Question submission: idempotency key and unique scope key prevent duplicates on retry.
- `FEATURE_NEXT`: occurrence-scoped lock or unique partial constraint prevents competing current selections.
- Reminder and Telegram outbox: unique idempotency keys prevent duplicate sends despite retries.
- Attendance events: attempt-local sequence/idempotency prevents duplicate transition inflation.

## Retention and deletion

Use the repository’s established child-data/privacy policy. If none exists, implement configurable retention with conservative defaults and document them for approval rather than silently retaining indefinitely.

Minimum technical rules:

- never retain raw provider join URLs;
- clear decrypted provider fields from application references immediately after SDK join invocation;
- delete or render unusable launch bearer material on consume/expiry;
- retain only grant metadata needed for abuse/audit for a bounded period;
- encrypt question bodies and purge them on a documented schedule;
- minimize attendance to join/leave/reconnect summaries;
- purge provider registrant tokens when the meeting/enrollment no longer needs them; and
- make deletion jobs idempotent and auditable without copying deleted content into logs.
