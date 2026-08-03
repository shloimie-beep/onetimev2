# OT-01 New Lead Intake UI Checklist

Folder: 00 - Intake & Data
Exact trigger: successful durable Family-account creation committed with immediate free access
message_class: access_help
sender_key: office
transport: GHL
Registry: integrations/highlevel/registry/workflow-registry.yaml

- Build only in Draft.
- Confirm every field, tag and custom value exists in `registry/current.json` before use.
- Read `sender-registry.yaml`, `message-class-registry.yaml`, and `communications-contract.json` before sender configuration.
- Select the registered picker value: One Time Office Sender Name.
- Select the registered picker value: One Time Office From.
- Select the registered picker value: One Time Default Reply-To.
- Never guess or hardcode an unregistered sender identity.
- No Human Handoff action.
- No human task creation.
- No production contact enrollment.
- No outbound message send in this lane.
- No Student contact, Student field or Student tag.
- Configure only canonical copy `ghl.signup_confirmation.v1` with its registered One Time Member Login URL CTA.
- Require durable Family-account and immediate-free-access readback before the receipt.
- Verify the copy confirms up to three Student seats, no collected card, and no automatic charge without creating a Student contact.
- Keep School inquiries on the separate manual path; never enroll a School inquiry in OT-01 or automatic nurture.
- Record the workflow ID in `WORKFLOW-ID-CAPTURE.md` after creation.
