# OT-72 Integration Manifest

## Purpose

OT-72 will expose server-only, default-off provider adapters and typed registration hooks for OT-80. This branch must not mount shared UI, central route wiring, public landing/signup UI, CRM UI, or portal UI.

## Planned Provider Surfaces

| Phase | Provider | Planned Surface | Default |
| --- | --- | --- | --- |
| 1 | Stripe | Test-mode billing adapter, webhook/event truth, safe billing DTOs | Off |
| 2 | Resend/WAPI | Deny-by-default dispatch adapters, provider truth ingestion, sink fixtures | Off |
| 3 | Zoom | Protected live-class readiness/launch adapter seam | Off |
| 4 | Vimeo | Protected playback/readiness/outcome adapter seam | Off |
| 5 | Telegram | Separate One Time bot transport and webhook ingress | Off |
| 6 | BNA oversight | Redacted asynchronous producer-side outcome contract | Off |

## Collision Boundaries

- No shared AppShell/navigation edits.
- No central route registration/application composition edits.
- No parent/student portal UI edits.
- No CRM UI edits.
- No shared auth/session logic edits.
- No public landing/signup UI edits.

Any test-only composition change must be documented here before commit.
