# OT-01 New Lead Intake UI Checklist

Folder: 00 - Intake & Data
Prompt file: integrations/highlevel/ai-workflow-prompts/OT-01-new-lead-intake.md

## Manual Fields AI Builder Cannot Safely Infer

- Exact trigger: Contact is manually or API-enrolled after One Time public signup, WhatsApp lead capture, or approved import review.
- Trigger filters: Contact has OT | Lead. Contact has OT | Signup Website or OT | Signup WhatsApp. Contact does not have OT | Marketing Suppressed. Contact is a parent or lead contact, never a Student contact.
- Opportunity stage: Create or move opportunity to One Time Business / Lead.
- Webhook actions: No outbound webhook required for initial lead capture.
- Publish toggle: leave Draft until explicitly approved.

## Exact Trigger Test

- Use one operator-owned test contact.
- Add OT | Lead and OT | Signup Website.
- Confirm Lead opportunity stage, consent gate, and no Student fields.

## Expected Result

- Tags/fields: OT | Lead, OT | Prelaunch, OT | Signup Website, OT | Signup WhatsApp; One Time CRM Contact ID, One Time Signup Source, One Time Customer Status, One Time Email Consent, One Time WhatsApp Consent, One Time Suppression State
- Outbound webhook: No outbound webhook required for initial lead capture.
- Messages: OT New Lead Acknowledgement - DRAFT, parent-facing, no class link.
- Stop conditions: OT | Marketing Suppressed is present. OT | Active is present. Contact replies STOP, unsubscribe, or asks not to be contacted.

## Workflow ID Location

- Copy the HighLevel workflow ID into WORKFLOW-ID-CAPTURE.md.
- Copy the same ID into integrations/highlevel/workflows.yaml.

## Rollback / Disable

- Disable workflow and remove only test contact enrollment.
