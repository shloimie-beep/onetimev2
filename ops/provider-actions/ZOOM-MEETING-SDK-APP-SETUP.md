# OT-LAUNCH-01 Zoom staging real-control canary

Status: **reviewed staging-only provider-action job; not executed by this preparation task**

Job key: `OT-LAUNCH-01-ZOOM-STAGING-CANARY-01`

Assigned track: `zoom_real_control_operator_change_set`

Acceptance: `ZOOM-SDK-001`, `ZOOM-S2S-001`

This job has two mutually exclusive execution paths:

1. the historical persistent-staging replacement path, which requires verified old-target
   revocation; or
2. the operator-authorized isolated PR #105 path, which creates one new disposable meeting while
   leaving the Tisha target and every persistent-staging/production variable untouched.

It does not authorize production Zoom, the Rabbi's recurring meeting, customer participants,
notifications, a second Zoom app, or a second status model. Protected values must move only
through native provider copy controls and protected Railway variables. They must never appear in
terminal output, Git, logs, screenshots, browser snapshots, tickets, or reports.

The preparation task that wrote this job did not rotate a target, read or write a protected
value, change a Zoom/Railway setting, deploy, join a meeting, invoke Zoom, or change production.

## First external human action

For the historical replacement path, the first external action is a read-only classification of
the exposed persistent-staging class target while every real/canary gate remains off. Do not
start with deletion, rotation, the Zoom allowlist, or Railway runtime credential writes. Run the
repository classifier described below. Only `SAFE_TO_REVOKE` permits the separately controlled
revoke/replace step; `BLOCKED` means no delete, rotation, replacement, or provider mutation.

The isolated PR #105 path must not bind, inspect, read, classify, copy, clear, rotate, or delete
the persistent-staging class target or the Tisha event target. It starts from a fresh absent
protected-state file and creates one new disposable meeting only after exact-source preflight.

For the historical path only: if the operator cannot access that authoritative source, or the
old-target denial is ambiguous, stop with `PROTECTED_CLASS_TARGET_ROTATION_BLOCKED`. Clear the
staging target variable if its handling is in doubt; never restore or reuse the exposed value.

## Fixed scope

- Repository/branch/PR: `shloimie-beep/onetimev2`,
  `codex/full-app-staging-live`, PR `#97`.
- Runtime: `ONE_TIME_RUNTIME_ENVIRONMENT=isolated_staging`.
- Web origin: the historical path uses `https://ot99-web-staging.up.railway.app`; the distinct
  disposable path uses only `https://ot99-web-onetimev2-pr-105.up.railway.app`.
- Provider app: the existing admin-managed General app, `One Time Zoom Stage Host`, with Meeting
  SDK enabled. Do not create another General app.
- API app: the existing Server-to-Server OAuth app. Do not create another S2S app.
- Meeting: one disposable isolated staging meeting. Never use the Rabbi's recurring/customer
  meeting.
- People: one authorized host and fictional Student 1 only. Student 2 is used only for an
  application-layer negative scope test and must not join Zoom.
- Runtime secrets: the distinct disposable path supplies them only to its isolated private job
  and, after provisioning, only the minimum canary-specific values to the PR #105 preview.
  Persistent staging, production, and the worker receive no change from that path.
- Production, DNS, public landing, GHL, Telegram, Vimeo, email, WhatsApp, payment, and customer
  data are out of scope.

Before any mutation, pin the exact Git head and authoritative Railway service/domain/deployment
mapping. Require `/version` source fields to agree with the pinned head and require `/health` and
`/ready` to return healthy with no blockers. A stale human version label must be corrected only if
it is an explicit staging-only label; a source mismatch stops the job.

## Authoritative implementation contract

The current code enforces four provider gates before Zoom client construction:

1. `ONE_TIME_RUNTIME_ENVIRONMENT=isolated_staging`
2. `ZOOM_CLASSROOM_ENABLED=true`
3. `ZOOM_CLASSROOM_PROVIDER_MODE=real`
4. `ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED=true`

