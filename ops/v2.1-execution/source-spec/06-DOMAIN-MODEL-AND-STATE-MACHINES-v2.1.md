# One Time Mishnayos — Domain Model and State Machines

**Package:** `ONE-TIME-PRODUCTION-SPEC-v2.1`  
**Document:** `06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md`  
**Status:** Normative product contract  
**Decision source:** `03-DECISION-REGISTER-v2.1.md`  
**Repository baseline:** `shloimie-beep/onetimev2` at `73dda293079f602c83929d1bbccb8dd5b9d1a455`

## 1. Purpose and normative language

This document defines the durable One Time domain model, aggregate boundaries, invariants, and allowed state transitions. It defines product truth; it is not an implementation sequence and does not prescribe table names, framework choices, or a roadmap.

The words **must**, **must not**, **required**, and **only** are normative. A derived projection may improve read performance, but it may not become an independently editable source of truth.

The v2.1 decision register controls all conflicts. In particular:

- One Time is a standalone product and failure domain.
- Assignable roles are exactly `admin`, `parent`, and `student`.
- there is one adult account owner per household;
- a single adult identity may own multiple separate households;
- a Parent never receives Student learning, recording, question, or classroom access;
- every active Student is automatically enrolled in the canonical class;
- Student audio and video may be recorded only under current versioned consent from the relationship-authorized adult actor;
- no Student has an email address or a HighLevel contact;
- production contains no fictional, preview, demo, test-lab, or Class Helper domain object.

## 2. Global scope and identity rules

### 2.1 Standalone scope

Every One Time record is scoped by server-derived One Time product scope. The browser, a provider webhook, a background job, or a Telegram callback may not choose or override that scope.

The minimum scope tuple is:

```text
product = one_time_mishnayos
runtime_tier = isolated_staging | production
verification_environment_id =
  ci | provider_sandbox | persistent_staging |
  production_read_only | production_operator_canary | production_broad
```

`runtime_tier` is the data/provider isolation boundary. `verification_environment_id` is the exact verification lane from `11-ENVIRONMENT-FIXTURE-CANARY-MANIFEST-v2.1.yaml`; it never creates a third runtime tier. The mapping is mandatory:

| `verification_environment_id` | `runtime_tier` |
|---|---|
| `ci` | `isolated_staging` |
| `provider_sandbox` | `isolated_staging` |
| `persistent_staging` | `isolated_staging` |
| `production_read_only` | `production` |
| `production_operator_canary` | `production` |
| `production_broad` | `production` |

Every database row, session, job, provider operation, provider registry entry, audit record, and acceptance result that carries environment identity stores or resolves both values and validates this mapping. A production-mapped verification lane uses only production-tier identities and credentials; its mutation permissions remain restricted by the manifest lane. A staging-mapped lane cannot reference a production provider object.

If the physical schema retains `account_key` or `workspace_key`, its only production value is the canonical One Time value. BNA identifiers, sessions, roles, database rows, provider configuration, and runtime state are invalid in this scope.

### 2.2 Identifier rules

- Internal primary identifiers are opaque and non-meaningful.
- Provider identifiers are stored separately from internal identifiers.
- Provider identifiers, email addresses, names, and phone numbers are never primary keys.
- Normalized email uniqueness is case-insensitive.
- Student username uniqueness is case-insensitive within the One Time product.
- A reused idempotency key with a different canonical request hash is rejected as a conflict.
- Archived records retain their internal identifiers so history and audit references remain stable.
- Public URLs contain neither raw provider credentials nor durable bearer tokens.

### 2.3 Mutable-record contract

Every mutable aggregate root contains:

- opaque identifier;
- current lifecycle state;
- positive monotonic version;
- creation and last-update timestamps;
- creating actor and last-mutating actor when applicable;
- archive timestamp when applicable;
- product scope;
- append-only audit references for material mutations.

Every update that depends on previously read state supplies the expected version. A stale version produces a conflict and no partial write.

## 3. Aggregate map

| Aggregate | Root | Canonical purpose | Independently editable projections forbidden |
|---|---|---|---|
| Adult identity | `AdultPerson` | One normalized adult identity and CRM-linkage projection | copied CRM lifecycle, copied consent detail |
| Human account | `HumanAccount` | One global adult login, role memberships, security state, sessions | UI role labels |
| Household | `Household` | subscription/access boundary, one owner, Student-seat boundary | dashboard household counts |
| Student identity | `StudentProfile` | local learner identity and Student credential subject | GHL contact, email recipient |
| Commercial access | `HouseholdAccessProjection` | effective `free`, `active`, `grace`, or `inactive` state | tags, invoice copies |
| Class series | `ClassSeries` | canonical recurring teaching schedule | calendar event cards |
| Class occurrence | `ClassOccurrence` | one real scheduled/live class and preparation state | provider meeting state |
| Enrollment | `SeriesEnrollment` | automatic Student membership in canonical class | occurrence roster snapshot |
| Classroom | `ClassroomResource` | Zoom occurrence resource, registrants, launch grants, attendance | raw Zoom URLs |
| Content | `ContentItem` | source, processing, approval, publication, assignments | Vimeo library lists |
| Recording participation | `RecordingParticipantSnapshot` | occurrence-time recording consent and participation evidence | roster display or transcript inference |
| Content participation | `ContentParticipant` | Student appearance/voice intervals and redaction state per content version | full-text search result |
| Question | `StudentQuestion` | private Student-to-Rabbi learning question and moderation | Telegram message |
| Support case | `SupportCase` | Student or adult support workflow | Telegram/GHL conversation |
| Learning progress | `LearningEvent` | append-only attendance/review/question achievement inputs | badge/leaderboard summaries |
| Notification | `InAppNotification` | durable Parent or Student in-app notice | unread counters |
| External work | `ProviderOperation` | one logical provider effect and its idempotent outcome | transient worker attempt |
| Audit | `AuditEvent` | append-only material-action evidence | mutable activity summaries |
| Data rights | `DataRightsRequest` | verified export, correction, closure, erasure, or consent-withdrawal case | support message |
| Purge evidence | `DeletionPurgeRecord` | backup-independent hash-only deletion tombstone | restorable primary database row |

## 4. Adult identity, accounts, and sessions

### 4.1 AdultPerson

`AdultPerson` contains:

- `adult_id`;
- normalized email;
- display name and legal/contact name fields as supplied;
- optional normalized phone;
- timezone and country/location when supplied;
- verified HighLevel contact reference or no reference;
- GHL linkage state `linked`, `unlinked`, or `identity_review`;
- source/provenance;
- archived state;
- version and timestamps.

Invariants:

1. One normalized email maps to one `AdultPerson`.
2. A verified HighLevel contact reference maps to at most one `AdultPerson`.
3. Matching precedence is verified provider reference, then exact normalized email, then GHL `identity_review`.
4. Name or phone alone never silently merges adults.
5. One adult may own multiple `Household` records without duplicating the adult identity.
6. One `AdultPerson` has exactly one `HumanAccount` and one global email/password login.
7. `identity_review` quarantines only the ambiguous GHL CRM linkage. A fresh public Family signup keeps the submitted local email/password login, household, pre-expiry free access, authenticated local product, and Resend security delivery. The public signup sets its password directly and does not require or send a setup link.
8. While `identity_review` is unresolved, One Time creates no GHL contact, updates no candidate GHL contact, starts no GHL workflow, opens no GHL billing page, and creates no household CRM/billing correlation. Admin reconciliation must resolve the exact contact before those effects resume.

