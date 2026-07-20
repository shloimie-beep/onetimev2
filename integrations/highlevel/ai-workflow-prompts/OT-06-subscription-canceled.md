# OT-06 Subscription Canceled AI Builder Prompt

Copy the text below into HighLevel AI Builder. Build in Draft state only.

```text
Create a HighLevel workflow named "OT-06 Subscription Canceled".
Place it in folder "20 - Billing & Access".

Trigger: GHL Stripe subscription canceled.
Trigger filters: Known One Time parent contact.
Re-entry: Allow once per subscription cancellation event ID.
Stop on response: Create task on reply; transactional webhook still runs.
Timezone/business window: Transactional actions may run anytime; optional messages follow business window.
Tags to use: OT | Canceled, OT | Former
Custom fields to use: One Time Customer Status, One Time Access Status, One Time Current Period End, One Time Last Sync

Build these If/Else branches:
- If current_period_end exists, keep access active through that date.
- If missing current_period_end, create manual review task.

Add these waits:
- No wait for webhook.
- Optional end-of-period task waits until current_period_end.

Messages/templates by exact safe name:
- OT Cancellation Confirmation - DRAFT; no immediate access revocation promise.

Workflow-to-workflow handoffs: Refund or chargeback to OT-13.
Opportunity stage changes: Move opportunity to Canceled, then Former after current period end when applicable.
Tasks/internal notifications: Create task for missing current_period_end or webhook failure.
Custom webhook actions to One Time: subscription.canceled minimized webhook to One Time.
Stop conditions: Refund, chargeback, suppression for optional messages.

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
- Cancel test subscription.
- Confirm current period handling and minimized webhook.

Publish checklist:
- Leave workflow in Draft.
- Review every trigger, filter, branch, wait, message, task, webhook, and stop condition.
- Test with the protected operator-owned test contact only.
- Record the workflow ID in integrations/highlevel/WORKFLOW-ID-CAPTURE.md and workflows.yaml after it exists.
- Publish only after separate operator approval.
```
