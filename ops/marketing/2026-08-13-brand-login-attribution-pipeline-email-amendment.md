# One Time Mishnayos — Brand, Login, Attribution, Pipeline, and Email Amendment

**Decision date:** 2026-08-13  
**Status:** **LOCKED OPERATOR AMENDMENT — SUPERSEDES CONFLICTING MARKETING GUIDANCE**  
**Applies to:** Launch marketing, Family signup handoff, GHL lifecycle design, Drive/media organization

## 1. Positioning and brand hierarchy

One Time Mishnayos is not positioned as a commodity video library or a conventional weekly Zoom class. The product is a premium daily live/visual Mishnayos experience built around Rabbi Eli Scheller, one complete perek each class day, a large teaching display, visual material, a Rabbi camera bubble, stories, clear explanation, and on-demand review.

Use this hierarchy:

- **Product name:** `One Time Mishnayos`
- **Brand promise / tagline:** `Mishnayos Made Memorable`
- **Primary landing-page hero:** `Help your son love learning Mishnayos.`
- **Hero support:** `Live with Rabbi Eli Scheller from Eretz Yisrael. One full perek each class day. Online + on demand.`
- **Primary CTA:** `GET FREE ACCESS`
- **Form action:** `CREATE YOUR FREE FAMILY ACCOUNT`

`Mishnayos Made Memorable` is a strong reusable brand line, but it does not replace clear conversion copy at the top of the landing page. Use it in the logo/brand lockup, social covers, video intro/outro, graphic package, email header/signature, and selected campaign creative. Keep the hero benefit explicit.

Do not lead public copy with `AI`. Visual/AI-assisted footage and production quality are proof of a better learning experience, not the customer’s primary reason to buy.

## 2. Research and customer-question posture

Remove the proposed survey and scripted/corny parent-interview program from launch execution.

Do not add a post-signup survey. Do not ask generic questions such as “What problem are you trying to solve?” in the launch funnel.

Learn this market from actual behavior and natural conversations:

- traffic source;
- landing clicks;
- Family registrations;
- Student creation;
- first class/replay use;
- repeat use;
- paid continuation;
- retention;
- real replies and support conversations.

Shloimie may collect useful observations from normal conversations, but no formal survey or research burden is part of launch.

## 3. Parent account and automatic login

A Family signup is an actual account creation, not a lead form or pre-registration.

Required flow:

```text
Landing page
→ Create Family account with adult email/password
→ One required Terms checkbox
→ Local account commit
→ Parent browser session established immediately
→ Parent is already logged in
→ Redirect directly to first-Student setup when the household has zero Students
→ Create Student username/password
→ Show next class and/or first available lesson
```

Rules:

- Do not require the Parent to log in again after successful signup.
- Do not require email verification before the Parent may continue.
- Confirmation email is a backup/receipt and return path, not an activation gate.
- If session establishment fails after the account commits, fail safely and show a sign-in path without creating another account.
- Returning Parents use the existing Member Login path.
- Each Student has a separate username/password; Students do not receive email addresses.
- The primary success-page/dashboard action is `ADD YOUR FIRST STUDENT`, not a generic thank-you state.

The current PR #131 signup router already contains session establishment and a signed-in continuation. Product implementation should preserve that behavior and improve the zero-Student continuation so the Parent lands directly in Student setup rather than stopping at a passive overview.

## 4. Traffic attribution — no anonymous-click pipeline stage

An anonymous landing-page click is not a GHL opportunity stage because there is no identified adult yet.

Track anonymous traffic in analytics/Meta and carry the attribution into signup. Create/update the GHL adult contact and household opportunity only after the Family account is created.

### Standard link fields

Use standard UTM fields plus the stable One Time creative ID:

```text
utm_source
utm_medium
utm_campaign
utm_content
```

`utm_content` carries the stable creative ID, for example `OTM-CR-202608-001-V01`.

Canonical campaign:

```text
ot_launch_2026_aug_sep
```

