# Direct Codex Prompt — OT-88 Zoom Learner Classroom and Question Queue

Paste this entire prompt into Codex. Do not begin implementation until every preflight gate below passes.

---

You are the principal real-time classroom, security, and UX engineer implementing **OT-88: Zoom Learner Classroom and Question Queue** in the existing **One Time** repository.

## Mission

Build a protected learner classroom shell using Zoom’s official Meeting SDK for human participation, plus an application-level student question queue integrated asynchronously with the OT-84 Telegram action gateway.

The product decision is fixed:

- the $67 family subscription grants **up to three named active learner seats**;
- it does **not** grant three reusable family URLs;
- each learner has a separate profile/login/device context;
- each learner receives a protected One Time join action for a specific immutable class occurrence;
- the daily class is at `19:00` in `Asia/Jerusalem`;
- the optional reminder is T-30 at `18:30` local time;
- no raw reusable Zoom join URL, meeting passcode, SDK secret, host token, registrant token, or similar provider credential may appear in ordinary portal JSON, HTML state, URLs, logs, analytics, support output, Telegram, screenshots, or test fixtures; and
- no production Zoom mutation or broad real reminder is permitted during this task.

You must complete safe code and provider-off/sink verification even when Zoom credentials are absent. In that case finish at the explicit checkpoint `READY_FOR_ZOOM_CANARY`.

## Non-negotiable source and branch gate

This task may run **only after** the remote branch `codex/ot84-telegram-action-gateway` exists.

You must:

1. locate the existing One Time repository;
2. identify the Git remote that actually contains `refs/heads/codex/ot84-telegram-action-gateway` using `git ls-remote --heads`;
3. fetch that branch explicitly;
4. resolve its current commit dynamically from the fetched remote-tracking ref;
5. record the actual source remote, source ref, and resolved source commit in the run state;
6. prove that the resolved OT-84 branch contains the OT-83 portal foundation;
7. create the new branch `codex/ot88-zoom-learner-classroom` from that exact fetched commit in a clean worktree; and
8. use `codex/ot84-telegram-action-gateway` as the draft pull request base.

Do not ask for or insert a commit SHA. Do not use a placeholder SHA. Do not start from a local-only branch. Do not silently fall back to the repository’s default branch.

If no remote contains the required source branch, write the blocked run state described below and stop before product-code edits.

## Repository discovery

Locate the existing One Time repository rather than creating an unrelated project.

Use this order:

1. an explicit environment variable/path already provided for the One Time repository;
2. the current directory or an ancestor if it is a Git worktree for One Time;
3. common workspace roots such as the user home, `/workspace`, `/workspaces`, or the current task mount, with a bounded search for `.git` directories/worktrees;
4. score candidate repositories using their remote URLs and recognizable One Time project markers.

For every candidate, use `git rev-parse --show-toplevel` and inspect remotes. Select only a repository whose contents and remotes identify it as One Time. Record how it was identified.

Do not modify a dirty existing checkout. Do not delete or reset another person’s changes. If the repository cannot be located confidently, persist `BLOCKED_REPOSITORY_NOT_FOUND` and stop.

## Remote resolution procedure

Use an equivalent safe procedure to the following logic; adapt shell syntax to the environment without weakening the checks:

```text
SOURCE_BRANCH = codex/ot84-telegram-action-gateway
TARGET_BRANCH = codex/ot88-zoom-learner-classroom

for each configured remote:
    git ls-remote --exit-code --heads REMOTE refs/heads/SOURCE_BRANCH
select exactly one intended remote, preferring the repository's normal upstream remote

git fetch REMOTE \
  +refs/heads/SOURCE_BRANCH:refs/remotes/REMOTE/SOURCE_BRANCH

SOURCE_REF = refs/remotes/REMOTE/SOURCE_BRANCH
SOURCE_SHA = git rev-parse SOURCE_REF^{commit}
```

Verify after fetch that `SOURCE_REF` exists and that `SOURCE_SHA` is a commit. Record both values. A stale local branch is not sufficient evidence.

If multiple remotes contain the branch, choose the established upstream remote based on repository convention and record the decision. Do not merge branches or rebase the source.

## OT-83 portal-foundation proof

