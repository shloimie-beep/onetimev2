# OT-LAUNCH-01 Rabbi launch email design — sanitized handoff

- schema_version: `1`
- goal_id: `OT-LAUNCH-01`
- track_id: `audit_wave_03_ghl_sender_design`
- task_id: `OT-LAUNCH-01-GHL-RABBI-LAUNCH-EMAIL-DESIGN-PORTABILITY-REPAIR`
- owner: `03-OT-GHL`
- assignment_sha: `0fc24128dfb9f5d512c1915ad61bb9c6b3568042`
- write_scope: exact PR #126 semantic design plus only the canonical prompt-fingerprint helper, LF/CRLF/CR portability test, regenerated projections, and this handoff
- sanitized_at: `2026-07-27`

## Result

Repository-only portability repair completed from the exact PR #126 result base. HighLevel was not opened. GHL-UI-13 remains unchanged and zero-send. GHL-UI-24 remains the sole separately gated successor and is blocked unless a later exact operator authorization supplies every required acceptance input.

The active Phase-1 Rabbi campaign route remains the existing registered office From and Reply-To. The desired Rabbi Phase-2 From remains pending mailbox/routing ownership, HighLevel From acceptance, one protected operator-owned seed, and one controlled reply readback in GHL Conversations. No address, mailbox ownership, destination, audience, or permission was invented.

OT-02A and OT-02B now identify separate reviewed Email One concepts in their canonical prompt/checklist paths. OT-02A is limited to an operator-selected adult existing-subscriber migration list. OT-02B is limited to adults with independently proven general-marketing permission. Neither path may infer authority from Tisha registration, attendance, payment, portal state, deliverability, or legacy tags. Both retain the registered One Time Home URL as the sole CTA source and keep any later sequence copy blocked pending review.

Every prompt fingerprint now hashes `canonicalTextForHash` output, so LF, CRLF, and CR source inputs produce the same SHA-256 and the same generated workflow-control projection. No sender, message-class, audience, permission, CTA, or GHL-UI-24 meaning changed.

## Acceptance results

| Acceptance ID         | Result                                        | Evidence                                                                                                                                                                                                    |
| --------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GHL-SENDER-DESIGN-001 | Passed for repository-only portability repair | PR #126 sender semantics are preserved; the canonical prompt fingerprint and regenerated projections are LF/CRLF/CR portable; GHL-UI-13 remains unchanged zero-send and GHL-UI-24 remains separately gated. |

## Files and evidence

- `integrations/highlevel/registry/workflow-registry.yaml`: canonical OT-02A/OT-02B Phase-1, CTA, permission-boundary, reviewed-copy identity, and successor-job metadata.
- `integrations/highlevel/workflows.yaml`, `integrations/highlevel/registry/current.json`, and `integrations/highlevel/registry/WORKFLOW-CONTROL-REPORT.md`: regenerated only through the canonical workflow-control scripts.
- `integrations/highlevel/ai-workflow-prompts/OT-02A-existing-subscriber-migration-2026-v1.md` and `integrations/highlevel/workflow-checklists/OT-02A-existing-subscriber-migration-2026-v1.md`: migration-only reviewed Email One instructions.
- `integrations/highlevel/ai-workflow-prompts/OT-02B-new-lead-nurture-v1.md` and `integrations/highlevel/workflow-checklists/OT-02B-new-lead-nurture-v1.md`: consented-nurture-only reviewed Email One instructions.
- `integrations/highlevel/agent-mode/jobs/GHL-UI-24-rabbi-campaign-one-seed-reply-acceptance.json`: exact later browser executor prompt and result schema.
- `tests/unit/highlevel/rabbi-launch-email-design.test.ts`: focused separation and successor-gate coverage.
- `scripts/highlevel/prompt-fingerprint.ts` and `tests/unit/highlevel/prompt-fingerprint-portability.test.ts`: canonical prompt fingerprint helper and all-registered-prompt LF/CRLF/CR proof.

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
