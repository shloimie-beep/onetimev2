# OT-10 New Recording Available AI Builder Prompt

Copy the text below into HighLevel AI Builder. Build in Draft state only.

```text
Create a HighLevel workflow named "OT-10 New Recording Available".
Place it in folder "40 - Classes & Content".

Trigger: One Time emits recording available business event.
Trigger filters: Parent contact only. Access active, grace, or complimentary. Not suppressed. Explicit channel opt-in for any message.
Re-entry: Allow once per recording/content event ID.
Stop on response: Stop optional messages and create task.
Timezone/business window: Asia/Jerusalem; Sunday-Thursday 9:00-20:30.
Tags to use: OT | Recording Available
Custom fields to use: One Time Access Status, One Time Last Sync

Build these If/Else branches:
- Email notice branch.
- WhatsApp notice branch.
- No-consent internal task branch.

Add these waits:
- Wait 15 minutes after content publish confirmation.

Messages/templates by exact safe name:
- OT Recording Available - DRAFT; reference parent portal only, never raw Vimeo credentials.

Workflow-to-workflow handoffs: None.
Opportunity stage changes: No billing stage change.
Tasks/internal notifications: Task if access or recording state conflicts.
Custom webhook actions to One Time: None.
Stop conditions: Suppression, no access, no consent, reply, recording unpublished.

Consent and suppression gates:
- Check OT | Marketing Suppressed before any outbound message.
- Check One Time Email Consent and OT | Email Opt-In before email.
- Check One Time WhatsApp Consent and OT | WhatsApp Opt-In before WhatsApp.
- Unknown consent may create an internal task, but must not send a campaign message.
- STOP, unsubscribe, complaint, hard bounce, and manual suppression win over every other branch.

Safety boundaries:
- Never create or message Student contacts.
- Never include Student names, ages, passwords, private notes, progress, attendance, Vimeo credentials, Zoom links, reset links, or raw internal IDs.
- Never unlock One Time portal access from a HighLevel tag alone.
- Never send a campaign, publish the workflow, or enroll production contacts from this prompt.

Test procedure:
- Use test content event.
- Confirm no Vimeo credentials or private URLs.

Publish checklist:
- Leave workflow in Draft.
- Review every trigger, filter, branch, wait, message, task, webhook, and stop condition.
- Test with the protected operator-owned test contact only.
- Record the workflow ID in integrations/highlevel/WORKFLOW-ID-CAPTURE.md and workflows.yaml after it exists.
- Publish only after separate operator approval.
```
