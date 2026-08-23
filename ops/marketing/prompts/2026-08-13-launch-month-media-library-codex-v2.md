# Codex Prompt B — Launch-Month Media Library, Drive Organization, and Fast Organic-to-Paid Handoff

You are in `shloimie-beep/onetimev2`.

Run this in a **separate Codex window, separate worktree, and separate branch** from PR #131 and from the consent/source-of-truth lane.

## Read first

1. Current remote `AGENTS.md` from PR #131.
2. Current PR #131 head and launch status.
3. PR #132 and PR #133 marketing history.
4. Current `ops/marketing/**` files.
5. `ops/marketing/2026-08-13-30-day-launch-marketing-source-of-truth-v2.md`.
6. `ops/v2.1-execution/source-spec/00-OPERATOR-DECISION-OVERRIDE-20260813-ONE-CHECKBOX.md` for awareness only; do not edit product consent code in this media lane.

## Source

Primary source folder:

- Name: `Mishnayos New`
- Drive ID: `1jj6e4L8cuoqQifWQWUzI03Bbc_-mB69R`

Treat this folder and every other source folder as immutable.

## Required outcome

Complete the bounded launch-month media system through terminal deliverables:

- full source inventory;
- dedupe and blocked-content classification;
- approximately 40–60 strong selected moments;
- approximately 100–150 clean atomic clips in multiple useful lengths;
- all approved still images consolidated into one obvious folder;
- one simple Rabbi-facing Drive workspace;
- twelve anchor video packs;
- covers and strong first-frame assets;
- four-week schedule-ready organization;
- repo manifests, calendar, copy, scorecard, and Rabbi editing instructions;
- landing-creative handoff;
- read-only GHL/Facebook/Instagram/YouTube connection status;
- zero publication, scheduling, broadcast, ad spend, provider changes, production mutation, or source-file mutation.

## Source preservation

- Never move, rename, replace, modify, or delete originals.
- Create only derivative outputs in the new bounded workspace.
- Hash/dedupe where safely possible.
- For very large recordings, create bounded proxies/contact sheets first.
- Block third-party footage, visible private data, irrelevant media, or uncertain rights.
- Do not repeatedly transcode multi-gigabyte sources without a selected time range.

## Rights state

For current supplied launch media, record the operator decision:

```text
rights_status: operator_attested_all_marketing_channels
attested_by: Shloimie Dratler
attestation_date: 2026-08-13
```

Covered destinations include website, email, WhatsApp, Facebook, Instagram, YouTube, organic social, and paid advertising. This does not clear third-party copyright, visible private data, or unrelated/uncertain people.

Do not create or preserve a second media checkbox in this lane. Product consent implementation belongs to Prompt A.

## Inventory

Create:

`ops/marketing/2026-08-13-source-media-inventory.csv`

Fields:

```text
source_id,source_filename,drive_id,url,mime_type,bytes,duration,width,height,orientation,created_at,sha256_or_status,duplicate_group,people_present,student_present,rabbi_present,audio_present,dialogue_present,third_party_content,private_data_flag,rights_status,review_status,notes
```

Create low-resolution contact sheets/proxies for fast review.

## Atomic clip library

Select approximately 40–60 strong moments and create approximately 100–150 useful clips.

Cut types:

- impact: 0.8–1.5 seconds;
- standard: 2–3.5 seconds;
- extended: 4–6 seconds;
- dialogue: 8–15 seconds.

Create multiple lengths only when each version has a clear editing use.

Prioritize:

- Rabbi close-ups, smiles, gestures, reactions;
- Rabbi pointing, drawing, teaching, or using the Mishnah screen;
- boys listening, smiling, answering, reacting, and speaking with Rabbi;
- coherent Rabbi–Student exchanges;
- full-class energy and wide shots;
- Mishnah text, sefarim, screen, device, and online-class proof;
- strong vertical footage;
- active first-frame/thumbnail moments.

Atomic clip rules:

