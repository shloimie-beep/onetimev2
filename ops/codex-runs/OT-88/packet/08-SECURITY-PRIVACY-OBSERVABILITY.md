# OT-88 Security, Privacy, and Observability

## Security objective

Permit an entitled learner to join one class occurrence through the official Meeting SDK while preventing provider credentials and child-scoped data from becoming reusable, broadly visible, durable, or cross-account.

The design does not claim that Meeting SDK join fields are invisible to the browser that must execute them. It confines those fields to a one-time, same-origin, no-store launch bootstrap after authorization and excludes them from ordinary portal state and every secondary channel.

## Threat model

### Protected assets

- learner identity and household relationship;
- entitlement and named seat assignment;
- class occurrence and attendance state;
- student question text and moderation state;
- Zoom meeting number/UUID and passcode;
- Meeting SDK secret and generated SDK JWT/signature;
- provider registrant ID/token (`tk`);
- ZAK/OBF/host/co-host credentials;
- One Time launch bearer secret;
- Rabbi moderator grant and OT-84 action identity;
- reminder destinations; and
- audit/evidence integrity.

### Adversaries and failure modes

- unauthenticated link guesser;
- sibling using a shared device/session;
- learner changing opaque IDs in requests;
- guardian attempting to use a learner seat as a join credential;
- cross-household account;
- replay of a captured launch grant;
- browser history/referrer/cache/service-worker leakage;
- logging, tracing, analytics, support, or error-reporting capture;
- XSS/third-party script on launch surface;
- malicious or stale Telegram action;
- duplicate background-job/outbox delivery;
- provider API/SDK error echo;
- misconfigured Meeting SDK UI exposing invite or meeting information;
- cross-account Zoom authorization mismatch;
- dependency/version drift;
- operator accidentally using production credentials or recipients; and
- concurrency races in seat, grant, question, or reminder state.

## Data classification

| Class | Examples | Handling |
|---|---|---|
| `PUBLIC` | generic class product description | Normal controls. |
| `ACCOUNT_INTERNAL` | opaque household/learner/occurrence IDs, entitlement state | Authenticated, least privilege, no public enumeration. |
| `CHILD_SENSITIVE` | learner profile relationship, question body, attendance details | Encrypt where stored, strict projections, short/approved retention, no broad analytics/support. |
| `PROVIDER_SENSITIVE` | meeting number/UUID, passcode, registrant ID/token, SDK JWT | Server-restricted encrypted storage; dedicated launch bootstrap only where required; never ordinary state/logs. |
| `SECRET` | SDK/client secret, ZAK, OBF, host/co-host token, encryption keys | Secret manager only; never browser or database plaintext. |
| `BEARER` | One Time launch token, Rabbi moderation token | High entropy, digest at rest, short TTL, single use, scope-bound. |

The SDK/client ID/key may be public according to provider mechanics, but still belongs only in the launch integration and should not be mixed into ordinary portal analytics or logs.

## Trust boundaries

```text
Browser ordinary portal
    | safe app data only
    v
One Time web/API authorization boundary
    | internal calls, encrypted fields
    v
Provider adapter / secret manager
    | minimum SDK fields after consume
    v
Isolated launch shell in browser
    | official Meeting SDK network/media
    v
Zoom

OT-84 Telegram gateway and reminder delivery are separate outbound boundaries.
They never receive Zoom launch material or learner sessions.
```

## Launch grant security

- Generate with a CSPRNG; at least 128 bits, preferably 256 bits.
- Use an opaque ID plus separate secret, or an equivalently strong opaque bearer.
- Store only a keyed digest/HMAC of bearer material.
- Bind to learner, seat, occurrence, purpose, attempt, expiry, and policy version.
- Optionally bind to a privacy-minimized session/device risk digest; do not rely on IP alone.
- Return through a same-origin path with no provider values.
- Consume with an atomic compare-and-set.
- Repeat live authorization at consume time.
- Mark terminal on consume/expiry/revocation.
- Never regenerate provider material on replay.
- Rate limit issue and consume independently.
- Revoke outstanding grants on seat/entitlement/occurrence revocation where practical.

## Dedicated launch surface