Before creating product code, prove that the fetched OT-84 source contains the OT-83 portal foundation. Require both provenance evidence and functional evidence.

### Provenance evidence

Search the source tree and history for repository-native evidence such as:

- `ops/codex-runs/OT-83/` task/final/state files;
- OT-83 identifiers in commit history, release notes, or implementation documentation;
- OT-84 run evidence that explicitly identifies OT-83 as its portal foundation/base; or
- equivalent authoritative repository evidence.

### Functional evidence

Inspect the source tree and tests and identify the actual paths that provide at least:

- portal authentication/session enforcement;
- learner identity or learner profile context;
- household/guardian/learner relationship enforcement or the closest existing authorization primitive;
- entitlement/subscription checks or the existing domain seam where they belong;
- a protected portal shell/route suitable for the learner classroom; and
- tests that demonstrate the portal foundation.

Record exact file paths and relevant commits in `ops/codex-runs/OT-88/STATE.json` and `RESUME.md`.

Do not accept a filename alone as proof. If you cannot establish both provenance and functional evidence, persist `BLOCKED_OT83_FOUNDATION_UNVERIFIED` and stop before product-code edits.

## Clean worktree and target branch

Use a new clean worktree outside the main working directory or in the repository’s established worktree area.

Requirements:

- the worktree starts at the dynamically resolved `SOURCE_SHA`;
- create `codex/ot88-zoom-learner-classroom` from that commit;
- `git status --porcelain` must be empty before writing run metadata;
- do not reuse a worktree containing unrelated changes;
- do not overwrite an existing local or remote target branch;
- if resuming an existing OT-88 run, validate that its recorded source SHA, target branch, and worktree match before continuing; otherwise stop with a conflict state.

## Persist run artifacts before product-code edits

Inside the new worktree, create this directory before editing application code:

```text
ops/codex-runs/OT-88/
```

Create and populate at least these files first:

```text
ops/codex-runs/OT-88/TASK_PROMPT.md
ops/codex-runs/OT-88/STATE.json
ops/codex-runs/OT-88/RESUME.md
ops/codex-runs/OT-88/FINAL.md
```

`TASK_PROMPT.md` must contain this full task prompt or an exact persisted copy supplied to the run.

`STATE.json` must be valid JSON and initially include:

- ticket `OT-88`;
- status `PREFLIGHT_COMPLETE` after all preflight gates pass;
- UTC start timestamp;
- repository root;
- source remote;
- source branch;
- fetched source ref;
- actual resolved source commit;
- target branch;
- worktree path;
- OT-83 provenance evidence;
- OT-83 functional evidence paths;
- feature flags/default safety mode;
- credentials/settings presence as booleans only, never values;
- test/canary status; and
- an append-only checkpoint list.

`RESUME.md` must state exactly how another Codex run can find the worktree, validate the branch/source, see the current checkpoint, and continue safely.

`FINAL.md` must initially say that implementation is pending. Update all four artifacts as the task progresses. These metadata files are the first repository edits; product-code edits come after them.

Never place secrets, tokens, meeting identifiers, passcodes, child free text, cookies, or authorization headers in these artifacts.

## Inspect and follow repository conventions

Before designing files, inspect the codebase and document in the run state:

- language/framework/package manager;
- application boundaries and domain patterns;
- persistence/migration framework;
- auth/session/CSRF conventions;
- background jobs/outbox/queue conventions;
- feature-flag/configuration conventions;
- test commands and CI checks;
- logging/analytics/error-reporting libraries;
- secret-management and encryption helpers;
- OT-84 Telegram gateway contracts; and
- any project-specific meaning of “BNA fanout.”

Reuse existing patterns. Do not introduce a parallel architecture when a repository-native seam exists. If “BNA fanout” is an internal term, find its existing definition and preserve it; do not invent a conflicting expansion.

## Required domain model and invariants

Implement the repository-equivalent of these concepts:

- household entitlement with a maximum of three active learner seats;
- named learner seat/enrollment;
- class series with timezone-aware daily schedule;
- immutable class occurrence;
- provider meeting mapping;
- per-learner provider registrant identity where supported;
- short-lived single-purpose One Time launch grant;
- attendance attempt and minimized join/leave/reconnect events;
- student question, moderation actions, and OT-84 alert intent;
- reminder preference and idempotent reminder delivery intent;
- provider configuration/readiness assessment; and
- append-only redacted audit event.

