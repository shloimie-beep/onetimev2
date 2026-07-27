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

Repository-only portability repair completed from the exact PR #126 result base and corrected during convergence for the final sender decision. HighLevel was not opened. GHL-UI-13 remains unchanged and zero-send. GHL-UI-24 remains the sole separately gated successor and is blocked unless a later exact operator authorization supplies every required provider and one-seed input.

The sender decision is final: visible campaign From after provider acceptance is `Rabbi Eli Scheller | One Time Mishnayos <rabbi@onetimeonetime.com>`, Reply-To remains `info@onetimeonetime.com`, and rabbi@ may route into the same governed GHL Conversations workflow without a separately monitored second inbox. The existing info@ From remains only the current fallback until provider acceptance. Provider acceptance, one protected operator-owned seed, and one controlled reply readback remain unproven and separately gated; the fixed identity does not authorize a send.

OT-02A and OT-02B now identify separate reviewed Email One concepts in their canonical prompt/checklist paths. OT-02A is limited to an operator-selected adult existing-subscriber migration list. OT-02B is limited to adults with independently proven general-marketing permission. Neither path may infer authority from Tisha registration, attendance, payment, portal state, deliverability, or legacy tags. Both retain the registered One Time Home URL as the sole CTA source and keep any later sequence copy blocked pending review.

Every prompt fingerprint now hashes `canonicalTextForHash` output, so LF, CRLF, and CR source inputs produce the same SHA-256 and the same generated workflow-control projection. No sender, message-class, audience, permission, CTA, or GHL-UI-24 meaning changed.

## Acceptance results

| Acceptance ID         | Result                                        | Evidence                                                                                                                                                                                                            |
| --------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GHL-SENDER-DESIGN-001 | Passed for repository-only convergence repair | The final Rabbi From and Reply-To decision is canonical, the prompt fingerprint and regenerated projections are LF/CRLF/CR portable, GHL-UI-13 remains unchanged zero-send, and GHL-UI-24 remains separately gated. |

## Files and evidence

- `integrations/highlevel/registry/sender-registry.yaml` and `integrations/highlevel/registry/workflow-registry.yaml`: fixed Rabbi sender decision plus canonical OT-02A/OT-02B CTA, permission-boundary, reviewed-copy identity, current-fallback, and successor-job metadata.
- `integrations/highlevel/workflows.yaml`, `integrations/highlevel/registry/current.json`, and `integrations/highlevel/registry/WORKFLOW-CONTROL-REPORT.md`: regenerated only through the canonical workflow-control scripts.
- `integrations/highlevel/ai-workflow-prompts/OT-02A-existing-subscriber-migration-2026-v1.md` and `integrations/highlevel/workflow-checklists/OT-02A-existing-subscriber-migration-2026-v1.md`: migration-only reviewed Email One instructions.
- `integrations/highlevel/ai-workflow-prompts/OT-02B-new-lead-nurture-v1.md` and `integrations/highlevel/workflow-checklists/OT-02B-new-lead-nurture-v1.md`: consented-nurture-only reviewed Email One instructions.
- `integrations/highlevel/agent-mode/jobs/GHL-UI-24-rabbi-campaign-one-seed-reply-acceptance.json`: exact later browser executor prompt and result schema.
- `tests/unit/highlevel/rabbi-launch-email-design.test.ts`: focused separation and successor-gate coverage.
- `scripts/highlevel/prompt-fingerprint.ts` and `tests/unit/highlevel/prompt-fingerprint-portability.test.ts`: canonical prompt fingerprint helper and all-registered-prompt LF/CRLF/CR proof.

## Later browser-executor prompt

Use only `GHL-UI-24-rabbi-campaign-one-seed-reply-acceptance.json` after a separate exact operator authorization names the immutable registry SHA, proves same-Conversations routing and GHL acceptance of the already-fixed Rabbi From, identifies one protected operator-owned destination outside Git, grants one unique seed idempotency key, contains `APPROVE SEND` for exactly one seed, and permits exactly one controlled reply readback. Do not ask for the sender product decision again. If any operational item is absent, return `blocked` with every effect counter at zero. Do not select an audience, publish or activate a workflow, enroll anyone, create or change a contact, or write private data to Git.

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

No repository-design or sender-decision blocker remains. Browser execution is intentionally blocked pending proven same-Conversations routing, provider acceptance, one protected operator-owned destination, and an exact `APPROVE SEND` authorization. The historic approximately 88 contacts, all customer audiences, and all sender canary activity remain out of scope.