- H.264 MP4;
- preserve useful source resolution without upscaling;
- no added music;
- no baked-in text/captions;
- no transitions;
- no watermark;
- no filters, face restoration, beauty effects, face swap, generative fill, or synthetic people;
- no private child/account data;
- preserve original audio only when useful; create a muted variant where helpful.

Human-readable names:

```text
C001 - Rabbi points to Mishnah screen - 01s - HORIZONTAL.mp4
C002 - Rabbi points to Mishnah screen - 03s - HORIZONTAL.mp4
C003 - Students watching closely - 02s - VERTICAL.mp4
C004 - Student answers Rabbi - 03s - VERTICAL.mp4
C005 - Student answers Rabbi - 10s - VERTICAL.mp4
```

Create:

`ops/marketing/2026-08-13-clip-library-manifest.csv`

Fields:

```text
clip_id,display_filename,source_filename,source_drive_id,source_in,source_out,duration,orientation,category,description,energy_score,clarity_score,audio_type,dialogue_summary,student_flag,rabbi_flag,rights_status,first_frame_score,recommended_packs,drive_output_id,url,sha256,notes
```

## Rabbi-facing Drive workspace

Create:

```text
ONE TIME MARKETING — LAUNCH MONTH
  00 START HERE
  01 SOURCE SHORTCUTS - DO NOT EDIT
  02 ALL APPROVED IMAGES
  03 ALL APPROVED CLIPS
    01 Rabbi Teaching and Gestures
    02 Students Engaged and Reacting
    03 Rabbi-Student Conversations
    04 Full Classroom and Wide Shots
    05 Mishnah Text, Screen and Sefarim
    06 Community and Atmosphere
    07 Dialogue and Voice Clips
    08 Hero Openers and Cover Frames
  04 VIDEO PACKS FOR RABBI
  05 CANVA AND GRAPHICS
    01 Feed Graphics - 1080x1350
    02 Vertical Covers - 1080x1920
    03 Landing Hero - Desktop
    04 Landing Hero - Mobile
    05 Landing Link Preview - 1200x630
  06 READY TO SCHEDULE
    WEEK 1
    WEEK 2
    WEEK 3
    WEEK 4
  07 POSTED AND RESULTS
    FACEBOOK
    INSTAGRAM
    YOUTUBE
    WHATSAPP
  99 BLOCKED OR DO NOT USE
```

Rules:

- Put every approved still in `02 ALL APPROVED IMAGES` with `I001`, `I002`, etc.
- Do not mix CSVs or long reports into the image folder.
- `00 START HERE` contains only short human instructions.
- Use shortcuts to source folders rather than copying giant originals.

Create `ops/marketing/2026-08-13-drive-output-manifest.csv`.

## Twelve anchor packs

Create:

```text
VP-001 - Classes Start Sunday
VP-002 - Get Free Access
VP-003 - Look Forward to Mishnayos
VP-004 - A Real Rebbe Changes the Screen
VP-005 - One Perek One Accomplishment
VP-006 - Live from Eretz Yisrael
VP-007 - Live and On Demand
VP-008 - Torah Learning Feels Alive
VP-009 - When the Mishnah Clicks
VP-010 - Rabbi and Student Conversation
VP-011 - Build the Habit Before Rosh Hashanah
VP-012 - Free Access Deadline
```

Each pack contains only:

```text
01 USE THESE CLIPS
02 USE THIS COVER
03 TEXT OVERLAYS
READ THIS - 1 PAGE.txt
```

For every pack provide:

- exact 7–10 second recipe;
- exact 15-second recipe;
- exact 25–30 second recipe;
- ordered clip IDs;
- recommended image/cover;
- strong active first-frame clip;
- no more than three kinetic-text phrases;
- Facebook/Instagram Primary Text and headline;
- WhatsApp Status/direct-forward/broadcast copy linking to the landing page;
- YouTube Short title and description;
- rights/blocker status.

Do not render final song-backed videos. Rabbi Eli performs final editing.

