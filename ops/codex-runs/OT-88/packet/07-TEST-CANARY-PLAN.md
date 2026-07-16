# OT-88 Test and Canary Plan

## Release gates

| Gate | Required outcome |
|---|---|
| G0 — Preflight | Remote OT-84 branch resolved dynamically; OT-83 portal foundation proven; clean OT-88 worktree and run files created. |
| G1 — Domain/persistence | Migrations and invariants pass, including transactional 3-seat maximum and immutable occurrence behavior. |
| G2 — Provider-off | Full application flow works with deterministic Zoom/Telegram/reminder fakes and no external calls. |
| G3 — Security/privacy | Authorization, replay, leakage, redaction, CSRF/origin, and secret-scan tests pass. |
| G4 — UX/accessibility | Responsive client/fallback selection, failure states, keyboard, RTL, reduced motion, and app-shell accessibility pass. |
| G5 — Performance | Thirty raw samples are recorded and summarized; app-owned budgets are met or an explicit blocker is recorded. |
| G6 — Zoom canary | Optional only when protected test prerequisites exist; otherwise status is `READY_FOR_ZOOM_CANARY`. |
| G7 — Git/evidence | Exact evidence and resume files complete, branch pushed, draft PR open, worktree clean. |

## Test environments

### A. Pure domain/unit

- no database/network where not needed;
- fixed clock with `Asia/Jerusalem` cases;
- deterministic IDs/randomness through test seams;
- property/concurrency tests for seat and grant invariants.

### B. Integration with local test database

- real migrations and constraints;
- transactional concurrency;
- auth/session/CSRF middleware;
- outbox claiming and idempotency;
- encryption helper using test key provider, never committed key material.

### C. Provider-off end-to-end

- browser tests against the full app;
- Zoom adapter is a deterministic sink/fake;
- Meeting SDK mount is simulated at the adapter boundary or official module is mocked without network;
- OT-84 and reminder delivery use recording sinks;
- outbound network policy denies Zoom/Telegram/real delivery hosts.

### D. Zoom test canary

- explicit test account and test meeting only;
- credentials supplied through protected secret mechanism;
- synthetic/approved test learner identities;
- canary allowlist and mutation flags verified;
- no production Zoom mutation or broad reminders.

## Required fixture model

Create fixtures/factories for:

- Household A with active $67 family entitlement and learners A1, A2, A3, A4.
- Household B with active entitlement and learner B1.
- Household C school/no-subscription profile C1.
- Active, suspended, expired, and revoked entitlement variants.
- Active/revoked learner seats.
- Daily class series at 19:00 `Asia/Jerusalem` with configured duration.
- Occurrences before open, open, waiting, active, ended, cancelled, and superseded.
- Provider readiness states and sink/failure scripts.
- Authorized Rabbi identity, unauthorized Telegram identity, and support actor.
- Question, reminder, launch-grant, and attendance records with deterministic opaque IDs.

Do not use production child data or production provider values in fixtures.

## Domain and persistence cases

### Seats and entitlement

1. Activate A1, A2, and A3 successfully.
2. Deny A4 as the fourth active learner.
3. Run two concurrent attempts for the last available seat and prove exactly one succeeds.
4. End/revoke a seat and activate a replacement according to product policy.
5. Deny launch for a suspended/revoked seat.
6. Deny launch for expired, suspended, past-due, or revoked entitlement according to existing billing semantics.
7. Deny C1 school/no-subscription access.
8. Verify a guardian can manage only their household seats and cannot join as a learner.

### Timezone and occurrence immutability

1. Generate occurrences around Israel DST transitions and assert local start remains 19:00.
2. Assert T-30 resolves to 18:30 local on both sides of DST changes.
3. Assert recurrence generation does not add fixed 24-hour UTC intervals.
4. Assert schedule fields cannot update in place after occurrence creation.
5. Assert a correction creates a replacement/superseding occurrence with history retained.
6. Assert cancelled/superseded/ended occurrences cannot issue grants.

### Launch grants

1. Issue for A1 in open window.
2. Deny before join window and after close.
3. Deny for sibling A2 when the target/grant belongs to A1.
4. Deny B1 cross-household access.
5. Consume once successfully.
6. Replay same grant and prove Zoom adapter call count remains zero for replay.
7. Expire the grant and prove no adapter call.
8. Revoke entitlement/seat after issue but before consume; consume must fail.
9. Change occurrence status after issue; consume must fail.
10. Bind to authenticated session/learner and reject wrong session.
11. Reject malformed/guessed token without resource enumeration.
12. Verify issue and consume rate limits and `Retry-After` behavior.
13. Verify participant role is always `0` regardless of request body.
14. Verify leave/rejoin requires a newly issued grant and attempt.