### Route isolation

Prefer a dedicated route/document boundary rather than embedding SDK state into the main portal tree. It should have:

- no third-party analytics, support widget, tag manager, ads, or session replay;
- no ordinary application error body capture;
- strict same-origin POST bootstrap;
- `Cache-Control: no-store, private, max-age=0`;
- `Pragma: no-cache` where legacy intermediaries matter;
- `Referrer-Policy: no-referrer`;
- `X-Content-Type-Options: nosniff`;
- restrictive `Permissions-Policy` allowing camera/microphone only to the launch context and official SDK requirements;
- CSP limited to the current official Zoom SDK origins/resources plus One Time;
- frame policy consistent with the chosen architecture;
- no search indexing or social preview metadata;
- service-worker bypass and CDN cache bypass;
- no provider fields in URL, HTML, data attributes, source maps, page title, or meta tags; and
- explicit destruction/unmount on leave/error.

If the repository uses an iframe to isolate client-view styles, the iframe must be same-origin or use a carefully designed postMessage protocol. Provider fields must not cross to the parent. Validate `event.origin`, message type, nonce/attempt binding, and one-time semantics.

### Bootstrap response

Use a dedicated media type such as a repository-defined sensitive launch payload. Do not serialize it through generic response logging/middleware.

Allowed after successful consume:

- selected SDK view;
- SDK/client ID/key as required;
- participant-role SDK signature/JWT;
- provider meeting number/ID required by SDK;
- passcode if required;
- registrant token if required;
- learner display name derived server-side;
- safe leave URL; and
- opaque attendance attempt ID.

Forbidden:

- raw Zoom join/invite URL;
- SDK/client secret;
- role `1` or user-controlled role;
- ZAK/OBF/host/co-host token on learner path;
- provider API response bodies;
- unrelated registrant/meeting/account fields;
- question text; and
- reusable One Time session credentials.

### Browser memory

- Keep bootstrap in a local closure, not global state.
- Do not persist in local/session storage, IndexedDB, Cache API, service worker, Redux/devtools, query cache, or URL.
- Avoid debug logging.
- Pass directly into SDK init/join.
- Remove references immediately after invocation and on every terminal path.
- Do not claim reliable zeroization of JavaScript strings; rely on confinement and short validity.

## Zoom UI privacy gate

The official SDK can contain invite and meeting-information features. Therefore:

- client view must initialize with current-version controls that disable invite and hide the meeting header;
- learner Zoom chat is disabled by product policy;
- recording/call-out/Zoom Phone invite controls are disabled where the SDK supports it;
- component view is disabled until canary proves copy-link and meeting-information credentials are absent;
- account-level settings are part of readiness, not assumed;
- inability to meet the gate selects verified client fallback or disables join; and
- screenshots/DOM evidence must be sanitized and reviewed before commit.

## Authentication and session controls

- Use the OT-83 portal auth/session foundation.
- Learner identity comes from the server session.
- No profile ID in a request changes the authenticated learner.
- Sensitive POSTs require CSRF and origin checks according to repository standards.
- Rotate/revalidate session on sign-in/profile switch.
- Shared-device profile switching must end the prior learner launch context.
- Guardian session cannot impersonate a learner for join.
- Rabbi moderator session is separate and cannot inherit a learner cookie/token.
- Moderator deep links are short-lived, single-use, purpose-bound, and still require Rabbi auth.

## IDOR and cross-scope controls

Every lookup follows actor-to-resource relationships before returning existence-sensitive data. Opaque IDs reduce guessing but do not replace authorization.

Test cross-scope access for:

- learner seat;
- class occurrence;
- grant;
- attempt;
- question;
- Telegram action;
- moderator link;
- reminder intent; and
- provider mapping.

Use generic denials where detailed reasons would reveal another learner/household.

## Child question privacy

- Store only short text; no attachments in V1.
- Normalize and validate before encryption.
- Encrypt original body at rest using existing key-management conventions.
- Generate a separate redacted preview server-side.
- Redact seeded patterns for email, phone/contact handles, URLs, and other project-defined sensitive content.
- Telegram receives the preview, not the original.
- Learner projection includes only own safe state.
- Rabbi decryption occurs only in the authorized moderation service/surface.
- Support sees no body by default.
- Do not send free text to Zoom chat, analytics, logs, or AI services.
- Define configurable retention and purge jobs; do not retain indefinitely by accident.

