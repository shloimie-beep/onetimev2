# OT-88 Zoom Capability Notes

Access date: 2026-07-16.

Official Zoom documentation reviewed for the provider seam:

- Meeting SDK Web overview.
- Meeting SDK Web client view guidance.
- Meeting SDK Web component view browser support.
- Meeting SDK Web React sample.
- Meeting SDK Web auth endpoint sample.

Implementation decision:

- OT-88 keeps real provider mode disabled and fail-closed.
- Sink mode returns deterministic, non-provider launch payloads for product and test coverage.
- Participant bootstraps use learner/participant role only.
- Mobile/tablet launch selects the client-style surface; desktop may select component-style surface when the component flag is enabled.
- No live meeting creation, registrant mutation, provider launch link, or canary execution was performed.
