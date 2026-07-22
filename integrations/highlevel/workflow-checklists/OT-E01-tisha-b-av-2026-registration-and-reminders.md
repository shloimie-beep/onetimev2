# OT-E01 Tisha B'Av 2026 Registration and Reminders UI Checklist

Folder: 45 - Events
Exact trigger: Tisha B'Av 2026 registration or approved reminder milestone is recorded
message_class: event_registration_confirmation
sender_key: brand
transport: GHL
Registry: integrations/highlevel/registry/workflow-registry.yaml

- Build only in Draft.
- Confirm every field, tag and custom value exists in `registry/current.json` before use.
- Read `sender-registry.yaml`, `message-class-registry.yaml`, and `communications-contract.json` before sender configuration.
- Select the registered picker value: One Time Brand Sender Name.
- Select the registered picker value: One Time Brand From.
- Select the registered picker value: One Time Default Reply-To.
- Never guess or hardcode an unregistered sender identity.
- No Human Handoff action.
- No human task creation.
- No production contact enrollment.
- No outbound message send in this lane.
- No Student contact, Student field or Student tag.
- Record the workflow ID in `WORKFLOW-ID-CAPTURE.md` after creation.
