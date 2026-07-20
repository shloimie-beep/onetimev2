# OT-13 Refund / Chargeback AI Builder Prompt

Copy the text below into HighLevel AI Builder. Build in Draft state only.

```text
Create a HighLevel workflow named "OT-13 Refund / Chargeback".
Place it in folder "20 - Billing & Access".

Trigger: GHL Stripe refund, full refund, partial refund, or chargeback event.
Trigger filters: Known parent/contact or subscription ID. Payment event ID present.
Re-entry: Allow once per provider event ID.
Stop on response: Create billing task on reply; transactional webhook still runs.
Timezone/business window: Transactional webhook anytime; human-facing messages by policy.
Tags to use: OT | Refunded, OT | Chargeback
Custom fields to use: One Time Customer Status, One Time Access Status, One Time Current Period End, One Time Subscription ID

Build these If/Else branches:
- Full refund -> immediate inactive entitlement webhook.
- Chargeback -> immediate inactive entitlement webhook and owner task.
- Partial refund -> manual review, no automatic revoke.

Add these waits:
- No wait for entitlement webhook.
- Wait 0 minutes for owner alert task.

Messages/templates by exact safe name:
- No automatic customer message unless operator approves exact copy.

Workflow-to-workflow handoffs: Can close OT-05 failed-payment reminders and OT-06 cancellation follow-up.
Opportunity stage changes: Move to Former or manual review based on event type.
Tasks/internal notifications: Create urgent owner billing task for chargeback or ambiguous refund.
Custom webhook actions to One Time: refund.full or chargeback minimized webhook to One Time.
Stop conditions: Manual review complete, event duplicate, missing provider event ID.

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
- Use test payment event only.
- Confirm no live Stripe mutation and no customer message.

Publish checklist:
- Leave workflow in Draft.
- Review every trigger, filter, branch, wait, message, task, webhook, and stop condition.
- Test with the protected operator-owned test contact only.
- Record the workflow ID in integrations/highlevel/WORKFLOW-ID-CAPTURE.md and workflows.yaml after it exists.
- Publish only after separate operator approval.
```
