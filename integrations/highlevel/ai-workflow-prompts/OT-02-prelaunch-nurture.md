# OT-02 Prelaunch Nurture AI Builder Prompt

Copy the text below into HighLevel AI Builder. Build in Draft state only.

```text
Create a HighLevel workflow named "OT-02 Prelaunch Nurture".
Place it in folder "10 - Nurture & Sales".

Trigger: Tag OT | Prelaunch is added or OT-01 hands off after consent checks.
Trigger filters: Contact is not suppressed. Contact has explicit email opt-in or explicit WhatsApp opt-in. Contact is not active, canceled, refunded, or chargeback.
Re-entry: Allow re-entry once per import batch or new signup source.
Stop on response: Stop sequence on any reply and create human task.
Timezone/business window: Asia/Jerusalem; Sunday-Thursday 9:00-20:30.
Tags to use: OT | Prelaunch, OT | Email Opt-In, OT | WhatsApp Opt-In
Custom fields to use: One Time Import Batch, One Time Source Classification, One Time Email Consent, One Time WhatsApp Consent, One Time Suppression State

Build these If/Else branches:
- Email branch only when OT | Email Opt-In is present.
- WhatsApp branch only when OT | WhatsApp Opt-In is present.
- Consent unknown branch creates task and stops without sending.

Add these waits:
- Wait 1 day after intake.
- Wait 3 days between nurture touches.

Messages/templates by exact safe name:
- OT Prelaunch Seed Email - use approved seed copy below only for seed/testing until broad-send approval.
- Subject: Join One Time Mishnayos with Rabbi Eli Scheller
- Preheader: Live daily Mishnayos at 7:00 p.m. Israel time - free until Rosh Hashanah.
-
- Hello,
-
- One Time Mishnayos with Rabbi Eli Scheller is open for signup.
-
- Give your son a love for learning Torah with a live daily Mishnayos class at 7:00 p.m. Israel time, live from Eretz Yisrael.
-
- Join now - free until Rosh Hashanah.
-
- Sign up: https://join.onetimeonetime.com/signup
-
- - One Time Mishnayos
- OT Prelaunch WhatsApp Draft - DRAFT ONLY, no promise, price, or deadline beyond approved copy.

Workflow-to-workflow handoffs: Stop when checkout starts and hand off to OT-03.
Opportunity stage changes: Keep opportunity in Lead unless checkout begins.
Tasks/internal notifications: Create task for high-intent replies or consent ambiguity.
Custom webhook actions to One Time: None.
Stop conditions: Suppression, reply, payment active, checkout started, cancellation, refund, chargeback.

Consent and suppression gates:
- Check OT | Marketing Suppressed before any outbound message.
- Check One Time Email Consent and OT | Email Opt-In before email.
- Check One Time WhatsApp Consent and OT | WhatsApp Opt-In before WhatsApp.
- Unknown consent may create an internal task, but must not send a campaign message.
- STOP, unsubscribe, complaint, hard bounce, and manual suppression win over every other branch.

Safety boundaries:
- Never create or message Student contacts.
- Never include Student names, ages, passwords, private notes, progress, attendance, Vimeo credentials, Zoom links, reset links, or raw internal IDs.
- Never unlock One Time portal access from a HighLevel tag alone.
- Never send a campaign, publish the workflow, or enroll production contacts from this prompt.

Test procedure:
- Run one email-opt-in test contact.
- Run one consent-unknown test contact and confirm no outbound message.

Publish checklist:
- Leave workflow in Draft.
- Review every trigger, filter, branch, wait, message, task, webhook, and stop condition.
- Test with the protected operator-owned test contact only.
- Record the workflow ID in integrations/highlevel/WORKFLOW-ID-CAPTURE.md and workflows.yaml after it exists.
- Publish only after separate operator approval.
```