### 4.2 HumanAccount

`HumanAccount` contains:

- `human_account_id`;
- linked `adult_id`;
- nonempty role-membership set that is a subset of `{admin, parent}`;
- lifecycle state;
- password hash and password-policy version;
- security/session version;
- setup state and latest setup-token reference;
- last successful login;
- disabled/archive reason;
- version and timestamps.

Student authentication is not represented as a `HumanAccount`; it is part of `StudentCredential`.

Invariants:

- one `AdultPerson` and normalized email map to exactly one `HumanAccount` and one password;
- a HumanAccount may hold `admin`, `parent`, or both memberships and never holds any other human role;
- every authenticated request has exactly one server-validated active role context selected from the account’s memberships;
- changing active role context is a same-origin, CSRF-protected server action that rotates the session identifier and re-evaluates the selected role’s session expiry; a client-supplied role label never grants membership;
- no `owner`, `rabbi`, `crm_agent`, `viewer`, `support`, or other assignable role is valid;
- teacher/profile data for Rabbi Eli is profile metadata attached to his `admin` account;
- Shloimie Dratler and Rabbi Eli Scheller receive the same Admin capability set;
- no Admin can disable or archive the final active Admin;
- membership addition/removal, Admin creation, disable, archive, reactivation, password reset, and session revocation are audited;
- removing `parent` is forbidden while the account owns any household; removing `admin` is forbidden when it would remove the final active Admin;
- adult passwords contain 12–128 Unicode code points; Student passwords contain 8–64 Unicode code points; neither policy has a composition rule;
- passwords that are common/compromised or normalization-equivalent to the account email, adult name, Student username, or Student name are rejected;
- adult and Student password hashes use a versioned Argon2id policy with a unique salt; successful authentication upgrades an obsolete valid hash without exposing the password;
- the current password, password hash, setup token, reset token, session token, and CSRF token are never readable through product UI or ordinary audit output.

### 4.3 Parent household selection

A Parent account may own one or more households. After authentication:

- the active role context is `parent`;
- one household is selected as the active household context;
- the selected household must be drawn from server-resolved ownership links;
- changing household context never changes identity or role;
- all Parent reads and mutations are scoped to the selected owned household;
- direct identifiers for another household are denied even if syntactically valid.

### 4.4 Household ownership transfer

`HouseholdOwnershipTransfer` contains:

- source household;
- current owner;
- replacement normalized email/adult identity;
- initiating Admin;
- single-use acceptance token reference;
- current policy-set version;
- state `pending`, `accepted`, `expired`, `canceled`, or `failed`;
- expiry and timestamps.

Transfer preconditions are exact:

- acceptance is blocked while the outgoing owner has an active `self` Student in the source household;
- before acceptance, the outgoing owner or an Admin must either archive that `self` Student or move it to another household that the outgoing adult owns and that has an available seat;
- the move preserves the Student identifier, credentials, immutable consent/learning/content history, and audit lineage, while atomically changing household scope under both household seat locks, replacing canonical enrollment, and revoking sessions and outstanding classroom/playback grants;
- a `self` Student is never auto-converted to `dependent` and is never transferred to the replacement owner;
- `dependent` Students remain in the household, but the replacement owner must record current authority plus current `service_account` and `recording_participation` acceptance for each exact dependent before acceptance; prior consent evidence remains immutable, and optional `member_recognition` is not carried forward unless the replacement owner separately accepts it.

Acceptance is atomic:

1. every transfer precondition above is rechecked under lock and the replacement adult accepts current required policies;
2. the replacement adult and sole HumanAccount are created or linked by normalized email;
3. `parent` membership is added idempotently when absent, including when the replacement already has `admin`;
4. the household owner changes;
5. all sessions of the prior owner that authorize that household are revoked;
6. every outstanding billing-portal session for the household is revoked;
7. pending setup/reset links for the prior household ownership are invalidated;
8. provider reassociation operations are queued without changing financial identity or history;
9. an audit event records both adult references and the Admin actor.

There is no simultaneous co-owner or co-guardian access at launch.

### 4.5 Sessions

`Session` contains only hashed token material and safe metadata:

- session identifier and token hash;
- subject account or Student credential;
- active role context;
- security version;
- issued, last-seen, idle-expiry, and absolute-expiry timestamps;
- revoked timestamp and reason;
- hashed or minimized device/IP evidence;
- CSRF secret/token hash where applicable.

Session invariants:

- login rotates session state;
- password reset, username change, ownership transfer, disable, archive, and explicit revoke invalidate affected sessions;
- active-role switching rotates into a new context-bound session; an existing session never gains another role in place;
- archived or disabled human accounts and archived Students cannot create or use sessions;
- an inactive household does not invalidate the Parent session, but every request is restricted to the exact inactive-household allowlist in §6.2;
- Student sessions require current Student, household, access, and `service_account` acceptance on every protected action; live-class and playback actions then apply their separate scope-specific checks.

Exact session policy:

| Context | Idle expiry | Absolute expiry |
|---|---:|---:|
| Admin | 30 minutes | 12 hours |
| Parent | 24 hours | 30 days |
| Student | 7 days | 30 days |

The shorter active-role policy governs an account holding both memberships. There is no remember-me override and no MFA state. Setup tokens expire after seven days; reset tokens expire after 60 minutes. Replacement issuance invalidates every earlier unused token for the same subject and purpose.

Authentication and recovery rate limits are enforced before password hashing or token issuance:

| Action | Limit |
|---|---|
| Login | 5 failures per normalized account-identity and source-IP pair per 15 minutes, and 50 failures per source IP per 15 minutes |
| Password-reset request | 5 per normalized account identity per hour, and 20 per source IP per hour |
| Setup-link resend | 3 per account per hour |

Responses are generic and do not reveal account existence. Limits decay automatically; there is no permanent account lock. A successful login clears only the account/IP-pair failure bucket and never clears the source-IP abuse bucket.

OAuth authorization state and any same-origin provider callback state expire after ten minutes, are single-use, are bound to the initiating account/session/action, and fail closed on mismatch or replay.

## 5. Household and Student model

### 5.1 Household

`Household` contains:

- `household_id`;
- owner `adult_id` and Parent account reference;
- family/school classification;
- display name;
- timezone;
- standard or contracted plan reference;
- active-seat limit;
- effective access projection reference;
- one household-scoped Stripe Customer reference and its subscription correlations;
- one household-keyed GHL opportunity/account-record reference;
- state `active` or `archived`;
- version and timestamps.

Invariants:

- a Family household has a seat limit of three;
- an approved School household uses the same model and UI, with a manually recorded contracted limit when it differs from three;
- changing a School seat limit requires Admin authority, contract reference, reason, version check, and audit;
- a household has exactly one current adult owner;
- a Stripe Customer is owned by exactly one household and is never shared between households, even when one adult owns both;
- one GHL adult contact may relate to several household-keyed GHL records, but household lifecycle, service preference, plan, billing, and access projections never overwrite one another;
- archiving a household revokes Student sessions and makes effective access `inactive`;
- household display state never grants access independently of the canonical access projection.

