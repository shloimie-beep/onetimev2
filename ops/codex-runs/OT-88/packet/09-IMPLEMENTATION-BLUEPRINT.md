# OT-88 Implementation Blueprint

This blueprint is framework-neutral. The Codex run must map it to the One Time repository’s existing architecture rather than imposing these names verbatim.

## Bounded contexts

### 1. Entitlement and learner seats

Responsibilities:

- resolve the $67 family product by stable product code;
- manage up to three named active learner seats;
- enforce concurrent seat limit;
- expose server-side eligibility decisions;
- react to suspension/revocation/billing changes.

### 2. Class schedule

Responsibilities:

- timezone-aware series at 19:00 `Asia/Jerusalem`;
- occurrence generation and immutable snapshots;
- join/reminder windows;
- cancellation/supersession;
- safe next-class projection.

### 3. Classroom launch

Responsibilities:

- launch authorization;
- opaque one-use grant;
- view selection;
- dedicated no-store bootstrap;
- Meeting SDK lifecycle;
- failure mapping;
- leave/rejoin.

### 4. Questions and moderation

Responsibilities:

- short learner question;
- encryption/redacted preview;
- rate/idempotency/moderation state;
- OT-84 alert outbox;
- Rabbi actions and deep link;
- learner-safe own projection;
- disabled Zoom feature port.

### 5. Attendance

Responsibilities:

- application attempt lifecycle;
- minimized client events;
- optional provider reconciliation;
- privacy-preserving summaries.

### 6. Provider readiness and canary

Responsibilities:

- Zoom configuration/readiness assessment;
- SDK/account/meeting/registration/UI privacy checks;
- provider-off and test canary modes;
- feature flags/circuit state;
- sanitized evidence.

## Suggested module seams

```text
classroom/
  domain/
    entitlement-policy
    occurrence-policy
    launch-grant
    attendance-attempt
    failure-state
    provider-readiness
  application/
    get-next-class
    issue-launch-grant
    consume-launch-grant
    record-attendance-event
    leave-classroom
  adapters/
    persistence
    zoom
    clock
    rate-limit
    audit
  web/
    safe-portal-routes
    isolated-launch-route
    classroom-shell

questions/
  domain/
    question
    moderation-transition
    preview-redaction
  application/
    submit-question
    list-own-questions
    apply-telegram-action
    issue-moderator-link
  adapters/
    persistence
    ot84
    encryption
    outbox

reminders/
  application/
    find-due-class-reminders
    evaluate-eligibility
    deliver-intent
  adapters/
    sink
    approved-delivery
```

Reuse existing folders, dependency injection, service objects, events, and naming.

## Ports

### `ZoomMeetingLaunchPort`

Conceptual interface:

```text
prepareParticipantLaunch(input): Result<ZoomParticipantLaunch, ZoomLaunchFailure>

input:
  providerMeetingApplicationId
  providerRegistrantApplicationId?
  learnerDisplayName
  selectedView
  occurrenceId
  attendanceAttemptId

output (server-restricted):
  sdkClientIdOrKey
  participantSignature
  meetingNumber
  passcode
  registrantToken?
  safeLeaveUrl
  sdkVersion/configVersion metadata
```

Rules:

- input uses application IDs, not browser-supplied provider values;
- role fixed to `0` inside adapter;
- decrypts only in bounded operation;
- no raw join URL output;
- no host credentials;
- errors normalized without raw bodies;
- output object is marked sensitive/non-loggable where language supports it.

### `ZoomRegistrantPort`

```text
ensureLearnerRegistrant(meetingAppId, learnerSeatId, mode)
  -> ActiveRegistrantRef | RegistrationUnsupported | RegistrationFailure
```

Production mutation implementation remains disabled by default. Read/verify existing test configuration or use a deliberate test-account canary. If a response has a provider join URL, extract the token in memory, encrypt the token, discard the URL.

### `ZoomProviderReadinessPort`

Checks:

- secret references present and readable by service role;
- current SDK version policy;
- host account/app authorization relationship;
- provider meeting mapping;
- registration mode and per-learner identity;
- client-view privacy controls;
- component-view privacy/capability controls;
- canary evidence freshness;
- circuit/provider health.

Returns detailed internal assessment plus a coarse learner projection.

### `ZoomAttendanceReconciliationPort`

