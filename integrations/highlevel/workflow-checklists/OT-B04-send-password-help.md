# OT-B04 Send Password Help UI Checklist

Folder: 60 - Bot Actions
Exact trigger: OT-A1 invokes the typed password-help adapter
message_class: password_reset
sender_key: account_security
transport: Resend
Registry: integrations/highlevel/registry/workflow-registry.yaml

- Build only in Draft.
- Confirm every field, tag and custom value exists in `registry/current.json` before use.
- Read `sender-registry.yaml`, `message-class-registry.yaml`, and `communications-contract.json` before sender configuration.
- Select the registered picker value: One Time Account Sender Name.
- Select the registered picker value: One Time Account Preferred From.
- Select the registered picker value: One Time Default Reply-To.
- Never guess or hardcode an unregistered sender identity.
- No Human Handoff action.
- No human task creation.
- No production contact enrollment.
- No outbound message send in this lane.
- No Student contact, Student field or Student tag.
- Record the workflow ID in `WORKFLOW-ID-CAPTURE.md` after creation.
- Verify the split delivery contract: GHL may request the One Time adapter but never stores or sends a reset token.
