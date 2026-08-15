# One Time Mishnayos — Parent Companion, Pipeline, Email, and Rabbi Voice Amendment

**Date:** 2026-08-13  
**Status:** Current operator amendment; live GHL audit and PR #131 integration required  
**Supersedes:** conflicting portions of the earlier nine-stage pipeline and first-Student-only activation sequence

## 1. Core decision

The Family journey should not force a newly registered Parent to complete Student setup before experiencing the product.

The Parent is automatically signed in and receives an immediately useful **Parent Companion** experience. The Parent can see the protected learning experience, interact with Rabbi Eli as a Parent, manage up to three Student identities, and reinforce Family-visible Student progress.

The Family offer is:

> **One Parent Companion + up to three Students**

The Parent does not consume a Student seat.

## 2. Separate acquisition from product lifecycle

Do not mix warm leads, old-app cohorts, event contacts, Student setup, usage, payment, and cancellation in one pipeline.

Use two related adult-only pipelines.

### Pipeline A — `One Time | Audience & Reactivation`

One opportunity represents the adult prospect before a current Family account exists.

Recommended stages:

1. **Warm Lead**
2. **Old App — Active**
3. **Old App — Inactive**
4. **Prior Event / Prior Interest**
5. **Invitation Sent / Registration Opened**
6. **Registered — Handoff Complete** — mark Won
7. **Not Interested / Suppressed** — mark Lost with exact reason

Rules:

- Preserve the existing warm-lead and old-app segmentation.
- Do not silently erase or flatten historical cohorts.
- Source details such as Facebook, WhatsApp, YouTube, Tisha B'Av, Rabbi referral, and campaign/creative ID remain attribution fields/tags.
- When a real Family account is committed, close/win the audience opportunity and create or update the household lifecycle opportunity.
- One adult contact may own more than one household lifecycle opportunity when the product permits multiple households.

### Pipeline B — `One Time | Family Lifecycle`

One opportunity represents one Family household with a current One Time account.

Recommended stages:

1. **Family Account Created — Parent Not Activated**
2. **Parent Companion Activated — Student Setup Pending**
3. **Student Created — Not Yet Learning**
4. **Activated Free Family**
5. **Engaged Free Family**
6. **Paid Active** — mark Won
7. **Grace / Payment Issue**
8. **Canceled / Former**

`Paid Continuation Pending` is removed.

Checkout started, continuation offered, and free-access expiry are events/fields, not durable lifecycle stages:

```text
continuation_offer_sent_at
checkout_started_at
checkout_abandoned_at
free_access_ends_at
paid_at
```

Recommended definitions:

- **Parent Companion Activated:** Parent opened the protected Parent class/library experience or approved first recording.
- **Student Created — Not Yet Learning:** at least one Student exists, but no Student has joined live or started an approved recording.
- **Activated Free Family:** at least one Student has joined live or started an approved recording.
- **Engaged Free Family:** household meets the configured repeat-use threshold, initially recommended as at least two verified Student learning sessions on separate days. The threshold must be confirmed against actual usage and then locked.
- **Paid Active:** payment/access is verified from the authoritative Stripe/GHL reconciliation path.

## 3. Automated stage movement

One Time remains authoritative for account and product events. GHL projects those events into the adult household opportunity.

Use idempotent, household-scoped events:

```text
family.account_created
parent.companion_activated
student.created
student.first_learning_started
family.engaged
billing.checkout_started
billing.active
billing.grace
billing.canceled
```

Projected movement:

```text
family.account_created
→ Family Account Created — Parent Not Activated

parent.companion_activated
→ Parent Companion Activated — Student Setup Pending

student.created
→ Student Created — Not Yet Learning

student.first_learning_started
→ Activated Free Family

family.engaged
→ Engaged Free Family

billing.active
→ Paid Active / Won

billing.grace
→ Grace / Payment Issue

billing.canceled
→ Canceled / Former
```

Rules:

- Never move an opportunity based only on an email open, page click, or guessed activity.
- Anonymous page visits and ad clicks remain analytics/attribution events.
- Every update is idempotent and household-scoped.
- Stage movement never creates a Student contact.
- If product state and GHL stage disagree, product/billing truth wins and the discrepancy enters reconciliation.

## 4. Email architecture

Separate **audience/reactivation campaigns** from **Family product-lifecycle communication**.

All program, invitation, learning, vision, progress, and continuation emails should normally use:

> **Rabbi Eli Scheller <rabbielischeller@onetimeonetime.com>**

with Reply-To:

> `rabbielischeller@onetimeonetime.com`

Use the office/operational sender only for message classes such as password reset, Student PIN reset, security, provider receipt, technical incident, payment failure, and other essential account operations.

The Rabbi sender has already passed DNS authentication, inbox delivery, and reply-routing proof. Do not recreate it; verify and reuse the existing configuration.

