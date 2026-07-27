# OT-LAUNCH-01 Rabbi launch email design — sanitized handoff

- schema_version: `1`
- goal_id: `OT-LAUNCH-01`
- track_id: `audit_wave_03_ghl_sender_design`
- task_id: `OT-LAUNCH-01-GHL-RABBI-LAUNCH-EMAIL-DESIGN-REAUTHOR`
- owner: `03-OT-GHL`
- assignment_sha: `1e2e14812db179562f503f4818aeca9b099d5c56`
- write_scope: existing sender/message-class/communications/workflow registries, generated workflow projections, OT-02A/OT-02B prompt and checklist pairs, GHL-UI-24 successor job, focused test, and this handoff only
- sanitized_at: `2026-07-27`

## Result

Repository-only design completed. HighLevel was not opened. GHL-UI-13 is unchanged and remains a zero-send, prerequisite-recording job. The new `GHL-UI-24-rabbi-campaign-one-seed-reply-acceptance` is the sole separately gated successor; it is blocked unless a later exact operator authorization supplies every required acceptance input.

The active Phase-1 Rabbi campaign route remains the existing registered office From and Reply-To. The desired Rabbi Phase-2 From remains pending mailbox/routing ownership, HighLevel From acceptance, one protected operator-owned seed, and one controlled reply readback in GHL Conversations. No address, mailbox ownership, destination, audience, or permission was invented.

OT-02A and OT-02B now identify separate reviewed Email One concepts in their canonical prompt/checklist paths. OT-02A is limited to an operator-selected adult existing-subscriber migration list. OT-02B is limited to adults with independently proven general-marketing permission. Neither path may infer authority from Tisha registration, attendance, payment, portal state, deliverability, or legacy tags. Both retain the registered One Time Home URL as the sole CTA source and keep any later sequence copy blocked pending review.

## Acceptance results

| Acceptance ID         | Result                            | Evidence                                                                                                                                                                                             |
| --------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GHL-SENDER-DESIGN-001 | Passed for repository-only design | Phase-1 routing is explicit, message classes remain separate, GHL-UI-13 is unchanged zero-send, GHL-UI-24 is separately gated, and workflow projections are regenerated from the canonical registry. |

## Files and evidence

- `integrations/highlevel/registry/workflow-registry.yaml`: canonical OT-02A/OT-02B Phase-1, CTA, permission-boundary, reviewed-copy identity, and successor-job metadata.
- `integrations/highlevel/workflows.yaml`, `integrations/highlevel/registry/current.json`, and `integrations/highlevel/registry/WORKFLOW-CONTROL-REPORT.md`: regenerated only through the canonical workflow-control scripts.
- `integrations/highlevel/ai-workflow-prompts/OT-02A-existing-subscriber-migration-2026-v1.md` and `integrations/highlevel/workflow-checklists/OT-02A-existing-subscriber-migration-2026-v1.md`: migration-only reviewed Email One instructions.
- `integrations/highlevel/ai-workflow-prompts/OT-02B-new-lead-nurture-v1.md` and `integrations/highlevel/workflow-checklists/OT-02B-new-lead-nurture-v1.md`: consented-nurture-only reviewed Email One instructions.
- `integrations/highlevel/agent-mode/jobs/GHL-UI-24-rabbi-campaign-one-seed-reply-acceptance.json`: exact later browser executor prompt and result schema.
- `tests/unit/highlevel/rabbi-launch-email-design.test.ts`: focused separation and successor-gate coverage.

## Later browser-executor prompt

Use only `GHL-UI-24-rabbi-campaign-one-seed-reply-acceptance.json` after a separate exact operator authorization names the immutable registry SHA, authorizes the Rabbi Phase-2 From identity, proves mailbox/routing and GHL From acceptance, identifies one protected operator-owned destination outside Git, grants one unique seed idempotency key, permits exactly one seed, and permits exactly one controlled reply readback. If any item is absent, return `blocked` with every effect counter at zero. Do not select an audience, publish or activate a workflow, enroll anyone, create or change a contact, or write private data to Git.

## External-effect counters

| Counter             | Value |
| ------------------- | ----: |
| HighLevel mutations |     0 |
| Customer messages   |     0 |
| Contacts changed    |     0 |
| Enrollments         |     0 |
| Publications        |     0 |
| Activations         |     0 |
| Deletes/quarantines |     0 |
| Stripe mutations    |     0 |
| Access mutations    |     0 |
| Production changes  |     0 |
| Provider mutations  |     0 |

## Remaining work / blocker

No repository-design blocker remains. Browser execution is intentionally blocked pending a separate exact authorization with the protected operational inputs described above. The historic approximately 88 contacts, all customer audiences, and all sender canary activity remain out of scope.