Disabled unless provider webhook/report signature and identity correlation are proven. It accepts a minimal provider event and returns a mapped application attempt fact. It must drop unrelated fields immediately.

### `ZoomFeatureParticipantPort`

```text
featureSelectedQuestion(input)
  -> UnsupportedDisabled
```

No Zoom call in V1.

### `QuestionAlertPort`

Uses OT-84 established gateway. Input includes only:

- alert intent ID;
- opaque question ID;
- safe occurrence label/time;
- redacted preview;
- authorized recipient reference;
- action contract version; and
- idempotency key.

### `ReminderDeliveryPort`

Sink/default implementation records safe delivery metadata. Real adapter requires external-delivery flag and explicit canary/production policy, outside broad OT-88 verification.

## Application services

### `GetNextClass`

Inputs: authenticated session, server time.  
Output safe projection:

```json
{
  "occurrenceId": "opaque-application-id",
  "startsAt": "ISO instant",
  "localDate": "YYYY-MM-DD",
  "localTime": "19:00",
  "timeZone": "Asia/Jerusalem",
  "readiness": "READY | PREPARING | TEMPORARILY_UNAVAILABLE",
  "canJoin": true,
  "joinAvailability": "OPEN | TOO_EARLY | ENDED | NOT_ELIGIBLE",
  "questionSummary": {
    "canSubmit": true,
    "ownStates": []
  }
}
```

No household ID is needed unless the existing portal contract already exposes a safe one. No provider field.

### `IssueLaunchGrant`

Input: authenticated learner session, occurrence opaque ID, idempotency key.  
Steps:

1. resolve learner from session;
2. resolve active seat/entitlement;
3. authorize occurrence/product/window/revocation/readiness;
4. apply rate limit;
5. allocate attendance attempt;
6. create CSPRNG grant and digest;
7. persist atomically with idempotency mapping;
8. audit allow/deny;
9. return opaque launch route and expiry.

Safe response:

```json
{
  "launchPath": "/classroom/launch/<opaque-handle>",
  "expiresAt": "ISO instant"
}
```

The path does not contain Zoom data. Prefer a separate bearer secret in a secure fragment/body/cookie mechanism if repository routing permits; do not reduce entropy or leak through referrers. The final mechanism must be threat-modeled and tested.

### `ConsumeLaunchGrant`

Input: same-origin authenticated request, grant bearer, CSRF/origin/session context.  
Steps:

1. locate by opaque handle/digest without logging bearer;
2. verify `ISSUED` and unexpired;
3. re-resolve learner/session and all live policy;
4. choose view/fallback before provider resolution where possible;
5. compare-and-set grant to `CONSUMED` and mark attempt bootstrapping;
6. resolve encrypted provider meeting/registrant;
7. generate participant SDK signature;
8. create no-store sensitive bootstrap;
9. audit with no sensitive values;
10. on provider failure, preserve terminal consume semantics and require new grant for retry unless the implementation can safely retry within the same server operation before response.

The bootstrap schema may use the SDK’s exact names internally. Do not place a sample token/value in docs or fixtures. Mark fields as sensitive in types.

### `RecordAttendanceEvent`

- binds session learner to attempt;
- allowlisted event enum/schema;
- idempotency/sequence;
- server timestamp authoritative;
- state-machine validation;
- no arbitrary metadata.

### `SubmitQuestion`

- active learner/seat/entitlement/occurrence authorization;
- content normalization/length/shape;
- rate/idempotency;
- encrypt original;
- generate redacted preview;
- transaction: question + audit + OT-84 outbox;
- return own safe projection.

### `ApplyQuestionModerationAction`

- verifies Rabbi/OT-84 actor mapping;
- locks question/current featured selection;
- idempotent state transition;
- `FEATURE_NEXT` calls disabled port and records instruction;
- emits learner-safe state update and audit;
- never sends question to Zoom.

### `ScheduleClassReminders`

- query due occurrence T-30 instants;
- evaluate current eligibility/opt-in/destination;
- insert unique intent;
- sink/external adapter through outbox;
- no launch/provider data in copy.

## View selection algorithm