## Authorization/IDOR cases

Test every opaque identifier independently:

- household;
- entitlement;
- learner seat;
- occurrence;
- provider mapping;
- launch grant;
- attendance attempt;
- question;
- alert intent; and
- moderator deep-link grant.

For each, test self, sibling, other household, guardian, Rabbi, support, anonymous, and internal actor as applicable. Verify denials do not reveal object existence or sensitive relationships.

## Normal-surface leakage suite

Create an automated scanner over:

- safe next-class API JSON;
- portal SSR/HTML and hydration state;
- client-side global/state stores;
- rendered error pages;
- browser URL/history/referrer;
- application logs and structured test sink;
- tracing/error-reporting test sink;
- analytics event sink;
- support serialization/export;
- Telegram test sink;
- reminder sink;
- snapshots and committed fixtures;
- built static assets/source maps; and
- run/evidence files.

Search for exact seeded canary values and structural patterns including:

- provider `join_url` / `zoom.us/j/` patterns;
- meeting number/UUID;
- passcode and telephone passcode;
- `pwd=`/`tk=`/ZAK/OBF query fragments;
- Meeting SDK signature/JWT;
- SDK/client secret;
- host/co-host token;
- registrant token/ID;
- launch bearer secret;
- cookies/authorization headers; and
- unredacted question text/contact information.

The test uses unique seeded sentinels so false confidence is not based only on generic regexes.

### Dedicated bootstrap exception test

The launch bootstrap is the only browser response allowed to contain the minimum Meeting SDK join fields. Test that it:

- is inaccessible before successful issue/consume;
- is same-origin POST only;
- requires valid session, CSRF/origin, learner scope, and unconsumed grant;
- is returned once;
- contains no raw Zoom join URL;
- contains no SDK secret, host role, ZAK, OBF, host token, or unrelated provider data;
- has no-store/no-referrer/security headers;
- is excluded/redacted from logs, traces, analytics, service worker, CDN cache, SSR, and browser storage;
- cannot be replayed to obtain another bootstrap; and
- causes application references to be cleared after SDK invocation/leave.

## View-selection and browser cases

### Mobile/tablet

- iPhone/Safari supported profile -> client view.
- Android/Chrome supported profile -> client view.
- tablet profile -> client view.
- Android Firefox or unsupported browser according to current official policy -> safe unsupported/fallback behavior, never component view.
- orientation changes and responsive full-page shell.

### Desktop

- verified desktop browser + feature flag + privacy capability -> component view.
- component flag off -> client fallback.
- feature matrix requirement missing -> client fallback.
- inability to suppress invite/meeting info -> client fallback and readiness evidence.
- component init failure -> destroy context and use a fresh-grant safe fallback path.
- unsupported SDK version -> disable or verified compatible fallback, no arbitrary runtime CDN swap.

### UI privacy assertions

In both real canary views where possible, verify by visual/DOM inspection that the learner cannot access:

- Invite/copy-link controls;
- meeting number/UUID;
- passcode;
- registration token;
- meeting-info panel containing provider credentials;
- Zoom chat input;
- recording controls contrary to policy; or
- host/co-host controls.

If the provider-owned UI cannot satisfy this, fail the canary and disable that view/path.

## Failure-state tests

For each state in `06-FAILURE-STATE-MATRIX.md`, verify:

- deterministic detector mapping;
- learner-safe copy;
- keyboard focus/live-region behavior;
- allowed CTA only;
- bounded retry behavior;
- telemetry category and no raw provider message;
- cleanup of launch/SDK context; and
- no raw-link fallback.

Inject at least these provider categories in the fake adapter and map current official codes in adapter contract tests:

- host not started;
- wrong passcode/configuration;
- registration required/misconfigured;
- reconnecting;
- disconnected;
- ended;
- capacity reached;
- locked;
- removed;
- host-admin blocked;
- unsupported SDK version; and
- timeout/provider 5xx/circuit open.

## Attendance/privacy cases

1. Authorized attempt accepts allowlisted ordered events.
2. Duplicate idempotency key is a no-op.
3. Wrong learner/attempt is denied.
4. Invalid transition/order is rejected or safely normalized according to documented state machine.
5. Client timestamps outside tolerance do not control authorization/duration.
6. Network telemetry is coarse and local-attempt scoped.
7. Schema rejects captions, chat, participant list, display name, provider IDs, tokens, and arbitrary blobs.
8. Leave/ended closes summary deterministically.
9. Optional webhook reconciliation verifies signature and identity mapping; unproven identity remains disabled.
10. No media capture or AI/bot join code exists.

