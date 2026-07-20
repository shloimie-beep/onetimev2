# OT-06 Subscription Canceled UI Checklist

Folder: 20 - Billing & Access
Prompt file: integrations/highlevel/ai-workflow-prompts/OT-06-subscription-canceled.md

## Manual Fields AI Builder Cannot Safely Infer

- Exact trigger: GHL Stripe subscription canceled.
- Trigger filters: Known One Time parent contact.
- Opportunity stage: Move opportunity to Canceled, then Former after current period end when applicable.
- Webhook actions: subscription.canceled minimized webhook to One Time.
- Publish toggle: leave Draft until explicitly approved.

## Exact Trigger Test

- Cancel test subscription.
- Confirm current period handling and minimized webhook.

## Expected Result

- Tags/fields: OT | Canceled, OT | Former; One Time Customer Status, One Time Access Status, One Time Current Period End, One Time Last Sync
- Outbound webhook: subscription.canceled minimized webhook to One Time.
- Messages: OT Cancellation Confirmation - DRAFT; no immediate access revocation promise.
- Stop conditions: Refund, chargeback, suppression for optional messages.

## Workflow ID Location

- Copy the HighLevel workflow ID into WORKFLOW-ID-CAPTURE.md.
- Copy the same ID into integrations/highlevel/workflows.yaml.

## Rollback / Disable

- Disable workflow; restore only test opportunity stage if needed.
