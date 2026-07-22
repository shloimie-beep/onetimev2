# OT-C01 Tisha B'Av 2026 Warm Invitation Prompt

Build in HighLevel Draft state only. Do not publish, send messages, enroll production contacts, mutate Stripe, or create Student contacts from this prompt.

Canonical registry: one-time-highlevel@1.1.0
Exact workflow: OT-C01 Tisha B'Av 2026 Warm Invitation
Folder: 10 - Nurture & Sales
Exact trigger: approved Tisha B'Av 2026 warm invitation audience enters the registered campaign
message_class: rabbi_event_invitation
sender_key: rabbi_campaign
transport: GHL
Purpose: Registered Tisha B'Av 2026 Rabbi-authored warm invitation campaign.

Registry dependencies:
- `integrations/highlevel/registry/sender-registry.yaml`
- `integrations/highlevel/registry/message-class-registry.yaml`
- `integrations/highlevel/registry/communications-contract.json`
- `integrations/highlevel/registry/workflow-registry.yaml`

Exact sender custom values to select from the picker:
- One Time Rabbi Campaign Sender Name
- One Time Rabbi Campaign Phase 1 From
- One Time Rabbi Campaign Phase 2 From
- One Time Default Reply-To
- Do not type or guess sender display-name, From, reply-to, or provider text.
- If a registered sender value is absent from the picker, block this workflow instead of inventing it.

Required boundaries:
- Use only registered One Time fields, tags and custom values from `integrations/highlevel/registry/current.json`.
- Preserve unrelated existing tags on contacts.
- Check suppression and consent before any non-transactional communication.
- Do not create human tasks or Human Handoff actions.
- Do not expose raw Zoom links, raw Vimeo links, tokens, payment-card data, internal IDs, usernames or passwords.
- A GHL tag or field is not authorization for One Time portal access.

Use event_code tisha-bav-2026 and only the preserved Tisha B'Av event tags and values already registered.
Use rabbi_campaign phase 1 only. Phase 2 rabbi@ remains blocked until every acceptance prerequisite is recorded.
Do not select an audience, send a seed, or launch the campaign from this prompt.

Test state:
- Use only a protected operator-owned test contact.
- Record the workflow ID only after it exists in the verified location.
- Keep publish toggle off until explicit separate approval.
