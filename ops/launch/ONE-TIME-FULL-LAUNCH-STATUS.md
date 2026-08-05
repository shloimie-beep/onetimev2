# One Time Complete Production Launch — Status

| Area                                  | Status      | Next action                                                                                              |
| ------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------- |
| Baseline, branch, rollback            | WORKING     | Keep rollback immutable; integrate only verified slices.                                                 |
| Landing and Family signup             | WORKING     | Keep the canonical Family journey live while later milestones continue.                                  |
| Auth and portals                      | IN PROGRESS | Milestone 1 Parent/Student boundary is proven; complete the broader Admin/Parent/Student surface matrix. |
| GHL confirmation/projection           | WORKING     | Monitor the idempotent consumer and preserve zero Student contacts.                                      |
| Class, Zoom, attendance               | IN PROGRESS | Canonical schedule and automatic roster are live; complete the bounded Zoom/attendance canary.           |
| Drive, media, Vimeo, library          | IN PROGRESS | Integrate current runtime/catalog branches and prove one pipeline.                                       |
| Learning, support, notifications      | IN PROGRESS | Inventory current persistent paths and remove retired surfaces.                                          |
| Billing and access                    | IN PROGRESS | Reconcile Stripe/GHL configuration; verify test lifecycle first.                                         |
| Email workflows, bot, routing         | IN PROGRESS | Inventory existing assets without duplicating provider objects.                                          |
| Privacy, security, accessibility, ops | IN PROGRESS | Update locked contracts and carry focused gates with each slice.                                         |

Current checkpoint: Milestone 1 remains production-working on source `b180660c3a7faa9cb3c0cdb4011283f7257969e8`. Web deployment `555b5099-bce4-42e2-864a-da04bf839a93` and worker deployment `4a0fbb29-8148-4f14-b973-4e0944877925` are successful; migration head is `2266` with 97 applied and zero pending. Web and worker `APP_VERSION`/`COMMIT_SHA` agree, public health/readiness/version are HTTP 200, and the worker completed a clean post-deploy batch. The preserved canary still has one Family account, one adult GHL contact, one household opportunity, one immediate confirmation, successful recovery with two old sessions revoked, three separate Students, a rejected fourth seat, successful Student login, and consumed-token replay denial. The normative `one_time_mishnayos` class scope now has one canonical series, 65 Sunday-through-Thursday occurrences from August 16 through November 12, 2026, and all three active Students enrolled with zero missing. Milestone 2 and the remaining Zoom/attendance portion of Milestone 3 are active.