### Seat rule

Enforce the three-seat maximum transactionally. Concurrent fourth-seat activation must fail deterministically. A seat is assigned to a named learner and cannot be used as a transferable bearer slot.

### Occurrence rule

Generate the daily occurrence at `19:00 Asia/Jerusalem` using timezone-aware calendar recurrence, not fixed 24-hour UTC arithmetic. Store the timezone and schedule snapshot. Schedule fields are immutable; corrections cancel/supersede an occurrence instead of rewriting history.

Model a configured class duration and join window. If no existing product policy exists, use a documented default of opening 15 minutes before start and closing 15 minutes after scheduled end, behind configuration.

### Reminder rule

The optional reminder is T-30, which is `18:30 Asia/Jerusalem`. It is sent only when the learner/approved recipient is eligible and opted in. It contains a safe One Time prompt, never Zoom credentials or a launch grant. Use an outbox/idempotency key unique to learner seat, occurrence, channel, and reminder type.

### Launch-grant rule

The One Time launch grant is not the Meeting SDK JWT. It is an opaque application authorization object bound to:

- authenticated learner;
- active learner seat;
- household entitlement;
- class occurrence;
- purpose `JOIN_CLASS`;
- short expiry; and
- one attendance attempt.

Use at least 128 bits of unpredictable entropy; prefer 256 bits. Store only a digest/HMAC of bearer material. Recommended TTL is 90 seconds unless existing policy dictates otherwise.

State transitions are terminal:

```text
ISSUED -> CONSUMED
ISSUED -> EXPIRED
ISSUED -> REVOKED
```

Consume atomically once. Re-check all authorization and occurrence-window conditions at consume time. Replay returns a safe expired/used state and never regenerates provider material. Rejoin after leave requires a new launch grant.

## Authorization requirements

Never authorize from client-supplied household, learner, seat, entitlement, provider, occurrence, recipient, or actor IDs alone. Resolve relationships from server-owned records.

Before issuing **and again before consuming** a launch grant, verify:

1. authenticated principal is a learner session allowed to join;
2. session learner equals the grant learner;
3. learner seat belongs to that learner;
4. seat is active and not revoked/suspended;
5. seat belongs to the active household entitlement;
6. entitlement covers the class product and current time;
7. occurrence exists, is not cancelled/superseded/ended, and is in its join window;
8. learner and household are not revoked or blocked;
9. provider readiness permits the selected environment/path;
10. request passes CSRF/origin/session checks;
11. issue/consume rate limits pass; and
12. idempotency/replay checks pass.

A guardian may manage seats according to existing policy but may not consume a learner join action. A sibling learner may not view or use another sibling’s occurrence grant or question. School/no-subscription accounts are denied unless the existing entitlement model explicitly grants this product.

Rabbi moderation is a separate authorization domain. A Rabbi deep link never opens or impersonates a child’s learner session.

## Zoom integration architecture

Use ports/adapters or the repository’s equivalent boundary. At minimum provide seams equivalent to:

- `ZoomMeetingLaunchPort` — resolve encrypted meeting configuration and generate participant SDK launch material server-side;
- `ZoomRegistrantPort` — obtain/verify per-learner registrant identity where supported;
- `ZoomProviderReadinessPort` — check credentials, account authorization, meeting configuration, registration, SDK/UI privacy readiness;
- `ZoomAttendanceReconciliationPort` — optional restricted reconciliation, disabled when not configured;
- `ZoomFeatureParticipantPort` — present but disabled in V1;
- `QuestionAlertPort` — OT-84 Telegram gateway adapter;
- `ReminderDeliveryPort` — sink by default; and
- clock, ID, idempotency, rate-limit, audit, and secret-store abstractions consistent with the repository.

### Provider safety defaults

Default flags/configuration must make these false/off:

- production provider mutations;
- broad reminders;
- automatic participant feature/spotlight behavior;
- component view before privacy verification;
- canary access outside explicit test identities/occurrences.

