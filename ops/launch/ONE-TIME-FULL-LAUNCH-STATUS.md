# One Time Complete Production Launch — Status

| Area | Status | Next action |
|---|---|---|
| Baseline, branch, rollback | WORKING | Keep rollback immutable; integrate only verified slices. |
| Landing and Family signup | WORKING | Keep the canonical Family journey live while later milestones continue. |
| Auth and portals | IN PROGRESS | Milestone 1 Parent/Student boundary is proven; complete the broader Admin/Parent/Student surface matrix. |
| GHL confirmation/projection | WORKING | Monitor the idempotent consumer and preserve zero Student contacts. |
| Class, Zoom, attendance | IN PROGRESS | Reconcile existing code/provider state and prepare bounded canary. |
| Drive, media, Vimeo, library | IN PROGRESS | Integrate current runtime/catalog branches and prove one pipeline. |
| Learning, support, notifications | IN PROGRESS | Inventory current persistent paths and remove retired surfaces. |
| Billing and access | IN PROGRESS | Reconcile Stripe/GHL configuration; verify test lifecycle first. |
| Email workflows, bot, routing | IN PROGRESS | Inventory existing assets without duplicating provider objects. |
| Privacy, security, accessibility, ops | IN PROGRESS | Update locked contracts and carry focused gates with each slice. |

Current checkpoint: Milestone 1 is production-working on source `7e3075b06e2b03b67168e59d7fcfb96d16324c7a`. Web deployment `f89c6bad-e8f2-4b7c-ae99-bc83fd7a3d95` and worker execution `0049c1d6-ece3-4cbb-a08d-bacd5220be85` are successful; migration head is `2264` with 95 applied and zero pending. The preserved canary has one Family account, one adult GHL contact, one household opportunity, one immediate confirmation, successful recovery with two old sessions revoked, three separate Students, a rejected fourth seat, successful Student login, and consumed-token replay denial. Milestone 2 is active.
