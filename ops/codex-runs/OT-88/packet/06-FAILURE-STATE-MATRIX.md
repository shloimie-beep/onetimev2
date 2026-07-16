# OT-88 Failure-State Matrix

## Principles

- The classroom shell owns stable state names and learner copy.
- Raw Zoom error messages/codes never appear in learner UI.
- The learner is never asked for a meeting number, passcode, registration token, or host credential.
- No failure path falls back to a raw Zoom URL.
- Retry is bounded and state-aware. Reauthorization precedes every new launch attempt.
- Telemetry contains only opaque application IDs and coarse categories.

## Matrix

| App state | Typical detector / source | Learner-safe copy | Primary action | Retry / recovery | Restricted telemetry | Security behavior |
|---|---|---|---|---|---|---|
| `AUTH_REQUIRED` | Missing/expired One Time session; auth middleware | “Please sign in again to join class.” | Sign in | Return to safe portal route after fresh auth; never preserve launch material | `auth_required`, occurrence ID if already safely resolved | Do not reveal whether a grant/question exists; invalidate pending grant where appropriate |
| `LEARNER_NOT_ELIGIBLE` | No active named seat, wrong account type, inactive entitlement | “Class access is not available for this profile.” | Back to account/help | No automatic retry; re-evaluate after account change | coarse policy reason restricted to audit | Do not disclose other household/learner records |
| `SEAT_LIMIT_REACHED` | Guardian seat activation transaction would exceed 3 | “This family plan already has three active learner profiles.” | Manage existing seats | Retry only after a seat is ended/revoked under policy | entitlement ID, active count, policy version; no learner names in generic logs | Visible only to authorized guardian for own household |
| `CROSS_HOUSEHOLD_DENIED` | Target object not in actor household | Generic “This item is not available.” | Back | None | `authorization_denied` with opaque actor/target scopes | Use non-enumerating response; no target details |
| `SIBLING_ACCESS_DENIED` | Session learner differs from target learner/grant/question | Generic “This item is not available for this profile.” | Switch through normal sign-in/profile flow | None on current session | `learner_scope_mismatch` | Do not permit guardian/sibling impersonation shortcut |
| `TOO_EARLY` | `now < join_opens_at` | “Class is not open yet. It starts at 7:00 PM.” | Stay on card | Server-provided safe countdown; no provider call | occurrence ID, seconds-to-open bucket | Do not issue a launch grant early |
| `OCCURRENCE_CANCELLED` | Occurrence status cancelled/superseded | “Today’s class is not available.” | Back to schedule | Refresh schedule; no provider call | safe occurrence status | Do not expose provider configuration or alternate link |
| `OCCURRENCE_ENDED` | `now > join_closes_at`, app status ended, or provider ended | “This class has ended.” | Return to class page | No join retry; allow safe question/status view per product | `ended`, source `app` or provider code category | Revoke unconsumed grants; clear launch context |
| `GRANT_ISSUE_RATE_LIMITED` | Per learner/session/occurrence limiter | “Please wait a moment before trying again.” | Retry after shown delay | Honor `Retry-After`; do not queue repeated requests | limiter bucket/category, no IP | Do not mint extra grants during lockout |
| `GRANT_EXPIRED_OR_USED` | App grant expired, replayed, consumed, revoked, wrong digest/session | “This join attempt has expired. Return to the class page to try again.” | Return to class page | Fresh full authorization and new grant only | `expired`, `replay`, `revoked`, or `binding_mismatch` restricted | Never call Zoom; do not distinguish token state to unauthorized caller |
| `PROVIDER_PREPARING` | Readiness `READY_FOR_ZOOM_CANARY`/unconfigured for general use | “The classroom is still being prepared.” | Back / refresh later | Refresh readiness; operations action required | readiness enum/check booleans only | Join remains disabled; no raw-link fallback |
| `PROVIDER_UNAVAILABLE` | Adapter timeout, circuit open, DNS/service error, safe 5xx mapping | “The classroom service is temporarily unavailable.” | Try again | Bounded retry with jitter; circuit breaker; new grant if prior one consumed | latency, timeout/circuit category; no provider body | Scrub exceptions; never display/record request payload or credentials |
| `HOST_NOT_STARTED` | Zoom meeting-not-started error, commonly provider code `3008` | “The teacher has not started class yet.” | Keep waiting / try again | Bounded poll/rejoin using new server decision as required; stop at join close | provider code stored only in restricted numeric field; wait duration | Never ask for passcode or expose meeting ID |
| `WAITING_ROOM` | SDK waiting-room state/event | “You’re in the waiting room. The teacher will let you in.” | Wait / leave | Maintain SDK session; attendance state `WAITING`; safe leave | attempt ID, waiting duration | No question/credential leakage; keep portal shell controls available |
| `DEVICE_PERMISSION_REQUIRED` | Browser permission prompt pending | “Allow microphone and camera access to participate.” | Open permission instructions / continue audio-only if product allows | User-mediated retry; do not loop prompts | coarse `mic`, `camera`, or both; no device labels | Do not collect device inventory; respect denial |
| `DEVICE_PERMISSION_DENIED` | Browser/SDK permission denied | “Camera or microphone access is blocked. Check your browser settings.” | Show browser-safe instructions / rejoin | New attempt only after user changes permission; preserve no provider fields | permission category and browser class only | Do not log device names or enumerate hardware |
| `NETWORK_POOR` | SDK network-quality level, high latency/loss, app online state | “Your connection is weak. Class may pause while it recovers.” | Stay / reconnect | SDK-managed recovery; show bounded status; optionally suggest audio-only if supported | coarse level/bucket, direction, duration; no raw metrics unless privacy-approved | Do not transmit participant-wide network data; only local attempt |
| `RECONNECTING` | Provider code/event equivalent to `4000` | “Reconnecting to class…” | Wait / leave | SDK-managed retry with timeout; transition to disconnected if exhausted | reconnect count/duration | Do not re-use a consumed app grant to bootstrap a second client instance |
| `DISCONNECTED` | Provider code/event equivalent to `4001`, browser offline | “You were disconnected.” | Return and rejoin | Destroy client; fresh authorization + new grant | disconnect category, online/offline flag | Clear provider fields; no hidden auto-loop |
| `CLASS_FULL` | Provider capacity reached, commonly `4005` | “The class is full right now.” | Try again / contact support per product | Bounded retry if occurrence remains open; operations alert | occurrence/attempt IDs and capacity category; no meeting ID | Do not offer alternate provider link |
| `MEETING_LOCKED` | Provider code equivalent to `4006` | “Class entry is closed.” | Return to class page | No automatic retry unless operations changes state | `meeting_locked` | Treat as provider/host state; no credentials |
| `REMOVED_BY_HOST` | Provider code equivalent to `3009` | “You have left this class session.” | Return to class page | Product policy decides whether a later new grant is allowed; default no immediate loop | `removed_by_host` | Do not reveal host identity or provider detail; abuse-safe cooldown |
| `REGISTRATION_MISCONFIGURED` | Provider says registration required (`3099`) or token invalid/missing | “The classroom could not be opened.” | Return / support | No learner retry loop; mark readiness degraded and alert operations | coarse config code and adapter version; no token | Never ask learner to register directly or expose `join_url`/`tk` |
| `PASSCODE_MISCONFIGURED` | Provider wrong-password error, commonly `3004` | “The classroom could not be opened.” | Return / support | Disable affected provider mapping until corrected | coarse config code; no passcode or provider response | Never prompt for passcode; redact request/exception |
| `HOST_ADMIN_BLOCKED` | Provider code equivalent to `6603` | “The classroom is not available right now.” | Return | Operations/account configuration required | `host_admin_blocked`, account config reference only | General join disabled; no alternate link |
| `SDK_VERSION_UNSUPPORTED` | Provider code equivalent to `10000`, local minimum-version check | “The classroom needs an update before it can open.” | Return | Deploy supported SDK; no runtime retry storm | installed version, required policy/version source date | Disable join or use verified compatible fallback only; never load arbitrary CDN version |
| `COMPONENT_UNSUPPORTED` | Mobile/tablet, browser/feature/privacy check fails | No error shown; “Opening the compatible classroom view…” if transition is visible | Continue | Select client view before fetching provider material | failed capability flags, browser class; no full UA | Fail to client view, not raw link; do not expose component bootstrap |
| `COMPONENT_INIT_FAILED` | Component SDK init error after bootstrap | “Opening the compatible classroom view…” | Safe fallback | Destroy component client; obtain a new grant before client-view bootstrap if provider fields were consumed | `component_init_failed`, SDK version | Never carry provider fields across routes/global state; no silent reuse if single-use semantics would be broken |
| `CLIENT_INIT_FAILED` | Client SDK init/import/CSP failure | “The classroom could not open on this browser.” | Return / supported-browser help | One bounded retry; then operations/support | init stage, CSP/category, browser class | No provider values in error boundary, console capture, or support serialization |
| `CSP_OR_RESOURCE_BLOCKED` | Browser security policy, asset/worker failure | “The classroom could not load securely.” | Return | Fix deployment policy; avoid weakening CSP at runtime | blocked resource origin category and policy version | Never inject `unsafe` exceptions dynamically or load unapproved scripts |
| `CLOCK_SKEW` | Client clock differs materially; signed timestamp/idempotency validation | “Please refresh the page and try again.” | Refresh | Server time remains authoritative; new grant | skew bucket | Do not extend grant based on client time |
| `QUESTION_RATE_LIMITED` | Learner/occurrence question limiter | “Please wait before sending another question.” | Retry later | `Retry-After`; current submitted questions remain visible | limiter category, count bucket | Do not echo rejected content into logs/Telegram |
| `QUESTION_REJECTED` | Empty/too long/disallowed shape/moderation hold | “Please shorten or edit your question.” or “Your question is being checked.” | Edit / wait | Deterministic validation; moderation flow where applicable | reason enum only; never body | Avoid revealing detailed abuse heuristics |
| `QUESTION_DUPLICATE` | Same idempotency key/body retry | Existing question state | View state | Return prior result | duplicate/idempotency category | Do not create duplicate alert |
| `TELEGRAM_RETRYING` | OT-84 temporary failure | Learner still sees “Submitted”; no delivery detail needed | None | Outbox backoff with stable idempotency key | attempt count/error category/next time | No full question or Telegram response in logs |
| `TELEGRAM_DEAD_LETTER` | Retry exhaustion/permanent failure | Learner-safe state remains; internal alert | None | Operations re-drive through authorized tool | opaque intent/question IDs, coarse failure | Never reroute to arbitrary recipient or include full body in support ticket |
| `MODERATION_ACTION_STALE` | Rabbi action repeats or conflicts with current state | “That action is no longer available.” | Refresh | Idempotent success for exact duplicate; reject conflict | action/state/version | Do not reveal other moderators/learners |
| `MODERATOR_LINK_EXPIRED` | Rabbi-only deep-link grant expired/used | “This moderation link has expired.” | Re-open from authorized workflow | Mint a new moderator grant only after Rabbi reauthorization | grant status/category | Never fall back to learner session or question URL without auth |
| `FEATURE_AUTOMATION_DISABLED` | `ZoomFeatureParticipantPort` disabled | Rabbi: “Selected in One Time. Use normal host controls to feature the learner.” | Continue host workflow | No provider retry | explicit disabled reason | No Zoom call; no false success claim |
| `UNKNOWN_SAFE_FAILURE` | Unclassified exception after redaction | “Something went wrong opening class.” | Return / retry once | Correlation ID for support; circuit rules | opaque correlation ID and stage only | Default deny, destroy context, suppress bodies and credentials |