### 5.2 StudentProfile

`StudentProfile` contains:

- `student_id`;
- household reference;
- relationship to the account owner `self` or `dependent`;
- actual first name;
- actual last/family name when available;
- safe display name;
- lifecycle `active` or `archived`;
- current consent projection reference;
- version and timestamps.

Invariants:

- no email field exists;
- no HighLevel contact reference exists;
- no phone or independent marketing-consent field exists;
- no date of birth, numeric age, age band, grade, or Hebrew-specific field exists;
- `dependent` means the account owner attests that they are authorized to create and manage that Student; `self` means the legally capable adult account owner is using a separate Student seat for themselves;
- the dependent-name instruction is exactly: “Please use the Student’s actual name so Rabbi Eli can identify them during class.”;
- the self-name instruction is exactly: “Please use your actual name so Rabbi Eli can identify you during class.”;
- names accept Unicode and are normalized for safe display without replacing the supplied actual name;
- an active Student consumes one household seat;
- an archived Student retains history, cannot authenticate, and consumes no active seat;
- creation/activation or restoration requires effective household access `free`, `active`, or `grace` and is transactional under the household seat lock;
- concurrent final-seat requests allow exactly one success;
- a rejected activation creates no Student credential, enrollment, access, consent, audit-success, or idempotency partial write.

### 5.3 StudentCredential

`StudentCredential` contains:

- Student reference;
- unique normalized username and display form;
- password hash;
- credential/security version;
- state `unconfigured`, `active`, `reset_required`, or `disabled`;
- last reset and last session-revocation timestamps;
- version and audit references.

Invariants:

- Parent or Admin is the only credential-management actor;
- the Student cannot change username or password;
- an existing password is never returned;
- username change and password reset revoke every Student session;
- archiving the Student sets credential state to `disabled`;
- restoring an archived Student requires available seat capacity and current `service_account` acceptance before credential state can return to `active`;
- one username maps to one Student across the product;
- no credential action sends email to a Student.

### 5.4 Adult-as-Student

An adult learner is represented by a normal `StudentProfile` with relationship `self` and a `StudentCredential`, consuming one household seat. Parent authentication does not inherit that Student’s class, library, recording, question, or learning-progress capabilities. The adult uses the separate Student username/password for Student surfaces.

Moving an active `self` Student between two households owned by the same adult is a version-checked, audited non-lifecycle mutation. It requires an available destination seat and locks both households atomically. The move preserves the Student identifier and immutable history, changes household scope, replaces canonical enrollment, and revokes all Student sessions and grants. No other cross-household Student move exists at launch.

## 6. Commercial access

### 6.1 Source records

`AccessSource` records are independent, append-only inputs:

| Source kind | Purpose | Required fields |
|---|---|---|
| `free_period` | configured Family launch access | effective/expiry timestamps, policy version, signup reference |
| `paid_subscription` | verified Stripe-backed paid entitlement | provider event reference, current paid period, source revision |
| `payment_grace` | seven-day failed-payment grace | failure event, invalidated paid-source reference, grace start/end, source revision |
| `manual_school_contract` | approved School terms | contract reference, effective/expiry timestamps, Admin actor |
| `complimentary_admin` | explicit exceptional access | reason, effective/expiry timestamps, Admin actor |
| `administrative_block` | safety, fraud, or account suspension | reason, effective timestamp, Admin actor |

An access source is not an invoice or payment-history row.

### 6.2 Effective access projection

`HouseholdAccessProjection` contains:

- household reference;
- effective state `free`, `active`, `grace`, or `inactive`;
- winning source kind/reference;
- effective and expiry timestamps;
- source revision and source-updated timestamp;
- policy version;
- reason;
- projection version and evaluated timestamp.

Precedence is deterministic:

1. archived household or active administrative block produces `inactive`;
2. a verified valid paid source with current-term evidence and no newer unresolved renewal failure, or a valid contracted School or complimentary source, produces `active`;
3. a valid payment-grace source produces `grace`;
4. a valid free-period source produces `free`;
5. otherwise the result is `inactive`.

Rules:

- `free`, `active`, and `grace` grant Student authentication and learning access;
- `inactive` denies Student authentication and learning access;
- the Parent remains authenticated while inactive only for this exact Parent allowlist: `overview/status`, `household switcher`, `billing/reactivation`, `support list/detail`, `account`, `privacy`, and `data rights`;
- a HighLevel tag, workflow state, email delivery, checkout-start event, or unverified browser return never changes access;
- replay of the same source revision is idempotent;
- a lower or stale source revision cannot overwrite newer truth;
- a verified failed renewal atomically marks the previously winning paid source non-current and creates one seven-day grace source in the same access-projection transaction;
- repeated failure events for the same renewal do not restart or extend grace;
- verified recovery creates a new current winning paid source with a newer revision and closes the grace source; it never reactivates the invalidated paid source;
- an unresolved failure newer than the latest paid evidence prevents that paid source from winning until Stripe readback proves recovery or continued current-term entitlement;
- contradictory provider truth enters reconciliation and fails to the safer state defined by the provider contract.

For an inactive selected household, the exact deny list includes `Students`, `calendar/class`, `progress`, `updates`, `newsletter`, `reminder preferences`, and all Student routes. Authorization denies before protected render, before a protected loader returns content, and before provider dispatch; hiding navigation is not enforcement. The `household switcher` resolves only server-proven owned households and re-evaluates the destination household’s access projection.

## 7. Class series, occurrences, enrollment, and roster

### 7.1 Canonical ClassSeries

`ClassSeries` lifecycle states are `draft`, `active`, `paused`, and `archived`. The canonical launch series starts `active` with:

- Sunday through Thursday recurrence;
- 7:00 p.m. `Asia/Jerusalem`;
- English/Gregorian display dates;
- 60-minute scheduled duration;
- Rabbi Eli Admin-teacher profile assignment;
- embedded Zoom classroom requirement;
- recording enabled subject to consent.

The recurrence rule is stored once. UTC start/end timestamps are generated from the local date, local time, IANA timezone, and timezone database. An occurrence is unique by canonical series and Jerusalem local class date. The scheduler maintains a rolling 90-day horizon: at least the next 90 local calendar days of occurrences are generated, and each daily scheduler run extends the horizon idempotently.

The launch catalog contains exactly this one active/published series. Admin may create an additional series for future expansion, but it begins `draft`, has no enrollment or generated Parent/Student-visible occurrence, creates no provider resource, and sends no notification. Explicit Admin activation/publishing is required before any of those effects may occur.

Allowed `ClassSeries` transitions are:

| From | To | Trigger and invariant |
|---|---|---|
| `draft` | `active` | Explicit Admin activate/publish after schedule, timezone, teacher, access, enrollment, and reminder policy validation; downstream effects use one idempotent activation operation |
| `active` | `paused` | Explicit Admin pause; no new future occurrence, enrollment, provider, or reminder work starts while paused; already-live occurrence handling follows its own state |
| `paused` | `active` | Explicit Admin resume after the same activation validations and reconciliation of future work |
| `draft`, `active`, or `paused` | `archived` | Explicit Admin archive; historical occurrences and attendance remain, while future provisioning and visibility stop |
| `archived` | `draft` | Explicit Admin restore; restoration never republishes, enrolls, provisions, or communicates until a separate activate/publish action |

