# Zoom Capability Findings and Product Decisions

Status date: 2026-07-15

## Official citations used in this assessment

- Embedding model and human-use limitation: [Zoom Meeting SDK for Web](https://developers.zoom.us/docs/meeting-sdk/web/).
- Mobile/tablet recommendation: [Client view](https://developers.zoom.us/docs/meeting-sdk/web/client-view/) and [browser support](https://developers.zoom.us/docs/meeting-sdk/web/browser-support/).
- Desktop component limitations and feature differences: [Component view](https://developers.zoom.us/docs/meeting-sdk/web/component-view/) and [supported features](https://developers.zoom.us/docs/meeting-sdk/web/component-view/supported/).
- React integration inputs and server auth endpoint: [official React sample](https://github.com/zoom/meetingsdk-react-sample).
- Backend Meeting SDK JWT generation and credential handling: [official auth endpoint sample](https://github.com/zoom/meetingsdk-auth-endpoint-sample).
- Registration-token joins: [client-view meetings/webinars](https://developers.zoom.us/docs/meeting-sdk/web/client-view/meetings-webinars/) and [component-view meetings/webinars](https://developers.zoom.us/docs/meeting-sdk/web/component-view/meetings-webinars/).
- Invite/header controls and component customization: [client `init` reference](https://marketplacefront.zoom.us/sdk/meeting/web/functions/ZoomMtg.init.html) and [component `InitOptions`](https://marketplacefront.zoom.us/sdk/meeting/web/components/interfaces/InitOptions.html).
- Failure codes and current account-authorization warning: [Meeting SDK error codes](https://developers.zoom.us/docs/meeting-sdk/web/error-codes/).
- Minimized event signals: [component event listener reference](https://marketplacefront.zoom.us/sdk/meeting/web/components/functions/EmbeddedClient.on.html).
- Pin versus spotlight semantics: [pinning participant videos](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0065767) and [spotlighting participant videos](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0066300).

## Executive finding

The official Meeting SDK supports the intended embedded human classroom, but the secure product boundary is not “give the learner a Zoom link.” It is:

1. authorize the learner and occurrence in One Time;
2. mint a short-lived, single-use One Time launch grant;
3. consume that grant on a dedicated no-store launch surface;
4. generate or resolve the provider launch fields on the server;
5. pass only the minimum fields needed by the Meeting SDK to the isolated launch page in memory; and
6. destroy the launch context on leave, error, or expiry.

The normal portal must never receive or serialize provider meeting credentials. The unavoidable browser-side Meeting SDK fields belong only to the dedicated launch bootstrap after all policy checks.

## Findings table

| Capability | Official finding | OT-88 decision | Confidence / gate |
|---|---|---|---|
| Embed a meeting in a web app | The Meeting SDK for Web embeds Zoom Meeting and Webinar experiences and offers client and component views. | Use the official Meeting SDK, not a raw join URL and not a custom media client. | Proven by official overview; canary still required. |
| Human participation only | Official docs state the Meeting SDK is reserved for human use cases and does not support bots or AI notetakers. | No One Time helper bot joins media. Questions and Telegram helpers remain outside Zoom media capture. | Proven. |
| Mobile/tablet view | Client view is the recommended implementation for mobile and tablet browsers. | Mobile and tablet always use a full-page client-view launch shell. | Proven; device canary required. |
| Desktop component view | Component view is designed for desktop browsers and may omit client-view features. | Use component view only behind a capability flag after browser, SDK, required-feature, and privacy-control verification. Otherwise use client view. | Proven in principle; implementation-specific verification required. |
| Feature parity | Component view supports core functions but the official matrix lists differences. | Never assume parity. Maintain a required-capabilities checklist and a secure client-view fallback. | Proven. |
| SDK authorization | The official samples use a backend endpoint to generate a Meeting SDK JWT. SDK credentials are environment/server secrets. | Implement signing behind a server-side port. Never expose the SDK secret or implement signing in browser code. | Proven. |
| Participant role | Official samples distinguish participant role `0` and host role `1`; host start also requires host authorization. | Learner signatures are always participant role `0`. Learner code must never accept a role from the request. | Proven. |
| Registration join | Both views support joining registration-required meetings using a registrant token (`tk`) retrieved through the Zoom API. | Prefer a per-learner registrant identity where account settings and meeting type support it. Parse any provider `join_url` server-side, retain only required encrypted fields, and discard the URL. | Proven capability; account/meeting canary required. |
| Invite control | Client-view initialization includes `disableInvite`; it also supports hiding the meeting header. | Initialize learner client view with invite disabled and meeting header hidden. Verify in canary that meeting number, passcode, and copy-link controls are not visible. | API proven; rendered behavior must be verified. |
| Component-view privacy controls | Component view supports UI customization, including meeting-information customization, but the supported-feature matrix still includes copied-URL invite behavior. | Component view is ineligible unless the installed SDK can omit invite and credential-bearing meeting information from the learner UI. Failure forces client-view fallback. | Unproven until version/account canary. |
| Chat | In-meeting chat is supported by the SDK. | Disable learner Zoom chat by default. The One Time question queue is the only V1 question channel. | Capability proven; product decision explicit. |
| Leave/rejoin | Both views support leave and custom post-leave behavior. | Leave clears in-memory provider fields and ends the One Time attempt. Return requires a newly authorized launch grant. | Proven in principle; e2e test required. |
| Waiting room / host not started | Waiting room is supported; error codes include meeting-not-started. | Show distinct safe states without exposing provider details. Poll/retry within a bounded window; do not request a passcode from the learner. | Proven. |
| Network/reconnect | Component events and SDK error codes expose reconnect/disconnect and network-quality signals. | Record coarse state transitions and durations only. Do not record participant lists, media, captions, or message content. | Proven. |
| Full class | Error code `4005` identifies capacity reached. | Show a non-technical full-class state and alert operations with occurrence/attempt IDs only. | Proven. |
| Provider/account blocking | Official errors include host-admin blocking and unsupported SDK version. Current docs also require authorization for cross-account joins. | Provider readiness must prove account relationship/authorization before enabling join. Treat admin block or unsupported version as provider configuration failures. | Proven policy; tenant setup must be checked. |
| Pinning | Zoom support states a pin affects the local view. | Never describe `Feature next` as pinning a learner for everyone. | Proven. |
| Spotlighting | Zoom support treats spotlight as a host/co-host action affecting participant views. | V1 gives the Rabbi an application queue and instructions to use ordinary host controls. Automatic spotlight remains disabled. | Host behavior proven; programmatic automation deliberately unproven. |

## Required launch architecture

### Ordinary portal response

The normal portal may return:

- occurrence ID;
- learner-safe title and local schedule;
- readiness enum;
- whether Join is currently allowed;
- a coarse reason if not allowed;
- an opaque launch-grant path after a successful grant request; and
- learner-owned question states.

It must not return:

- Zoom meeting number or UUID;
- Zoom join URL or invite URL;
- meeting passcode;
- Meeting SDK JWT/signature;
- SDK secret/client secret;
- registrant token (`tk`);
- ZAK, OBF, host, or co-host token;
- provider registrant ID if it is not needed by the user; or
- provider account/configuration details.

### Dedicated launch bootstrap

A special same-origin launch route may provide the exact fields required by the Meeting SDK only after an opaque launch grant is atomically consumed. This route is explicitly not a normal portal API. It must have:

- `Cache-Control: no-store, private`;
- no service-worker caching;
- `Referrer-Policy: no-referrer`;
- strict CSP and Permissions Policy;
- CSRF/session/origin checks;
- an application-specific sensitive response media type;
- structured-logging suppression and body redaction;
- no error echo containing provider fields;
- participant role fixed to `0`;
- no raw provider join URL; and
- in-memory use only by the isolated launch page.

The browser necessarily receives the SDK join inputs at join time. The security objective is to keep them out of durable state, reusable URLs, ordinary application surfaces, logs, analytics, and other users’ sessions—not to claim that JavaScript-visible values can be cryptographically hidden from the browser executing the SDK.

## Client-view policy

Use client view for every mobile/tablet launch and as the universal fallback. At minimum, verify the installed SDK supports and correctly applies controls equivalent to:

- invite disabled;
- meeting header hidden;
- in-meeting chat disabled;
- recording controls disabled for the learner surface;
- call-out and Zoom Phone invite controls disabled;
- safe leave URL to a One Time route; and
- no provider data in page title, URL, server-rendered HTML, error boundary, or analytics.

Do not copy options blindly from this packet. Confirm the exact names and behavior against the installed SDK reference and add a version-aware adapter test.

## Component-view eligibility contract

Component view is eligible only when all checks are true:

1. desktop browser and desktop-class viewport;
2. browser is on the repository’s supported allowlist;
3. current SDK version passes the minimum-version check;
4. component view is enabled by One Time feature flag;
5. invite/copy-link controls are absent;
6. meeting information cannot reveal meeting number/passcode;
7. required waiting-room, leave, reconnect, audio/video permission, accessibility, and localization behavior passes canary;
8. no required client-view-only feature is needed for this class; and
9. provider account settings do not alter the UI in a way that breaks these guarantees.

Any false or unknown check selects client view before provider launch material is fetched.

## Provider identity and registration

Preferred mode:

- one provider meeting associated with a series or occurrence, according to the existing provider configuration;
- one provider registrant identity per learner and relevant meeting scope;
- encrypted provider registrant token at rest;
- learner display name derived from the authorized learner profile, not request input;
- provider email/identity alias generated according to existing privacy rules; and
- provider response URLs discarded after extracting the minimum required token.

Fallback mode is not “share the family URL.” If per-learner registration is unavailable, the provider readiness state must explicitly record that identity correlation is unproven. The team may run a limited canary with another supported identity mechanism, but broad rollout remains disabled until learner-to-provider identity and privacy behavior are demonstrated.

## Error and state mapping

Important official error categories include:

- meeting not started (`3008`);
- wrong password (`3004`), treated as provider misconfiguration;
- registration required (`3099`), treated as readiness/configuration failure;
- reconnecting (`4000`);
- disconnected (`4001`);
- meeting ended (`4004`);
- capacity reached (`4005`);
- meeting locked (`4006`);
- participant removed (`3009`);
- Meeting SDK key blocked by host administrator (`6603`); and
- unsupported SDK version (`10000`).

The learner UI must map these to stable One Time states. Raw provider codes may appear only in restricted internal telemetry with occurrence/attempt IDs and no provider credentials.

## `ZoomFeatureParticipantPort`

Create the port and a disabled adapter so the domain does not hard-code a permanent impossibility, but keep it disabled in all normal configurations.

Required V1 behavior:

```text
requestFeatureParticipant(questionSelection)
  -> UnsupportedDisabled(
       reason = "V1 uses Rabbi host controls; provider automation not proven"
     )
```

A future canary may replace the disabled adapter only after all of the following are proven with official SDK/API documentation and a test account:

- an supported programmatic host operation exists for the exact client/meeting mode;
- the caller has host/co-host authorization without exposing host credentials to learner code;
- One Time can correlate the selected learner to the current provider participant safely;
- account and meeting settings permit the action;
- failure and revocation behavior is defined;
- audit records contain no child free text or provider token; and
- the operation does not degrade privacy or give a false guarantee.

## Unproven items that must remain gated

- exact component-view suppression of all invite/meeting-information surfaces in the installed version;
- cross-account authorization mode and OBF/ZAK requirements for the configured host account;
- registration scope and token lifecycle for the selected recurring-meeting strategy;
- mobile Safari/Chrome audio, camera, waiting-room, and rejoin behavior on supported OS versions;
- desktop component behavior with RTL, keyboard, reduced motion, and assistive technology;
- provider webhook reliability and participant identity correlation;
- automated spotlight/feature behavior; and
- any production reminder or provider mutation.

Missing evidence leads to `READY_FOR_ZOOM_CANARY`, not a fabricated success state.