## Logging policy

Use an allowlist logger for OT-88 events.

### Allowed fields

- event name/version;
- request/correlation ID;
- opaque actor/household/learner/seat/occurrence/grant/attempt/question IDs as policy permits;
- decision/status/reason enum;
- selected view;
- coarse client class;
- duration/count/bucket;
- provider adapter stage and coarse error code/category;
- feature-flag/readiness booleans; and
- code/build version.

### Forbidden fields

- request/response bodies for launch bootstrap;
- cookies, authorization/CSRF headers;
- provider join URL, meeting number/UUID, passcode;
- SDK JWT/signature/secret;
- registrant ID/token, ZAK, OBF, host token;
- launch bearer secret;
- full question body/redacted preview in generic logs;
- Telegram chat/user identifiers unless a restricted audit reference is explicitly required;
- full IP/user-agent/device labels; and
- secret-manager values or raw provider exceptions.

Configure tracing/APM/error-reporting middleware to drop or redact launch routes and sensitive fields before export. Sanitization after export is insufficient.

## Analytics policy

Permitted product analytics should be coarse and application-owned, for example:

- `class_card_viewed`;
- `join_authorization_allowed/denied` with coarse reason;
- `launch_shell_ready`;
- `meeting_joined` / `meeting_left` with occurrence/attempt opaque IDs and duration bucket;
- `question_submitted` and safe state transition counts; and
- `reminder_intent_sent/skipped`.

Do not include:

- provider IDs/tokens;
- question text;
- learner display name/email;
- household billing details;
- participant list;
- raw network statistics; or
- high-entropy fingerprint fields.

Do not load general analytics on the launch document if it risks bootstrap capture. Server-side minimized events are preferred.

## Attendance minimization

The goal is evidence of access/join/leave, not surveillance.

Store:

- authorized/bootstrap/waiting/joined/reconnecting/left/ended timestamps;
- selected view;
- reconnect count;
- coarse permission/network/failure category; and
- derived duration where defensible.

Do not store:

- audio/video;
- transcript/captions;
- screen share;
- chat;
- active-speaker history;
- participant roster;
- child display names from Zoom;
- device inventory; or
- raw provider telemetry dumps.

Provider webhook/report reconciliation is opt-in and disabled until signature validation and learner identity correlation are proven. Drop unrelated participants and fields at ingestion.

## OT-84 Telegram boundary

- Use only the existing authenticated OT-84 contract.
- Map the external actor to an active configured Rabbi identity.
- Use opaque question ID and redacted preview.
- Actions have stable idempotency keys.
- The gateway may relay actions but the question service owns authorization/state transition.
- Do not trust callback data alone.
- Do not include learner-session links.
- Rabbi deep link uses a separate moderator grant.
- Retries never fan out to a fallback recipient.
- Store only coarse delivery error categories.

## Reminder boundary

- Evaluate eligibility immediately before creating/sending intent.
- Unique idempotency key per occurrence, seat, channel, reminder type.
- Destination comes from approved account configuration, not scheduler input.
- Copy says to open One Time; no Zoom/provider/grant data.
- External adapter is a sink by default.
- Canary targets one explicit approved destination at most.
- Retry preserves recipient and idempotency key.
- Permanent failure does not redirect to another person/channel automatically.

## Rate limiting and abuse controls

Use repository-native distributed limits where required.

Recommended scopes:

- launch issue: learner + occurrence + session;
- launch consume: grant + learner/session + source risk bucket;
- question submit: learner + occurrence and household aggregate;
- moderator link issue/consume: Rabbi + question;
- OT-84 action: actor + question + action;
- reminder worker: intent and destination; and
- support lookup: support actor + correlation ID.

Return safe `Retry-After` values. Avoid storing raw IP; use existing privacy-preserving abuse infrastructure.

## Concurrency and idempotency