## 5. Audience and reactivation sequence

### A1 — Warm Lead

**Purpose:** introduce the actual free-access offer.  
**Sender:** Rabbi Eli  
**Subject direction:** `I want your son to experience One Time`  
**CTA:** `GET FREE ACCESS`

Message focus:

- real live daily Mishnayos;
- one complete perek each class day;
- visual teaching and stories;
- free access through the fixed launch cutoff;
- no card required.

### A2 — Old App Active

**Purpose:** invite people who already know Rabbi Eli into the new product.  
**Subject direction:** `One Time is back—on a completely different level`

Message focus:

- this is not merely the old recording app;
- live Sunday–Thursday;
- Parent Companion plus separate Student logins;
- visual Mishnayos, Rabbi interaction, progress, and review;
- one direct activation CTA.

### A3 — Old App Inactive

**Purpose:** reintroduce the product without pretending they are current members.  
**Subject direction:** `Come see what One Time has become`

Message focus:

- clear new experience;
- free access;
- immediate Parent access;
- one simple invitation, not a guilt message.

### A4 — Prior Event / Prior Interest

Enroll only when current marketing permission and suppression state permit. Do not infer broad newsletter permission from event attendance alone.

## 6. Family lifecycle sequence

This is state-driven. Recheck actual product, consent, suppression, payment, and activation state immediately before every message.

### F1 — Family account created; Parent not activated

**Sender:** Rabbi Eli  
**Subject:** `Your One Time access is ready`  
**Preheader:** `See how the class works, then add your first Student.`  
**CTA:** `OPEN ONE TIME`

Core copy:

```text
Hi {{contact.first_name}},

Your One Time Family account is ready—and you can already go inside and see how the learning works.

Start by opening One Time. You’ll see the next class, the learning experience, and the place where you can add your son’s separate Student login.

[OPEN ONE TIME]

Your Family membership includes your Parent Companion account plus up to three Students.

Rabbi Eli Scheller
One Time Mishnayos
Mishnayos Made Memorable
```

Do not tell the Parent to log in again when the browser session is already established.

### F2 — Parent activated; no Student

**Sender:** Rabbi Eli  
**Subject:** `Now set up your son’s One Time login`  
**CTA:** `ADD YOUR FIRST STUDENT`

Core message:

- Parent has seen One Time;
- Student gets his own username/PIN;
- Parent manages resets and technical help;
- setup should take one clear step.

### F3 — Student created; no Student learning activity

**Sender:** Rabbi Eli  
**Subject:** `His login is ready—start with one class`  
**CTA:** `OPEN THE STUDENT LOGIN`

Core message:

- join the next live class or watch the first approved recording;
- do not make perfection the threshold;
- one class is enough to begin.

### F4 — Activated Free Family; not yet engaged

**Sender:** Rabbi Eli  
**Subject direction:** `The next class is where the habit begins`

Message focus:

- celebrate the first use;
- encourage the next separate-day session;
- explain that consistency, not pressure, creates the kinyan;
- offer direct Parent/Rabbi communication and technical help;
- mention only reward/badge features that are actually live.

### F5 — Engaged Free Family

**Sender:** Rabbi Eli  
**Subject direction:** `He is building something real`  
**CTA:** `SEE HIS PROGRESS`

Use actual verified progress where available:

- classes completed;
- separate learning days;
- perek count;
- attendance streak;
- approved badge/accomplishment;
- next class.

Core idea:

> This is no longer an account someone opened. Your son is making a real kinyan, one perek at a time.

### F6 — Parent/Student activation help

**Sender:** office for technical incidents or Rabbi Eli for relational encouragement, selected by the actual issue class.  
**Subject:** `Let’s get his One Time access working`

The CTA must resolve to the next incomplete step, not always to the same generic login page.

### F7 — Free-access deadline and continuation

**Sender:** Rabbi Eli for the program invitation; office/billing sender for payment failures or receipts.  
**CTA:** approved GHL-hosted continuation page.

Do not activate this branch until the exact checkout and billing reconciliation path is production-ready.

### F8 — Paid Active retention

Do not stop communicating after conversion.

Recommended recurring Parent communication:

- concise weekly progress;
- what was learned;
- current hespek;
- Student accomplishments;
- one Parent review prompt;
- next class;
- direct reply path to Rabbi Eli.

### F9 — Grace / Payment Issue

Essential operational message only. State the problem, access/grace truth, exact repair path, and deadline. Do not mix it with promotional copy.

### F10 — Canceled / Former

Reactivation only when marketing permission and suppression state allow. Preserve the prior relationship; do not send generic cold-lead copy.

## 7. In-app reinforcement

Email is not the only retention system.

Use product events to show truthful, immediate reinforcement:

- `You completed today’s class.`
- `Three learning days in a row.`
- `Another perek completed.`
- `Rabbi Eli approved your question.`
- `A new Family-visible accomplishment was published.`

