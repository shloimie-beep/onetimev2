# OT-11 WhatsApp Lead Qualification AI Builder Prompt

Copy the text below into HighLevel AI Builder. Build in Draft state only.

```text
Create a HighLevel workflow named "OT-11 WhatsApp Lead Qualification".
Place it in folder "00 - Intake & Data".

Trigger: Agent Studio / Conversation AI creates or updates a WhatsApp lead and applies OT | Signup WhatsApp.
Trigger filters: WhatsApp opt-in captured explicitly. Not suppressed. No Student data collected.
Re-entry: Allow after new inbound WhatsApp conversation starts or consent changes.
Stop on response: Conversation AI handles active replies; human handoff stops automation when uncertain.
Timezone/business window: Inbound response anytime; outbound follow-up Sunday-Thursday 9:00-20:30 Asia/Jerusalem.
Tags to use: OT | Lead, OT | Signup WhatsApp, OT | WhatsApp Opt-In
Custom fields to use: One Time WhatsApp Consent, One Time Signup Source, One Time Source Classification

Build these If/Else branches:
- Qualified family lead to OT-01.
- Existing-customer support issue to OT-12.
- Uncertain or sensitive question to human.

Add these waits:
- No automated wait before AI response.
- Wait 10 minutes before internal task if handoff required.

Messages/templates by exact safe name:
- Conversation AI uses OT-A1 One Time Enrollment Concierge prompt.

Workflow-to-workflow handoffs: Qualified lead to OT-01 or OT-02. Support issue to OT-12.
Opportunity stage changes: Create or move opportunity to Lead when qualified.
Tasks/internal notifications: Create task for human handoff, identity conflict, or STOP handling.
Custom webhook actions to One Time: No webhook unless One Time lead intake endpoint is registered.
Stop conditions: STOP/opt-out, suppression, existing technical support, human handoff.

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
- Use test WhatsApp contact.
- Confirm separate consent capture and no Student fields.

Publish checklist:
- Leave workflow in Draft.
- Review every trigger, filter, branch, wait, message, task, webhook, and stop condition.
- Test with the protected operator-owned test contact only.
- Record the workflow ID in integrations/highlevel/WORKFLOW-ID-CAPTURE.md and workflows.yaml after it exists.
- Publish only after separate operator approval.
```