- Seat max enforced in database transaction/constraint.
- Grant consume compare-and-set.
- Question submission unique idempotency key.
- One active `FEATURE_NEXT` per occurrence via lock/constraint.
- Telegram and reminder outbox unique keys.
- Attendance events deduplicated by attempt-local key/sequence.
- Webhook events deduplicated by provider event ID stored as a keyed digest if the raw ID is sensitive.

## Encryption and secret management

- Reuse existing envelope encryption/secret store.
- Keep SDK secret and host authorization only in secret manager.
- Store provider meeting/passcode/registrant material encrypted only when necessary.
- Separate key/reference access by service role where infrastructure supports it.
- Do not use reversible “encoding” as encryption.
- Never commit `.env`, test credentials, provider fixtures, or captured responses.
- Secret scans run before commit and on evidence artifacts.

## Dependency and supply-chain controls

- Verify the installed `@zoom/meetingsdk` version against current official minimum policy.
- Pin through the repository’s normal lockfile; do not hot-load an arbitrary latest CDN version at runtime.
- Review changelog/breaking changes for the chosen upgrade.
- Use official Zoom packages/repositories, not unverified forks.
- Record package version and source access date in run evidence.
- Run repository dependency/license/security checks.

## CSP and external resources

Build CSP from current official Zoom browser-support guidance and the application’s architecture. Do not copy a broad example without narrowing it and testing.

Validate:

- scripts/workers/WASM/media/connect/WebSocket origins required by the installed SDK;
- `worker-src blob:` or other required worker behavior;
- `script-src-elem` consistency if present;
- camera/microphone permissions in iframe/WebView architecture;
- no unrelated third-party origins on launch route; and
- report-only rollout before enforcement where repository policy requires it.

CSP failure must produce a safe disabled state, not dynamic weakening.

## Observability events

Suggested allowlisted events:

```text
ot88.next_class.evaluated
ot88.launch_grant.issue_allowed
ot88.launch_grant.issue_denied
ot88.launch_grant.consumed
ot88.launch_grant.consume_denied
ot88.launch.bootstrap_created
ot88.launch.bootstrap_failed
ot88.sdk.state_changed
ot88.attendance.event_accepted
ot88.question.submitted
ot88.question.alert_intent_created
ot88.question.moderation_transition
ot88.reminder.intent_created
ot88.reminder.delivery_result
ot88.provider.readiness_assessed
ot88.provider.canary_result
```

Each event has a documented schema and automated forbidden-field test.

## Evidence hygiene

Evidence files must contain commands, versions, counts, timings, safe states, and paths—not raw payloads.

Before commit:

1. scan evidence for all seeded secret/provider/question sentinels;
2. inspect screenshots/HTML reports manually;
3. strip environment dumps and request/response bodies;
4. ensure browser traces/HAR files are not committed unless transformed to a safe metric-only form;
5. ensure test videos do not display credentials/child data; preferably do not commit video; and
6. list every retained evidence file in the final report.

## Security acceptance checklist

- [ ] no reusable Zoom URL in database, API, UI, logs, Telegram, reminder, support, or evidence;
- [ ] no SDK/client secret or host credential reaches browser;
- [ ] ordinary portal never receives meeting/passcode/registrant/SDK signature fields;
- [ ] dedicated bootstrap is one-use, scope-bound, no-store, redacted from telemetry, and contains no raw join URL;
- [ ] three-seat rule is transactional;
- [ ] sibling/cross-household/guardian impersonation denied;
- [ ] consume-time reauthorization and replay prevention;
- [ ] provider UI privacy gate and secure fallback;
- [ ] learner chat/record/invite policy enforced and canary verified;
- [ ] questions encrypted, preview redacted, own-state only, outside Zoom;
- [ ] OT-84 actor/recipient authorized and idempotent;
- [ ] moderator link separate from learner session;
- [ ] reminders sink/default, allowlisted, idempotent, no provider data;
- [ ] attendance minimized; no media/transcript/roster capture;
- [ ] logs/traces/analytics/support use allowlists and forbidden-field tests;
- [ ] current SDK/version/account authorization checked;
- [ ] provider-off external network isolation;
- [ ] production mutations and broad reminders remain off;
- [ ] sanitized evidence and secret scan pass.
