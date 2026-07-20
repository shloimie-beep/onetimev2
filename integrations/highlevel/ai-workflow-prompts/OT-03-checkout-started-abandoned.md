# OT-03 Checkout Started / Abandoned AI Builder Prompt

Copy the text below into HighLevel AI Builder. Build in Draft state only.

```text
Create a HighLevel workflow named "OT-03 Checkout Started / Abandoned".
Place it in folder "20 - Billing & Access".

Trigger: GHL checkout started event, GHL Stripe state, or manual move to Checkout Started.
Trigger filters: Parent/lead contact only. Not suppressed. No active payment already processed.
Re-entry: Allow once per checkout attempt or subscription ID.
Stop on response: Stop reminder sequence on reply and create task.
Timezone/business window: Asia/Jerusalem; Sunday-Thursday 9:00-20:30.
Tags to use: OT | Checkout Started, OT | Lead, OT | Prelaunch
Custom fields to use: One Time Customer Status, One Time Subscription ID, One Time Last Sync

Build these If/Else branches:
- If payment succeeds, stop and hand off to OT-04.
- If suppressed, stop.
- If no consent, create task only.

Add these waits:
- Wait 30 minutes before first abandoned-checkout reminder.
- Wait 24 hours before final internal task.

Messages/templates by exact safe name:
- OT Checkout Reminder - DRAFT; no pricing promise unless configured in GHL checkout.

Workflow-to-workflow handoffs: Payment active to OT-04. Payment failure to OT-05.
Opportunity stage changes: Move opportunity to One Time Business / Checkout Started.
Tasks/internal notifications: Create abandoned checkout follow-up task after final wait.
Custom webhook actions to One Time: Optional checkout.started webhook only after One Time endpoint is registered.
Stop conditions: Payment active, cancellation, suppression, reply, manual review.

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
- Move test opportunity to Checkout Started.
- Confirm no class link or portal credentials are sent.

Publish checklist:
- Leave workflow in Draft.
- Review every trigger, filter, branch, wait, message, task, webhook, and stop condition.
- Test with the protected operator-owned test contact only.
- Record the workflow ID in integrations/highlevel/WORKFLOW-ID-CAPTURE.md and workflows.yaml after it exists.
- Publish only after separate operator approval.
```