Canonical examples:

```text
Facebook paid:
utm_source=facebook
utm_medium=paid_social
utm_campaign=ot_launch_2026_aug_sep
utm_content=OTM-CR-202608-001-V01

Facebook organic:
utm_source=facebook
utm_medium=organic_social
utm_campaign=ot_launch_2026_aug_sep
utm_content=OTM-CR-202608-001-V01

Instagram organic:
utm_source=instagram
utm_medium=organic_social
utm_campaign=ot_launch_2026_aug_sep
utm_content=OTM-CR-202608-001-V01

WhatsApp Status:
utm_source=whatsapp
utm_medium=status
utm_campaign=ot_launch_2026_aug_sep
utm_content=OTM-CR-202608-001-V01

WhatsApp direct forward:
utm_source=whatsapp
utm_medium=forward
utm_campaign=ot_launch_2026_aug_sep
utm_content=OTM-CR-202608-001-V01

WhatsApp broadcast:
utm_source=whatsapp
utm_medium=broadcast
utm_campaign=ot_launch_2026_aug_sep
utm_content=OTM-CR-202608-001-V01

YouTube Short:
utm_source=youtube
utm_medium=organic_short
utm_campaign=ot_launch_2026_aug_sep
utm_content=OTM-CR-202608-001-V01

Lifecycle email:
utm_source=email
utm_medium=lifecycle
utm_campaign=ot_launch_2026_aug_sep
utm_content=OTM-EMAIL-<ID>
```

### Persistence rule

Because the landing page and signup form are separate routes, the application must capture first-touch and latest-touch attribution on entry, preserve it across navigation, and bind it to the committed Family signup. Do not rely on the UTM query string still being present after the visitor moves from `/` to `/signup`.

Required adult/household attribution projection:

- first source, medium, campaign, content;
- latest source, medium, campaign, content;
- first entry URL;
- latest entry URL;
- referrer when safely available;
- stable creative ID;
- signup timestamp;
- household opportunity source.

No Student record is sent to GHL.

## 5. Current GHL readback and pipeline decision

The live read-only GHL connector exposed a One Time opportunity pipeline that currently contains mixed historical/event lifecycle records, including Tisha B’Av event opportunities and Old App Inactive opportunities. Support opportunities are in a separate pipeline. The connector did not expose the complete pipeline-definition/stage-name resource, so exact current stage labels remain unverified.

Do not silently repurpose mixed event/legacy stages for the new Family launch.

Use one dedicated canonical pipeline:

> **One Time | Family Lifecycle**

One opportunity represents one Family household. Do not create an opportunity for every click, email, Student, or class attendance event.

### Canonical stages

1. `01 Account Created — Student Setup Pending`
2. `02 Student Created — Not Yet Learning`
3. `03 Activated — First Class or Replay`
4. `04 Engaged Free Access`
5. `05 Continuation Offered`
6. `06 Paid Active`
7. `07 Free Expired — Not Paid`
8. `08 Reactivation`

Use GHL opportunity status:

- stages 01–05 and 07–08: `Open`;
- stage 06: `Won`;
- explicit opt-out/not-a-fit: `Lost` with an exact lost reason, not a vague stage.

### Stage transition definitions

- **01:** Family account committed; no Student exists.
- **02:** At least one Student exists; no verified live/replay use.
- **03:** A Student completes the defined activation event: first live class join or first replay start above the minimum activity threshold.
- **04:** Household reaches the launch engagement threshold, initially proposed as two verified learning sessions on separate days.
- **05:** Approved paid-continuation offer has been shown/sent.
- **06:** Verified paid access wins in One Time/Stripe/GHL reconciliation.
- **07:** Fixed free access expired and no verified paid source exists.
- **08:** A previously expired/lost household re-enters active reactivation follow-up.

Do not use `Clicked Landing Page` as a pipeline stage. Clicks belong in attribution and analytics.

## 6. Workflow architecture