Every other transition is denied without a write. In particular, `archived` cannot transition directly to `active`, and creating or restoring a series never activates it implicitly.

### 7.2 SeriesEnrollment

An active Student receives an active enrollment in the canonical series in the same transaction that activates or restores the Student.

Enrollment contains:

- series;
- Student and household;
- state `active` or `revoked`;
- effective/revoked timestamps;
- source `student_activation`, `student_restore`, `student_archive`, or Admin correction;
- idempotency and audit references.

No enrollment request or separate Admin approval exists for the canonical class.

Archiving a Student revokes the current enrollment. Restoring the Student restores enrollment idempotently.

### 7.3 ClassOccurrence

`ClassOccurrence` contains:

- occurrence and series references;
- Jerusalem local date;
- UTC start and end;
- join-open timestamp, normally ten minutes before start;
- automatic-close timestamp, normally scheduled end plus 15 minutes;
- optional Admin-extended close timestamp and audited reason;
- timezone;
- lifecycle state;
- schedule version;
- preparation/roster version;
- cancellation reason;
- current classroom/content references;
- version and timestamps.

Visible occurrences correspond to real generated schedule instances or explicit Admin schedule actions. Draft recurrence edits do not create fake visible occurrences.

The canonical occurrence opens its protected join path ten minutes before scheduled start when preparation is ready. It remains joinable while `live`, including after scheduled start. It automatically transitions to `completed` at scheduled end plus 15 minutes unless an Admin has explicitly extended the close time or closed it earlier. An Admin extension changes only the audited close timestamp; it does not alter the original scheduled duration used for reporting.

### 7.4 OccurrenceRosterSnapshot

The roster snapshot is derived at preparation time from active series enrollments. It records:

- occurrence and roster version;
- each Student and household;
- Student/enrollment/access and scoped `service_account`, `recording_participation`, and `member_recognition` versions used;
- inclusion or exclusion decision and safe reason;
- generated timestamp.

The snapshot controls provider preparation, but it never overrides current authorization. Join rechecks current `service_account` and `recording_participation`; playback rechecks derived `playback_authorization`; recognition rechecks `member_recognition`.

### 7.5 Consent and authorization scopes

Student authorization separates four scopes:

| Scope | Source of truth | Required effect |
|---|---|---|
| `service_account` | current relationship-authorized adult policy acceptance for the exact Student | required to activate/restore the Student and process ordinary Student account/learning data |
| `recording_participation` | current relationship-authorized adult recording consent for the exact Student | required to issue live-class launch authorization because OBS records the class |
| `member_recognition` | optional current relationship-authorized adult choice for the exact Student | permits first-name-plus-last-initial recognition to authenticated class members; otherwise the stable class-scoped nonidentifying alias is used |
| `playback_authorization` | derived One Time authorization, not consent | requires active Student, enrollment, household access, published assignment, and no revocation |

Consent actor rules are deterministic:

- for relationship `dependent`, only the current verified Parent/account owner may accept, renew, or withdraw consent; a dependent Student session has no privacy/consent route;
- for relationship `self`, the same legally capable adult owner records initial `service_account` acceptance during Student creation and, after activation, may review, accept/renew, or withdraw their own `recording_participation` and `member_recognition` from the authenticated self-managed Student privacy route; the record binds both the adult identity and exact Student;
- a self-managed adult Student with missing or withdrawn `recording_participation` may reach only the consent explanation/control, not the classroom bootstrap; a committed current acceptance is rechecked before the 60-second launch grant is issued;
- relationship, actor authority, policy version, and consent version are checked at write and again at join. A role/session label alone cannot manufacture authority.

Withdrawing `recording_participation` blocks future live-class launch but does not revoke unrelated published-library playback. Withdrawing `member_recognition` changes only member-visible attribution: the Student’s underlying rank, learning facts, and badge facts remain; that Student sees `You`, while peers immediately see the stable class-scoped nonidentifying alias on rankings, badges shown to members, and approved questions. Withdrawing `service_account` begins the governed closure/erasure process and blocks new Student sessions. `playback_authorization` cannot be granted or withdrawn as a marketing/recording-consent checkbox.

## 8. Classroom, Zoom resources, launch sessions, and attendance

### 8.1 ClassroomResource

Each occurrence has at most one current app-owned Zoom meeting resource. It contains:

- occurrence;
- provider, `runtime_tier`, and `verification_environment_id`;
- purpose `normal_class`;
- state `not_provisioned`, `provisioning`, `active`, `failed`, `acceptance_unknown`, `closed`, or `deleted`;
- encrypted provider meeting reference and meeting secret material;
- safe provider-reference digest;
- stable provisioning idempotency key;
- source schedule/roster version;
- timestamps and safe error code.

Raw Zoom join URLs are not domain fields.

### 8.2 StudentRegistrant

Each rostered Student has at most one current registrant per occurrence:

- Student, household, occurrence, and classroom resource;
- state `pending`, `provisioning`, `active`, `failed`, `acceptance_unknown`, or `revoked`;
- encrypted registrant token/reference;
- safe provider digest;
- stable idempotency key;
- source Student/enrollment/roster versions;
- timestamps and safe error code.

No family-shared registrant exists.

### 8.3 LaunchGrant and LiveStudentSession

`LaunchGrant` is short-lived, one-use, and bound to:

- product, `runtime_tier`, and `verification_environment_id`;
- Student;
- household;
- Student session;
- occurrence;
- registrant;
- issue and expiry time;
- one-time state;
- security/consent/access/enrollment versions.

The classroom bootstrap grant expires 60 seconds after issue and is consumed once. The browser uses a constant authenticated classroom route. The grant is not placed in a URL, email, log, referrer, GHL record, Telegram message, or client-stored durable state.

`LiveStudentSession` enforces one concurrent live session per Student:

- same Student, occurrence, app session, and device/session lineage may reconnect;
- a second concurrent device/session is denied;
- the active device sends a lease heartbeat every 30 seconds and its lease expires after 90 seconds without a valid heartbeat;
- Admin reset revokes the current live session and launch grants;
- closing/canceling the occurrence revokes outstanding grants.

### 8.4 Attendance model

`AttendanceEvent` is append-only and records:

- occurrence and Student;
- source `zoom_provider`, `embedded_client`, or `admin_correction`;
- provider/client event reference;
- event kind;
- observed timestamp;
- connection lineage;
- idempotency key;
- minimized safe metadata.

`AttendanceProjection` contains:

- first joined and last left timestamps;
- total connected minutes;
- reconnect count;
- percentage of the scheduled occurrence duration, capped at 100%;
- late indicator based on actual first join compared with scheduled start;
- reconciliation state;
- manual correction reason and Admin actor when corrected.

Reconnect intervals are merged without double-counting overlap. Verified Zoom provider events take precedence for connected time; embedded-client events provide provisional status. Admin corrections supersede the projection only through an append-only correction event and never erase source events.

## 9. Class preparation and notification aggregate

`ClassPreparation` is one durable saga per occurrence and schedule/roster version.

States are `draft`, `validating`, `preview_ready`, `confirmed`, `provisioning`, `ready_to_notify`, `notifying`, `partial_failure`, `failed`, `acceptance_unknown`, `invalidated`, `canceled`, and `complete`.

