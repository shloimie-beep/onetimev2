# One Time Complete Production Launch — Status

| Area                                  | Status      | Next action                                                                                              |
| ------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------- |
| Baseline, branch, rollback            | WORKING     | Keep rollback immutable; integrate only verified slices.                                                 |
| Landing and Family signup             | WORKING     | Keep the canonical Family journey live while later milestones continue.                                  |
| Auth and portals                      | IN PROGRESS | Milestone 1 Parent/Student boundary is proven; complete the broader Admin/Parent/Student surface matrix. |
| GHL confirmation/projection           | WORKING     | Monitor the idempotent consumer and preserve zero Student contacts.                                      |
| Class, Zoom, attendance               | IN PROGRESS | Canonical schedule and automatic roster are live; complete the bounded Zoom/attendance canary.           |
| Drive, media, Vimeo, library          | IN PROGRESS | App runtime and callback are live; supply owner-scoped Vimeo/Drive credentials and prove one pipeline.   |
| Learning, support, notifications      | IN PROGRESS | Inventory current persistent paths and remove retired surfaces.                                          |
| Billing and access                    | IN PROGRESS | Reconcile Stripe/GHL configuration; verify test lifecycle first.                                         |
| Email workflows, bot, routing         | IN PROGRESS | Inventory existing assets without duplicating provider objects.                                          |
| Privacy, security, accessibility, ops | IN PROGRESS | Update locked contracts and carry focused gates with each slice.                                         |

Current checkpoint: application source `d53ffd2ee4d83263083aaed7c8538bf639e87673` is live through successful web deployment `ed638ec9-2829-4194-8978-2c5b1a61c0af` and worker deployment `1895e2fd-8f7b-4caa-b067-0c79b0927b93`. All six PR checks passed. Protected diagnostics bind `APP_VERSION`/`COMMIT_SHA` to the exact source, report migration `2267_v21_parent_preferences`, zero ready/retry/dead-letter queue rows, one fresh ready worker heartbeat, and no blockers; public app/join health and readiness return HTTP 200. The provider-correct Vimeo callback is mounted and returns `VIMEO_WEBHOOK_DISABLED` until protected account/webhook values exist. Keyholder readback found a valid Zoom Meeting SDK pair and a Vimeo app token limited to `public`, but no Drive service-account/OAuth file or Vimeo webhook secret. The preserved Milestone 1 canary remains intact. Complete Milestone 2 production acceptance and the remaining Zoom/attendance and media provider canaries without waiting on the separate GHL UI lane.