## Question queue cases

### Submission

- learner A1 submits for authorized occurrence;
- empty/whitespace rejected;
- over-length rejected;
- disallowed markup/attachment/URL behavior according to policy;
- Unicode normalization deterministic;
- idempotent retry returns same question;
- rate limit works by learner/occurrence;
- seat/entitlement revoked denial;
- sibling A2 cannot submit as A1;
- B1 cannot target A occurrence;
- school/no-subscription denied;
- encrypted original differs from plaintext and no plaintext appears in database logs/snapshots;
- redacted preview removes seeded email/phone/contact sentinel and truncates safely.

### Learner visibility

- A1 sees only A1 safe state;
- A2 cannot see A1 question, even same household;
- learner projection excludes moderator notes/reasons/other ordering;
- dismissed/answered/feature states use approved safe copy.

### OT-84 alert/retry

- exactly one outbox intent per submitted question/idempotency key;
- authorized Rabbi recipient reference only;
- payload contains opaque question ID and redacted preview only;
- payload contains no child session, full profile, household, Zoom data, or unredacted text;
- retry uses same idempotency key and does not duplicate alert/action;
- permanent failure moves to dead letter and does not fan out to another recipient.

### Moderation

- authorized OT-84 actor can `Feature next`, `Answered`, `Dismiss`;
- unauthorized Telegram identity denied;
- stale/conflicting action handled safely;
- exact duplicate action is idempotent;
- one current `FEATURE_NEXT` per occurrence under concurrency;
- Rabbi-only deep link is separate, short-lived, single-use, and requires Rabbi auth;
- deep link cannot establish learner session;
- `Feature next` calls disabled `ZoomFeatureParticipantPort`, receives `UnsupportedDisabled`, and still records application selection/instruction;
- no Zoom chat or spotlight API call occurs.

## Reminder cases

1. Due time is 18:30 local for every occurrence.
2. Active opted-in eligible learner produces one intent.
3. Opted-out, inactive seat, inactive entitlement, cancelled occurrence, or unauthorized destination produces `SKIPPED`/no send.
4. Multiple scheduler instances produce one unique intent.
5. Retry does not duplicate delivery.
6. Sink copy contains safe One Time call to action only.
7. No Zoom URL/meeting data/grant.
8. External delivery flag off prevents real delivery.
9. Canary allowlist blocks non-test recipients.
10. Outbound request count proves no broad fanout.

## No-BNA-fanout evidence

First locate and document the repository’s existing definition of BNA. Then add tests at the relevant boundary. At minimum, the evidence must count outbound side effects for a controlled fixture and prove that:

- one learner question creates at most the intended single authorized Rabbi alert intent;
- one reminder key creates at most one intended sink/allowlisted delivery;
- retries do not add recipients;
- provider failure does not trigger alternate links/messages;
- no background job enumerates all households/learners outside the due/eligible scope; and
- no test touches production recipient/provider destinations.

Record the exact repository-native assertion and outbound counts.

## Thirty-sample performance protocol

Collect 30 raw samples on the final commit:

| Path | Samples | Mode |
|---|---:|---|
| Mobile/tablet protected client-view shell | 10 | Provider sink; mobile emulation, include cold and warm runs. |
| Desktop component-eligible shell | 10 | Provider sink; component path selected and mocked SDK mount. |
| Desktop forced client fallback | 10 | Provider sink; component disqualified before bootstrap. |

For each sample capture:

- commit and build identifier;
- environment/runtime/browser profile;
- cold/warm marker;
- authenticated next-class response duration;
- launch-grant issue duration;
- shell navigation to app-owned ready state;
- bootstrap sink duration;
- SDK mount-boundary duration;
- total app-owned time;
- CLS;
- long-task count/duration if available;
- result/state; and
- no-leak assertion result.

Store raw machine-readable data and a generated summary with p50/p95/max. Do not cherry-pick successful runs. Failed samples remain in the data with reason.

Use existing budgets if present. Otherwise use provisional targets from the direct prompt and record whether the environment makes them meaningful. External Zoom join time from a real canary is reported separately and not used to excuse slow app-owned authorization/shell work.

## Accessibility, keyboard, RTL, reduced-motion protocol

### Automated

- run repository accessibility checks/axe equivalent on app-owned next-class, authorizing, launch shell pre-SDK, failure, question, and leave states;
- zero critical/serious findings in app-owned UI;
- semantic validation and color contrast according to project standard.

### Manual/automated interaction

