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
- Select the registered picker value: One Time Rabbi Campaign Sender Name.
- Select the registered picker value: One Time Default Reply-To.
- The fixed post-acceptance visible From is `Rabbi Eli Scheller | One Time Mishnayos <rabbi@onetimeonetime.com>` using One Time Rabbi Campaign Phase 2 From; this is not an open product decision.
- Preserve the current Phase 1 From fallback until GHL-UI-24 proves provider acceptance. Do not activate or send from the desired address in this Draft-only task.
- Keep Reply-To at `info@onetimeonetime.com`; rabbi@ may use the same governed GHL Conversations route and needs no separately monitored second inbox.
- Never guess or hardcode an unregistered sender identity.
- Use the three reviewed emails from the paired canonical prompt, in this exact order: `rabbi_new_program_existing_subscriber_migration_v1`, `rabbi_parent_student_experience_existing_subscriber_migration_v1`, then `rabbi_controlled_pilot_existing_subscriber_migration_v1`.
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