Allowed transitions:

| From | To | Actor/trigger | Required effects |
|---|---|---|---|
| none | `draft` | scheduler or Admin creates saga version | bind occurrence, schedule version, roster version, and stable saga identity |
| `draft` | `validating` | scheduler or Admin starts validation | validate occurrence, consent, access, roster, provider registry, and copy/template version |
| `validating` | `preview_ready` | system validation succeeds | persist immutable preview of roster, exclusions, recipients, and proposed notice |
| `validating` | `failed` | system detects a permanent validation failure | store `failed_stage=validating`, safe reason, and no provider dispatch |
| `preview_ready` | `confirmed` | Admin confirms exact preview, or preapproved scheduler policy confirms an unchanged automatic run | bind confirmer/policy and preview digest |
| `preview_ready` or `confirmed` | `invalidated` | schedule, roster, consent, access, recipient, or template version changes | revoke confirmation and prevent dispatch |
| `confirmed` | `provisioning` | worker claims confirmed saga | create/reuse meeting and registrant ProviderOperations with stable identities |
| `provisioning` | `ready_to_notify` | all required meeting, registrant, and protected portal operations are `complete` | persist provider readback and ready version |
| `provisioning` | `partial_failure` | at least one operation fails while another completes | record exact failed operation set; send no household notice naming an unready Student |
| `provisioning` | `failed` | every required path is permanently rejected or exhausts safe retry | store `failed_stage=provisioning`; no false ready state |
| `provisioning` | `acceptance_unknown` | any dispatched effect has unknown acceptance | quarantine the saga until provider reconciliation |
| `ready_to_notify` | `notifying` | approved 30-minute reminder trigger or explicit Admin send | queue one account-owner reminder per household and Student in-app notices using bound versions |
| `notifying` | `complete` | every required notice is accepted/read back or explicitly suppressed by current policy | persist per-recipient terminal disposition |
| `notifying` | `partial_failure` | some required notice fails while another completes | preserve successful receipts and exact failed recipients |
| `notifying` | `failed` | every required notice is permanently rejected or exhausts safe retry | store `failed_stage=notifying`; prepared in-app/class access remains valid |
| `notifying` | `acceptance_unknown` | any send has unknown acceptance | quarantine unknown sends and do not duplicate them |
| `partial_failure` | `provisioning` or `notifying` | Admin or reconciler retries the recorded failed stage | reuse the same logical operation identities and completed effects |
| `failed` | `validating`, `provisioning`, or `notifying` | Admin authorizes retry after correcting the recorded `failed_stage` | transition only to the exact recorded stage; retain prior evidence |
| `acceptance_unknown` | `provisioning` or `notifying` | reconciler proves the effect absent and retry safe | reuse the same idempotency key and request hash |
| `acceptance_unknown` | `ready_to_notify` or `complete` | reconciler proves the effect accepted and current | record provider evidence before advancing |
| `invalidated` | `draft` | system creates a replacement saga version | preserve old version as non-executable history |
| any state except `complete` or `canceled` | `canceled` | Admin cancels occurrence or obsolete saga | revoke unconsumed grants/intents and queue exact cleanup operations for created temporary resources |

`complete` and `canceled` are terminal for that saga version. A later schedule/roster change creates a new version rather than reopening terminal history.

Rules:

1. Preview records the exact occurrence, roster, recipients, consent/access checks, and content of the proposed account-owner email.
2. A schedule, roster, recipient, consent, or access change invalidates the preview and confirmation.
3. Confirmation is an explicit Admin action bound to the preview version.
4. Meeting and registrant operations use stable provider idempotency keys.
5. Concurrent confirmations converge on one saga.
6. No household notification is sent until every Student named for that household has an active registrant and protected portal state.
7. A partial provider result never silently omits a Student from an already approved email.
8. Retry preserves the same logical operation identity.
9. Acceptance-unknown work is quarantined for provider reconciliation.
10. Email failure does not revoke already prepared in-app access; it is visible and retryable.

The canonical scheduler creates or resumes preparation 24 hours before scheduled start. An Admin may start preparation earlier. Automatic preparation uses the same saga and may not bypass preview-version, provider-idempotency, consent, or authorization invariants. The approved reminder trigger is 30 minutes before scheduled start. Preparation alone does not invent communication authority.

## 10. Content and learning library

### 10.1 ContentSource

Both app upload and Drive intake create a `ContentSource`:

- opaque source identifier;
- source kind `app_upload` or `drive`;
- capture method `obs`;
- private storage/provider reference or digest;
- S3 bucket/key digest, object-version identifier, KMS key-version reference, and durable checksum-readback receipt;
- display filename;
- MIME/container metadata;
- byte count;
- SHA-256 checksum;
- received and stable timestamps;
- matched occurrence and match confidence;
- occurrence identifier embedded in the approved filename or metadata plus Admin match confirmation;
- OBS recording start/stop timestamps and recording Admin;
- source-retention deadline;
- validation state.

One checksum within the product maps to one canonical source object. Repeated app/Drive discovery links to the existing source rather than starting duplicate processing. Zoom cloud recording is not a valid launch source.

### 10.2 RecordingParticipantSnapshot

One immutable `RecordingParticipantSnapshot` exists per occurrence/Student who was eligible for or participated during the OBS capture. It records:

- Student, household, occurrence, roster version, and OBS capture interval;
- merged validated Zoom/embedded participation intervals intersecting the capture interval;
- `service_account` consent actor kind/adult identity/type/version/accepted time;
- `recording_participation` consent actor kind/adult identity/type/version/accepted or withdrawn time;
- `member_recognition` actor kind/adult identity/choice/version/time;
- Student lifecycle, enrollment, access, and session versions checked at join;
- safe display attribution in effect at capture;
- evidence source and Admin confirmation;
- recognition state `allowed`, `anonymous`, or `withdrawn`;
- redaction state `not_required`, `required`, `in_progress`, `complete`, or `restricted`;
- immutable creation time and audit reference.

The snapshot does not claim that camera or microphone media was transmitted when provider evidence cannot establish it. Missing, stale, or contradictory recording-consent evidence blocks live launch and later publication.

### 10.3 ContentParticipant

Each `ContentVersion` has a `ContentParticipant` record for every Student whose name, image, voice, private remark, question, or other identifying information appears or may appear in that version. It records:

- ContentVersion, source, occurrence, and Student;
- source `RecordingParticipantSnapshot`;
- exact or conservative media/transcript participation intervals;
- consent type/version/time applicable to capture;
- recognition state;
- required redaction actions `cut`, `mute`, `blur`, `transcript_redaction`, `worksheet_redaction`, or `none`;
- redaction state and reviewing Admin;
- replacement-version and privacy-case references when applicable.

The participant set is produced using roster/provider evidence plus automated detection and Admin review; automation never clears a participant by itself. A missing participant snapshot, unresolved possible participant, or required redaction not marked `complete` blocks approval and publication.

### 10.4 ContentItem and immutable versions

`ContentItem` is the stable library identity. Material revisions are immutable `ContentVersion` records containing:

