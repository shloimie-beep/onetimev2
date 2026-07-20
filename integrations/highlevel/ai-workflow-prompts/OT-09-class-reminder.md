# OT-09 Class Reminder AI Builder Prompt

Copy the text below into HighLevel AI Builder. Build in Draft state only.

```text
Create a HighLevel workflow named "OT-09 Class Reminder".
Place it in folder "40 - Classes & Content".

Trigger: One Time emits next class reminder event or GHL scheduled parent reminder after local access check.
Trigger filters: Parent contact only. Explicit channel opt-in. Not suppressed. Access active, grace, or complimentary.
Re-entry: Allow per class occurrence when One Time Next Class At changes.
Stop on response: Stop reminder and create task on reply.
Timezone/business window: Asia/Jerusalem; class reminders may send near 19:00 Israel time.
Tags to use: OT | Class Reminder Pending, OT | Email Opt-In, OT | WhatsApp Opt-In
Custom fields to use: One Time Next Class At, One Time Class Time Zone, One Time Access Status

Build these If/Else branches:
- Email reminder branch.
- WhatsApp reminder branch.
- No-consent internal task branch.

Add these waits:
- Wait until configured reminder time.

Messages/templates by exact safe name:
- OT Class Reminder - DRAFT; parent-facing only, no student contact.

Workflow-to-workflow handoffs: None.
Opportunity stage changes: No billing stage change.
Tasks/internal notifications: Task if class time is missing or timezone is invalid.
Custom webhook actions to One Time: None.
Stop conditions: Suppression, no access, no consent, reply, class canceled.

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
- Set test Next Class At.
- Confirm parent-facing message only.

Publish checklist:
- Leave workflow in Draft.
- Review every trigger, filter, branch, wait, message, task, webhook, and stop condition.
- Test with the protected operator-owned test contact only.
- Record the workflow ID in integrations/highlevel/WORKFLOW-ID-CAPTURE.md and workflows.yaml after it exists.
- Publish only after separate operator approval.
```
