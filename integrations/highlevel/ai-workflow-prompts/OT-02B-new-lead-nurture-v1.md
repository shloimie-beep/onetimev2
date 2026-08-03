# OT-02B New Lead Nurture v1 Prompt

Build in HighLevel Draft state only. Do not publish, send messages, select an audience, enroll production contacts, mutate Stripe, or create Student contacts from this prompt.

Canonical registry: one-time-highlevel@1.1.0
Exact workflow: OT-02B New Lead Nurture v1
Folder: 10 - Enrollment & Nurture
Exact trigger: registered new lead nurture audience entry
message_class: prelaunch_nurture
sender_key: rabbi_campaign
transport: GHL
Purpose: Three-email outcomes, live/on-demand, and free-access sequence for independently consented adult leads.

Exact sender state for this Draft:

- Select One Time Rabbi Campaign Sender Name and verify `Rabbi Eli Scheller`.
- Select One Time Rabbi Campaign Phase 2 From and verify `rabbielischeller@onetimeonetime.com`.
- Select One Time Rabbi Reply-To and verify `rabbielischeller@onetimeonetime.com`.
- Never use the historical `rabbi@onetimeonetime.com` alias or a fallback identity.
- Until GHL-UI-24 records provider acceptance, keep the workflow Draft and blocked.
- Do not type or guess sender display-name, From, Reply-To, or provider text.

Required boundaries:

- The audience is only adults with independently proven general-marketing permission and no suppression. Event registration, attendance, payment, portal state, deliverability, and legacy tags never establish permission.
- Recheck consent and every suppression state before each email.
- Exit on signup, School inquiry, checkout start, Active status, opt-out, unsubscribe, DND, complaint, hard bounce, suppression, or sequence completion.
- Use only registered One Time custom values. Do not create Student contacts or expose provider links, tokens, card data, internal IDs, usernames, or passwords.

## Reviewed Email One - `ghl.prelaunch_nurture.step_1.v1`

- Subject: Build clarity, memory, and consistency in Mishnah
- Preheader: A steady learning experience designed to help Mishnah last.
- Body:

  > Shalom {{contact.first_name}},
  >
  > I'm grateful to introduce One Time Mishnayos, a program designed to help boys build clarity, memory, consistency, and a love of Mishnah through learning from Eretz Yisrael.
  >
  > The goal is steady progress: understand each Mishnah, review it, and keep building from one class to the next.
  >
  > If that sounds meaningful for your family, I invite you to see how One Time works.
  >
  > With bracha,
  > Rabbi Eli Scheller
  > One Time Mishnayos

- CTA: `See How One Time Works` using only the registered `One Time Home URL` custom value.

## Reviewed Email Two - `ghl.prelaunch_nurture.step_2.v1`

- Subject: Live learning when it is time to learn - recordings when it is time to review
- Preheader: One secure Family account for live class and on-demand review.
- Body:

  > Shalom {{contact.first_name}},
  >
  > One Time brings live Mishnah learning and an on-demand recording library together in one secure family experience.
  >
  > A Student can join class live, return to a recording for review, and keep a steady routine. The parent manages the Family account while each Student uses separate access.
  >
  > The new zman begins in Elul, and I would be glad for your family to learn with us.
  >
  > With bracha,
  > Rabbi Eli Scheller
  > One Time Mishnayos

- CTA: `Explore Live and On-Demand Learning` using only the registered `One Time Home URL` custom value.

## Reviewed Email Three - `ghl.prelaunch_nurture.step_3.v1`

- Subject: Begin One Time with free access now
- Preheader: Start without a card and add up to three Student seats.
- Body:

  > Shalom {{contact.first_name}},
  >
  > Your family can begin One Time Mishnayos with immediate free access as we prepare for the new zman in Elul.
  >
  > Create a durable Family account, then add up to three Student seats for live learning and the on-demand recording library. No card is required, and there is no automatic charge.
  >
  > I would be happy to welcome your family to One Time.
  >
  > With bracha,
  > Rabbi Eli Scheller
  > One Time Mishnayos

- CTA: `Start with Free Access` using only the registered `One Time Signup URL` custom value.

Use the standard GHL unsubscribe treatment on all three emails. This copy is not authorization to send.

Test state:

- Keep the workflow Draft, unpublished, inactive, and unenrolled.
- Keep cadence values unset until separate approval supplies them.
- Do not select an audience or send.
- Use no contact until separate authority names one protected operator-owned test contact.
- Keep the publish toggle off until explicit separate approval.