- source and occurrence;
- trim decision;
- compressed/resized derivative;
- English transcript and captions;
- worksheet/review draft;
- future knowledge-base draft;
- transcode profile version;
- transcription provider/model, glossary/context-prompt, and prompt version;
- worksheet/review/knowledge model, Structured Output schema, and prompt versions;
- participant-set version and redaction-review result;
- title, description, topic, date, and structured Mishnah references;
- private Vimeo projection;
- approval actor/time;
- publication actor/time;
- checksums and provider-reference digests.

Editing an approved or published item creates a new version. Approval and publication always point to an immutable version.

Before an Admin may approve a version, the transcript, captions, worksheet, review material, and knowledge artifact must remove or replace:

- full Student names except an explicitly permitted safe attribution;
- Student usernames, adult contact information, and provider aliases;
- sensitive personal or household information;
- private or unapproved Student remarks and questions;
- any content marked for cut, mute, blur, or text redaction by `ContentParticipant`.

Automation may propose redactions, but an Admin must inspect the media and every member-visible text artifact and attest that all required redactions are complete. Approval without that attestation is invalid.

### 10.5 Assignment and playback

`ContentAssignment` links a published ContentVersion to the canonical class and eligible Students. Eligibility is derived from:

- current Student lifecycle;
- household;
- canonical series enrollment;
- household access;
- publication state;
- explicit revocation.

`PlaybackGrant` expires five minutes after issue and is bound to Student, session, content version, assignment, access version, and expiry. It requires derived `playback_authorization`; it does not require current `recording_participation` or `member_recognition` consent. The browser receives an authorized One Time playback surface, not a durable raw Vimeo URL.

Resume playback stores only the Student/content/version position and update timestamp. It is private to that Student and may not leak sibling activity.

### 10.6 Library search

The canonical search document is derived from the approved published version and contains:

- title;
- approved, human-reviewed, redacted English transcript text;
- occurrence date;
- class/topic;
- structured Mishnah references when supplied and approved.

Draft or unpublished text is not Student-searchable. Search results always recheck authorization before returning metadata or playback actions.

## 11. Questions, support, learning events, badges, and leaderboard

### 11.1 StudentQuestion

`StudentQuestion` contains:

- Student and occurrence/class context;
- private body;
- lifecycle state;
- private Rabbi/Admin answer;
- moderation/publication projection;
- timestamps, version, and audit references.

The body and private answer are visible only to that Student and authorized Admins. They are absent from Parent routes, Parent exports, GHL, general logs, and ordinary Telegram payloads.

An approved/published representation is a separate moderated artifact. It contains only approved text and the current class-member attribution: first name plus last initial or a separately approved safe display name with current `member_recognition`; otherwise the same stable class-scoped nonidentifying alias used by the leaderboard.

### 11.2 SupportCase

Support cases record:

- requester kind `adult` or `student`;
- scoped adult/household/Student reference;
- category, severity, private body, and safe summary;
- lifecycle state;
- assigned Admin;
- adult GHL conversation reference only when requester is adult;
- internal Telegram notification reference;
- version, timestamps, and audit.

A Student support case remains in One Time and never creates a Student GHL contact or conversation.

### 11.3 LearningEvent

Learning inputs are append-only:

- scheduled attendance completion;
- first `answered_private`-or-`approved_for_class` event for a unique StudentQuestion;
- completed review event;
- Admin correction/revocation.

Each event has Student, class/content context, event time, idempotency key, source, and audit reference.

A completed review event is unique by Student and Admin-published review item. The first authenticated submit/mark-complete action creates it; correctness and score are not prerequisites, and repeat opens or submissions do not increment it. Admin correction or revocation requires a reason and audit event.

A question-recognition LearningEvent is unique by StudentQuestion and Student. It is emitted once, at the first transition into `answered_private` or `approved_for_class`. A later transition to `approved_for_class`, `published`, republication, or answer edit never creates another count. An Admin correction or revocation appends a correction/revocation event and deterministically recalculates affected badges and rolling leaderboard categories without deleting the original event.

### 11.4 Badges

Launch badges are fixed configuration:

| Badge family | Level I | Level II | Level III |
|---|---:|---:|---:|
| Consistency | 5 consecutive scheduled attendances | 20 | 60 |
| Curious Learner | 1 unique question reaching `answered_private` or `approved_for_class` | 5 | 15 |
| Review Ready | 1 completed review event | 4 | 12 |

Badge awards are derived from canonical LearningEvents and stored as an auditable projection. A correction recalculates the projection; it does not delete the source event. There is no currency, redemption, catalog, or Admin-editable badge rule.

### 11.5 Leaderboard

The leaderboard has three separate rolling-30-day categories:

- attendance count;
- current attendance streak;
- unique question-recognition events.

It has no combined score. Every otherwise eligible Student remains ranked regardless of `member_recognition`. On the Student’s own authenticated view, their row label is exactly `You`. Peers see first name plus last initial or a separately approved safe display name only with current `member_recognition`; otherwise they see a stable class-scoped nonidentifying alias such as `Anonymous Student • A7`.

The alias mapping is a server-generated opaque projection unique within the class, stable across that class’s leaderboard, member-visible badges, and approved-question attribution, and not reusable across classes or derived from a name, username, email, household, rank, or public hash. Consent decline or withdrawal immediately invalidates named-attribution caches and swaps the alias without deleting or changing rank, event counts, progress, or badge facts. Ties share a rank and the next rank uses competition ranking. Admin views may show full actual names. There is no public leaderboard.

## 12. In-app notifications

`InAppNotification` contains:

- recipient kind `parent` or `student`;
- exact recipient account/Student;
- event type;
- title and safe body;
- protected same-origin action;
- created, available, read, expired, and archived timestamps;
- idempotency key.

Rules:

- Parent notices contain Parent-authorized information only;
- Student notices contain only that Student’s information;
- unread count is derived from unread durable notices;
- an audible cue may play only while the Student portal is open and browser policy permits;
- there is no background push/PWA subscription at launch;
- absence of WhatsApp cannot delay or invalidate in-app or email state.

## 13. Provider operations, jobs, and audit

### 13.1 ProviderOperation

Every logical external effect has one durable `ProviderOperation`:

- operation type and aggregate reference;
- provider, `runtime_tier`, and `verification_environment_id`;
- stable idempotency key;
- canonical request hash;
- state;
- attempt count, recovery generation, next-attempt time, and unknown-effect flag;
- lease owner/generation/expiry;
- provider acceptance digest;
- provider readback/reconciliation digest;
- safe error code;
- timestamps and audit.

`accepted` means the provider has durably acknowledged or readback has proven the external effect, but required local readback/application is not finished. `complete` means provider acceptance, canonical readback, local projection/application, and durable audit all agree. A UI may not display a completed provider effect while the operation is merely `accepted`.

Allowed transitions:

