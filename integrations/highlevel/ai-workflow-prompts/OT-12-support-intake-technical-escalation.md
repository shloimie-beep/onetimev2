# OT-12 Support Intake / Technical Escalation AI Builder Prompt

Copy the text below into HighLevel AI Builder. Build in Draft state only.

```text
Create a HighLevel workflow named "OT-12 Support Intake / Technical Escalation".
Place it in folder "50 - Support".

Trigger: Support requested tag, Conversation AI handoff, inbound reply needing technical help, or One Time support event.
Trigger filters: Known parent/contact or qualified lead. No passwords, student data, or raw private notes in workflow fields.
Re-entry: Allow per new support event or unresolved task reopen.
Stop on response: Replies update the support task and keep human review active.
Timezone/business window: Support tasks anytime; outbound replies by human/operator policy.
Tags to use: OT | Support Requested
Custom fields to use: One Time Support Status, One Time CRM Contact ID, One Time Last Sync

Build these If/Else branches:
- Existing customer technical issue.
- Prospect enrollment question.
- Billing/support issue.
- Sensitive or uncertain -> human.

Add these waits:
- Wait 30 minutes before escalation reminder if task remains unassigned.

Messages/templates by exact safe name:
- OT Support Intake Acknowledgement - DRAFT; no credentials, no Torah rulings.

Workflow-to-workflow handoffs: Billing issue can hand off to OT-05/OT-06/OT-13 only after state is confirmed.
Opportunity stage changes: No automatic sales stage change.
Tasks/internal notifications: Create support task assigned to owner/admin queue.
Custom webhook actions to One Time: Optional minimized support status webhook only after endpoint is registered.
Stop conditions: Support resolved, suppression for optional messages, sensitive-data request.

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
- Apply support tag to test contact.
- Confirm task and no raw sensitive fields.

Publish checklist:
- Leave workflow in Draft.
- Review every trigger, filter, branch, wait, message, task, webhook, and stop condition.
- Test with the protected operator-owned test contact only.
- Record the workflow ID in integrations/highlevel/WORKFLOW-ID-CAPTURE.md and workflows.yaml after it exists.
- Publish only after separate operator approval.
```