## State-transition guidance

```text
PORTAL_READY
  -> AUTHORIZING
  -> LAUNCH_SHELL
  -> BOOTSTRAPPING
  -> WAITING | JOINING
  -> JOINED
  -> RECONNECTING -> JOINED
  -> LEFT | ENDED | FAILED

Any FAILED/LEFT/ENDED transition destroys the SDK client and provider bootstrap references.
A new JOINING path requires a new application launch grant.
```

## Retry rules

1. **Never retry authorization denial automatically.** Refreshing server state is allowed; bypassing policy is not.
2. **Never retry a consumed launch grant.** Return to the class page for a new grant.
3. **Never ask the learner for provider credentials.** Wrong passcode/registration errors are operations/configuration failures.
4. **Bound provider retries.** Use jitter/backoff/circuit breaker; avoid synchronized retry storms at 19:00.
5. **Separate SDK reconnect from new launch.** In-session reconnect may be SDK-managed; a destroyed/left client needs new authorization.
6. **Idempotent external retries.** OT-84 and reminders keep the same idempotency key.
7. **No broad failover.** Provider failure does not fan out a Zoom link, reminder, Telegram message, or support payload to extra recipients.

## Support correlation

Learner-facing error pages may show a short opaque correlation code generated by One Time. The support lookup behind that code may reveal only safe application state and coarse failure category. It must not decode to or embed provider IDs, learner IDs, meeting details, tokens, or question content.
