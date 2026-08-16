# One Time Mishnayos — App Almost Ready / Live Class Announcement

**Decision date:** 2026-08-16  
**Status:** Current operator-approved draft direction; one operator test permitted, no production send authorized by this file  
**Product integration authority:** PR #131  
**GHL production location:** `pBSnOK2nkdxp6gf9Rg3o`

## Purpose

Use one calm, honest announcement instead of rushing a broken app launch.

The message should:

- announce that the live daily Mishnayos class is restarting;
- say the new app is in its final stages and expected within the next few days;
- explain that One Time Productions is focusing on helping boys throughout Klal Yisrael develop a love for Mishnayos;
- invite recipients to tonight's live class from Eretz Yisrael;
- describe the learning as clear, visual, exciting, and engaging;
- tell recipients that a separate Family-account setup email will follow within the next few days;
- state that the Family account/program will be free through Rosh Hashanah with no credit card required;
- avoid mentioning stories, a “real Rebbe,” or recordings afterward for review in this announcement;
- avoid claiming that the app is already live when it is not.

## Audience

Do not send to every raw GHL record.

Use the approved marketable adult Smart List:

- Name: `OT | Sunday Launch Eligible | 2026-08-16`
- ID: `Gr4bIiGGGf0eBadxINbx`
- Last verified count: `1,335`

GHL suppression, DND, unsubscribe, bounce, and complaint protections remain in force.

## Recommended email

**Subject:** `One Time is starting again tonight`

**Preheader:** `Join tonight at 7:00 PM Israel time / 12:00 PM Eastern. The new app is almost ready.`

```text
Hi {{contact.first_name}},

I’m excited to share that One Time is starting again tonight.

The new One Time app is in its final stages and should be ready over the next few days.

Going forward, One Time Productions will be focused on one goal: helping boys throughout Klal Yisrael develop a real love for Mishnayos.

Tonight at 7:00 PM Israel time / 12:00 PM Eastern, we are restarting the live daily Mishnayos class from Eretz Yisrael.

Each class covers one full perek in a way that is clear, visual, exciting, and engaging.

Click the link below to join tonight’s class.

Within the next few days, you’ll receive another email with a link to set up your free Family account. No credit card will be required, and the program will remain free through Rosh Hashanah.

[JOIN TONIGHT’S LIVE CLASS]

I look forward to learning together.

Rabbi Eli Scheller
One Time Mishnayos
Mishnayos Made Memorable
```

## CTA

**Label:** `JOIN TONIGHT’S LIVE CLASS`

**Destination rule:** Use only the existing verified, safe current-class access destination or first-party protected redirect already approved for the current class. Do not invent a URL and do not store, print, or expose a raw Zoom/provider bearer link in this document, AI response, GHL field, report, or log.

The GHL operator should inspect the existing `OT-B02 Send Next Confirmed Class Info` workflow and the current approved class-access configuration. It may reuse the same destination only when it is a safe first-party access route or governed protected redirect suitable for a campaign button. If no such safe destination is available, stop with `SAFE_CLASS_ACCESS_URL_REQUIRED` and do not send the test or production campaign.

## GHL builder prompt

