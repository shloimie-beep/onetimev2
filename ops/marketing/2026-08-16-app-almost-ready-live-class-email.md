# One Time Mishnayos — App Almost Ready / Live Class Announcement

**Decision date:** 2026-08-16  
**Status:** Current operator-approved draft direction; no send authorized by this file  
**Product integration authority:** PR #131  
**GHL production location:** `pBSnOK2nkdxp6gf9Rg3o`

## Purpose

Use one calm, honest announcement instead of rushing a broken app launch.

The message should:

- announce that the live daily Mishnayos class is restarting;
- say the new app is in its final stages and expected within the next few days;
- explain that One Time Productions is focusing on spreading a love of Mishnayos throughout Klal Yisrael;
- invite recipients to the live class from Eretz Yisrael;
- state that access is free through Rosh Hashanah with no credit card required;
- avoid claiming that the app is already live when it is not;
- avoid sending recipients into a broken signup or classroom path.

## Audience

Do not send to every raw GHL record.

Use the approved marketable adult Smart List:

- Name: `OT | Sunday Launch Eligible | 2026-08-16`
- ID: `Gr4bIiGGGf0eBadxINbx`
- Last verified count: `1,335`

GHL suppression, DND, unsubscribe, bounce, and complaint protections remain in force.

## Recommended email

**Subject:** `One Time is starting again tonight`

**Preheader:** `The new app is almost ready. Join Rabbi Scheller live from Eretz Yisrael.`

```text
Hi {{contact.first_name}},

I’m excited to share that One Time is starting again tonight.

The new One Time app is in its final stages and should be ready over the next few days. Going forward, One Time Productions will be focused on one goal: helping boys throughout Klal Yisrael develop a real love for Mishnayos.

Tonight at 7:00 PM Israel time / 12:00 PM Eastern, we are restarting the live daily Mishnayos class from Eretz Yisrael.

One full perek. Clear visual teaching. Stories. A real Rebbe. And recordings afterward for review.

The program will be free through Rosh Hashanah, with no credit card required.

[PRIMARY CTA]

I look forward to learning together.

Rabbi Eli Scheller
One Time Mishnayos
Mishnayos Made Memorable
```

## CTA decision

Use exactly one of these:

### A. App/signup confirmed working

- Label: `GET FREE ACCESS`
- Destination: the verified canonical join/signup URL with UTM parameters.

### B. App is not ready, but a safe class-access page is confirmed

- Label: `JOIN TONIGHT’S LIVE CLASS`
- Destination: a verified first-party class-access or registration page.
- Never use or expose a raw Zoom URL.

### C. Neither app nor class-access page is safely ready

Send the announcement without a button and add:

```text
We’ll send the access link as soon as the new app opens.
```

Then send a separate app-live email when the end-to-end path is proven.

## GHL builder prompt

```text
Create or update one Draft email campaign in the One Time HighLevel location.

Exact campaign name:
OT-C03 App Almost Ready — Live Mishnayos Starts Again

Keep it Draft, unscheduled, and unsent.

Audience:
OT | Sunday Launch Eligible | 2026-08-16
Smart List ID: Gr4bIiGGGf0eBadxINbx

Do not use every raw contact in the location. Preserve GHL DND, unsubscribe, bounce, complaint, and suppression enforcement.

Sender:
Rabbi Eli Scheller
rabbielischeller@onetimeonetime.com

Reply-To:
rabbielischeller@onetimeonetime.com

Subject:
One Time is starting again tonight

Preheader:
The new app is almost ready. Join Rabbi Scheller live from Eretz Yisrael.

Use the clean plain-text editor or text builder. Insert exactly this copy. Do not paraphrase, add emojis, images, countdowns, testimonials, stock marketing language, extra headings, or a second CTA.

Hi {{contact.first_name}},

I’m excited to share that One Time is starting again tonight.

The new One Time app is in its final stages and should be ready over the next few days. Going forward, One Time Productions will be focused on one goal: helping boys throughout Klal Yisrael develop a real love for Mishnayos.

Tonight at 7:00 PM Israel time / 12:00 PM Eastern, we are restarting the live daily Mishnayos class from Eretz Yisrael.

One full perek. Clear visual teaching. Stories. A real Rebbe. And recordings afterward for review.

The program will be free through Rosh Hashanah, with no credit card required.

[PRIMARY CTA]

I look forward to learning together.

Rabbi Eli Scheller
One Time Mishnayos
Mishnayos Made Memorable

Before adding the CTA, stop and determine which verified destination exists:

1. If the full signup and Parent journey is operator-confirmed, use one button:
   GET FREE ACCESS
   pointing to the verified canonical join/signup URL with UTM parameters.

2. If the app is not ready but a safe first-party class-access page is confirmed, use one button:
   JOIN TONIGHT’S LIVE CLASS
   pointing only to that verified first-party page.

3. If neither destination is safely ready, use no button. Replace [PRIMARY CTA] with:
   We’ll send the access link as soon as the new app opens.

Never use a raw Zoom, Vimeo, Drive, provider, or credential-bearing link.

Save, exit, reopen, and return:

- campaign ID;
- Draft/unscheduled/unsent state;
- exact subject and preheader;
- sender and Reply-To;
- final body;
- selected CTA option and destination;
- Smart List ID and current count;
- emails sent: 0;
- one operator action required before send.
```

## Send rule

This draft is deliberately honest if the app slips by one or two days. Do not turn a delayed app into a false launch claim.