| From | To | Actor/condition | Required effects |
|---|---|---|---|
| none | `not_started` | local aggregate transaction | persist intent, canonical request hash, stable idempotency key, and source version before dispatch |
| `not_started` or `retry_wait` | `leased` | worker claims due work with fewer than eight dispatch attempts | create five-minute lease with new fencing generation |
| `leased` | `in_flight` | owning worker immediately before dispatch | increment dispatch attempt; persist dispatch timestamp |
| `leased` | `retry_wait` | owning worker releases before dispatch | prove no provider request occurred; compute safe jittered retry |
| `in_flight` | `accepted` | verified provider response proves acceptance but local completion/readback remains | persist acceptance digest before further work |
| `in_flight` | `complete` | one response/readback atomically proves acceptance and all required local effects finish | persist provider and local readback/audit |
| `in_flight` | `rejected` | verified permanent provider response proves the effect was not accepted | persist safe rejection; no blind retry |
| `in_flight` | `retry_wait` | provider explicitly proves non-acceptance and a retry is safe | preserve the same idempotency key/hash and schedule backoff |
| `in_flight` or expired `leased` after possible dispatch | `acceptance_unknown` | timeout, lost response, or stale worker could have reached provider | set unknown-effect flag; quarantine all mutating retry |
| `accepted` | `complete` | reconciler/worker completes canonical readback and local application | retain original acceptance evidence |
| `acceptance_unknown` | `accepted` or `complete` | reconciler proves the exact effect exists and matches | record readback before advancing |
| `acceptance_unknown` | `retry_wait` | reconciler proves the exact effect does not exist and same-key retry is safe | clear unknown-effect flag; retain reconciliation evidence |
| `acceptance_unknown` | `rejected` | reconciler proves the provider permanently rejected the exact effect and no effect exists | persist canonical rejection/readback evidence; no retry |
| `acceptance_unknown` | `dead_letter` | eight bounded reconciliation/dispatch attempts cannot establish a safe result | retain unknown-effect flag and block any new mutating operation for the same logical effect |
| `retry_wait` | `dead_letter` | eight dispatch attempts are exhausted | persist failure summary and require governed recovery |
| `not_started`, `leased`, or `retry_wait` | `canceled` | authorized aggregate change makes an undispatched intent obsolete | fence leases and prove no accepted effect |
| `dead_letter` | `not_started` | Admin authorizes recovery after correcting the recorded cause | increment recovery generation, reset its attempt count, and preserve the same logical idempotency key/request hash |

`complete`, `rejected`, and `canceled` are terminal for that operation version. An accepted effect is never rewritten as canceled. If the accepted resource must be undone, the original operation completes and a separate, idempotent compensation/cleanup `ProviderOperation` targets its exact provider resource.

Worker rules are exact:

- a lease lasts five minutes;
- the owning worker heartbeats every 60 seconds and may renew only while its generation remains current;
- a stale generation cannot persist a result;
- each recovery generation permits at most eight dispatch attempts;
- safe retry uses full jitter uniformly from zero to `min(30 minutes, 30 seconds × 2^(attempt−1))`;
- attempt exhaustion enters `dead_letter`;
- `acceptance_unknown` is reconciled without blind retry, even when a normal retry would otherwise be due.

### 13.2 AuditEvent

Material actions create append-only AuditEvents containing:

- event type and immutable event identifier;
- actor kind and opaque actor identifier;
- aggregate type/id and version before/after;
- request/correlation and idempotency references;
- timestamp;
- safe reason;
- redacted structured metadata;
- provider operation reference when applicable.

Audit must cover account and credential lifecycle, ownership transfer, consent, Student activation/archive, seat-limit changes, access changes, class schedule/preparation, provider actions, attendance corrections, content approval/publication, question moderation, support replies, communication launch/pause, billing reconciliation, export, and deletion.

Passwords, tokens, raw provider URLs, raw secrets, full private Student questions, and unnecessary message bodies are forbidden in audit metadata.

### 13.3 DataRightsRequest

`DataRightsRequest` contains:

- request kind `export`, `correction`, `closure`, `erasure`, or `consent_withdrawal`;
- subject scope `adult`, `household`, or exact `student`;
- requester kind `account_owner`, `adult_self_student`, or authorized Admin/legal reviewer;
- relationship evidence `self` or `dependent` when the subject is a Student;
- recent-password reauthentication/session evidence;
- internal state `received`, `identity_verified`, `approved`, `executing`, `provider_pending`, `completed`, `denied`, `failed`, or `canceled`;
- exact requested data categories, exclusions, and legal-retention exceptions;
- provider-operation set and per-provider status;
- due date, completion/denial reason, version, and audit references.

Allowed progression is `received -> identity_verified -> approved -> executing -> provider_pending -> completed`; `executing` may go directly to `completed` when no provider work remains. A terminal first-party execution error may move `executing -> failed`; a provider-pending case may move to `failed` only after canonical reconciliation proves a terminal noncompletion and no effect remains uncertain. Only an authorized privacy Admin may move `identity_verified -> denied`, with a recorded reason. The authenticated requester may move `received` or `identity_verified` to `canceled`. Every other transition is denied. Provider timeout or uncertain effect remains `provider_pending`; it never yields a false completion.

Requester-visible active status is derived and has exactly five values:

| Internal state/evidence | Requester-visible status |
|---|---|
| `received`, `identity_verified`, or `approved` | `requested` |
| `executing` | `processing` |
| `provider_pending`, or `completed` with a permitted legal/provider exception | `partially_excepted` |
| `completed` with no remaining exception | `completed` |
| `denied` or `failed` | `failed` |

`canceled` is a requester action outcome, not an active status value; its detail view may show a non-status “Request canceled” confirmation. No internal state name or other status token is requester-visible.

### 13.4 DeletionPurgeRecord

Approval of an erasure request writes one append-only `DeletionPurgeRecord` to the independent purge ledger before primary-data deletion begins. It contains only:

- keyed hashes of adult, household, Student, content, and provider subject identifiers;
- erasure request and policy-version hashes;
- exact category/provider tombstones;
- effective deletion timestamp;
- required replay-until timestamp;
- legal-retention exception codes;
- ledger sequence, integrity digest, and prior-record digest.

It contains no names, email addresses, question/support bodies, credentials, media, or raw provider IDs. The ledger is outside primary database backups and follows the immutable storage/replication contract in `13-OPERATIONS-SLO-DR-INCIDENT-v2.1.md`. Restore cannot admit traffic until every ledger tombstone newer than the restored point has been replayed and verified.

## 14. State-transition tables

### 14.1 Human account

| From | To | Authorized trigger | Required effects |
|---|---|---|---|
| none | `active` | valid fresh public Family signup submits its password | create the sole AdultPerson-linked account with `parent` membership and versioned password hash atomically; create no setup token or setup email |
| none | `invited` | Admin/legacy invitation, ownership-transfer acceptance for an unclaimed identity, or other approved passwordless claim flow | create the sole AdultPerson-linked account with nonempty membership set; one current seven-day setup token; prior unused token invalidated |
| `invited` | `active` | adult accepts setup | password stored; token consumed; setup audit |
| `invited` | `archived` | Admin cancels identity | token invalidated; login denied |
| `active` | `disabled` | Admin suspension | sessions revoked; login denied |
| `disabled` | `active` | Admin reactivation | security version advances; fresh login required |
| `active` or `disabled` | `archived` | Admin/account closure | sessions and tokens revoked; retained history |

`archived` has no direct login restoration. A later return requires an audited Admin reactivation decision and fresh setup transaction that preserves the prior identity/history rather than creating a duplicate adult.

Adding or removing an allowed role membership does not change lifecycle state. It is a separately authorized, version-checked mutation that rotates all adult sessions. Adding `parent` during an accepted household transfer is idempotent. The final active `admin` membership and a `parent` membership that still owns a household cannot be removed.