- complete join flow keyboard-only;
- focus moves to status/error and returns to Join/portal after leave;
- no keyboard trap in app shell; document provider SDK behavior separately;
- live regions do not announce secrets or spam reconnect updates;
- question form labels, limits, validation, and status are announced;
- Hebrew/RTL order, alignment, icons, and punctuation are correct;
- times render as intended for locale and timezone;
- `prefers-reduced-motion` removes nonessential motion;
- 200% zoom/text resize does not hide Join/Leave/error controls;
- mobile orientation does not expose/overflow provider data.

Capture sanitized evidence without learner/provider secrets.

## Provider-off network isolation

During provider-off CI/e2e:

- deny outbound DNS/network to Zoom, Telegram, and real delivery providers where the test runner supports it;
- fail the test if an unexpected external request occurs;
- assert fake adapter call counts and argument classifications without snapshotting secrets;
- ensure environment has no protected Zoom credentials; and
- prove the application reaches safe `PROVIDER_PREPARING`/sink states.

## Zoom canary prerequisites

All must be true:

- protected test Meeting SDK credentials available through secret manager/CI secret;
- SDK secret never printed;
- test Zoom account relationship/authorization verified under current policy;
- test meeting exists and is not production;
- meeting/registrant configuration supports the selected identity strategy;
- explicit synthetic/approved test learner identities;
- explicit canary occurrence and recipient allowlists;
- installed SDK meets current minimum policy;
- client-view hardening options verified in types/reference;
- component privacy controls verified before component canary;
- canary operator authorization recorded;
- external reminder delivery remains off unless a single approved test target is part of the canary; and
- no production mutation flag enabled.

If any prerequisite is false/unknown, do not run a real canary. Record `READY_FOR_ZOOM_CANARY` and the missing checklist without values.

## Zoom canary procedure

1. **Readiness-only check** — validate credentials by a safe supported operation and verify account/meeting relationship; do not mutate production.
2. **Single test learner, client view** — issue/consume grant, waiting/host-not-started, join, leave, fresh-grant rejoin.
3. **Mobile profiles** — supported iOS Safari and Android Chrome devices/emulators where available; verify permissions and full-page client view.
4. **Desktop fallback** — force client view and verify invite/header/chat/provider-info suppression.
5. **Desktop component** — only if all eligibility checks pass; verify absence of copy-link/meeting-info credential exposure and required states.
6. **Registration** — prove learner-specific registrant identity/token behavior without exposing token in evidence.
7. **Three simultaneous test learners** — each distinct application identity/device/session; attendance separated.
8. **Fourth-seat denial** — application denial before any provider call.
9. **Failure behavior** — safe simulation for capacity/provider-down; induce only harmless test-account states for waiting/ended/locked as approved.
10. **Question workflow** — submit synthetic text, OT-84 sink or one approved test recipient, moderation actions, no Zoom chat.
11. **Cleanup** — leave sessions, revoke temporary app grants, remove temporary test records according to test-account policy; no production changes.

## Canary pass criteria

- successful protected join for each approved path;
- mobile/tablet never selects component view;
- desktop fallback works;
- component path, if enabled, reveals no invite/copy link/meeting number/passcode/chat/host control;
- participant identity correlation is correct for test learners;
- no provider credential appears in logs/traces/analytics/screenshots/evidence;
- leave/rejoin requires a new grant;
- provider errors map to safe app states;
- attendance remains minimized;
- question workflow stays outside Zoom chat/media;
- outbound side effects remain allowlisted/idempotent; and
- evidence is reproducible and sanitized.

Any privacy/control failure disables the affected path and yields `CANARY_FAILED` or client fallback. Do not waive a leak because it is “only in Zoom UI.”

## Final evidence checklist

- [ ] source branch/commit and OT-83 proof;
- [ ] migration/domain tests;
- [ ] three-seat and concurrent fourth denial;
- [ ] cross-household/sibling/school denials;
- [ ] grant replay/expiry/revocation;
- [ ] no-leak scanner and dedicated-bootstrap tests;
- [ ] mobile/client and desktop/fallback/component policy;
- [ ] all required failure states;
- [ ] question privacy and OT-84 retry/idempotency;
- [ ] reminder T-30/idempotency/sink;
- [ ] provider failure/circuit behavior;
- [ ] 30 raw performance samples and summary;
- [ ] accessibility/keyboard/RTL/reduced motion;
- [ ] no-BNA-fanout outbound counts;
- [ ] provider-off external network isolation;
- [ ] Zoom canary evidence or exact `READY_FOR_ZOOM_CANARY` checklist;
- [ ] format/lint/type/test commands and counts;
- [ ] secret scan, `git diff --check`, clean status;
- [ ] push and draft PR evidence.
