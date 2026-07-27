# OT-02B New Lead Nurture v1 Prompt

Build in HighLevel Draft state only. Do not publish, send messages, select an audience, enroll production contacts, mutate Stripe, or create Student contacts from this prompt.

Canonical registry: one-time-highlevel@1.1.0
Exact workflow: OT-02B New Lead Nurture v1
Folder: 10 - Enrollment & Nurture
Exact trigger: registered new lead nurture audience entry
message_class: prelaunch_nurture
sender_key: rabbi_campaign
transport: GHL
Purpose: New lead nurture separate from migration. This reviewed email is the first nurture message only; do not invent later nurture copy from it.

Registry dependencies:

- `integrations/highlevel/registry/sender-registry.yaml`
- `integrations/highlevel/registry/message-class-registry.yaml`
- `integrations/highlevel/registry/communications-contract.json`
- `integrations/highlevel/registry/workflow-registry.yaml`

Exact sender custom values to select from the picker for this Phase-1 Draft:

- One Time Rabbi Campaign Sender Name
- One Time Rabbi Campaign Phase 1 From
- One Time Default Reply-To
- Do not select One Time Rabbi Campaign Phase 2 From. It remains pending mailbox/routing, HighLevel From acceptance, separately authorized protected seed delivery, and controlled reply-to-Conversations readback.
- Do not type or guess sender display-name, From, reply-to, or provider text.
- If a registered sender value is absent from the picker, block this workflow instead of inventing it.

Required boundaries:

- Use only registered One Time fields, tags and custom values from `integrations/highlevel/registry/current.json`.
- Preserve unrelated existing tags on contacts.
- The audience is only adults with independently proven general-marketing permission and no suppression. Tisha registration, attendance, payment, portal state, deliverability, and legacy tags never establish that permission.
- Check consent and suppression before any non-transactional communication.
- Stop when checkout starts, customer status becomes Active, an opt-out occurs, or suppression is applied.
- Do not ask the same lead questions already handled by OT-A1.
- Do not create human tasks or Human Handoff actions.
- Do not expose raw Zoom links, raw Vimeo links, tokens, payment-card data, internal IDs, usernames, or passwords.
- A GHL tag or field is not authorization for One Time portal access.

## Reviewed Email One — `rabbi_new_program_prelaunch_nurture_v1`

Use this exact subject, preheader, body, signature, and CTA only after the separate consented audience, publication, and delivery approvals are all present. This copy is not an authorization to send.

- Subject: A new way to grow with Mishnah
- Preheader: A personal invitation from Rabbi Eli to explore One Time Mishnayos.
- Body:

  > Shalom,
  >
  > I’m grateful to introduce a new One Time Mishnayos program for boys to build clarity, memory, consistency, and a love of Mishnah through live learning from Eretz Yisrael.
  >
  > If this sounds meaningful for your family, you are invited to see the current program and the controlled pilot: [One Time Home URL].
  >
  > This is an invitation to learn more; it does not change a family’s account, access, or payment status.
  >
  > With bracha,
  > Rabbi Eli Scheller
  > One Time Mishnayos

- CTA: Insert only the registered `One Time Home URL` custom value. Do not substitute a Tisha page, raw Zoom/provider link, price, or unverified application route.
- Compliance: Use the standard GHL unsubscribe treatment for the selected independently consented audience. Do not claim or infer permission from a historical record.

Test state:

- Do not select an audience or send in this lane.
- Do not use any contact until a separate exact authority names one protected operator-owned test contact.
- Record the workflow ID only after it exists in the verified location.
- Keep publish toggle off until explicit separate approval.
