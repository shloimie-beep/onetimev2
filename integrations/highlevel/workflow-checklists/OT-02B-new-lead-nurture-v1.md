# OT-02B New Lead Nurture v1 UI Checklist

Folder: 10 - Enrollment & Nurture
Exact trigger: registered new lead nurture audience entry
message_class: prelaunch_nurture
sender_key: rabbi_campaign
transport: GHL
Registry: integrations/highlevel/registry/workflow-registry.yaml

- Build only in Draft.
- Confirm every field, tag, and custom value exists in `registry/current.json` before use.
- Read `sender-registry.yaml`, `message-class-registry.yaml`, and `communications-contract.json` before sender configuration.
- Select One Time Rabbi Campaign Sender Name and verify it renders exactly `Rabbi Eli Scheller`.
- Select One Time Rabbi Campaign Phase 2 From and verify it renders exactly `rabbielischeller@onetimeonetime.com`.
- Select One Time Rabbi Reply-To and verify it renders exactly `rabbielischeller@onetimeonetime.com`.
- The single canonical public identity is `Rabbi Eli Scheller <rabbielischeller@onetimeonetime.com>` for both From and Reply-To; this is not an open product decision.
- Preserve One Time Rabbi Campaign Phase 1 From and historical `rabbi@onetimeonetime.com` data, but never select either for canonical public use.
- Until GHL-UI-24 proves provider acceptance, keep this Draft blocked. Do not use a fallback identity, activate, enroll, or send.
- Never guess or hardcode an unregistered sender identity.
- Use only the current controlled Reviewed Email One `rabbi_new_program_prelaunch_nurture_v1` from the paired canonical prompt; it supersedes provider-era copy instructions, authorizes no send, and leaves later nurture copy blocked pending separate review.
- Insert only the registered One Time Home URL custom value for the CTA.
- Do not select an audience. Only independently proven adult general-marketing permission may authorize a later audience; Tisha registration, attendance, payment, portal state, deliverability, and legacy tags never do.
- No Human Handoff action.
- No human task creation.
- No production contact enrollment.
- No outbound message send in this lane.
- No Student contact, Student field, or Student tag.
- Record the workflow ID in `WORKFLOW-ID-CAPTURE.md` after creation.