Provider mutation methods may be implemented behind an interface for future/test setup, but this task must not create/update/delete production Zoom meetings or registrants.

### Server-side SDK authorization

Use Zoom’s official Meeting SDK patterns. The SDK secret/client secret remains server-side. The learner role is hard-coded to participant role `0`; never accept role from browser input.

The official auth sample permits a Meeting SDK JWT validity longer than the One Time launch grant. Treat the application launch grant as the immediate one-use gate. Generate the SDK JWT only after grant consumption and use the shortest provider-supported validity that works with the installed SDK/account.

Do not expose ZAK, OBF, host, or co-host credentials to learner code. If current Zoom account rules require cross-account authorization, readiness/canary must prove the supported account relationship or OBF/ZAK arrangement before enabling join.

### Provider meeting and registrant material

Persist provider meeting number/ID, passcode, UUID, registrant ID, and registrant token only as encrypted/server-restricted fields when they must be retained. Do not store a full provider `join_url`.

If a Zoom API response contains a `join_url`, parse the required registrant token server-side and discard the full URL immediately. Never send that URL to the portal, Telegram, logs, analytics, or support tools.

### Dedicated launch bootstrap

Ordinary portal APIs may return only safe occurrence/readiness data and an opaque launch path/grant.

Use a dedicated same-origin launch page and single-use bootstrap endpoint for the exact Meeting SDK join inputs. This endpoint is explicitly outside normal portal JSON and must:

- consume the One Time launch grant atomically;
- reauthorize the learner/seat/entitlement/occurrence;
- choose client/component/fallback before fetching provider material where possible;
- generate/resolve the participant SDK signature and required provider fields server-side;
- return no raw Zoom join URL;
- return only the minimum SDK join fields required by the isolated launch page;
- set `Cache-Control: no-store, private` and related no-cache headers;
- use `Referrer-Policy: no-referrer`;
- bypass service-worker/cache persistence;
- use strict CSP/Permissions Policy suitable for the official SDK;
- suppress request/response body logging and tracing capture;
- never serialize provider fields into server-rendered HTML, page props, Redux/global state, local/session storage, IndexedDB, browser history, analytics, or error messages;
- use fields in a local closure/in-memory bootstrap object only; and
- clear application references and destroy the SDK client on leave/error.

Document the unavoidable residual fact that the browser executing the Meeting SDK can observe its in-memory join inputs. The security guarantee is confinement to the one-time launch surface and exclusion from durable/reusable/application-wide channels.

## Meeting SDK view policy

Use official Meeting SDK behavior, reverified against the installed version.

### Mobile/tablet

Always use full-page client view.

### Desktop

Use component view only when all of these pass before bootstrap:

- desktop browser/viewport classification;
- repository supported-browser policy;
- supported Meeting SDK version;
- component feature flag;
- required feature checklist;
- invite/copy-link UI suppression verified;
- meeting-number/passcode information suppression verified;
- waiting room, leave, reconnect, permissions, accessibility, RTL, and reduced-motion canary passed; and
- provider account settings do not reintroduce unsafe controls.

Otherwise use secure client view fallback. Unknown equals fallback.

### Client-view hardening

Verify and use installed-version options equivalent to:

- disable invite;
- hide meeting header;
- disable in-meeting chat for learners;
- disable learner recording controls;
- disable call-out/Zoom Phone invite paths;
- safe One Time leave URL; and
- no provider details in document title/URL/error UI.

Do not blindly copy option names. Verify them in official reference/types and add adapter tests.

### Component-view hardening

Configure only required components. Omit/hide invite and meeting-information surfaces. If the current SDK or account cannot guarantee that meeting number/passcode/copy-link controls are absent, mark `UI_PRIVACY_UNVERIFIED` and select client view.

## Protected classroom UX

Implement an application-owned classroom shell with:

- next-class card;
- local date/time in `Asia/Jerusalem`;
- provider readiness summarized safely;
- one clear `Join Class` action;
- loading/authorizing state;
- waiting room;
- host not started;
- device-permission help;
- poor network/reconnecting;
- disconnected/retry;
- full class;
- provider unavailable;
- expired/used grant;
- class ended;
- leave confirmation and safe return; and
- rejoin through a newly issued grant.

