# GPT PRO FACTORY 04 — Zoom Learner Classroom and Question Queue

Act as a principal real-time classroom, security, and UX engineer. Create a downloadable ZIP named `OT88-zoom-classroom-codex-packet.zip`. Do not edit GitHub. Include a direct Codex prompt, domain/data model, Zoom capability findings with official sources, sequence diagrams in text/Mermaid, authorization matrix, failure-state matrix, test/canary plan, and checksums.

The generated Codex prompt must run only after `codex/ot84-telegram-action-gateway` is remote. It must fetch/resolve that branch dynamically, confirm it contains the OT83 portal foundation, and create `codex/ot88-zoom-learner-classroom`. No placeholder SHAs. It must locate the One Time repo, use a clean worktree, and persist all task prompt/state/resume/final files under `ops/codex-runs/OT-88/` before edits.

## Product decision

The $67 family subscription grants up to three named learner seats, not three reusable family URLs. Each learner uses a separate profile/login/device and gets a protected One Time join action for each class occurrence. The daily class is 19:00 `Asia/Jerusalem`; optional reminder is T-30 at 18:30.

Model:

- household entitlement with max three active learners;
- class series and immutable class occurrence;
- learner enrollment/seat;
- provider meeting and per-learner registrant identity where supported;
- short-lived, single-purpose app launch grant per learner and occurrence;
- join/leave/attendance/audit events;
- reminder eligibility and delivery intent;
- provider configuration/readiness state.

Never return a raw reusable Zoom join URL, meeting passcode, SDK secret, host token, or registrant token in normal portal JSON, HTML state, logs, analytics, support tickets, or Telegram. Resolve/generate the short-lived launch material server-side only after authentication, learner relationship, entitlement, occurrence window, revocation, and rate-limit checks.

## Embedded portal experience

Use Zoom’s official Meeting SDK for human meeting participation. The official web SDK can embed meetings; client view is recommended on mobile/tablet, while component view is desktop-oriented. Design a protected classroom shell with:

- next-class card and readiness state;
- one clear Join Class action;
- full-page client view for mobile/tablet;
- component view on desktop only when supported and verified, otherwise a secure client-view fallback;
- waiting, host-not-started, device-permission, network, full-class, provider-down, expired-grant, ended, and reconnect states;
- leave/return behavior that does not leak provider credentials;
- attendance telemetry with privacy minimization.

Official sources to use and cite in the generated packet:

- `https://developers.zoom.us/docs/meeting-sdk/web/`
- `https://developers.zoom.us/docs/meeting-sdk/web/client-view/`
- `https://developers.zoom.us/docs/meeting-sdk/web/component-view/supported/`
- `https://github.com/zoom/meetingsdk-react-sample`
- `https://github.com/zoom/meetingsdk-auth-endpoint-sample`

## Student questions and Rabbi workflow

V1 questions are an application-level One Time queue, not automatic Zoom chat injection:

1. The authenticated student submits a short class question in the portal.
2. One Time stores it with learner/occurrence scope, rate limits, moderation state, audit, and idempotency.
3. OT84 asynchronously alerts the Rabbi’s authorized Telegram identity with a redacted preview and opaque question ID.
4. Rabbi can mark `Feature next`, `Answered`, `Dismiss`, or open a Rabbi-only moderation deep link. The link never opens the child’s student session.
5. The portal shows safe state to that learner only.

Do not promise automatic Zoom pin/spotlight. Pinning is viewer-local and host spotlight behavior must be treated as a separate provider capability. Create a disabled `ZoomFeatureParticipantPort` and a canary plan only if official SDK/API support, host permissions, identity correlation, and account settings are proven. V1 `Feature next` selects the question and guides the Rabbi to use normal host controls. Do not send child free text into Zoom chat by default.

The Meeting SDK is for human use, not an AI notetaker. The question queue and helper bot remain outside Zoom media capture.

## Verification

Require provider-off/sink tests plus Zoom sandbox/test canary if protected credentials exist. Test three learners, fourth-seat denial, cross-household denial, replay/expired grant, sibling access denial, school/no-subscription denial, reminder idempotency, no raw-link leakage, mobile join, desktop fallback, questions/privacy, Telegram retry, and provider failure. Add 30-sample join-shell performance evidence, accessibility, keyboard, RTL, reduced motion, and no BNA fanout.

No production Zoom mutation or broad real reminders. Finish safe code and checkpoint `READY_FOR_ZOOM_CANARY` when credentials/settings are missing. Require clean push/draft PR and exact evidence/resume report.

