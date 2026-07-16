# OT-86B Performance

Packet id: OT-86B<br>
Branch: codex/ot86b-buffer-social<br>
Base SHA: 87a1bb7ffd6a2fa0d016a1831894d430aa2ee065<br>
Current head SHA: pending until final commit/push<br>
Generated UTC: 2026-07-15T17:50:30Z

## Environment

- Node: v24.13.0
- Tool: `scripts/ot86/social-performance-probe.ts`
- Command: `npx tsx scripts/ot86/social-performance-probe.ts --write-report`
- Exit code: 0
- Fixture: 10,000 accepted social sources, 10,000 drafts, 50,000 draft revisions, 10,000 approvals, 10,000 scheduled commands.
- Samples: 30
- Event payload bytes: 402,028 of 524,288 limit.
- BNA network dependency: false
- Provider network time: excluded; no Buffer write was performed.

## Results

| Path                                       | Budget p95 | Measured p95 | Result |
| ------------------------------------------ | ---------: | -----------: | ------ |
| Event validation plus durable receipt      |     300 ms |    26.219 ms | Pass   |
| Draft list/filter                          |     300 ms |   173.347 ms | Pass   |
| Draft detail/preview                       |     250 ms |     1.718 ms | Pass   |
| Scheduler due-command selection, 100 batch |     500 ms |    79.041 ms | Pass   |
| Duplicate event/command reconciliation     |     250 ms |     1.658 ms | Pass   |

`PERFORMANCE-PROBE.json` contains median, p95, max, fixture size, budgets, and index evidence.

## Index Evidence

- `ot86b_social_drafts_list_idx`: `(tenant_id, workflow_state, updated_at DESC, draft_id)`.
- `ot86b_social_publish_commands_due_idx`: `(command_state, scheduled_for, id)`.
- `ot86b_social_event_inbox_queue_idx`: `(processing_state, received_at)`.
- `ot86b_social_draft_revisions_draft_idx`: `(draft_id, created_at DESC)`.
- `ot86b_social_approvals_draft_idx`: `(tenant_id, draft_id, approval_state)`.

## Bundle Boundary

`npm run build` passed. OT86B adds no client route, Buffer SDK, access-token logic, raw provider response types, or scheduler code to browser bundles.
