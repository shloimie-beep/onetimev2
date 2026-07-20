# OT-01 New Lead Intake AI Builder Prompt

Copy the text below into HighLevel AI Builder. Build in Draft state only.

```text
Create a HighLevel workflow named "OT-01 New Lead Intake".
Place it in folder "00 - Intake & Data".

Trigger: Contact is manually or API-enrolled after One Time public signup, WhatsApp lead capture, or approved import review.
Trigger filters: Contact has OT | Lead. Contact has OT | Signup Website or OT | Signup WhatsApp. Contact does not have OT | Marketing Suppressed. Contact is a parent or lead contact, never a Student contact.
Re-entry: Allow re-entry only after the contact exits and a new signup source or import batch value is present.
Stop on response: Stop marketing messages when the contact replies and create a human follow-up task.
Timezone/business window: Use Asia/Jerusalem. Send human-facing messages Sunday-Thursday 9:00-20:30 unless the message is a transactional acknowledgement.
Tags to use: OT | Lead, OT | Prelaunch, OT | Signup Website, OT | Signup WhatsApp
Custom fields to use: One Time CRM Contact ID, One Time Signup Source, One Time Customer Status, One Time Email Consent, One Time WhatsApp Consent, One Time Suppression State

Build these If/Else branches:
- If suppressed, remove from this workflow and do not send.
- If explicit email opt-in, use email-safe acknowledgement.
- If explicit WhatsApp opt-in, use WhatsApp-safe acknowledgement.
- If consent unknown, create internal task only.

Add these waits:
- Wait 5 minutes after entry before any non-transactional follow-up.

Messages/templates by exact safe name:
- OT New Lead Acknowledgement - DRAFT, parent-facing, no class link.
- OT Internal New Lead Review Task - no outbound message.

Workflow-to-workflow handoffs: If launch audience and not suppressed, hand off to OT-02 Prelaunch Nurture.
Opportunity stage changes: Create or move opportunity to One Time Business / Lead.
Tasks/internal notifications: Create internal task when consent is unknown or the source classification needs review.
Custom webhook actions to One Time: No outbound webhook required for initial lead capture.
Stop conditions: OT | Marketing Suppressed is present. OT | Active is present. Contact replies STOP, unsubscribe, or asks not to be contacted.

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
- Use one operator-owned test contact.
- Add OT | Lead and OT | Signup Website.
- Confirm Lead opportunity stage, consent gate, and no Student fields.

Publish checklist:
- Leave workflow in Draft.
- Review every trigger, filter, branch, wait, message, task, webhook, and stop condition.
- Test with the protected operator-owned test contact only.
- Record the workflow ID in integrations/highlevel/WORKFLOW-ID-CAPTURE.md and workflows.yaml after it exists.
- Publish only after separate operator approval.
```