```text
function selectMeetingView(client, config, verifiedCapabilities):
    if client.isMobileOrTablet:
        return CLIENT

    if not config.zoomComponentViewEnabled:
        return CLIENT_FALLBACK

    if not client.desktopBrowserSupported:
        return CLIENT_FALLBACK

    if not verifiedCapabilities.sdkVersionSupported:
        return CLIENT_FALLBACK or DISABLED according to compatibility

    if not verifiedCapabilities.componentRequiredFeatures:
        return CLIENT_FALLBACK

    if not verifiedCapabilities.inviteSuppressed:
        return CLIENT_FALLBACK

    if not verifiedCapabilities.meetingInfoCredentialsSuppressed:
        return CLIENT_FALLBACK

    if not verifiedCapabilities.accessibilityRtlPermissionReconnectCanary:
        return CLIENT_FALLBACK

    return COMPONENT
```

The decision is server-assisted/config-backed and must not rely only on a spoofable user-agent. Client capability checks refine it, but unknown is fallback.

## Classroom shell state machine

```text
IDLE
  -> AUTHORIZING
  -> GRANT_ISSUED
  -> LAUNCH_LOADING
  -> BOOTSTRAPPING
  -> WAITING | JOINING
  -> JOINED
  -> RECONNECTING -> JOINED
  -> LEFT | ENDED | FAILED
```

Rules:

- provider bootstrap exists only between `BOOTSTRAPPING` and SDK invocation;
- terminal transitions unmount/destroy SDK and clear references;
- `LEFT`, `ENDED`, `FAILED` cannot transition directly to `JOINING`; return to portal/new grant;
- app-owned status remains usable when provider UI is waiting/reconnecting;
- questions may remain in the portal shell or a safe companion surface but never receive provider credentials.

## Client-view integration

Use the installed official package. Verify exact API/types. The intended policy is equivalent to:

- full-page launch document;
- invite disabled;
- meeting header hidden;
- Zoom chat disabled;
- recording controls disabled;
- call-out/phone invite disabled;
- safe One Time leave URL;
- supported language/locale;
- provider errors mapped into app state where the SDK exposes callbacks;
- no generic console logging of SDK arguments/errors.

If client view’s injected DOM conflicts with the main application, isolate it in a dedicated document/iframe following current official guidance. Do not solve CSS collision by moving secrets into URL/HTML.

## Component-view integration

- desktop only;
- instantiate in a dedicated component root;
- include only needed components/toolbar controls;
- customize or omit meeting-info surfaces;
- verify no invite/copied URL control;
- subscribe only to required events (`connection-change`, join speed, local network, leave/end) and drop participant-wide payloads;
- do not subscribe/store chat/captions/participant list unless a documented app requirement exists—none exists for V1;
- on init/capability failure, destroy and use a fresh-grant client fallback path.

## Failure adapter

Normalize provider SDK/API errors immediately:

```text
Zoom raw code/error
  -> Zoom adapter category
  -> Classroom application state
  -> learner-safe copy / operations action
```

Raw provider message/body does not escape the adapter. Numeric code may be retained in a restricted field for debugging if safe.

## Persistence/migration rollout

Suggested order:

1. class/entitlement/seat constraints or adapters to existing tables;
2. occurrences and provider readiness/mapping;
3. launch grants/attendance attempts/events;
4. questions/moderation/outbox;
5. reminders/outbox;
6. indexes/unique constraints/retention jobs.

Migrations must be backward compatible with flags off. Avoid long table locks; use repository conventions for staged constraints/backfills.

Backfill only application-safe data. Do not create provider registrants or send reminders during migration.

## Configuration and flags

Suggested configuration keys, adapted to project naming:

```text
ZOOM_CLASSROOM_ENABLED=false
ZOOM_COMPONENT_VIEW_ENABLED=false
ZOOM_PROVIDER_MUTATIONS_ENABLED=false
ZOOM_FEATURE_PARTICIPANT_ENABLED=false
ZOOM_CANARY_ENABLED=false
CLASS_REMINDERS_EXTERNAL_DELIVERY_ENABLED=false
CLASSROOM_JOIN_GRANT_TTL_SECONDS=90
CLASSROOM_JOIN_OPEN_OFFSET_MINUTES=-15
CLASSROOM_JOIN_CLOSE_OFFSET_MINUTES=15
CLASS_QUESTION_MAX_CHARS=<documented repository value>
```

Protected values are secret references, not plain config printed in diagnostics.

## Readiness projection

Internal detail:

