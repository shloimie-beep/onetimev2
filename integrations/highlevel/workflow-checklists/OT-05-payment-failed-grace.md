# OT-05 Payment Failed / Grace UI Checklist

Folder: 20 - Billing & Access
Exact trigger: One Time payment/access projection becomes Grace after payment failure
message_class: payment_failed_support
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
- Record the workflow ID in `WORKFLOW-ID-CAPTURE.md` after creation.