```text
UPDATE THE ONE TIME APP-ALMOST-READY CAMPAIGN TO INVITE PEOPLE TO TONIGHT'S CLASS

Work inside the existing One Time HighLevel sub-account.

Location ID:
pBSnOK2nkdxp6gf9Rg3o

Create or update this exact campaign:

OT-C03 App Almost Ready — Live Mishnayos Starts Again

Keep it:

- Draft
- Unscheduled
- Unsent to the production audience

Audience for later production use:

OT | Sunday Launch Eligible | 2026-08-16

Smart List ID:

Gr4bIiGGGf0eBadxINbx

Last verified count:

1,335

Preserve all GHL DND, unsubscribe, bounce, complaint, and suppression protections.

SENDER

From Name:

Rabbi Eli Scheller

From Email:

rabbielischeller@onetimeonetime.com

Reply-To:

rabbielischeller@onetimeonetime.com

SUBJECT

One Time is starting again tonight

PREHEADER

Join tonight at 7:00 PM Israel time / 12:00 PM Eastern. The new app is almost ready.

EMAIL BUILDER INSTRUCTION

Use the clean plain-text editor or HighLevel text/AI builder.

Give the builder this exact instruction:

“Replace the entire email with the exact copy below. Do not paraphrase. Do not add emojis, images, countdowns, testimonials, stock marketing language, extra headings, legal commentary, stories, references to recordings for review, the phrase ‘a real Rebbe,’ or a second CTA. Use one clear button labeled JOIN TONIGHT’S LIVE CLASS. Preserve the first-name merge field, paragraph spacing, punctuation, and signature exactly.”

EXACT BODY

Hi {{contact.first_name}},

I’m excited to share that One Time is starting again tonight.

The new One Time app is in its final stages and should be ready over the next few days.

Going forward, One Time Productions will be focused on one goal: helping boys throughout Klal Yisrael develop a real love for Mishnayos.

Tonight at 7:00 PM Israel time / 12:00 PM Eastern, we are restarting the live daily Mishnayos class from Eretz Yisrael.

Each class covers one full perek in a way that is clear, visual, exciting, and engaging.

Click the link below to join tonight’s class.

Within the next few days, you’ll receive another email with a link to set up your free Family account. No credit card will be required, and the program will remain free through Rosh Hashanah.

[JOIN TONIGHT’S LIVE CLASS]

I look forward to learning together.

Rabbi Eli Scheller
One Time Mishnayos
Mishnayos Made Memorable

CTA

Create exactly one button.

Button label:

JOIN TONIGHT’S LIVE CLASS

DESTINATION SAFETY CHECK

Before setting the button URL, inspect:

- OT-B02 Send Next Confirmed Class Info;
- the existing approved current-class access configuration;
- any current first-party protected class redirect already used for the live class.

Use the destination only when it is a verified safe first-party class-access URL or governed protected redirect suitable for an email campaign.

Do not:

- invent a class URL;
- use the app signup URL while labeling the button Join Tonight’s Live Class;
- expose or report a raw Zoom URL, meeting passcode, provider token, or bearer credential;
- save a raw provider link into a GHL custom field, report, note, or AI response;
- alter the current class or Zoom configuration.

If no verified safe class-access destination is available, stop and return exactly:

SAFE_CLASS_ACCESS_URL_REQUIRED

Do not send the test email in that case.

VERIFY BEFORE TESTING

1. Verify the exact subject.
2. Verify the exact preheader.
3. Verify From Name, From Email, and Reply-To.
4. Verify the body contains the sentence directing recipients to join tonight's class.
5. Verify the body promises a separate Family-account setup email within the next few days.
6. Verify the body contains no stories, no recording-review statement, and no “real Rebbe” wording.
7. Verify there is exactly one CTA.
8. Verify the CTA points to the verified safe class-access destination.
9. Save the campaign.
10. Exit the editor.
11. Reopen it and confirm the saved content.
12. Keep it Draft, unscheduled, and unsent to the production audience.

TEST SEND

Only after the safe class-access destination has been verified and bound, send exactly one test email to:

sdratlr@gmail.com

This is an operator-owned test only.

Do not send to the 1,335-contact Smart List.
Do not schedule the campaign.
Do not publish or activate any workflow.
Do not move or create any opportunity.

RETURN

- campaign ID;
- campaign name;
- Draft status;
- exact subject;
- exact preheader;
- sender;
- Reply-To;
- complete saved body;
- CTA label;
- safe destination type, without printing any bearer credential;
- test recipient;
- test delivery result;
- production emails sent: 0;
- one operator action required before a production send.
```

## Send rule

The operator test may be sent to `sdratlr@gmail.com` only after the CTA is bound to a verified safe class-access destination. The full Smart List remains unsent until Shloimie reviews the test and explicitly authorizes production delivery.