Parent alerts may say:

- `Your son completed today’s class.`
- `Rabbi Eli published one of his questions for your Family.`
- `He earned a new approved badge.`

Never fabricate progress from an email click or page view.

## 8. Rabbi Eli voice and message system

### Sources reviewed

The tone direction is grounded in existing Drive material, including:

- `#7 - All-Day Mishnayas Learning and Micro Schools` — Drive ID `1dImTpmvCX4MpWILfi4dox3YpEC_6agNkEr03Cmj_3Dc`;
- newsletter/style correction records in `2026-06-19.md` — Drive ID `1hRWgxnxHYxESq6am-RPIaM-TcxPoC5B3`;
- the existing `OT-14 Parent Newsletter` workflow contract.

### Core themes

1. **A real kinyan, not exposure.**
2. **Clarity before speed.**
3. **Real hespek:** one complete perek each class day.
4. **One Rebbe and a steady relationship.**
5. **Total preparation and seriousness.**
6. **Visual teaching that makes the Mishnah stick.**
7. **Consistency becomes accomplishment.**
8. **A movement of boys learning the same Mishnayos rhythm around the world.**
9. **Family visibility and reinforcement without invading the child's private space.**

### Voice rules

Use:

- direct, confident sentences;
- concrete descriptions;
- Torah language naturally and accurately;
- Hebrew terms in Hebrew letters when appropriate;
- Rabbi Eli's seriousness, stories, and conviction;
- actual progress, actual questions, and actual examples.

Avoid:

- generic AI language;
- `revolutionary`, `game-changing`, or `unlock his potential`;
- sentimental fluff;
- manufactured Parent-interview questions;
- unsupported claims;
- calling every item a `journey`;
- vague education jargon;
- casual filler that weakens Rabbi Eli's authority.

### Approved message lines

- `The goal is not to cover Mishnayos. The goal is to make a kinyan.`
- `One perek. Clear. Memorable. Done.`
- `A boy should come out of class knowing what he learned.`
- `A real Rebbe. A steady schedule. Real progress.`
- `Mishnayos should not disappear when class ends.`
- `When the learning is clear, the boy wants to come back.`
- `Mishnayos Made Memorable.`
- `Take part in building the biggest Mishnayos class in the world.`

## 9. GHL implementation boundaries

Before changing live GHL:

1. Audit every live pipeline and stage ID.
2. Count opportunities in each stage.
3. Map all workflow/form/API dependencies.
4. Preserve the existing Rabbi sender and Reply-To.
5. Return a migration/rollback plan.
6. Configure new workflows in Draft only.
7. Perform save → reopen → exact readback.
8. Use one operator-owned seed only after explicit approval.
9. Send no broad email and publish no workflow during preparation.

The connected HighLevel search tool did not return pipeline definitions in the current session; it incorrectly returned contacts. Therefore, no claim is made here that the live pipeline audit is complete.

## 10. Contacts UI defect handoff

The operator reports that active text in the One Time Contacts section appears too dark/faded.

Codex must perform a bounded visual/contrast audit of the real Contacts list and detail surfaces at:

- 390px mobile;
- 768px tablet;
- 1440px desktop;
- the production dark theme and any supported light theme.

Acceptance:

- active normal text meets at least 4.5:1 contrast;
- large text meets at least 3:1;
- active content is not styled with disabled opacity;
- muted text remains readable and is used only for secondary information;
- selected, hover, focus, error, empty, archived, and disabled states remain distinct;
- use semantic brand tokens rather than page-specific arbitrary colors;
- provide before/after screenshots and focused accessibility/browser proof.

Do not guess the root cause from the report alone. Inspect the mounted page and computed styles first.

## 11. Current Rabbi email status

The existing evidence records:

- visible From: `Rabbi Eli Scheller <rabbielischeller@onetimeonetime.com>`;
- global Reply-To: `rabbielischeller@onetimeonetime.com`;
- SPF, DKIM, CNAME, MX, and DMARC verified;
- operator inbox delivery passed;
- reply round-trip into the correct GHL conversation passed;
- OT-01 Family Account Confirmation exists in Draft;
- no broad enrollment is active.

Remaining work is the final lifecycle routing and approved workflow configuration—not DNS creation from scratch.

## 12. Immediate implementation order

1. PR #131 records and scopes the Parent Companion product change.
2. Product worker audits Parent/Student entitlement and privacy conflicts.
3. GHL worker returns the live two-pipeline migration map.
4. Shloimie reviews the audience and lifecycle email copy.
5. GHL worker configures Draft workflows and exact state gates.
6. Product worker emits the idempotent lifecycle events.
7. One operator-owned Family canary proves account → Parent Companion → Student → activation → correct GHL stage/email behavior.
8. Publish only after exact readback and operator approval.
