# OT-106 Blockers

- No blocker for local implementation or local verification.
- `npm run db:verify` is blocked in this worktree because `DATABASE_URL` is not configured.
- Read-only Buffer canary is blocked by missing `BUFFER_ACCESS_TOKEN`, `BUFFER_ORGANIZATION_ID`, and `OT106_BUFFER_CHANNEL_ALIASES`; it exited unconfigured with `writes_performed=false`.
- Real Buffer draft canary remains blocked unless protected Buffer config is present and `OT106_BUFFER_DRAFT_CANARY_AUTHORIZED=true` is set with an allowlisted channel alias.
- Scheduling beyond draft creation remains blocked unless `OT106_BUFFER_PROVIDER_MODE=buffer_scheduled`, the manifest mode is `scheduled`, and owner/admin approval plus explicit runtime authorization are present.
