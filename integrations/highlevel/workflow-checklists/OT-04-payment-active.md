# OT-04 Payment Active UI Checklist

Folder: 20 - Billing & Access
Prompt file: integrations/highlevel/ai-workflow-prompts/OT-04-payment-active.md

## Manual Fields AI Builder Cannot Safely Infer

- Exact trigger: GHL Stripe subscription active or payment succeeded.
- Trigger filters: Known One Time parent contact or deterministic GHL contact link. Not refunded or chargeback.
- Opportunity stage: Move opportunity to One Time Business / Active Customer.
- Webhook actions: subscription.active or payment.succeeded minimized webhook to One Time.
- Publish toggle: leave Draft until explicitly approved.

## Exact Trigger Test

- Use GHL test subscription/contact only.
- Confirm minimized webhook payload and no portal unlock from tag alone.

## Expected Result

- Tags/fields: OT | Active; One Time Customer Status, One Time Access Status, One Time Current Period End, One Time Subscription ID
- Outbound webhook: subscription.active or payment.succeeded minimized webhook to One Time.
- Messages: OT Payment Confirmation - DRAFT; activation credentials are sent only by One Time/Resend.
- Stop conditions: Refund, chargeback, cancellation, suppression for optional messages.

## Workflow ID Location

- Copy the HighLevel workflow ID into WORKFLOW-ID-CAPTURE.md.
- Copy the same ID into integrations/highlevel/workflows.yaml.

## Rollback / Disable

- Disable workflow; remove only test tags/stage changes.