## Song handoff

Create `SONG AND VIDEO RECIPE` requesting:

- exact song file;
- ownership/usage confirmation for organic and paid advertising;
- exact `One Time, One Time` timestamp;
- preferred 15-second section;
- preferred 30-second section;
- instrumental version if available.

Do not add/distribute the song until supplied and approved.

## First frame and covers

Every pack includes:

```text
COVER-VERTICAL-1080x1920.png
COVER-FEED-1080x1350.png
FIRST-FRAME-VIDEO.mp4
```

The opening 0.5–1 second must work as the thumbnail/preview. No long static-logo intro.

## Calendar and fast organic winners

Create:

- `ops/marketing/2026-08-13-content-calendar.csv`
- `ops/marketing/2026-08-13-creative-scorecard.csv`
- `ops/marketing/2026-08-13-rabbi-editing-instructions.md`

Campaign facts:

- preparation Aug 13–15;
- first class Aug 16 at 7 PM Israel;
- free through Sept 11 at 6 PM Jerusalem;
- US Jewish parents with boys approximately 7–13;
- no schools;
- CTA `GET FREE ACCESS`;
- form action `CREATE YOUR FREE FAMILY ACCOUNT`;
- destination `https://join.onetimeonetime.com`;
- no `Pre-register`;
- WhatsApp is distribution to the landing page, not the funnel destination.

Cadence:

- one primary vertical video daily;
- one micro-cutdown daily;
- two to four WhatsApp units daily;
- three Facebook statics weekly;
- five YouTube Shorts weekly.

Winner timeline:

- Days 1–3: initial organic screen.
- Days 4–7: choose approximately three provisional winners and prepare immediate Meta paid tests.
- Days 8–14: confirm/refine winners and replace weak variants.
- Weeks 3–4: scale only creatives producing acceptable completed Family registrations and activation.

Prepare scheduling-ready files and upload checklists, but do not upload, schedule, broadcast, boost, or run ads.

## Tracking and scorecard

Give every creative a stable ID and track:

- spend;
- impressions;
- three-second views;
- average watch time;
- completion rate;
- shares/forwards;
- landing-page clicks;
- free registrations;
- activations;
- paid conversions;
- registration CPA;
- activation CPA;
- paid CAC;
- retention;
- payback;
- contribution LTV:CAC.

Use the simple planning example from the source-of-truth file in the Rabbi/Shloimie handoff.

## Read-only connection check

If accessible, read only:

- Facebook Page connection in GHL;
- Instagram professional connection;
- YouTube connection.

Record unverified facts as unverified. Do not connect or reauthorize accounts.

Prepare one exact instruction for Rabbi Eli, as primary YouTube owner, to connect the channel to GHL Social Planner.

## Landing creative handoff

Prepare a production-lane checklist only:

- `GET FREE ACCESS` everywhere;
- `CREATE YOUR FREE FAMILY ACCOUNT` on form action;
- no `Pre-register`;
- desktop hero;
- mobile hero;
- 1200×630 landing link-preview card;
- starts Aug 16 at 7 PM Israel;
- no card required;
- free through Sept 11 at 6 PM Jerusalem.

Do not edit app code in this media branch.

## Return

1. Separate worktree, branch, and draft PR.
2. Exact PR #131 authority readback.
3. Exact source count and inventory path.
4. Duplicate/blocked findings.
5. Selected-moment count.
6. Atomic-clip count by duration/category/orientation.
7. Rabbi-facing Drive workspace link.
8. `02 ALL APPROVED IMAGES` link.
9. Twelve pack links.
10. Week 1–4 ready-to-schedule links.
11. Repo manifest/calendar/scorecard paths.
12. Facebook/Instagram/YouTube readback.
13. Landing creative handoff path.
14. External-effect counts — all publication/scheduling/broadcast/ad/provider/product/deploy counts must remain zero.
15. One exact next action for Shloimie.
16. One exact next action for Rabbi Eli.
