# OT-02A Existing Subscriber Migration 2026 v1 Prompt

Build in HighLevel Draft state only. Do not publish, send messages, select an audience, enroll production contacts, mutate Stripe, or create Student contacts from this prompt.

Canonical registry: one-time-highlevel@1.1.0
Exact workflow: OT-02A Existing Subscriber Migration 2026 v1
Folder: 10 - Enrollment & Nurture
Exact trigger: registered existing subscriber migration audience entry
message_class: existing_subscriber_migration
sender_key: rabbi_campaign
transport: GHL
Purpose: Three-email existing-subscriber migration sequence. This reviewed email is email one only; do not invent email two or three copy from it.

Registry dependencies:

- `integrations/highlevel/registry/sender-registry.yaml`
- `integrations/highlevel/registry/message-class-registry.yaml`
- `integrations/highlevel/registry/communications-contract.json`
- `integrations/highlevel/registry/workflow-registry.yaml`

Exact sender state for this Draft:

- One Time Rabbi Campaign Sender Name
- One Time Default Reply-To
- The fixed post-acceptance visible From is `Rabbi Eli Scheller | One Time Mishnayos <rabbi@onetimeonetime.com>` using One Time Rabbi Campaign Phase 2 From.
- Reply-To remains `info@onetimeonetime.com`; rabbi@ may route into the same governed GHL Conversations workflow and does not require a separately monitored second inbox.
- Until GHL-UI-24 records provider acceptance, preserve the current One Time Rabbi Campaign Phase 1 From fallback and do not activate or send from the desired address.
- Do not type or guess sender display-name, From, reply-to, or provider text.
- If a registered sender value is absent from the picker, block this workflow instead of inventing it.

Required boundaries:

- Use only registered One Time fields, tags and custom values from `integrations/highlevel/registry/current.json`.
- Preserve unrelated existing tags on contacts.
- The audience is only an operator-selected adult existing-subscriber migration list. Historic payment, attendance, event registration, portal state, deliverability, and legacy tags never establish migration or marketing authority.
- Tisha event permission is event-purpose only and never permits this message.
- Check suppression and the approved migration authority before any non-transactional communication.
- Do not create human tasks or Human Handoff actions.
- Do not expose raw Zoom links, raw Vimeo links, tokens, payment-card data, internal IDs, usernames, or passwords.
- A GHL tag or field is not authorization for One Time portal access.

## Reviewed Email One — `rabbi_new_program_existing_subscriber_migration_v1`

Use this exact subject, preheader, body, signature, and CTA only after the separate audience, publication, and delivery approvals are all present. This copy is not an authorization to send.

- Subject: A new chapter for One Time Mishnayos
- Preheader: A personal note from Rabbi Eli about the One Time program.
- Body:

  > Shalom,
  >
  > I’m grateful to share that One Time Mishnayos is preparing a new program for boys to build clarity, memory, consistency, and a love of Mishnah through live learning from Eretz Yisrael.
  >
  > If you have learned with One Time before, I would be glad for you to see the current program and the controlled pilot: [One Time Home URL].
  >
  > This is an invitation to learn more; it does not change a family’s account, access, or payment status.
  >
  > With bracha,
  > Rabbi Eli Scheller
  > One Time Mishnayos

- CTA: Insert only the registered `One Time Home URL` custom value. Do not substitute a Tisha page, raw Zoom/provider link, price, or unverified application route.
- Compliance: Use the standard GHL unsubscribe treatment for the selected approved migration audience. Do not claim newsletter permission or infer it from customer history.

Test state:

- Do not select an audience or send in this lane.
- Do not use any contact until a separate exact authority names one protected operator-owned test contact.
- Record the workflow ID only after it exists in the verified location.
- Keep publish toggle off until explicit separate approval.
