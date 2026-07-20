# OT-05 Payment Failed / Seven-Day Grace AI Builder Prompt

Copy the text below into HighLevel AI Builder. Build in Draft state only.

```text
Create a HighLevel workflow named "OT-05 Payment Failed / Seven-Day Grace".
Place it in folder "20 - Billing & Access".

Trigger: GHL Stripe payment failed.
Trigger filters: Known One Time parent contact. Not refund or chargeback. Not suppressed for reminder sends.
Re-entry: Allow once per failed payment event ID.
Stop on response: Stop reminder sequence on reply and create billing task.
Timezone/business window: Asia/Jerusalem; Sunday-Thursday 9:00-20:30 for reminders.
Tags to use: OT | Grace, OT | Payment Failed
Custom fields to use: One Time Grace Until, One Time Access Status, One Time Subscription ID

Build these If/Else branches:
- If payment recovered, stop and hand off to OT-04.
- If canceled, stop and hand off to OT-06.
- If chargeback/refund, stop and hand off to OT-13.

Add these waits:
- Day 0 notice.
- Day 3 reminder.
- Day 6 final reminder.

Messages/templates by exact safe name:
- OT Payment Retry Reminder - DRAFT; no pressure copy.

Workflow-to-workflow handoffs: Recovered to OT-04. Canceled to OT-06. Refund/chargeback to OT-13.
Opportunity stage changes: Move opportunity to One Time Business / Grace.
Tasks/internal notifications: Create billing task on final failed reminder or webhook failure.
Custom webhook actions to One Time: payment.failed minimized webhook to One Time.
Stop conditions: Payment recovered, cancellation, refund, chargeback, suppression, reply, manual review.

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
- Trigger failed payment on test contact.
- Confirm seven-day grace fields and no immediate portal revocation.

Publish checklist:
- Leave workflow in Draft.
- Review every trigger, filter, branch, wait, message, task, webhook, and stop condition.
- Test with the protected operator-owned test contact only.
- Record the workflow ID in integrations/highlevel/WORKFLOW-ID-CAPTURE.md and workflows.yaml after it exists.
- Publish only after separate operator approval.
```
