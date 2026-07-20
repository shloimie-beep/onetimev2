# OT-03 Checkout Started / Abandoned UI Checklist

Folder: 20 - Billing & Access
Prompt file: integrations/highlevel/ai-workflow-prompts/OT-03-checkout-started-abandoned.md

## Manual Fields AI Builder Cannot Safely Infer

- Exact trigger: GHL checkout started event, GHL Stripe state, or manual move to Checkout Started.
- Trigger filters: Parent/lead contact only. Not suppressed. No active payment already processed.
- Opportunity stage: Move opportunity to One Time Business / Checkout Started.
- Webhook actions: Optional checkout.started webhook only after One Time endpoint is registered.
- Publish toggle: leave Draft until explicitly approved.

## Exact Trigger Test

- Move test opportunity to Checkout Started.
- Confirm no class link or portal credentials are sent.

## Expected Result

- Tags/fields: OT | Checkout Started, OT | Lead, OT | Prelaunch; One Time Customer Status, One Time Subscription ID, One Time Last Sync
- Outbound webhook: Optional checkout.started webhook only after One Time endpoint is registered.
- Messages: OT Checkout Reminder - DRAFT; no pricing promise unless configured in GHL checkout.
- Stop conditions: Payment active, cancellation, suppression, reply, manual review.

## Workflow ID Location

- Copy the HighLevel workflow ID into WORKFLOW-ID-CAPTURE.md.
- Copy the same ID into integrations/highlevel/workflows.yaml.

## Rollback / Disable

- Disable workflow; move only test opportunity back to Lead if needed.