Never ask the learner to type a meeting number or passcode. Never offer a fallback raw Zoom link.

Use stable app-owned state enums and age-appropriate non-technical copy. Provider error codes belong only in restricted internal telemetry.

Implement keyboard operation, visible focus, screen-reader labels, RTL, reduced motion, and responsive behavior. Test the One Time shell separately from provider-owned SDK accessibility. Document any provider-owned limitations without masking them.

## Attendance telemetry and privacy

Create one application attendance attempt per consumed launch grant. Accept only an allowlisted, idempotent event vocabulary such as:

```text
authorized
bootstrap_started
bootstrap_succeeded
waiting
join_started
joined
permission_denied
network_poor
reconnecting
reconnected
left
ended
join_failed
```

Record coarse timestamps, durations, reconnect count, selected view, and safe failure category. Do not record:

- media or media-derived data;
- captions/transcripts;
- Zoom chat;
- participant lists;
- display names;
- child question text;
- raw IP address or full user-agent fingerprint;
- meeting number/UUID/passcode;
- provider token/signature; or
- provider response body.

Use Meeting SDK events only as minimized signals. Validate event ordering and timestamps server-side. A client “joined” event is useful telemetry, not sufficient authorization evidence.

## Student question queue

V1 questions are application-level One Time records, not Zoom chat.

Flow:

1. authenticated learner submits one short text question for the current occurrence;
2. server proves learner/seat/entitlement/occurrence scope;
3. validate length, Unicode normalization, allowed content shape, CSRF, idempotency, and rate limits;
4. store the original encrypted under the existing privacy/key-management system;
5. create a redacted/truncated preview and opaque question ID;
6. write append-only audit and an outbox/alert intent;
7. asynchronously invoke OT-84 for the authorized Rabbi Telegram identity only;
8. learner sees only their own safe state; and
9. no question text is sent to Zoom chat by default.

Use repository-consistent limits; if none exist, choose a documented short maximum in the 280–500 character range and rate limits that prevent flooding while allowing reasonable use. Include deterministic tests. Do not support attachments in V1.

Telegram payload contains:

- opaque question ID;
- occurrence-safe label/time;
- redacted short preview;
- actions `Feature next`, `Answered`, `Dismiss`; and
- a Rabbi-only moderation deep link.

It must not contain a Zoom link/token, learner session link/cookie, household details, full child profile, or unredacted contact information.

OT-84 retries must be idempotent. A Telegram retry cannot create duplicate moderation transitions.

## Rabbi workflow

Authorize Telegram actions against the configured Rabbi Telegram identity through OT-84’s established signed/action-gateway contract. Never accept an arbitrary Telegram actor/chat identifier from the request as proof.

Allowed transitions:

- `Feature next` — marks this question as the selected next question in One Time;
- `Answered` — marks it answered;
- `Dismiss` — removes it from the active queue with a learner-safe state; and
- open moderation — issues a separate, short-lived Rabbi-only deep link.

The deep link opens a Rabbi moderation surface under Rabbi authentication. It never opens, impersonates, or reuses the child’s learner session.

The learner can query only their own question state. Do not reveal other learners’ questions, ordering, identities, moderator notes, or reasons.

### No Zoom spotlight promise

Create `ZoomFeatureParticipantPort` and a disabled adapter. V1 `Feature next` guides the Rabbi to use normal host controls. It does not call Zoom.

The disabled port must return an explicit unsupported/disabled result and emit a safe audit event. Do not implement automatic pin/spotlight unless a future, separately gated canary proves official SDK/API support, host permission, identity correlation, and account settings. Pinning is viewer-local; spotlight is a host/co-host function. Do not conflate them.

## Provider readiness

Implement explicit readiness states equivalent to:

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

The portal receives only coarse learner-safe readiness such as `PREPARING`, `READY`, or `TEMPORARILY_UNAVAILABLE`.

`READY` is required for general join. `READY_FOR_ZOOM_CANARY` permits only explicit test identities/occurrences under a separate canary allowlist.

Do not claim readiness merely because environment variables exist. Check configuration shape, account/meeting relationship, SDK version, registration mode, privacy controls, and canary evidence freshness.