Keep workflows behavior-based and stage-aware. Do not run one generic drip regardless of user state.

- `OT-01 Family Account Confirmation` — immediate after account creation.
- `OT-02 Student Setup Rescue` — only stage 01.
- `OT-03 First Learning Activation` — only stage 02.
- `OT-04 Activated Family Welcome` — on transition to stage 03.
- `OT-05 Engaged Free Access / Vision` — stage 03–04.
- `OT-06 Paid Continuation` — stage 04–05, excluding paid.
- `OT-07 Free Expired Reactivation` — stage 07 only.

Every customer email must stop or skip when the household has already completed the requested action. Replies should stop automated follow-up where configured and route to human review.

## 7. Exact launch email sequence

All emails are from Rabbi Eli Scheller. Keep them direct, short, and action-focused.

### EMAIL 1 — Immediate account confirmation

**Workflow:** OT-01  
**Trigger:** Family account committed  
**Subject:** `Your One Time Family account is ready`  
**Preheader:** `Add your first Student and get ready for class.`

```text
Hi {{contact.first_name}},

Your One Time Family account is ready.

The next step is to add your son as a Student. He’ll get his own username and password for the live class and recording library.

[ADD YOUR FIRST STUDENT]

Classes begin Sunday, August 16, at 7:00 p.m. Israel time. Access is free through September 11. No card is required.

Looking forward to learning together,

Rabbi Eli Scheller
One Time Mishnayos
Mishnayos Made Memorable
```

### EMAIL 2 — Student setup rescue

**Workflow:** OT-02  
**Trigger:** stage 01 after 4 hours; skip if Student exists  
**Subject:** `One quick step before he can join`  
**Preheader:** `Create his Student login inside your Family account.`

```text
Hi {{contact.first_name}},

Your Family account is open, but your son still needs his own Student login before he can join the class or use the library.

It takes one quick step inside your Parent account.

[ADD YOUR STUDENT]

Once that is done, he’ll have his own protected place for the live class, recordings, review, and updates.

Rabbi Eli Scheller
```

### EMAIL 3 — Student login ready

**Workflow:** OT-03  
**Trigger:** first Student created  
**Subject:** `His One Time login is ready`  
**Preheader:** `Use his Student username and password to begin.`

```text
Hi {{contact.first_name}},

Your son’s One Time Student account is ready.

He should sign in with his own Student username and password. That is where he will join the live class and watch recordings.

[OPEN ONE TIME]

One Family account manages the household. Each Student learns through his own separate login.

Rabbi Eli Scheller
```

### EMAIL 4 — No learning activity yet

**Workflow:** OT-03  
**Trigger:** stage 02 after 24 hours; skip if activated  
**Subject:** `Start with one class`  
**Preheader:** `His account is ready. Now let him experience One Time.`

```text
Hi {{contact.first_name}},

His Student account is ready. The next step is simply to use it.

Open One Time, sign him in, and start with the next live class or an available recording.

[START LEARNING]

The program makes sense once he sees it: a full perek, clear visual teaching, stories, energy, and review—all built into one steady rhythm.

Rabbi Eli Scheller
```

### EMAIL 5 — Activation confirmation

**Workflow:** OT-04  
**Trigger:** first verified live/replay use  
**Subject:** `He’s started`  
**Preheader:** `One perek at a time. That is how the progress builds.`

```text
Hi {{contact.first_name}},

Your son has started learning in One Time.

The strength of the program is the rhythm: one full perek each class day, explained clearly, made visual, and available afterward for review.

Keep him coming back. The consistency is where the accomplishment begins.

Rabbi Eli Scheller
```

### EMAIL 6 — Brand and vision

**Workflow:** OT-05  
**Trigger:** activated household, approximately day 2–3  
**Subject:** `Mishnayos Made Memorable`  
**Preheader:** `Why I built One Time this way.`

