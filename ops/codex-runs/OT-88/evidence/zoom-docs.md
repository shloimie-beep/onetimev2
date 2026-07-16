# OT-88 Zoom Capability Notes

Access date: 2026-07-16.

Official Zoom documentation reviewed for the provider seam:

- Meeting SDK Web overview.
- Meeting SDK Web client view import/init/join guidance:
  `ZoomMtg.preLoadWasm`, `ZoomMtg.prepareWebSDK`, `ZoomMtg.init`, and `ZoomMtg.join`.
- Meeting SDK Web component view import/init/join guidance:
  `ZoomMtgEmbedded.createClient`, `client.init`, and `client.join`.
- Meeting SDK authentication guidance: Meeting SDK JWT/signature material is generated
  server-side and is not a browser-originated provider call.

Implementation decision:

- OT-88 keeps real provider mode disabled and fail-closed.
- Sink mode returns deterministic, non-provider launch payloads for product and test coverage.
- The new launch client is a local mocked SDK lifecycle only; it imports no Zoom
  SDK package and makes no provider network call.
- Participant bootstraps use learner/participant role only.
- Mobile/tablet launch selects the client-style surface; desktop may select component-style surface when the component flag is enabled.
- No live meeting creation, registrant mutation, provider launch link, or canary execution was performed.
