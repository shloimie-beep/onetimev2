# OT-05 Payment Failed / Seven-Day Grace UI Checklist

Folder: 20 - Billing & Access
Prompt file: integrations/highlevel/ai-workflow-prompts/OT-05-payment-failed-seven-day-grace.md

## Manual Fields AI Builder Cannot Safely Infer

- Exact trigger: GHL Stripe payment failed.
- Trigger filters: Known One Time parent contact. Not refund or chargeback. Not suppressed for reminder sends.
- Opportunity stage: Move opportunity to One Time Business / Grace.
- Webhook actions: payment.failed minimized webhook to One Time.
- Publish toggle: leave Draft until explicitly approved.

## Exact Trigger Test

- Trigger failed payment on test contact.
- Confirm seven-day grace fields and no immediate portal revocation.

## Expected Result

- Tags/fields: OT | Grace, OT | Payment Failed; One Time Grace Until, One Time Access Status, One Time Subscription ID
- Outbound webhook: payment.failed minimized webhook to One Time.
- Messages: OT Payment Retry Reminder - DRAFT; no pressure copy.
- Stop conditions: Payment recovered, cancellation, refund, chargeback, suppression, reply, manual review.

## Workflow ID Location

- Copy the HighLevel workflow ID into WORKFLOW-ID-CAPTURE.md.
- Copy the same ID into integrations/highlevel/workflows.yaml.

## Rollback / Disable

- Disable workflow; clear test-only failed-payment tags.