## Failure mapping

Map application and provider failures to app-owned states. Include at least:

- unauthenticated/session expired;
- learner relationship/seat/entitlement denied;
- fourth-seat denial;
- occurrence too early/late/cancelled/ended;
- grant expired, replayed, revoked, or rate limited;
- host not started / waiting;
- device permission denied;
- reconnecting/disconnected/poor network;
- meeting capacity reached;
- provider unavailable/timeout;
- wrong password or registration required as provider misconfiguration, never learner input;
- meeting locked;
- removed by host;
- host-admin blocked;
- unsupported SDK version;
- component unsupported -> client fallback; and
- safe leave/rejoin.

Every state needs: detector, learner copy, allowed CTA, retry policy, telemetry category, and security behavior. Do not leak raw provider messages.

## API boundary

Adapt route names to repository conventions, but preserve these responsibilities:

### Safe next-class query

Returns only application IDs, local schedule, safe readiness, question summary for the current learner, and `canJoin`. No provider identifiers.

### Launch-grant issue

Authenticated POST with CSRF/origin/idempotency. Returns an opaque launch path/handle and expiry only. No provider fields.

### Launch page

Same-origin isolated shell. No provider fields in SSR/HTML/URL. Fetches bootstrap after load.

### Launch consume/bootstrap

Authenticated same-origin POST that atomically consumes grant and returns the minimum Meeting SDK fields with no-store protections. It is excluded from normal logging/tracing/analytics and never returns a raw join URL.

### Attendance event ingest

Authenticated/idempotent allowlisted events bound to the attempt and learner session.

### Question submit/list-own

Learner-scoped POST/GET. Only own occurrence/questions.

### Rabbi moderation

Separate Rabbi auth or OT-84 signed action endpoint. No child-session reuse.

### Reminder scheduler/outbox

Eligibility evaluation at T-30, sink/default adapter, idempotent delivery.

## Security controls

Use existing repository controls and add missing tests for:

- CSRF and strict same-origin launch consumption;
- session fixation and learner/sibling confusion;
- IDOR across household, learner, occurrence, grant, attempt, and question IDs;
- transactional replay prevention;
- rate limiting for grants/questions/moderation links;
- encrypted provider/child-sensitive fields at rest;
- structured-log allowlist rather than blacklist-only logging;
- redaction in exceptions, tracing, analytics, support exports, and Telegram;
- no request/response body capture on launch bootstrap;
- no secrets in source, snapshots, fixtures, screenshots, or run artifacts;
- CSP/Permissions Policy for camera, microphone, screen share, and Zoom SDK origins;
- service-worker and CDN bypass for launch routes;
- safe `Referrer-Policy` and no credentials in URL;
- dependency/version minimum check;
- launch page not indexable/share-previewable; and
- disabled recording/chat/invite controls according to product policy.

Add automated leakage scans over normal portal responses, rendered HTML/state, logs, analytics test sink, Telegram test sink, support serialization, and built assets. The dedicated launch bootstrap may contain minimum SDK fields only after successful consume; tests must prove it is no-store, single-use, scope-bound, absent from logs, and never includes a raw join URL or host/SDK secret.

## Feature flags and rollout defaults

Use repository-native flags/config. Equivalent defaults:

```text
zoom_classroom_enabled = false until schema/provider-off tests pass
zoom_component_view_enabled = false
zoom_provider_mutations_enabled = false
zoom_feature_participant_enabled = false
class_reminders_external_delivery_enabled = false
zoom_canary_enabled = false
```

Provider-off mode and sink adapters must support full local/CI verification.

## Tests required before completion

Implement unit, integration, authorization, security, and end-to-end coverage appropriate to the repository. At minimum verify:

1. three named learners can hold active seats;
2. fourth seat is denied, including concurrent activation;
3. cross-household access denied;
4. sibling access/launch/question access denied;
5. school/no-subscription account denied;
6. suspended/revoked/expired entitlement denied;
7. occurrence timezone is 19:00 `Asia/Jerusalem` across DST boundaries;
8. reminder resolves to 18:30 local and is idempotent;
9. reminder retry does not duplicate and sink receives no broad fanout;
10. launch grant issuance policy;
11. consume-time reauthorization;
12. expired, replayed, revoked, wrong-session, and rate-limited grant denial;
13. no raw-link/passcode/token leakage in ordinary surfaces;
14. dedicated bootstrap no-store/single-use/log-redaction behavior;
15. participant role cannot be escalated by input;
16. mobile/tablet chooses client view;
17. eligible desktop chooses component only when verified;
18. desktop unknown/unsupported/privacy-failed path falls back to client view;
19. leave clears context and return requires a new grant;
20. waiting, host-not-started, permission, network, full, provider-down, ended, and reconnect states;
21. question submit authorization, length, idempotency, rate limit, encryption/redaction;
22. learner sees only own safe question state;
23. OT-84 alert payload is redacted and recipient-authorized;
24. Telegram retry/idempotent moderation;
25. Rabbi deep link cannot open learner session;
26. `Feature next` changes One Time state but never calls Zoom;
27. disabled `ZoomFeatureParticipantPort` behavior;
28. provider-off/sink mode makes no external Zoom or real reminder call;
29. provider failure/timeout/circuit behavior; and
30. no BNA fanout according to the repository’s established invariant.

## 30-sample performance evidence

Produce 30 join-shell samples, not a single anecdotal run:

- 10 mobile/tablet client-view shell samples;
- 10 desktop component-eligible shell samples in provider-sink mode; and
- 10 desktop forced-fallback client-view shell samples.

Measure app-owned stages separately from Zoom provider join:

- authenticated next-class response;
- launch-grant issue;
- launch shell navigation/first meaningful app UI;
- bootstrap request in sink mode;
- SDK mount boundary; and
- layout shift/long tasks where tooling supports it.

Record raw samples plus p50/p95/max, environment, cold/warm classification, commit, and commands under `ops/codex-runs/OT-88/evidence/performance/`.

Use repository budgets if they exist. Otherwise document provisional budgets and fail obvious regressions; recommended initial app-owned targets are p95 under 750 ms for server authorization endpoints in the test environment, p95 under 2.5 s for an interactive protected shell under the chosen mobile profile, and CLS below 0.1 for the app-owned shell. Report external Zoom join time separately rather than hiding it in app metrics.

## Accessibility and internationalization evidence

Verify:

- keyboard-only join/question/leave flows;
- visible focus and logical focus restoration after SDK exit;
- semantic headings/status/live regions in the app-owned shell;
- screen-reader labels for readiness and errors;
- no critical/serious automated accessibility findings in app-owned UI;
- RTL layout/content for Hebrew context;
- locale/time rendering in `Asia/Jerusalem`;
- reduced-motion behavior; and
- zoom/text-resize behavior.

Do not claim provider-owned SDK accessibility beyond what was actually tested. Separate app findings from provider findings.

## Provider-off and sink verification

CI/local tests must run without Zoom credentials and without contacting Zoom. Use deterministic fake/sink adapters.

The sink must record only safe application metadata. Assert outbound call counts and recipients to prove no broad reminder/Telegram/BNA fanout.

No test may use a production Zoom meeting, production registrant, production child account, or broad recipient list.

## Zoom sandbox/test canary

Run a real Zoom canary only if protected test credentials, account authorization, test meeting/settings, and explicit canary allowlist are present.

Canary scope:

- test Zoom account/meeting only;
- synthetic or explicitly approved test learner identities only;
- no production provider mutation;
- no broad real reminders;
- one or a few allowlisted recipients;
- client view on mobile/tablet;
- component view on verified desktop plus forced fallback;
- registration-required join when configured;
- waiting/host-not-started;
- camera/microphone permission denial and approval;
- leave and new-grant rejoin;
- three test learners and fourth-seat application denial;
- provider outage/error simulation where real induction is unsafe; and
- rendered check that invite, meeting number, passcode, chat, and unsafe meeting-information controls are absent.

Store screenshots only when they contain no provider credentials, child data, or tokens. Redact before committing evidence.

If credentials/settings are missing or any account/privacy prerequisite is unproven, do not fabricate or skip silently. Finish provider-off/sink code and set the status/checkpoint to `READY_FOR_ZOOM_CANARY` with an exact checklist of missing protected prerequisites.

