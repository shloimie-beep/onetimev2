# OT-12 Support Intake / Technical Escalation UI Checklist

Folder: 50 - Support
Prompt file: integrations/highlevel/ai-workflow-prompts/OT-12-support-intake-technical-escalation.md

## Manual Fields AI Builder Cannot Safely Infer

- Exact trigger: Support requested tag, Conversation AI handoff, inbound reply needing technical help, or One Time support event.
- Trigger filters: Known parent/contact or qualified lead. No passwords, student data, or raw private notes in workflow fields.
- Opportunity stage: No automatic sales stage change.
- Webhook actions: Optional minimized support status webhook only after endpoint is registered.
- Publish toggle: leave Draft until explicitly approved.

## Exact Trigger Test

- Apply support tag to test contact.
- Confirm task and no raw sensitive fields.

## Expected Result

- Tags/fields: OT | Support Requested; One Time Support Status, One Time CRM Contact ID, One Time Last Sync
- Outbound webhook: Optional minimized support status webhook only after endpoint is registered.
- Messages: OT Support Intake Acknowledgement - DRAFT; no credentials, no Torah rulings.
- Stop conditions: Support resolved, suppression for optional messages, sensitive-data request.

## Workflow ID Location

- Copy the HighLevel workflow ID into WORKFLOW-ID-CAPTURE.md.
- Copy the same ID into integrations/highlevel/workflows.yaml.

## Rollback / Disable

- Disable workflow and close test task.