```json
{
  "state": "UI_PRIVACY_UNVERIFIED",
  "checks": {
    "credentialsReferencePresent": true,
    "sdkVersionSupported": true,
    "accountAuthorizationVerified": true,
    "meetingConfigured": true,
    "registrationVerified": true,
    "clientPrivacyVerified": true,
    "componentPrivacyVerified": false,
    "canaryFresh": false
  }
}
```

Learner projection:

```json
{
  "readiness": "PREPARING",
  "canJoin": false
}
```

Never expose provider account or meeting details.

## Question state model

```text
SUBMITTED -> QUEUED
QUEUED -> FEATURE_NEXT | ANSWERED | DISMISSED | MODERATION_HOLD
FEATURE_NEXT -> ANSWERED | DISMISSED | QUEUED (explicit restore)
MODERATION_HOLD -> QUEUED | DISMISSED
ANSWERED, DISMISSED terminal for learner presentation unless repository supports audited restore
```

Learner projection can simplify to:

```text
SUBMITTED
SELECTED
ANSWERED
CLOSED
```

No moderator reason/identity or other learner ordering.

## Outbox design

Question alerts and reminders should use the repository’s transactional outbox if available.

Required properties:

- record created in the same transaction as domain state;
- stable idempotency key;
- lease/claim with timeout;
- retry with exponential backoff/jitter;
- terminal dead-letter category;
- recipient fixed from authorized configuration;
- safe payload schema;
- no broad fallback recipient;
- metrics on counts/latency/failure, no content.

## Circuit breakers and 19:00 load

The daily synchronized start creates a burst. Design for:

- idempotent grant issue;
- short server transactions;
- no provider provisioning on the critical join path if it can be prepared earlier;
- registrant/provider readiness precomputation;
- bounded adapter concurrency;
- provider circuit breaker;
- jittered retries;
- cache only safe readiness/config metadata, never provider launch material;
- database indexes on active seats, occurrences, grants, intents; and
- no thundering-herd reminder or readiness scan.

## Provider preparation jobs

Safe pre-class work may include:

- generate upcoming immutable occurrences;
- assess provider config/readiness;
- verify existing test/production meeting mapping without mutation;
- ensure encrypted registrant mapping where already permitted/configured;
- pre-warm non-sensitive SDK assets according to app policy; and
- create reminder intents at the due time.

Do not pre-mint learner launch grants or SDK JWTs. Do not send provider tokens to the browser before Join.

## Testing architecture

- pure domain tests for state/invariants;
- database concurrency tests;
- route authorization/CSRF/idempotency tests;
- fake Zoom adapter with scripted state/error events;
- recording OT-84/reminder sinks with outbound counts;
- browser e2e for shell/view/failure/question flows;
- leakage scanner with seeded sentinels;
- optional official SDK test canary;
- 30-sample performance harness;
- accessibility/RTL/reduced-motion checks.

## Rollout phases

### Phase 0 — schema and provider-off

Flags off. Migrations, domain services, fakes, authorization, question queue, and shell tests.

### Phase 1 — internal sink

Classroom shell and questions operate against deterministic sinks. No Zoom external call; no real reminders.

### Phase 2 — `READY_FOR_ZOOM_CANARY`

Safe code complete. Exact protected prerequisites listed. This is the required endpoint when credentials/settings are unavailable.

### Phase 3 — test Zoom canary

Explicit test identities/meeting/account; client view first, then desktop fallback/component if privacy gate passes.

### Phase 4 — allowlisted production observation/rollout

Not automatically authorized by OT-88. Requires separate operational approval, credentials/settings review, and product/privacy/security sign-off.

## Definition of done

- branch is based on the dynamically fetched OT-84 source;
- OT-83 portal foundation proven;
- named 3-seat entitlement enforced;
- immutable 19:00 Jerusalem occurrences and 18:30 reminders modeled;
- protected one-use launch and no normal-surface provider leakage;
- mobile client view, verified desktop component, secure fallback;
- required failure/leave/reconnect behavior;
- minimized attendance;
- One Time question queue + OT-84 actions + Rabbi-only link;
- disabled Zoom feature automation;
- provider-off/sink tests, privacy/security, 30 samples, accessibility, RTL, no-BNA-fanout evidence;
- Zoom canary or exact `READY_FOR_ZOOM_CANARY` checkpoint;
- sanitized run artifacts;
- clean push and draft PR; and
- exact final/resume report.
