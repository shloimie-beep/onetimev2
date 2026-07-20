# OT-13 Refund / Chargeback UI Checklist

Folder: 20 - Billing & Access
Prompt file: integrations/highlevel/ai-workflow-prompts/OT-13-refund-chargeback.md

## Manual Fields AI Builder Cannot Safely Infer

- Exact trigger: GHL Stripe refund, full refund, partial refund, or chargeback event.
- Trigger filters: Known parent/contact or subscription ID. Payment event ID present.
- Opportunity stage: Move to Former or manual review based on event type.
- Webhook actions: refund.full or chargeback minimized webhook to One Time.
- Publish toggle: leave Draft until explicitly approved.

## Exact Trigger Test

- Use test payment event only.
- Confirm no live Stripe mutation and no customer message.

## Expected Result

- Tags/fields: OT | Refunded, OT | Chargeback; One Time Customer Status, One Time Access Status, One Time Current Period End, One Time Subscription ID
- Outbound webhook: refund.full or chargeback minimized webhook to One Time.
- Messages: No automatic customer message unless operator approves exact copy.
- Stop conditions: Manual review complete, event duplicate, missing provider event ID.

## Workflow ID Location

- Copy the HighLevel workflow ID into WORKFLOW-ID-CAPTURE.md.
- Copy the same ID into integrations/highlevel/workflows.yaml.

## Rollback / Disable

- Disable workflow and revert only test opportunity stage/tag.
