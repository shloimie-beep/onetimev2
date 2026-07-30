# OT-02A Existing Subscriber Migration 2026 v1 UI Checklist

Folder: 10 - Enrollment & Nurture
Exact trigger: registered existing subscriber migration audience entry
message_class: existing_subscriber_migration
sender_key: rabbi_campaign
transport: GHL
Registry: integrations/highlevel/registry/workflow-registry.yaml

- Build only in Draft.
- Confirm every field, tag, and custom value exists in `registry/current.json` before use.
- Read `sender-registry.yaml`, `message-class-registry.yaml`, and `communications-contract.json` before sender configuration.
- Select One Time Rabbi Campaign Sender Name and verify it renders exactly `Rabbi Eli Scheller`.
- Select One Time Rabbi Campaign Phase 2 From and verify it renders exactly `rabbielischeller@onetimeonetime.com`.
- Select One Time Rabbi Reply-To and verify it renders exactly `rabbielischeller@onetimeonetime.com`.
- The single canonical public identity is `Rabbi Eli Scheller <rabbielischeller@onetimeonetime.com>` for both From and Reply-To; this is not an open product decision.
- Preserve One Time Rabbi Campaign Phase 1 From and historical `rabbi@onetimeonetime.com` data, but never select either for canonical public use.
- Until GHL-UI-24 proves provider acceptance, keep this Draft blocked. Do not use a fallback identity, activate, enroll, or send.
- Never guess or hardcode an unregistered sender identity.
- Use the three current controlled emails from the paired canonical prompt, in this exact order: `rabbi_new_program_existing_subscriber_migration_v1`, `rabbi_parent_student_experience_existing_subscriber_migration_v1`, then `rabbi_controlled_pilot_existing_subscriber_migration_v1`. They supersede provider-era copy instructions and authorize no send.
- Preserve Reviewed Email One exactly. Do not derive, paraphrase, or overwrite it while adding the reviewed Email Two and Email Three repository specifications.
- Email Two may describe only the verified Parent/Student experience: live Mishnah learning, recordings for review, steady progress, and secure family access. Keep Student data out of GHL.
- Email Three may invite the recipient to learn about the controlled pilot only through the registered One Time Home URL. Do not use a direct signup, checkout, Zoom/provider, recording, or application URL.
- Insert only the registered One Time Home URL custom value for every CTA in this sequence.
- Apply the standard GHL unsubscribe treatment to each email.
- Keep cadence values unset until separately approved.
- Do not select an audience. An operator-selected adult migration list is a later separate authorization; payment, attendance, event registration, portal state, deliverability, and legacy tags never select or authorize it.
- Keep the workflow Draft, unpublished, inactive, and unenrolled.
- No Human Handoff action.
- No human task creation.
- No production contact enrollment.
- No outbound message send in this lane.
- No Student contact, Student field, or Student tag.
- Record the workflow ID in `WORKFLOW-ID-CAPTURE.md` after creation.
