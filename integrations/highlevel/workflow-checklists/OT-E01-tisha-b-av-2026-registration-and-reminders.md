# OT-E01 Tisha B'Av 2026 Registration and Reminders UI Checklist

Folder: 45 - Events
Exact trigger: Tisha B'Av 2026 registration or approved reminder milestone is recorded
message_class: event_registration_confirmation
sender_key: brand
approved_step_sender_override: Email A - Immediate Confirmation -> rabbi_campaign
transport: GHL
Registry: integrations/highlevel/registry/workflow-registry.yaml

- Reuse only workflow ID `a34ea513-4612-4f53-8bd8-49e89e6610f9`; never create a duplicate.
- Preserve the Published workflow and current in-flight enrollment. A brief Draft interval is permitted only to save and republish the Git-approved Email A change.
- Confirm every field, tag and custom value exists in `registry/current.json` before use.
- Read `sender-registry.yaml`, `message-class-registry.yaml`, and `communications-contract.json` before sender configuration.
- For Email A only, select the registered picker values One Time Rabbi Campaign Sender Name and One Time Rabbi Campaign Phase 1 From.
- Preserve One Time Brand Sender Name and One Time Brand From for Email C and Email D.
- Select the registered picker value: One Time Default Reply-To.
- Never guess or hardcode an unregistered sender identity.
- Set Email A subject to `You're registered — let's strengthen ourselves together`.
- Set Email A pre-header to `Join Rabbi Eli Scheller live from the Holy Land this Tisha B'Av.`.
- Match the exact Email A body in the canonical prompt file, including the protected custom-value link and the Rabbi Eli Scheller / One Time Mishnah Learning sign-off.
- Treat Email A as event-only registration confirmation. Do not infer newsletter or general-marketing consent.
- Require the registered-event permission marker, valid email, email DND false, and no unsubscribe, complaint, hard bounce, or suppression.
- Keep duplicate registration idempotent and Student contacts/data prohibited.
- Do not change OT-C01, its audience, or its Draft/zero-send state.
- No Human Handoff action.
- No human task creation.
- No production contact enrollment.
- No test or outbound message send in this lane.
- No Student contact, Student field or Student tag.
- Save Email A, save the existing workflow, reopen/read back the same ID, and verify the operator enrollment stayed at its current wait without reenrollment or advancement.
