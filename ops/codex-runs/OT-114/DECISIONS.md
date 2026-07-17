# OT-114 Decisions

- Kept implementation inside the isolated One Time worktree and did not edit the BNA checkout.
- Reused the existing authenticated CRM shell for support instead of retaining the raw support HTML island.
- Kept support routes private/no-store/noindex; anonymous users receive public signup/help guidance only.
- Preserved the historical OT-89A support event fixture while making the runtime schema compatible with OT-114 emitted fields.
- Treated reply composition as provider-off only: confirmation saves a single-recipient draft and sink outbox event, never an external provider send.
- Limited CRM read access to owner/admin/crm_agent/viewer and write/reply actions to the existing edit/admin roles.
- Used targetless `ON CONFLICT DO NOTHING` for tag create/assignment to avoid partial-index inference drift between PostgreSQL and pg-mem.
- Recorded real BNA delivery/canary as blocked by endpoint absence and lane scope, not as an implementation blocker.
