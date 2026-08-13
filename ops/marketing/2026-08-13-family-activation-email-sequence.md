# One Time Mishnayos — Family Activation Email Sequence

**Date:** 2026-08-13  
**Status:** Proposed launch copy and state contract; no send or GHL mutation authorized  
**Audience:** Adult Family account owners only  
**Product integration:** PR #131 remains isolated

## Operating rules

- This is a state-driven activation sequence, not a blind calendar drip.
- Recheck account, Student, activation, paid, consent, and suppression state immediately before every message.
- Exit or skip a step when its objective is already complete.
- Never create a Student GHL contact.
- Required account/access messages and optional marketing messages retain their appropriate suppression rules.
- Use one main CTA per email.
- Keep copy direct and short.

## State definitions

```text
family_account_created
student_setup_pending
student_created_not_activated
activated_free_family
engaged_free_family
paid_continuation_pending
paid_active
```

Activation means at least one Student joined a live class or started an approved recording.

---

## EMAIL 1 — Immediate account confirmation

**Trigger:** durable Family account committed and Parent session/account available  
**Skip/exit:** never duplicate for the same signup transaction  
**Sender:** One Time Mishnayos / office access sender  
**Subject:** `Your One Time Family account is ready`  
**Preheader:** `Add your first Student and start learning.`

```text
Hi {{contact.first_name}},

Your One Time Family account is ready.

The next step is to add your son as a Student. He will have his own login for the live class, recordings, review, and questions.

CREATE YOUR FIRST STUDENT

Classes begin Sunday, August 16 at 7:00 PM Israel time. Access is free through September 11. No card is required.

One Time Mishnayos
```

CTA destination: authenticated Parent Student-creation route.

---

## EMAIL 2 — Student setup pending

**Trigger:** no Student exists after the approved wait  
**Recommended wait:** 2 hours when signup occurs during normal waking hours; otherwise next morning in household timezone  
**Exit:** any Student created  
**Sender:** One Time Mishnayos / office access sender  
**Subject:** `Add your son so he can start`  
**Preheader:** `His separate Student login takes only a minute to set up.`

```text
Hi {{contact.first_name}},

Your Family account is ready, but no Student has been added yet.

Add your son now so he can use the live class and recording library in his own protected Student space.

ADD YOUR FIRST STUDENT

You can manage up to three Students from the same Family account.

One Time Mishnayos
```

CTA destination: authenticated Parent Student-creation route.

---

## EMAIL 3 — Student created, class not yet used

**Trigger:** at least one Student exists and no activation event exists  
**Timing:** before the next available class or, when no class is immediately available, after the first recording is ready  
**Exit:** first live join or recording start  
**Sender:** Rabbi Eli Scheller  
**Subject:** `His first Mishnayos class is ready`  
**Preheader:** `Use his Student login to join live or start a recording.`

```text
Hi {{contact.first_name}},

Your son's Student login is ready.

He can now join Rabbi Scheller's live Mishnayos class or use the recording library for review and catching up.

OPEN THE STUDENT LOGIN

Live class runs Sunday through Thursday at 7:00 PM Israel time.

Rabbi Eli Scheller
One Time Mishnayos
```

CTA destination: canonical Student-login instructions page; never expose a raw provider link.

---

## EMAIL 4 — Brand vision after access is clear

**Trigger:** Family is activated, or the approved Day-2 fallback for a Family that has received clear access instructions  
**Sender:** Rabbi Eli Scheller  
**Subject:** `Mishnayos Made Memorable`  
**Preheader:** `A full perek, clear visual teaching, and a real rebbe.`

```text
Hi {{contact.first_name}},

One Time is not another folder of recordings.

Each class is a full perek taught live by Rabbi Scheller, with clear visual teaching, stories, and the ability to go back and review on demand.

The goal is simple: your son should understand the Mishnah, remember it, and look forward to coming back.

SEE THE NEXT CLASS

Rabbi Eli Scheller
One Time Mishnayos
```

CTA destination: Parent schedule/next-class view or Student-login instructions, selected from actual state.

---

## EMAIL 5 — Progress and belonging

**Trigger:** activated Family after the configured use threshold or approved Day-4/Day-5 fallback  
**Sender:** Rabbi Eli Scheller  
**Subject:** `One perek at a time`  
**Preheader:** `A real rhythm. Real progress. Something to build.`

```text
Hi {{contact.first_name}},

The strength of the program is the rhythm.

One perek each class day. Live when he can join. On demand when he needs to catch up or review.

Your family is taking part in building the biggest Mishnayos class in the world—and your son is building something real, one perek at a time.

VIEW HIS ONE TIME SCHEDULE

Rabbi Eli Scheller
One Time Mishnayos
```

CTA destination: authenticated Parent schedule/progress view.

---

## EMAIL 6 — Activation help

**Trigger:** account or Student exists but activation remains absent after the configured threshold  
**Recommended timing:** Day 4–7 depending on class availability  
**Sender:** One Time Mishnayos / office access sender  
**Subject:** `Make sure his One Time access is working`  
**Preheader:** `We can help with the Student login or class access.`

```text
Hi {{contact.first_name}},

Your account is open, but we do not yet see a Student joining class or starting a recording.

Use the button below for the exact next step. If anything is not working, reply to this email and tell us where you got stuck.

CONTINUE SETUP

One Time Mishnayos
```

CTA destination: server-resolved next incomplete activation step.

---

## EMAIL 7 — Free-access deadline

**Trigger:** free Family is not paid and the paid-continuation flow is production-ready  
**Sender:** Rabbi Eli Scheller or approved office billing sender according to the final communication contract  
**Subject:** `Free One Time access ends September 11`  
**Preheader:** `Continue the live class and recording library after the free period.`

```text
Hi {{contact.first_name}},

Your free One Time access ends Friday, September 11 at 6:00 PM Jerusalem time.

The standard Family plan is $67 per month and includes up to three Students. Continuing requires an explicit checkout action; your Family account will not be charged automatically.

CONTINUE ONE TIME

Rabbi Eli Scheller
One Time Mishnayos
```

CTA destination: approved GHL-hosted continuation/checkout page only after exact production verification.

## Workflow implementation recommendation

Use one controlled Family activation/onboarding workflow or one tightly governed workflow family. Branch on current state rather than creating unrelated generic drips.

Pipeline stages may trigger evaluation, but each message must rely on verified product state and an idempotent message key, not a stage label alone.