An active `self` Student move between households owned by the same adult does not change Student lifecycle state and follows §5.4. Household ownership transfer is denied until its `self`-Student and dependent-consent preconditions in §4.4 are satisfied.

### 14.2 Student

| From | To | Trigger | Preconditions/effects |
|---|---|---|---|
| none | `active` | Parent/Admin creates Student | effective access is `free`, `active`, or `grace`; seat available; current `service_account` acceptance; relationship/authority recorded; credentials set; enrollment active |
| `active` | `archived` | Parent/Admin archives | credential disabled; sessions/grants revoked; enrollment revoked; seat freed |
| `archived` | `active` | Parent/Admin restores | effective access is `free`, `active`, or `grace`; seat available; current `service_account` acceptance; credential restored/reset; enrollment restored |

### 14.3 Effective access

| From | To | Canonical cause |
|---|---|---|
| none or `inactive` | `free` | valid free-period source |
| `free` | `active` | verified paid/contract/complimentary source becomes effective |
| `free` | `inactive` | free expiry without another grant |
| `active` | `grace` | verified renewal failure atomically invalidates winning paid source and creates one seven-day grace source |
| `grace` | `active` | verified recovery creates a newer winning paid source and closes grace |
| `grace` | `inactive` | seven-day grace expiry without recovery |
| `active` | `inactive` | paid period ends, contract expires, or block wins |
| `inactive` | `active` | verified reactivation or approved contract/complimentary source |
| any | `inactive` | archived household or administrative block |

### 14.4 Class occurrence

| From | To | Trigger |
|---|---|---|
| none | `scheduled` | recurrence generation or Admin schedule |
| `scheduled` | `preparing` | preparation saga starts |
| `preparing` | `ready` | meeting, roster registrants, and portal state complete |
| `ready` | `live` | Admin opens class or verified host start; protected join may be issued from ten minutes before start when all current checks pass |
| `live` | `completed` | Admin/host closes class, or automatic close at scheduled end plus 15 minutes/current Admin extension |
| `scheduled`, `preparing`, or `ready` | `canceled` | Admin cancellation |
| `canceled` | `scheduled` | audited restore before live start; old provider grants revoked |

`completed` is terminal. A rescheduled canceled occurrence creates or restores schedule truth with a new schedule version; old launch grants remain revoked.

### 14.5 Content

| From | To | Trigger |
|---|---|---|
| none | `received` | completed app upload or stable Drive discovery |
| `received` | `validating` | intake worker claim |
| `validating` | `processing` | source accepted and occurrence matched |
| `processing` | `needs_review` | derivative, transcript, captions, and drafts complete |
| `needs_review` | `approved` | Admin approves immutable version |
| `approved` | `publishing` | Admin publishes |
| `publishing` | `published` | Vimeo and One Time readback agree |
| `validating` | `failed` | validation failure; record `failed_from=validating` and safe reason |
| `processing` | `failed` | transcode/transcription/draft failure; record `failed_from=processing` and safe reason |
| `publishing` | `failed` | Vimeo/publication failure; record `failed_from=publishing` and safe reason |
| `failed` | `validating` | governed retry only when `failed_from=validating`; reuse source identity |
| `failed` | `processing` | governed retry only when `failed_from=processing`; reuse source, model/prompt/schema versions unless a new ContentVersion is explicitly created |
| `failed` | `publishing` | governed retry only when `failed_from=publishing`; reuse the same publication operation identity |
| `published` | `approved` | Admin unpublishes; playback grants revoked |
| `received`, `needs_review`, `approved`, `published`, or `failed` | `archived` | Admin archive; revoke playback/publication and apply exact retention/provider cleanup policy |

`failed_from` is required in `failed`; no retry target is inferred from current UI or error text. No source becomes Student-visible before `published`.

### 14.6 Student question

| From | To | Trigger |
|---|---|---|
| none | `submitted` | Student submission |
| `submitted` | `answered_private` | Admin/Rabbi private answer |
| `submitted` or `answered_private` | `approved_for_class` | Admin/Rabbi moderation |
| `approved_for_class` | `published` | Admin/Rabbi publishes moderated artifact |
| nonterminal | `declined` | Admin/Rabbi declines |
| `answered_private`, `published`, or `declined` | `closed` | Admin/Rabbi closes |

### 14.7 Support

| From | To | Trigger |
|---|---|---|
| none | `open` | adult or Student submission |
| `open` | `in_progress` | Admin begins work |
| `in_progress` | `waiting_on_requester` | governed reply/request |
| `waiting_on_requester` | `in_progress` | requester response |
| `open`, `in_progress`, or `waiting_on_requester` | `resolved` | Admin resolution |
| `resolved` | `in_progress` | audited reopen |
| `resolved` | `closed` | closure |

## 15. Cross-aggregate transactional invariants

The following operations are atomic:

1. fresh adult signup local AdultPerson/HumanAccount, Parent role membership, household ownership, time-derived `free` or `inactive` access, authenticated session, and durable GHL projection/welcome outbox creation; it creates no invitation or setup-token intent;
2. Student activation/restoration, seat enforcement, credential state, canonical enrollment, and audit;
3. Student archive, enrollment revocation, credential disable, session/grant revocation, and seat release;
4. household ownership-transfer precondition/consent recheck, owner change, old-owner session/grant revocation, and provider-reassociation intent;
5. access-event receipt, precedence decision, projection update, and necessary Student-session revocation;
6. class-preparation confirmation and immutable recipient/suppression/version readback binding;
7. question moderation state and creation of any publishable artifact;
8. content approval/publication pointer changes and playback authorization state;
9. consent acceptance/withdrawal and the resulting scoped authorization projections;
10. erasure approval, independent purge-ledger append, and creation of exact provider-deletion operations;
11. recording-participant snapshot confirmation and binding to the occurrence/content participant set;
12. content approval and proof that every required participant/text redaction is complete.

An external provider call is never held open inside a database transaction. The transaction commits the intent; a durable ProviderOperation performs and reconciles the external effect.

## 16. Forbidden legacy/runtime states

Production must reject or omit:

- legacy roles or role labels as authorization values;
- a second HumanAccount for the same AdultPerson/normalized email;
- an active role context not present in the HumanAccount membership set;
- Student email, phone, GHL contact, or GHL conversation;
- Student date of birth, age, age band, grade, or Hebrew-specific field;
- co-guardian or simultaneous second Parent ownership;
- completed ownership transfer with an active outgoing-owner `self` Student still in the household, any automatic `self`-to-`dependent` conversion, or a dependent Student lacking the replacement owner’s current authority and required consent;
- Parent access to Student class, library, recording, question, or Rabbi answer;
- Parent Learner Mode;
- a public Student signup;
- a school-specific role, portal, bulk roster, or organization administrator;
- manual enrollment approval for the canonical launch class;
- a shared household Zoom registrant;
- Zoom cloud recording at launch;
- durable classroom bearer tokens or raw provider URLs;
- publication with a missing RecordingParticipantSnapshot, incomplete ContentParticipant review, or unresolved required redaction;
- requiring `recording_participation` or `member_recognition` consent for otherwise authorized library playback;
- fictional/demo/test customer records;
- preview/test-lab/Class Helper/Buffer/favorites/PWA-push domain states;
- editable launch badge thresholds or redeemable reward balances;
- any projection that independently grants billing, access, consent, or provider authority.
