# OT-04 Payment Active AI Builder Prompt

Copy the text below into HighLevel AI Builder. Build in Draft state only.

```text
Create a HighLevel workflow named "OT-04 Payment Active".
Place it in folder "20 - Billing & Access".

Trigger: GHL Stripe subscription active or payment succeeded.
Trigger filters: Known One Time parent contact or deterministic GHL contact link. Not refunded or chargeback.
Re-entry: Allow per subscription ID and payment event ID.
Stop on response: Do not stop transactional webhook; stop optional marketing follow-up on reply.
Timezone/business window: Transactional actions may run anytime; human-facing messages follow business window.
Tags to use: OT | Active
Custom fields to use: One Time Customer Status, One Time Access Status, One Time Current Period End, One Time Subscription ID

Build these If/Else branches:
- If active subscription, add OT | Active and remove Grace/Canceled/Former when appropriate.
- If webhook fails, retry and create task.

Add these waits:
- No wait for webhook.
- Optional welcome follow-up waits 10 minutes.

Messages/templates by exact safe name:
- OT Payment Confirmation - DRAFT; activation credentials are sent only by One Time/Resend.

Workflow-to-workflow handoffs: Hand off to OT-07 Parent Portal Invitation after One Time entitlement projection confirms access.
Opportunity stage changes: Move opportunity to One Time Business / Active Customer.
Tasks/internal notifications: Create task if current period end is missing or webhook retry fails.
Custom webhook actions to One Time: subscription.active or payment.succeeded minimized webhook to One Time.
Stop conditions: Refund, chargeback, cancellation, suppression for optional messages.

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
- Use GHL test subscription/contact only.
- Confirm minimized webhook payload and no portal unlock from tag alone.

Publish checklist:
- Leave workflow in Draft.
- Review every trigger, filter, branch, wait, message, task, webhook, and stop condition.
- Test with the protected operator-owned test contact only.
- Record the workflow ID in integrations/highlevel/WORKFLOW-ID-CAPTURE.md and workflows.yaml after it exists.
- Publish only after separate operator approval.
```