```text
Hi {{contact.first_name}},

I built One Time around a simple standard: Mishnayos should be clear, visual, alive, and memorable.

We learn one full perek each class day. I teach it live from Eretz Yisrael using the large teaching screen, stories, visual material, and direct interaction. The recordings and review tools are there so the learning does not disappear when class ends.

This is not another folder of videos. It is a real learning rhythm with a real rebbe and a serious path through Mishnayos.

Rabbi Eli Scheller
One Time Mishnayos
Mishnayos Made Memorable
```

### EMAIL 7 — Paid continuation notice

**Workflow:** OT-06  
**Trigger:** engaged free household, seven days before free expiry; exclude paid  
**Subject:** `Keep his One Time access after September 11`  
**Preheader:** `$67 per month for the Family account, with up to three Students.`

```text
Hi {{contact.first_name}},

Free access to One Time ends Friday, September 11, at 6:00 p.m. Jerusalem time.

To keep the live class, recording library, review tools, and Family access active after that point, continue with the standard One Time plan:

$67 per month for the Family account, normally including up to three Students.

[KEEP MY FAMILY’S ACCESS]

There is no charge before the free period ends unless the checkout page clearly says otherwise and you approve it.

Rabbi Eli Scheller
```

### EMAIL 8 — 48-hour deadline

**Workflow:** OT-06  
**Trigger:** 48 hours before expiry; exclude paid  
**Subject:** `Free access ends Friday`  
**Preheader:** `Continue One Time before access closes.`

```text
Hi {{contact.first_name}},

Your Family’s free One Time access ends Friday, September 11, at 6:00 p.m. Jerusalem time.

Continue now to keep the live class and library active without interruption.

[KEEP ONE TIME ACTIVE]

Rabbi Eli Scheller
```

### EMAIL 9 — Final-day deadline

**Workflow:** OT-06  
**Trigger:** final day; exclude paid  
**Subject:** `Free access ends today`  
**Preheader:** `The cutoff is 6:00 p.m. Jerusalem time.`

```text
Hi {{contact.first_name}},

Free access ends today at 6:00 p.m. Jerusalem time.

Continue the Family plan now to keep your Students’ One Time access active.

[CONTINUE ONE TIME]

Rabbi Eli Scheller
```

## 8. Local computer and Drive consolidation

The mechanical media lane must use both:

- the new Drive source folder `Mishnayos New`;
- existing approved source/class/promo folders already identified in Drive;
- One Time media candidates currently sitting on the operator computer, especially under `C:\Users\User\Downloads` and known One Time/Codex output folders.

Rules:

1. Do not scan or upload unrelated personal files.
2. Filter by relevant media extensions and One Time/Rabbi/Mishnayos/class/promo naming or operator-approved preview.
3. Hash/dedupe against Drive before copying.
4. Never move, rename, edit, or delete a local original during consolidation.
5. Copy approved missing originals into a new Drive intake folder with a manifest of original local path, hash, upload result, and new Drive ID.
6. Keep the Rabbi-facing folders human-readable; technical lineage remains in the repo registry.
7. Put all approved still images in one obvious Drive folder.
8. Put all approved clips in one obvious Drive folder organized by human categories.
9. Keep blocked, private, duplicate, and uncertain files out of Rabbi’s main workspace.

## 9. Division of labor

ChatGPT/source-of-truth work owns:

- strategy;
- brand hierarchy;
- funnel design;
- traffic taxonomy;
- pipeline model;
- email copy;
- measurement definitions;
- exact Work/Codex instructions.

Work Ultra/Codex mechanical lane owns only:

- local/Drive inventory;
- safe deduplication;
- clean clip cutting;
- human-readable naming;
- Drive folder creation;
- registry population;
- cover/first-frame extraction;
- Rabbi pack assembly;
- read-only GHL verification and implementation handoff evidence.

Work/Codex must not redo broad market research, rewrite strategy, invent surveys, change the price, change the brand hierarchy, edit the active product-launch branch, publish, schedule, broadcast, boost, spend, or contact customers.