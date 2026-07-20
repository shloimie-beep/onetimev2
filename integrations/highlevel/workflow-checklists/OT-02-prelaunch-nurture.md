# OT-02 Prelaunch Nurture UI Checklist

Folder: 10 - Nurture & Sales
Prompt file: integrations/highlevel/ai-workflow-prompts/OT-02-prelaunch-nurture.md

## Manual Fields AI Builder Cannot Safely Infer

- Exact trigger: Tag OT | Prelaunch is added or OT-01 hands off after consent checks.
- Trigger filters: Contact is not suppressed. Contact has explicit email opt-in or explicit WhatsApp opt-in. Contact is not active, canceled, refunded, or chargeback.
- Opportunity stage: Keep opportunity in Lead unless checkout begins.
- Webhook actions: None.
- Publish toggle: leave Draft until explicitly approved.

## Exact Trigger Test

- Run one email-opt-in test contact.
- Run one consent-unknown test contact and confirm no outbound message.

## Expected Result

- Tags/fields: OT | Prelaunch, OT | Email Opt-In, OT | WhatsApp Opt-In; One Time Import Batch, One Time Source Classification, One Time Email Consent, One Time WhatsApp Consent, One Time Suppression State
- Outbound webhook: None.
- Messages: OT Prelaunch Seed Email - use approved seed copy below only for seed/testing until broad-send approval.
- Stop conditions: Suppression, reply, payment active, checkout started, cancellation, refund, chargeback.

## Workflow ID Location

- Copy the HighLevel workflow ID into WORKFLOW-ID-CAPTURE.md.
- Copy the same ID into integrations/highlevel/workflows.yaml.

## Rollback / Disable

- Disable workflow and remove test contact enrollment.