`ZOOM_CLASSROOM_CANARY_ENABLED=true` and an exact
`ZOOM_CLASSROOM_CANARY_LEARNER_KEY=full_app_preview_student_1` binding are additional, final
authorization gates. They are never inferred from the four provider gates. The canary flag
remains false until every prerequisite and negative preflight passes.

The four separately reported readiness phases are:

1. Meeting SDK app and exact origin
2. S2S meeting provisioning
3. host authorization
4. real-control canary authorization

Legacy `ZOOM_MEETING_SDK_KEY` and `ZOOM_MEETING_SDK_SECRET` cannot satisfy canonical SDK
readiness. The canonical S2S account variable is `ZOOM_S2S_ACCOUNT_ID`; integrated code accepts
`ZOOM_ACCOUNT_ID` only as a temporary account-ID alias. This job sets the canonical variable and
does not set both.

## Protected prerequisite-source validation

Validate presence and provenance without exporting values. Use provider/Railway UI states that
show only configured/missing, or a purpose-built presence-only check whose output is restricted
to the variable names and booleans below. Do not enumerate an environment, echo a value, print a
length/prefix/suffix, or take a DOM snapshot of any credential page.

### Meeting SDK and origin

- `ZOOM_MEETING_SDK_CLIENT_ID`
- `ZOOM_MEETING_SDK_CLIENT_SECRET`
- `ZOOM_MEETING_SDK_WEB_VERSION` (the repository contract currently selects `6.2.0`; recheck
  Zoom's minimum-version policy immediately before execution)
- `ZOOM_MEETING_SDK_ALLOWED_ORIGIN`
- `PUBLIC_BASE_URL`

For the historical path the last two values must both be
`https://ot99-web-staging.up.railway.app`. For the disposable path they must both be
`https://ot99-web-onetimev2-pr-105.up.railway.app`. In either case require HTTPS, no path, no
wildcard, no query/fragment, and no credentials.

### Six S2S/host/meeting prerequisites

- `ZOOM_S2S_ACCOUNT_ID`
- `ZOOM_S2S_CLIENT_ID`
- `ZOOM_S2S_CLIENT_SECRET`
- `ZOOM_HOST_USER_ID`
- `ZOOM_REAL_CONTROL_MEETING_ID`
- `ZOOM_REAL_CONTROL_MEETING_PASSCODE`

The host must be a licensed user in the same governed Zoom account. The meeting and passcode must
refer to one disposable staging meeting under that host. The historical replacement path uses
`npm run zoom:real-control:provision`. The distinct isolated path uses
`npm run zoom:real-control:disposable:provision` and must later use
`npm run zoom:real-control:disposable:cleanup`. Protected state stays outside Git, and sanitized
output must confirm no invitation, join URL, passcode, token, private destination, or provider
identifier was printed. Never substitute the Rabbi's regular meeting or the Tisha event meeting.

The distinct disposable provisioner must stop before reading protected credentials or
constructing a provider client unless every non-secret preflight value is exact:

- `ONE_TIME_RUNTIME_ENVIRONMENT=isolated_staging`
- `ZOOM_CLASSROOM_ENABLED=true`
- `ZOOM_CLASSROOM_PROVIDER_MODE=sink`
- `ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED=false`
- `ZOOM_CLASSROOM_CANARY_ENABLED=false`
- `ZOOM_CLASSROOM_CANARY_LEARNER_KEY=full_app_preview_student_1`
- `ZOOM_REAL_CONTROL_PROVISION_AUTHORIZATION=PROVISION_FICTIONAL_STUDENT_1_ONCE`
- `ZOOM_REAL_CONTROL_EXPECTED_SOURCE_SHA=<the exact full reviewed execution head>`
- `RAILWAY_GIT_COMMIT_SHA=<the same exact full reviewed execution head>`
- `PUBLIC_BASE_URL=https://ot99-web-onetimev2-pr-105.up.railway.app`
- `ZOOM_MEETING_SDK_ALLOWED_ORIGIN=https://ot99-web-onetimev2-pr-105.up.railway.app`
- `ZOOM_DISTINCT_DISPOSABLE_ISOLATED_CANARY_ATTESTATION=CREATE_ONE_DISTINCT_PR105_MEETING_TISHA_UNTOUCHED_DELETE_AFTER_PROOF`
- `ZOOM_DISPOSABLE_CANARY_OPERATION_ID=<one fresh UUID for this job>`
- `ZOOM_DISPOSABLE_CANARY_CLEANUP_DEADLINE=<10 minutes to 6 hours in the future>`
- `ONE_TIME_ZOOM_KEYHOLDER_DIR=<absolute One Time-owned protected directory outside Git>`
- `ZOOM_DISPOSABLE_CANARY_STATE_PATH=<absolute new JSONL path inside that directory>`

`BNA_KEYHOLDER_DIR`, `ZOOM_PROTECTED_TARGET_ROTATION_ATTESTATION`,
`ONE_TIME_PROTECTED_CLASS_TARGET_URL`, `ONE_TIME_TISHA_BAV_2026_ZOOM_JOIN_URL`,
`ZOOM_REAL_CONTROL_MEETING_ID`, and `ZOOM_REAL_CONTROL_MEETING_PASSCODE` must all be absent from
the disposable job. Absence is the proof that this job cannot inspect or act on the Tisha or
persistent-staging target. Do not copy BNA secrets. Transfer only the required S2S, host,
fictional-alias, and state-signing inputs through One Time-owned protected controls.

The new path writes a signed schema-v3 `create_intent` before the first provider POST, uses an
exclusive lock, records each transition durably, binds the state to the operation UUID, exact
execution head, exact origin, host, topic, and fictional Student 1, and rejects v1/v2, tampered,
wrong-purpose, wrong-source, cross-student, raw-email, token, or URL state. A completed `ready`
state may be read back without creating again. An ambiguous `create_intent`,
`registration_in_flight`, or `cleanup_required` state stops for exact reconciliation; it never
repeats an ambiguous POST.

The historical replacement command continues to require
`ZOOM_PROTECTED_TARGET_ROTATION_ATTESTATION=OLD_TARGET_REVOKED_REPLACEMENT_VALID`. That attestation
cannot authorize the disposable command, and the disposable attestation cannot authorize the
historical command.

### Protected class target

- `ONE_TIME_PROTECTED_CLASS_TARGET_URL`

This is not evidence that SDK/S2S is ready. Its previously exposed value is compromised and must
first be classified without rendering it. The discovered
`ONE_TIME_TISHA_BAV_2026_ZOOM_JOIN_URL` source variable is the Tisha event key. It is not a
disposable classroom-canary source and must never be copied, relabeled, inferred disposable,
deleted, or rotated by this job. The classifier also blocks when the protected target equals that
event-specific canonical Zoom meeting reference, even when the two URLs use different Zoom hosts,
`/j` versus `/w` paths, or query parameters.

Run `npm run zoom:protected-target:inspect` only from an authenticated disposable private Railway
job or equivalent server-side private-network task pinned to the exact reviewed Git head. Do not
use a public endpoint, browser DOM inspection, shell echo, environment enumeration, or client-side
code. Inject the protected target and S2S values through native protected variables and remove
only that exact disposable job after its sanitized result is captured.

The inspection requires these exact fail-closed gates:

- `ONE_TIME_RUNTIME_ENVIRONMENT=isolated_staging`
- `ZOOM_CLASSROOM_PROVIDER_MODE=sink`
- `ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED=false`
- `ZOOM_CLASSROOM_CANARY_ENABLED=false`
- `ZOOM_PROTECTED_TARGET_INSPECTION_AUTHORIZATION=INSPECT_PROTECTED_CLASS_TARGET_ONCE`
- `ONE_TIME_PROTECTED_CLASS_TARGET_URL` and
  `ONE_TIME_TISHA_BAV_2026_ZOOM_JOIN_URL` bound as separate server-side protected references for
  the source-scope comparison
- canonical `ZOOM_S2S_ACCOUNT_ID`, or temporary `ZOOM_ACCOUNT_ID` only when the canonical account
  variable is absent
- `ZOOM_S2S_CLIENT_ID`
- `ZOOM_S2S_CLIENT_SECRET`
- `ZOOM_HOST_USER_ID`
- `ONE_TIME_PROTECTED_CLASS_TARGET_URL`

The command parses the protected Zoom URL only in memory. S2S authentication requires one OAuth
token `POST`; the sole meeting-resource operation is one `GET`. The inspection client exposes no
create, update, registration, delete, or rotation method. Its output contains only fixed
`status`, `blocker`, boolean `classifications`, and numeric `counts`. Counts separately report
`oauth_token_requests`, `meeting_resource_get_requests`, and
`resource_mutation_requests` (always zero). It never prints a meeting/host/account identifier,
topic, agenda, URL, passcode, token, credential, provider error body, or digest.

Both protected URLs are parsed before any S2S/host requirement, OAuth, or provider construction.
If either URL is malformed, the job blocks with zero requests. The source-scope guard then
compares only the two canonical Zoom meeting references. Prefer a disposable private job that
binds both exact protected variable names and nothing else: canonical meeting-reference equality
returns `protected_target_source_scope_checked=true`,
`protected_target_source_scope_allowed=false`, and exact zero/zero/zero request counts. A missing
comparison input returns both booleans false (scope unknown). Distinct references return both
booleans true, which means only “not the known Tisha event key”; it does not establish that the
target is disposable. Only that distinct case may proceed to the S2S GET inspection.

`SAFE_TO_REVOKE` requires an exact single-occurrence type-2 meeting, the configured exact host,
the repository-created canonical UTC-minute canary topic, the exact isolated-canary agenda,
both registrant email settings false, and `join_before_host=false`. Every mismatch, malformed
response, provider error, unavailable readback, or ambiguous source returns
`PROTECTED_CLASS_TARGET_ROTATION_BLOCKED`. That blocker is terminal for this execution: perform no
delete or rotation. Clear `ZOOM_PROTECTED_TARGET_INSPECTION_AUTHORIZATION` immediately after the
single read-only attempt, whether it passes or blocks.

After `SAFE_TO_REVOKE`, the replacement is copied directly from its authoritative disposable
canary source to the staging protected variable. Record only `old_target_denied`,
`replacement_target_valid`, and `target_value_recorded=false`; do not record a URL or a plain
unsalted digest of one.

Any missing or ambiguous protected source stops before a real gate is enabled. The classifier
returns only the fixed blocker and sanitized phase booleans/counts; it does not echo a variable
value or provider error.

## Isolated PR #105 disposable-canary sequence

Use this sequence only under decision `zoom-distinct-disposable-isolated-canary-20260724`.

1. Pin the exact PR #105 successor head that contains this attestation repair. Redeploy the
   isolated preview and require `/version` commit fields to equal it; the observed stale
   `944f46b...` runtime is not acceptable evidence.
2. Require the existing General app, Meeting SDK enablement, and existing exact PR #105 preview
   origin. Add no persistent-staging or production origin and create no second app.
3. Keep every persistent-staging and production Zoom variable unchanged. Create one isolated
   private-network job with only the exact disposable preflight names above. Its source must be
   the reviewed successor head, not the stale `944f46b...` preview source.
4. Require a fresh absent protected-state path, then run
   `npm run zoom:real-control:disposable:provision` once. Sanitized output must report
   `mode=distinct_disposable_pr105_canary`, `phase=ready`, exact source verified, fictional
   Student 1 only, both protected targets unbound, zero invitations, and no printed protected
   value. Do not reuse a v2 state or manually provide a meeting identifier.
5. Install canary-specific values only in the isolated PR #105 preview, keep real/canary gates off
   through readiness preflight, and run the bounded host plus fictional Student 1 control and
   negative proof below on that isolated preview.
6. Stop for human verification, rate limiting, source drift, missing protected input, or any
   unexpected participant. Never bypass a challenge or substitute the Tisha/recurring meeting.
7. Immediately return the isolated preview to sink/real-provider-false/canary-false. Clear the
   one-shot provision authorization, set only
   `ZOOM_DISPOSABLE_CANARY_CLEANUP_AUTHORIZATION=DELETE_ONE_CREATED_PR105_DISPOSABLE_MEETING_ONCE`,
   and run `npm run zoom:real-control:disposable:cleanup`. The cleanup command can obtain its
   target only from the valid signed v3 state. It performs an exact GET scope proof before one
   documented meeting DELETE, requires the meeting's notification settings to read back false,
   verifies absence, and appends a secret-free `deleted` tombstone. A timeout, 429, 5xx, scope
   mismatch, or still-present readback remains fail-closed and is never blindly retried.
8. Capture only the sanitized deleted result. Then destroy the exact isolated job and its private
   state volume or remove that exact state and the canary-specific isolated variables through
   protected controls without rendering them. Read back that the disposable meeting is absent,
   the Tisha and recurring meetings were untouched, customer invitations/notifications are zero,
   persistent staging and production are unchanged, and no provider request occurs after disable.

The historical persistent-staging sequence below is not authorized by the isolated decision and
must not be mixed into it.

## Historical persistent-staging replacement sequence

### 1. Establish the safe baseline

Read back names/status only and require:

- `ZOOM_CLASSROOM_PROVIDER_MODE=sink`
- `ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED=false`
- `ZOOM_CLASSROOM_CANARY_ENABLED=false`
- `ZOOM_CLASSROOM_CANARY_LEARNER_KEY` is absent or already bound only to fictional Student 1
- production has no change associated with this job
- the exact fictional occurrence and fictional Student 1 are active and eligible in the current
  staging account/product
- no customer invitee, broad message, or recurring Rabbi meeting is in the canary scope

Do not record account, learner, meeting, participant, host, or credential identifiers.

### 2. Classify, then rotate the exposed class target

1. Run the read-only `npm run zoom:protected-target:inspect` job above and require
   `SAFE_TO_REVOKE`, one OAuth request, one meeting-resource GET, and zero resource mutations.
2. Clear the transient inspection authorization and remove its exact disposable private job.
3. If classification is `BLOCKED`, stop with no delete, rotation, or replacement.
4. Revoke the exposed value at the authoritative protected source.
5. Issue one replacement for the same persistent-staging class purpose.
6. Copy the replacement through native protected controls directly into
   `ONE_TIME_PROTECTED_CLASS_TARGET_URL`.
7. Consume the old target once through a non-logging denial check and require denial.
8. Consume the replacement once through a non-logging protected smoke and require the expected
   staging-only destination.
9. If either result is ambiguous, clear the variable, keep all real/canary gates off, revoke the
   replacement if needed, and stop.

### 3. Add the exact staging origin

In the existing General app:

1. Keep Meeting SDK enabled.
2. Preserve the accepted isolated PR origin.
3. Add exactly `https://ot99-web-staging.up.railway.app` to Meeting SDK Web Domains.
4. Keep strict/origin checking enabled.
5. Add no wildcard, path, localhost, production origin, customer destination, App Home URL, or
   unrelated redirect.

This runtime does not use a General-app OAuth callback for host control; ZAK retrieval comes from
the separate S2S app. Do not broaden OAuth redirects or scopes as part of this job.

If Zoom presents login reCAPTCHA, rate limiting, a concurrency conflict, or an unrecognized app
version, stop after the current atomic read. Do not hammer retry, create a replacement app, or
weaken strict origin checking.

### 4. Install protected prerequisites with real execution still disabled

1. Copy the canonical SDK values and six S2S/host/meeting values into the persistent-staging web
   service's protected variables.
2. Set `PUBLIC_BASE_URL` and `ZOOM_MEETING_SDK_ALLOWED_ORIGIN` to the exact staging origin.
3. Bind `ZOOM_CLASSROOM_CANARY_LEARNER_KEY=full_app_preview_student_1`, while leaving provider
   mode `sink`, real provider `false`, and canary `false`.
4. Redeploy the exact pinned source.
5. Verify `/version`, `/health`, and `/ready`; verify no raw value appears in logs or readiness.
6. Read the four readiness phases by name. Configuration phases may be ready while provider
   execution remains off.

### 5. Prove the final canary gate is fail-closed

Set only:

- `ZOOM_CLASSROOM_PROVIDER_MODE=real`
- `ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED=true`
- `ZOOM_CLASSROOM_CANARY_ENABLED=false`

Redeploy and require the application to report provider off with only canary authorization still
closed. A host port/provider client must not be constructed. If any provider request is observed,
disable the real gates and stop.

### 6. Run one bounded real canary

With the exact Student-1 learner binding still present, set `ZOOM_CLASSROOM_CANARY_ENABLED=true`
only on the staging web service and redeploy the exact source. Use a current supported Chrome or
Edge browser; allow microphone/camera only for this test.

1. On the host device, sign in as the authorized fictional Administrator and open
   `/app/live-console`.
2. On a separate physical device or isolated browser profile, sign in as fictional Student 1,
   open the exact class occurrence, and select **Join class**.
3. Start/join from **Protected Zoom Host**. Require role-1 SDK authorization plus a freshly
   acquired host ZAK; never record either token.
4. Require Student 1's role-0 join to map by the bounded stable `customer_key`, not display name.
   Record only the fictional label, never the customer key or Zoom participant ID.
5. Student 1 selects **I'm Ready**, joins audio/video voluntarily, and accepts Zoom's unmute
   prompt. The host cannot bypass participant consent.
6. From Live Console, select Student 1 and execute:
   - **Ask Unmute**; Student 1 accepts; read back unmuted.
   - **Mute**; read back muted.
   - **Ask Unmute** again; Student 1 accepts; read back unmuted.
   - **Spotlight** with Student 1 video on; read back spotlighted.
   - **Remove Spotlight**; read back not spotlighted.
   - **Done**; require selected question/participant state and stage scene to reset.
7. Refresh roster/state from Zoom participant events after each change; do not trust a cached
   parallel roster.
8. Stop the meeting. Do not invite a customer, record the meeting, livestream, or send a
   notification.

OBS is **not required** for this control proof. Meeting SDK/S2S plus the real host and Student
devices prove join, consent, mute/unmute, spotlight, and reset. OBS is a separate production or
broadcast-composition concern.

### 7. Prove negative boundaries

With no additional participant join:

1. Replay one consumed Student 1 launch grant and require an expired/consumed denial.
2. Submit one expired launch/command and require denial before provider invocation.
3. Attempt to use Student 1's context as fictional Student 2 and require sibling/cross-student
   denial before provider invocation.
4. Replay one executed host command with the same idempotency key and require idempotency
   rejection with no duplicate provider action.
5. Attempt a command against a participant outside the selected fictional question/context and
   require scope denial before provider invocation.

Do not loosen an assertion or create a manual fallback if any negative case fails.

### 8. Disable real execution and read back

Immediately after proof, or on any unexpected response:

1. Set `ZOOM_CLASSROOM_CANARY_ENABLED=false`.
2. Set `ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED=false`.
3. Set `ZOOM_CLASSROOM_PROVIDER_MODE=sink`.
4. Redeploy the same exact source.
5. Verify `/version`, `/health`, and `/ready`.
6. Verify Live Console and Student Classroom truthfully show provider off while the controlled
   fake flow remains usable.
7. Verify no new Zoom provider request occurs after disable.

The protected prerequisites and exact staging allowlist may remain installed for a later
separately governed canary, but all real/canary execution gates remain off. If credential scope,
origin binding, or value handling is suspect, remove the affected staging values and the staging
origin as part of containment. Keep the exposed old class target revoked in all cases.

## Sanitized evidence contract

The execution result may record only:

- job key, exact Git head, service names, deployment IDs, and timestamps
- `/version`, `/health`, `/ready`, and migration label
- `old_target_denied`, `replacement_target_valid`, `target_value_recorded=false`
- the exact public staging origin and whether strict allowlisting passed
- each variable **name** with `configured` or `missing`, never a value
- each readiness phase name with ready/blocked and blocker variable names
- fictional participant labels and device classes only
- each command type with executed/rejected and allowlisted provider result category
- replay/expiry/cross-student/idempotency denial booleans
- confirmation that post-canary mode is sink, real-provider false, and canary false
- provider request/mutation counts bounded to this one meeting and zero customer notifications
- production change count zero

It must not contain client IDs, secrets, account/host/meeting/participant identifiers, passcodes,
ZAK, signatures, access tokens, join/class targets, customer keys, emails, IP addresses, private
destinations, raw Zoom errors, browser credential fields, or screenshots of protected consoles.

Before handoff, run the repository secret scan, inspect the exact changed-file list, and confirm
no browser/terminal artifact captured a protected value. Return a single sanitized handoff to
the conductor; only the conductor updates `BOARD.yaml`.

## Stop conditions

Stop with one exact blocker and keep real/canary gates off when:

- a protected prerequisite source is missing or ambiguous
- target rotation or old-target denial cannot be proven
- the exact staging origin cannot be added without broadening the allowlist
- the host is not licensed or cannot obtain a fresh ZAK
- the isolated meeting cannot support the required participant behavior
- Zoom presents unresolved reCAPTCHA/rate limiting or an outdated-version conflict
- `/version` does not match the pinned source
- readiness exposes a value or constructs a provider before the final canary gate
- consent, mute/unmute, spotlight/reset, replay, expiry, sibling scope, or idempotency differs
  from the contract
- any customer notification, production change, unrelated meeting mutation, or protected-value
  disclosure is observed

## Current official Zoom constraints checked for this job

Checked on 2026-07-23:

- Meeting SDK JWTs are generated server-side; a host start/join uses JWT plus a fresh ZAK.
- S2S OAuth account credentials are separate from Meeting SDK credentials.
- Web participant join/state, mute/unmute, active-speaker, and host/co-host changes are surfaced
  through Meeting SDK participant events.
- Component view supports core mute/unmute and video controls; mobile uses client view.
- Zoom enforces a quarterly Meeting SDK minimum-version policy. Recheck the selected web version
  immediately before the canary.
- Meeting SDK is for human meeting use, which this bounded host-and-Student canary satisfies.

Official references:

- https://developers.zoom.us/docs/meeting-sdk/auth/
- https://developers.zoom.us/docs/internal-apps/create/
- https://developers.zoom.us/docs/meeting-sdk/web/client-view/participant-events/
- https://developers.zoom.us/docs/meeting-sdk/web/component-view/supported/
- https://developers.zoom.us/docs/build/minimum-version/
  The protected state and evidence must never contain raw meeting IDs, passcodes, join URLs, SDK or
  S2S credentials, ZAK, signatures, access tokens, participant identifiers, customer keys, emails,
  or private destinations.

## Existing-meeting read-only scope diagnostic

This diagnostic is the only current continuation after PR #125. It requires separate exact Board
authority and the preserved signed schema-v3 journal at sequence `4`, phase `cleanup_required`,
failure category `registration_outcome_ambiguous`, zero registrants, and no tombstone. It does not
authorize cleanup.

Deploy only an immutable accepted source containing
`zoom:real-control:disposable:classify-scope` to the preserved isolated runner. Keep every
sink/real/canary gate off and retain the original operation ID, protected journal path, protected
keyholder path, origin, learner key, and attestation. Require:

- `ZOOM_REAL_CONTROL_EXPECTED_SOURCE_SHA=96e54d9688ff174ac8265ce3b3a6216abb6292dc`
- `ZOOM_DISPOSABLE_CANARY_REPAIR_EXPECTED_SOURCE_SHA=<exact accepted diagnostic source SHA>`
- `RAILWAY_GIT_COMMIT_SHA=<the same exact accepted diagnostic source SHA>`
- `ZOOM_DISPOSABLE_CANARY_SCOPE_DIAGNOSTIC_AUTHORIZATION=CLASSIFY_ONE_EXISTING_PR105_96E54D_MEETING_SCOPE_ONCE`
- `ZOOM_REAL_CONTROL_PROVISION_AUTHORIZATION` absent
- `ZOOM_DISPOSABLE_CANARY_CLEANUP_AUTHORIZATION` absent
- `ZOOM_DISPOSABLE_CANARY_RECONCILIATION_AUTHORIZATION` absent

Run only `npm run zoom:real-control:disposable:classify-scope`. It must obtain the target only from
the verified signed journal, match the protected keyholder host before constructing the provider
lifecycle, call only the reviewed `inspectExactMeeting` path, and finish with OAuth `1`, meeting GET
`1`, and resource POST/PATCH/DELETE all `0`.

The sanitized output is limited to phase `cleanup_required`, sequence `4`, the reviewed
reconciliation predicate booleans, `start_delta_class` (`exact`,
`within_reviewed_tolerance`, `outside_reviewed_tolerance`, or `unparseable`), and provider counts.
It must not contain a raw identifier, topic, agenda, timestamp, delta, notification value,
alternative host, credential, token, URL, payload, or reversible digest. The journal bytes must be
unchanged.

## Existing-meeting reconciliation cleanup only

This cleanup contract is not current execution authority while the scope mismatch is unresolved.
Do not run it unless the diagnostic result has been accepted and the Board later grants one new
exact cleanup authorization.

This is a one-time repair for the existing signed schema-v3 journal whose create source is exactly
`96e54d9688ff174ac8265ce3b3a6216abb6292dc`, sequence is exactly `4`, phase is
`cleanup_required`, and failure category is exactly `registration_outcome_ambiguous`. It cannot
create, register, patch, join, control, or select a different meeting.

Deploy the repair successor only to the preserved isolated runner. Keep every sink/real/canary
gate off and retain the original operation ID, protected journal path, protected keyholder path,
origin, learner key, attestation, and cleanup authorization. Require:

- `ZOOM_REAL_CONTROL_EXPECTED_SOURCE_SHA=96e54d9688ff174ac8265ce3b3a6216abb6292dc`
- `ZOOM_DISPOSABLE_CANARY_REPAIR_EXPECTED_SOURCE_SHA=<exact repair successor SHA>`
- `RAILWAY_GIT_COMMIT_SHA=<the same exact repair successor SHA>`
- `ZOOM_DISPOSABLE_CANARY_CLEANUP_AUTHORIZATION=DELETE_ONE_CREATED_PR105_DISPOSABLE_MEETING_ONCE`
- `ZOOM_DISPOSABLE_CANARY_RECONCILIATION_AUTHORIZATION=RECONCILE_DELETE_ONE_EXISTING_PR105_96E54D_MEETING_ONCE`
- `ZOOM_REAL_CONTROL_PROVISION_AUTHORIZATION` absent

Run only `npm run zoom:real-control:disposable:reconcile-cleanup`.

Before any journal transition or delete, the command requires the signed meeting ID, type `2`,
protected host, unique operation-bound topic, fixed isolated agenda, duration `60`, disabled
join-before-host, no alternative host, and the original deterministic create head to match. The
only accepted provider normalization is an absolute scheduled-start delta of at most 60 seconds.
Both registrant notification flags must be explicitly `false`. General email notification must be
explicitly `false`, or may be omitted only when no alternative host exists and the journal proves
the exact deterministic original create head. Any explicit `true`, missing registrant flag,
unknown value, larger/invalid time delta, or other identity mismatch stops before journal
transition and `DELETE`.

The command appends signed sequence `5` / `cleanup_delete_in_flight`, including the exact repair
successor SHA in the HMAC chain, before exactly one delete, then performs exactly one meeting GET.
Only the canonical Zoom meeting-resource `404` with code `3001` proves absence and permits the
secret-free sequence `6` / `deleted` tombstone, which retains that repair-head binding. A timeout
or ambiguous response retains sequence `5`; a later invocation from that same exact repair head
performs absence reconciliation only and never repeats the delete. A completed tombstone is
idempotent and loads no provider context. Generic or OAuth `404` responses do not prove absence.

Only after sanitized `phase=deleted`, `deleted_tombstone_written=true`, and provider counts are
read back may the separate provider-only executor remove the preserved runner and state volume.
Do not remove either resource from this repository task.
