# OT-08 Parent Portal Activated UI Checklist

Folder: 30 - Portal Lifecycle
Prompt file: integrations/highlevel/ai-workflow-prompts/OT-08-parent-portal-activated.md

## Manual Fields AI Builder Cannot Safely Infer

- Exact trigger: One Time emits portal activated business event.
- Trigger filters: Parent contact only.
- Opportunity stage: No billing stage change.
- Webhook actions: None.
- Publish toggle: leave Draft until explicitly approved.

## Exact Trigger Test

- Emit test portal activated event.
- Confirm tag only; no auth mutation.

## Expected Result

- Tags/fields: OT | Portal Active; One Time Portal Status, One Time Last Sync
- Outbound webhook: None.
- Messages: OT Portal Activated Welcome - DRAFT.
- Stop conditions: Suppression for optional messages, reply, access inactive.

## Workflow ID Location

- Copy the HighLevel workflow ID into WORKFLOW-ID-CAPTURE.md.
- Copy the same ID into integrations/highlevel/workflows.yaml.

## Rollback / Disable

- Disable workflow and remove only test enrollment.
