# OT-08 Parent Portal Activated AI Builder Prompt

Copy the text below into HighLevel AI Builder. Build in Draft state only.

```text
Create a HighLevel workflow named "OT-08 Parent Portal Activated".
Place it in folder "30 - Portal Lifecycle".

Trigger: One Time emits portal activated business event.
Trigger filters: Parent contact only.
Re-entry: Do not re-enter unless Portal Status changes from inactive to active again.
Stop on response: Create task on reply.
Timezone/business window: Asia/Jerusalem; Sunday-Thursday 9:00-20:30.
Tags to use: OT | Portal Active
Custom fields to use: One Time Portal Status, One Time Last Sync

Build these If/Else branches:
- If active customer, optional welcome branch.
- If complimentary, optional internal review branch.

Add these waits:
- Optional welcome wait 1 hour after activation.

Messages/templates by exact safe name:
- OT Portal Activated Welcome - DRAFT.

Workflow-to-workflow handoffs: None.
Opportunity stage changes: No billing stage change.
Tasks/internal notifications: Create task only when activation conflicts with access status.
Custom webhook actions to One Time: None.
Stop conditions: Suppression for optional messages, reply, access inactive.

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
- Emit test portal activated event.
- Confirm tag only; no auth mutation.

Publish checklist:
- Leave workflow in Draft.
- Review every trigger, filter, branch, wait, message, task, webhook, and stop condition.
- Test with the protected operator-owned test contact only.
- Record the workflow ID in integrations/highlevel/WORKFLOW-ID-CAPTURE.md and workflows.yaml after it exists.
- Publish only after separate operator approval.
```
