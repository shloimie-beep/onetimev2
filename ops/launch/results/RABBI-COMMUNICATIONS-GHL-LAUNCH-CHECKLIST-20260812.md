# Rabbi communications — launch operator checklist

**Purpose.** Rabbi Eli owns routine adult email conversations for One Time. One Time remains the source of truth for Parent, Student, household, class, and learning data. HighLevel (GHL) is the adult CRM and email-conversation system of record. Do not create or import Student contacts in GHL.

This checklist is deliberately small. It does not create a new workflow library, Telegram reply path, or child-facing email surface.

## Do now in GHL (independent of the app release)

1. Open **Settings → My Staff**. Invite or open Rabbi Eli's user and give him **Admin** access for the One Time location. Confirm he can open **Conversations**, **Contacts**, **Opportunities**, **Automation → Workflows**, and **Settings → Email Services**. He does not need agency-level access.
2. Open **Settings → Email Services** (or the location's connected email/mailbox area). Connect or select the One Time mailbox used for adult support. The sender/reply address must be `info@onetimeonetime.com`; the public Rabbi identity is `Rabbi Eli Scheller <rabbielischeller@onetimeonetime.com>`. Turn on inbound email routing into **Conversations**. Do not forward mail to a personal inbox as the source of truth.
3. Open **Opportunities → Pipelines**. Use **One Time Enrollment and Conversion** as the only Family launch pipeline. Keep these launch placements:
   - Before signup: **Warm Leads**.
   - Form signup: **New Funnel / Pre-Registered**.
   - Active free Family: **Active Member**.
   - **One Time Business** is later billing; do not use it for launch signup routing.
4. Open **Automation → Workflows → OT-01 Family Account Confirmation**. This is the only launch workflow to publish. Before publishing, check its trigger is the real Family signup event, re-entry cannot duplicate confirmations, and every action is adult-only. Its From/Reply-To must resolve to the One Time sender/reply identity above. Keep consent and suppression honored. It must never receive, create, or target a Student contact.
5. Leave **OT-09 Parent Class Reminder** in Draft for this launch unless a separately approved reminder is required. Leave **OT-F01P Ongoing Updates Opt-In Processor** as compliance-only; it is not the launch confirmation flow. Do not publish the other draft workflows just because they exist.
6. In **Contacts**, search the `Student` tag/type. Expected result: **zero contacts**. If any appear, stop and remove them only through the approved adult-data cleanup path; do not convert Student records into GHL contacts.

## Minimal proof to capture

Take one screenshot for each numbered item below. Mask adult email addresses other than the One Time mailbox if practical; do not include child data, passwords, tokens, or full message bodies.

1. Rabbi Eli's GHL user page showing the One Time location and Admin access.
2. The configured `info@onetimeonetime.com` sender/reply mailbox and inbound routing enabled.
3. The **One Time Enrollment and Conversion** pipeline with the three named stages visible.
4. OT-01's trigger plus its first email action showing the correct sender/reply identity, and the workflow's **Published** status.
5. One adult-only test email received in Conversations and Rabbi's reply saved/sent from that same thread. Use an operator-owned adult test address only.
6. The zero-result `Student` contact search.

## What waits for the app release

- The One Time **Communications** page will become Rabbi/Admin-only and show an honest adult inbox state rather than the current task/workflow catalog. It will not invent a mailbox or show child data.
- Once the app release is deployed and the GHL inbox proof above exists, Rabbi opens One Time **Communications** to review the adult conversation context and household link. Replies remain in GHL unless the app's governed outbound path is explicitly enabled and proven.

## What is intentionally not in this launch

- No Student GHL contacts, Student email, Student inbox, or Student reply action.
- No Telegram reply authority. Telegram may notify the team, but GHL Conversations remains the adult-message source of truth.
- No Buffer/Social work, broad workflow cleanup, extra automations, or mass email sends.
