# OT-02A Existing Subscriber Migration 2026 v1 UI Checklist

Folder: 10 - Enrollment & Nurture
Exact trigger: registered existing subscriber migration audience entry
message_class: existing_subscriber_migration
sender_key: rabbi_campaign
transport: GHL
Registry: integrations/highlevel/registry/workflow-registry.yaml

- Build only in Draft; keep unpublished, inactive, and unenrolled.
- Confirm every field, tag, and custom value exists in `registry/current.json`.
- Select the registered sender values and verify `Rabbi Eli Scheller <rabbielischeller@onetimeonetime.com>` for both From and Reply-To.
- Never select the historical `rabbi@onetimeonetime.com` alias or any fallback identity.
- Keep the workflow blocked until GHL-UI-24 proves provider acceptance.
- Use exactly these copy IDs in order:
  1. `ghl.legacy_member_migration.step_1.v1`
  2. `ghl.legacy_member_migration.step_2.v1`
  3. `ghl.legacy_member_migration.step_3.v1`
- Email One is informational, Email Two is the restart reminder, and Email Three is the secure Family-account activation reminder.
- Use only the registered CTA custom value named by each canonical copy entry.
- Apply the standard GHL unsubscribe treatment to each email.
- Leave cadence unset until separately approved.
- Select no audience. Only an operator-approved adult migration list with documented migration authority is eligible.
- Recheck migration authority and every suppression state before each email.
- Exit on signup, decline, invalid address, unsubscribe, DND, complaint, hard bounce, suppression, or completion.
- No Human Handoff, human task, production enrollment, outbound send, Student contact, Student field, or Student tag.
- Keep the publish toggle off until explicit separate approval.
