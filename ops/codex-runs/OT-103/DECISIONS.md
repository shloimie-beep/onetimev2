# OT-103 Decisions

## DEC-OT103-001 - Preserve Sink-First Safety

Default classroom behavior remains disabled/sink unless explicit configuration enables staging behavior. Local tests must use deterministic fakes and must not call Zoom.

## DEC-OT103-002 - No Root Dependency Change

The prompt forbids root manifest/lockfile changes. The Zoom Meeting SDK dependency is not added in OT-103. OT-103 exports a classroom-only lazy adapter contract/fake and records the package addition for OPS-04.

## DEC-OT103-003 - Official Zoom Requirements Used

- Meeting SDK authorization docs: generate SDK JWT server-side with Meeting SDK credentials; learner joins use role `0`; host start requires role `1` plus host ZAK.
- Meeting SDK web join docs: registered meeting joins use the `tk` value from the registrant `join_url`; `userEmail` is required when registration is required.
- Meetings API docs: API server is `https://api.zoom.us/v2`; fixed recurring meetings use meeting type `8`; recurring occurrence IDs identify occurrences; create-meeting `start_url` is host-sensitive and must not be exposed/logged.
- Zoom API usage docs: a meeting UUID is specific to an occurrence; code should correlate attendance by meeting UUID/occurrence/registrant rather than display name.
- Webhook docs: verify `x-zm-signature` by HMAC SHA-256 over `v0:{x-zm-request-timestamp}:{rawBody}` with the webhook secret token, compare to `v0={hex}`; handle endpoint URL validation.
- Browser support docs: component view is desktop-oriented; mobile/tablet should use client view.

Sources opened 2026-07-16:

- https://developers.zoom.us/docs/meeting-sdk/auth/
- https://developers.zoom.us/docs/meeting-sdk/web/component-view/meetings-webinars/
- https://developers.zoom.us/docs/api/meetings/
- https://developers.zoom.us/docs/api/using-zoom-apis/
- https://developers.zoom.us/docs/api/webhooks/
- https://developers.zoom.us/docs/meeting-sdk/web/browser-support/