## Evidence layout

Keep sanitized evidence under:

```text
ops/codex-runs/OT-88/evidence/
  commands.md
  tests/
  performance/
  accessibility/
  security/
  provider-off/
  zoom-canary/        # only if safe canary ran
```

Do not save raw environment dumps, credentials, provider responses, meeting IDs, passcodes, tokens, cookies, question bodies, or Telegram payloads. Evidence should identify commands, exit status, test counts, safe summaries, and artifact paths.

## Completion, Git, and draft PR

After implementation:

1. run format/lint/type/unit/integration/e2e/security checks required by the repository;
2. run the leakage scan and verify no forbidden material in ordinary outputs or committed evidence;
3. update `STATE.json`, `RESUME.md`, and `FINAL.md` with exact results;
4. ensure no generated secret/test credential is staged;
5. ensure `git diff --check` passes;
6. commit intentionally on `codex/ot88-zoom-learner-classroom`;
7. push that branch to the same intended remote without force;
8. open a **draft** pull request with base `codex/ot84-telegram-action-gateway` and head `codex/ot88-zoom-learner-classroom`;
9. include test and canary status in the draft PR body; and
10. finish with `git status --porcelain` empty.

If push or draft PR creation is impossible because authentication/permissions are unavailable, do not claim completion. Preserve the local commit, record `BLOCKED_PUSH_OR_DRAFT_PR`, and provide exact safe resume commands. Never force-push or change GitHub outside the target branch/draft PR workflow.

## Exact final report contract

`ops/codex-runs/OT-88/FINAL.md` and your final response must include:

1. **Status** — `READY_FOR_REVIEW`, `READY_FOR_ZOOM_CANARY`, or an explicit blocked state.
2. **Repository/worktree** — resolved repository root and worktree path.
3. **Source proof** — source remote, source branch, fetched ref, actual resolved source commit.
4. **OT-83 proof** — provenance evidence and functional file paths.
5. **Target** — branch and final commit(s).
6. **Implemented scope** — concise module/migration/UI/API summary.
7. **Security invariants** — how raw-link/token/log/Telegram leakage is prevented.
8. **Authorization evidence** — three seats/fourth denial/cross-household/sibling/school cases.
9. **Test evidence** — every command, exit status, test totals, and artifact paths.
10. **Performance evidence** — 30-sample raw file and p50/p95/max summary.
11. **Accessibility/RTL/reduced-motion evidence**.
12. **Provider-off/sink evidence** and outbound-call counts.
13. **Zoom canary** — ran/not run, test account scope, results, and missing prerequisites; never values.
14. **Question/OT-84 evidence** — redaction, retry, idempotency, and privacy.
15. **No-BNA-fanout evidence** using the repository’s definition.
16. **Git/PR evidence** — push result and draft PR URL, or exact blocker.
17. **Cleanliness** — `git status --porcelain` result and `git diff --check` result.
18. **Resume instructions** — exact commands/path/checkpoint for the next operator.
19. **Known limitations** — especially provider-owned UI/account settings and disabled spotlight automation.

Do not use vague statements such as “tests passed” without commands and counts. Do not claim a Zoom canary ran when it did not.

## Official sources to consult and cite in run documentation

- https://developers.zoom.us/docs/meeting-sdk/web/
- https://developers.zoom.us/docs/meeting-sdk/web/client-view/
- https://developers.zoom.us/docs/meeting-sdk/web/component-view/supported/
- https://github.com/zoom/meetingsdk-react-sample
- https://github.com/zoom/meetingsdk-auth-endpoint-sample

Also consult current official browser support, error-code, meetings/registration, and API reference pages as needed. Record access date and installed SDK version. Prefer official Zoom documentation and official Zoom repositories.

## Final implementation standard

Deliver the smallest repository-native implementation that fully enforces the domain and security invariants. Keep provider-specific mechanics behind tested server-side boundaries. Fail closed. Do not leak credentials. Do not substitute a reusable Zoom URL. Do not inject child questions into Zoom. Do not automate spotlighting in V1. Do not mutate production Zoom. Do not send broad reminders. Preserve an exact, resumable evidence trail.

---
