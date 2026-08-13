# One Time Mishnayos — Work Ultra Worker Prompt Sequence

**Parent prompt:** `ops/marketing/prompts/work-ultra/00-master-orchestrator.md`  
**Product integration:** PR #131  
**Marketing/control parent:** PR #183  
**Primary Drive source:** `Mishnayos New` / `1jj6e4L8cuoqQifWQWUzI03Bbc_-mB69R`

Run the workers below through the Work Ultra control window. Each worker receives only its assigned scope. Workers must not invent new dependencies, edit another worker’s paths, or perform provider/product mutations.

---

# WORKER A — Market, Pricing, FX, and Conversion Research

```text
ONE TIME MISHNAYOS — WORKER A
MARKET, PRICING, FX, AND CONVERSION RESEARCH

Repository: shloimie-beep/onetimev2
Parent: PR #183
Active product launch: PR #131 — READ ONLY

READ FIRST

- current PR #131 AGENTS.md
- ops/marketing/2026-08-13-launch-marketing-source-of-truth-v3.md
- ops/marketing/research/2026-08-13-market-pricing-cro-fx-research.md

WRITE SCOPE

- ops/marketing/research/** only

MISSION

Refresh and deepen the market/pricing/conversion research without changing the locked launch price, offer, CTA, dates, audience, product code, providers, Drive, or production.

RESEARCH QUESTIONS

1. What do current directly comparable and adjacent Jewish/Torah education programs charge?
2. Which programs are daily, weekly, live, hybrid, on-demand, audio, or sponsored/free?
3. How does One Time's $67/month Family price compare after normalizing by live class-day and by child when three seats are used?
4. What proven or high-confidence conversion levers apply to a parent-directed education funnel?
5. What are current broad education landing-page benchmarks, and what limitations prevent treating them as a forecast?
6. How should One Time learn this narrow market directly during the first month?
7. How should USD ad spend and ILS management reporting be handled?

SOURCE RULES

- Use current primary sources whenever possible: official program pricing pages, official Bank of Israel data, original benchmark reports, official vendor case studies with explicit limitations.
- Record access date and exact public URL in source notes.
- Do not rely on unsupported snippets when the underlying page is accessible.
- Do not claim that a vendor case study proves universal causation.
- Preserve uncertainty where a public price is ambiguous, annual, membership-based, sponsored, or not described as monthly.

REQUIRED OUTPUTS

1. Update or append:
   ops/marketing/research/2026-08-13-market-pricing-cro-fx-research.md

2. Create:
   ops/marketing/research/current-competitor-pricing.csv

Required columns:

program,program_url,audience,live_frequency,live_minutes,asynchronous_or_library,household_or_per_child,published_price,published_price_period,registration_fee,free_or_sponsored,notes,verified_at

3. Create:
   ops/marketing/research/parent-interview-script.md

Include separate questions for:
- current families;
- former app families;
- registrants who never activate;
- activated families who do not pay;
- long-retained paying families.

4. Create:
   ops/marketing/research/launch-month-research-plan.md

Include:
- 10–15 parent interviews;
- source-segmented cohorts;
- optional post-signup micro-survey;
- weekly insight review;
- exact decisions the research may inform;
- decisions it may not change without Shloimie.

5. Create:
   ops/marketing/research/fx-accounting-note.md

Lock:
- USD as primary ad/customer unit-economics currency;
- date-stamped ILS reference reporting;
- Bank of Israel RER_USD_ILS as the preferred management reference;
- actual bank/card/transfer settlement as accounting evidence;
- no hard-coded exchange rate.

DO NOT

- change $67 price;
- create an annual plan;
- change free-access dates;
- change the audience;
- edit product or landing code;
- contact competitors;
- create accounts;
- publish or spend.

RETURN

- exact sources;
- pricing matrix summary;
- strongest conversion hypotheses;
- narrow-market research plan;
- unresolved ambiguities;
- repo paths changed;
- external effects, which must be zero.
```

---

# WORKER B — Content-Asset Registry Backend and Validator

```text
ONE TIME MISHNAYOS — WORKER B
CONTENT-ASSET REGISTRY BACKEND — NO FRONTEND

Repository: shloimie-beep/onetimev2
Parent: PR #183
Active product launch: PR #131 — READ ONLY

READ FIRST

- current PR #131 AGENTS.md
- ops/marketing/2026-08-13-launch-marketing-source-of-truth-v3.md
- ops/marketing/content-registry/README.md
- ops/marketing/content-registry/content-asset.schema.json

WRITE SCOPE

- ops/marketing/content-registry/**
- scripts/marketing/content-registry/**

MISSION

Finish a repository-backed marketing content registry that can later feed a content section, while adding no product frontend, route, API, database migration, provider integration, scheduler, or publication capability.

The registry is the durable index. Google Drive remains the binary media store.

REQUIRED WORK

1. Inspect the current registry README/schema/starter files.
2. Create a dependency-free Node.js validator under:
   scripts/marketing/content-registry/validate.mjs
3. The validator must:
   - parse every non-empty NDJSON line;
   - validate required fields and enum/pattern constraints needed for launch;
   - verify unique asset IDs;
   - verify source/cover/first-frame/package references where present;
   - reject Student assets with rights_status=not_required;
   - reject private-data assets from marketing-ready states;
   - reject short-lived signed/provider bearer URLs;
   - verify CSV headers;
   - verify package YAML has unique package IDs and valid referenced asset IDs;
   - emit a concise JSON result without personal data.
4. Do not add npm dependencies or change package.json. Use built-in Node facilities and existing repository utilities only.
5. Create:
   - ops/marketing/content-registry/assets.example.ndjson
   - ops/marketing/content-registry/creative-packages.example.yaml
   - ops/marketing/content-registry/REGISTRY-FIELD-MAP.md
   - ops/marketing/content-registry/FUTURE-CONTENT-SECTION-IMPORT-CONTRACT.md
6. The future import contract must explicitly state:
   - no launch frontend is being built;
   - PR #131 removed/deferred Social/Buffer UI and it must not be restored;
   - a future authorized importer may project registry records into the Admin content workspace;
   - Drive IDs/links stay server/admin scoped as appropriate;
   - no automatic publishing;
   - exact rights and source lineage remain mandatory.
7. Run the validator against starter/example files.

ID RULES

- Assets: OTM-A000001
- Moments: OTM-M0001
- Packages: OTM-CP-001
- Finished creatives: OTM-CR-202608-001-V01

DO NOT

- edit apps/**, packages/**, migrations, configs, routes, client UI, server UI, ContentWorkspace, or provider code;
- restore Social/Buffer surfaces;
- create a database;
- call Drive;
- publish or schedule.

RETURN

- validator command;
- validation result;
- exact files changed;
- registry limitations;
- future import boundary;
- external effects, which must be zero.
```

---

# WORKER C — Drive Source Inventory and Selected-Moment Plan

```text
ONE TIME MISHNAYOS — WORKER C
READ-ONLY SOURCE INVENTORY AND SELECTED-MOMENT PLAN

Repository: shloimie-beep/onetimev2
Parent: PR #183
Active product launch: PR #131 — READ ONLY
Primary source folder: Mishnayos New
Drive ID: 1jj6e4L8cuoqQifWQWUzI03Bbc_-mB69R

READ FIRST

- current PR #131 AGENTS.md
- ops/marketing/2026-08-13-launch-marketing-source-of-truth-v3.md
- ops/marketing/content-registry/README.md
- ops/marketing/content-registry/content-asset.schema.json

WRITE SCOPE

- ops/marketing/media-library/inventory/** only

DRIVE MODE

READ ONLY. Do not create, move, rename, edit, copy, cut, delete, share, or change permission on any Drive item in this worker.

MISSION

Build the complete source inventory and selected-moment plan that the cutting worker can execute without re-auditing the library.

REQUIRED WORK

1. Recursively inventory the entire Mishnayos New folder.
2. Record:
   - Drive ID and stable view URL;
   - filename;
   - MIME type;
   - size;
   - duration, dimensions, orientation, frame rate, and audio presence when available;
   - checksum when safely obtainable;
   - duplicate/near-duplicate grouping;
   - Rabbi/Student/private-data/third-party-content flags;
   - initial rights state;
   - usable quality notes.
3. Review video visually and identify approximately 40–60 genuinely strong moments.
4. For each moment, propose useful variants:
   - 0.8–1.5s impact;
   - 2–3.5s standard;
   - 4–6s extended;
   - 8–15s dialogue where coherent.
5. Score each moment 1–5 for:
   - visual energy;
   - clarity;
   - Rabbi personality;
   - Student engagement;
   - Mishnah/program proof;
   - first-frame potential;
   - paid-ad potential;
   - organic potential.
6. Assign stable source asset IDs and moment IDs compatible with the registry.
7. Propose human-readable Rabbi filenames.
8. Mark anything uncertain as blocked rather than guessing.

REQUIRED OUTPUTS

- ops/marketing/media-library/inventory/source-inventory.csv
- ops/marketing/media-library/inventory/duplicate-groups.csv
- ops/marketing/media-library/inventory/selected-moments.csv
- ops/marketing/media-library/inventory/proposed-clip-variants.csv
- ops/marketing/media-library/inventory/rights-and-private-data-review.md
- ops/marketing/media-library/inventory/contact-sheet-index.md
- ops/marketing/media-library/inventory/HANDOFF-TO-CUTTING.md

No child names or private account data may enter the repo.

STOP CONDITIONS

Stop and mark blocked if:
- participant rights are uncertain;
- a clip contains private family data, visible contact data, or unrelated child information;
- third-party copyrighted footage is embedded;
- source access is incomplete;
- a source file is corrupt or cannot be inspected safely.

RETURN

- total source counts by type;
- total duration;
- duplicate counts;
- selected-moment count;
- planned derivative count;
- exact blockers;
- repo paths;
- Drive effects, which must be zero.
```

---

# WORKER D — Atomic Clip Cutting and Rabbi-Facing Drive Organization

```text
ONE TIME MISHNAYOS — WORKER D
ATOMIC CLIP CUTTING AND RABBI-FACING DRIVE LIBRARY

Repository: shloimie-beep/onetimev2
Parent: PR #183
Active product launch: PR #131 — READ ONLY
Primary source folder: Mishnayos New
Drive ID: 1jj6e4L8cuoqQifWQWUzI03Bbc_-mB69R

DEPENDENCIES

- Worker B registry IDs/schema terminal and green.
- Worker C inventory and selected-moment handoff terminal.

READ FIRST

- current PR #131 AGENTS.md
- ops/marketing/2026-08-13-launch-marketing-source-of-truth-v3.md
- ops/marketing/content-registry/**
- ops/marketing/media-library/inventory/**

WRITE SCOPE

Repo:
- ops/marketing/media-library/derivatives/**
- append valid records to ops/marketing/content-registry/assets.ndjson

Drive:
- create only the new derivative workspace described below;
- never modify source folders or existing marketing packages.

MISSION

Create approximately 100–150 clean, reusable clips from approximately 40–60 approved selected moments and make the Drive workspace immediately understandable to Rabbi Eli.

CREATE THIS DRIVE ROOT

ONE TIME MARKETING — LAUNCH MONTH

CREATE EXACT TOP-LEVEL FOLDERS

00 START HERE
01 SOURCE SHORTCUTS - DO NOT EDIT
02 ALL APPROVED IMAGES
03 ALL APPROVED CLIPS
04 VIDEO PACKS FOR RABBI
05 CANVA AND GRAPHICS
06 READY TO SCHEDULE
07 POSTED AND RESULTS
99 BLOCKED OR DO NOT USE

UNDER 03 ALL APPROVED CLIPS

01 Rabbi Teaching and Gestures
02 Students Engaged and Reacting
03 Rabbi-Student Conversations
04 Full Classroom and Wide Shots
05 Mishnah Text, Screen and Sefarim
06 Community and Atmosphere
07 Dialogue and Voice Clips
08 Hero Openers and Cover Frames

CLIP RULES

- Export H.264 MP4 with source-appropriate resolution; do not upscale.
- Preserve native orientation where useful.
- No added music.
- No baked-in text or captions.
- No transitions.
- No watermark.
- No filters, beauty effects, face restoration, generative fill, synthetic people, or expression changes.
- Preserve natural audio only where the clip is a voice/dialogue asset; otherwise a clean silent or source-audio derivative may be made as specified in the inventory.
- Do not expose private data.

HUMAN-READABLE FILENAMES

Examples:

C001 - Rabbi points to Mishnah screen - 01s - HORIZONTAL.mp4
C002 - Rabbi points to Mishnah screen - 03s - HORIZONTAL.mp4
C003 - Students watching closely - 02s - VERTICAL.mp4
C004 - Student answers Rabbi - 10s - VERTICAL.mp4

The registry stores source lineage and IDs. The Rabbi filename stays simple.

ALL APPROVED IMAGES

Place every approved still image in one folder:

02 ALL APPROVED IMAGES

Use filenames such as:

I001 - Rabbi teaching beside Mishnah screen - VERTICAL.jpg
I002 - Full classroom engaged - HORIZONTAL.jpg
I003 - Rabbi smiling hero portrait - HORIZONTAL.jpg

No reports or CSVs belong in this folder.

00 START HERE

Create only short, usable files:

- RABBI - START HERE.pdf or .txt
- WHAT IS IN EACH FOLDER.txt
- SONG FILE - RABBI ADD HERE.txt

Do not place technical audits here.

REPO OUTPUTS

- ops/marketing/media-library/derivatives/drive-output-manifest.csv
- ops/marketing/media-library/derivatives/clip-output-manifest.csv
- ops/marketing/media-library/derivatives/image-output-manifest.csv
- ops/marketing/media-library/derivatives/registry-update-report.md
- ops/marketing/media-library/derivatives/validation.md
- ops/marketing/media-library/derivatives/HANDOFF-TO-RABBI-PACKS.md

VALIDATION

- every derivative opens;
- duration and orientation match filename/registry;
- registry validation passes;
- source IDs/timecodes/checksums are preserved;
- no blocked source appears in approved folders;
- Drive folder is understandable without repo access.

DO NOT

- make final song-backed ads;
- publish or schedule;
- alter permissions beyond what is required to create the operator-owned derivative workspace;
- move or rename originals;
- write outside approved scopes.

RETURN

- Drive root link;
- approved-images link;
- approved-clips link;
- source/selected/derivative counts;
- registry validation;
- blocked count;
- exact Drive effects;
- one next action for Rabbi Eli.
```

---

# WORKER E — Twelve Rabbi Editing Packs

```text
ONE TIME MISHNAYOS — WORKER E
TWELVE RABBI-READY VIDEO PACKS

Repository: shloimie-beep/onetimev2
Parent: PR #183
Active product launch: PR #131 — READ ONLY

DEPENDENCIES

- Worker D atomic clip library and Drive root terminal.

READ FIRST

- current PR #131 AGENTS.md
- ops/marketing/2026-08-13-launch-marketing-source-of-truth-v3.md
- content registry
- Worker D handoff/manifests

WRITE SCOPE

Repo:
- ops/marketing/rabbi-handoff/**
- append package definitions to ops/marketing/content-registry/creative-packages.yaml

Drive:
- 04 VIDEO PACKS FOR RABBI/** only
- supporting cover/graphic outputs under 05 CANVA AND GRAPHICS/** only

MISSION

Create twelve extremely simple, self-contained packages that Rabbi Eli can open and edit immediately in CapCut or another editor.

PACKS

OTM-CP-001 Classes Start Sunday
OTM-CP-002 Get Free Access
OTM-CP-003 Look Forward to Mishnayos
OTM-CP-004 A Real Rebbe Changes the Screen
OTM-CP-005 One Perek. One Accomplishment.
OTM-CP-006 Live from Eretz Yisrael
OTM-CP-007 Live + On Demand
OTM-CP-008 Torah Learning Should Feel Alive
OTM-CP-009 When the Mishnah Clicks
OTM-CP-010 Rabbi-Student Conversation
OTM-CP-011 Build the Habit Before Rosh Hashanah
OTM-CP-012 Free Access Ends September 11

EACH DRIVE PACK CONTAINS ONLY

01 USE THESE CLIPS
02 USE THIS COVER
03 TEXT OVERLAYS
READ THIS - 1 PAGE.txt

No CSVs, audits, rights reports, or technical manifests in Rabbi-facing folders.

EACH PACK MUST INCLUDE

- ordered clip copies or shortcuts;
- 7–10 second recipe;
- 15-second recipe;
- 25–30 second recipe;
- first-frame candidate that works within the first 0.5–1 second;
- COVER-VERTICAL-1080x1920.png;
- COVER-FEED-1080x1350.png;
- FIRST-FRAME-VIDEO.mp4 where practical;
- no more than three kinetic-text phrases;
- exact final CTA when the pack is conversion-focused;
- Facebook/Instagram primary text/headline;
- WhatsApp Status and forwarding/broadcast copy that links to the landing page;
- YouTube Short title/description;
- rights state in repo only.

SONG INSTRUCTIONS

Create a placeholder handoff for Rabbi to add:

- exact song file;
- ownership/organic/paid-rights confirmation;
- exact One Time, One Time opening timestamp;
- preferred 15-second section;
- preferred 30-second section;
- instrumental version if available.

Do not embed or redistribute the song before those facts are supplied.

EDITING STYLE

- opening frame is active and thumbnail-worthy;
- mostly hard cuts/punch-ins;
- 0.6–1.8 second visual clips;
- only two transition families;
- three controlled text motions maximum;
- footage stays central;
- do not cover faces, mouths, sefarim, or Mishnah screen;
- CTA sends to join.onetimeonetime.com;
- no claim that One Time is already the biggest Mishnayos class.

REPO OUTPUTS

- ops/marketing/rabbi-handoff/PACKAGE-INDEX.md
- one Markdown build sheet per package;
- ops/marketing/rabbi-handoff/SONG-HANDOFF.md
- ops/marketing/rabbi-handoff/RABBI-START-HERE.md
- registry package updates.

DO NOT

- make final published videos;
- alter product code;
- publish, schedule, broadcast, boost, or spend;
- create new claims or change CTA/date/price.

RETURN

- all 12 Drive pack links;
- package registry validation;
- missing song facts;
- exact blockers;
- one next action for Rabbi Eli.
```

---

# WORKER F — Landing Page and Funnel Conversion Audit

```text
ONE TIME MISHNAYOS — WORKER F
READ-ONLY LANDING PAGE AND CONVERSION AUDIT

Repository: shloimie-beep/onetimev2
Parent: PR #183
Active product launch: PR #131 — READ ONLY
Live destination: https://join.onetimeonetime.com

READ FIRST

- current PR #131 AGENTS.md
- current PR #131 launch status and relevant landing/signup source
- one-checkbox operator override
- ops/marketing/2026-08-13-launch-marketing-source-of-truth-v3.md
- ops/marketing/research/2026-08-13-market-pricing-cro-fx-research.md

WRITE SCOPE

- ops/marketing/funnel/** only

MISSION

Produce a precise, implementation-ready conversion handoff for PR #131 without modifying product code, deployment, providers, data, or the live page.

AUDIT

1. Ad-to-hero message match.
2. Exact CTA consistency:
   - GET FREE ACCESS
   - CREATE YOUR FREE FAMILY ACCOUNT
3. First class/date/free-expiry/no-card truth.
4. Mobile 360x800 and 390x844 experience.
5. Desktop/tablet composition.
6. Hero image clarity and text legibility.
7. LCP/CLS/overflow and heavy-image risks.
8. Form field count, explanation, error clarity, and completion friction.
9. Account-creation explanation: why secure Family/Student access needs an account.
10. Immediate post-signup activation path.
11. Trust/proof/testimonial placement.
12. Terms visibility and one-checkbox rule.
13. OG/social/WhatsApp link-preview card.
14. Tracking-event definitions without implementing them.

REQUIRED OUTPUTS

- ops/marketing/funnel/CURRENT-FUNNEL-AUDIT.md
- ops/marketing/funnel/HERO-CREATIVE-HANDOFF.md
- ops/marketing/funnel/COPY-AND-CTA-HANDOFF.md
- ops/marketing/funnel/ACTIVATION-JOURNEY-HANDOFF.md
- ops/marketing/funnel/MEASUREMENT-EVENT-SPEC.md
- ops/marketing/funnel/PR131-IMPLEMENTATION-PACKET.md

The implementation packet must:

- list exact repo files likely affected;
- separate required launch fixes from later experiments;
- identify conflicts with current source of truth;
- contain no direct code changes;
- require PR #131 owner acceptance before implementation.

PROPOSED EVENTS

- landing_view
- family_signup_started
- family_signup_complete
- first_student_created
- first_class_joined
- first_recording_started
- family_activated
- paid_continuation_started
- paid_conversion

No private Student data, raw names, emails, phone numbers, or content may enter analytics payloads.

DO NOT

- edit live/product code;
- deploy;
- change forms or copy;
- add trackers;
- create a second checkbox;
- change price/dates/CTA;
- run provider canaries.

RETURN

- top five conversion blockers;
- quick wins vs product changes;
- exact handoff paths;
- external effects, which must be zero.
```

---

# WORKER G — GHL, Facebook, Instagram, YouTube, and WhatsApp Scheduling Readiness

```text
ONE TIME MISHNAYOS — WORKER G
READ-ONLY SOCIAL/SCHEDULING READINESS

Repository: shloimie-beep/onetimev2
Parent: PR #183
Active product launch: PR #131 — READ ONLY

READ FIRST

- current PR #131 AGENTS.md
- ops/marketing/2026-08-13-launch-marketing-source-of-truth-v3.md
- Worker E Rabbi pack index when available

WRITE SCOPE

- ops/marketing/scheduling/** only

MODE

READ ONLY. Do not connect, disconnect, authorize, post, schedule, publish, broadcast, boost, spend, create campaigns, or change account settings.

MISSION

Determine current scheduling readiness and give exact human instructions so Shloimie and Rabbi Eli can connect/use GHL safely when the creatives are ready.

READBACK TARGETS

- Facebook Page connection to GHL Social Planner;
- connected Instagram professional account;
- YouTube channel connection;
- Rabbi’s Google/YouTube ownership level;
- available GHL destination/format support;
- custom thumbnail limitations;
- WhatsApp Status/manual forwarding/broadcast remains outside Social Planner;
- landing-page destination remains canonical.

IF A CONNECTION CANNOT BE READ

Return `UNVERIFIED` and provide an exact click-by-click checklist. Do not infer connected state.

REQUIRED OUTPUTS

- ops/marketing/scheduling/CURRENT-CONNECTION-READBACK.md
- ops/marketing/scheduling/RABBI-YOUTUBE-CONNECTION-INSTRUCTIONS.md
- ops/marketing/scheduling/GHL-SOCIAL-PLANNER-OPERATING-GUIDE.md
- ops/marketing/scheduling/WHATSAPP-DISTRIBUTION-GUIDE.md
- ops/marketing/scheduling/PRE-SCHEDULE-QA-CHECKLIST.md

LOCKED OPERATING RULES

- Facebook/Instagram/YouTube content may use GHL where supported.
- Rabbi should connect YouTube using the Google account with the ownership authority GHL requires.
- Every Short/Reel must have a strong first frame because thumbnail controls vary by platform/integration.
- WhatsApp Status, forwarding, and permissioned broadcasts always link to the landing page and are handled separately.
- No click-to-WhatsApp funnel.
- No Buffer.

DO NOT

- mutate GHL or social accounts;
- schedule even a test post;
- create a campaign;
- publish;
- send WhatsApp;
- change access/roles.

RETURN

- current verified/unverified connection state;
- exact operator steps;
- platform limitations;
- repo paths;
- external effects, which must be zero.
```

---

# WORKER H — Four-Week Calendar, Organic Winners, FX Scorecard, and Paid-Test Packet

```text
ONE TIME MISHNAYOS — WORKER H
CONTENT CALENDAR, WINNER SCORECARD, FX, AND PAID-TEST PLAN

Repository: shloimie-beep/onetimev2
Parent: PR #183
Active product launch: PR #131 — READ ONLY

DEPENDENCIES

- package IDs from Worker E;
- registry schema from Worker B;
- current research from Worker A;
- funnel event spec from Worker F;
- scheduling capability notes from Worker G.

WRITE SCOPE

- ops/marketing/measurement/**
- ops/marketing/calendar/**
- populate template rows only in ops/marketing/content-registry/performance.csv and fx-rates.csv when exact data is available

MISSION

Create a complete four-week organic operating calendar, fast provisional-winner method, dual-currency scorecard, and first paid-test packet. Do not publish or spend.

REQUIRED OUTPUTS

1. ops/marketing/calendar/2026-08-13-to-2026-09-11-calendar.csv

Columns:

date,week,creative_id,package_id,hook,format,platform,organic_or_paid,planned_time,status,landing_url,utm_source,utm_medium,utm_campaign,utm_content,owner,notes

2. ops/marketing/calendar/WEEK-1.md through WEEK-4.md

3. ops/marketing/measurement/ORGANIC-WINNER-SCORECARD.csv

Columns:

creative_id,platform,posted_at,three_second_views,average_watch_seconds,completion_rate,shares,forwards,landing_clicks,registrations,activations,registration_rate,activation_rate,provisional_rank,decision,notes

4. ops/marketing/measurement/PAID-TEST-PACKET.md

Lock:
- days 1–3 initial organic screen;
- days 4–7 choose approximately three provisional winners;
- days 8–14 confirm/refine;
- $300–$500 learning budget;
- $30–$50/day total;
- same audience and landing page;
- one main variable at a time;
- zero live spend from this worker.

5. ops/marketing/measurement/FX-AND-UNIT-ECONOMICS.xlsx is NOT required. Use CSV/Markdown only.

Create:
- ops/marketing/measurement/FX-AND-UNIT-ECONOMICS.md
- ops/marketing/measurement/BUDGET-SCENARIOS.csv

Budget scenarios should include USD and date-stamped ILS reference fields for:
- $300;
- $500;
- $1,000;
- $1,500;
- $5,000.

6. ops/marketing/measurement/METRIC-DEFINITIONS.md

Define in plain language:
- impression;
- reach;
- three-second view;
- completion rate;
- landing click;
- registration;
- activation;
- paid conversion;
- registration CPA;
- activation CPA;
- paid CAC;
- contribution LTV;
- payback period;
- LTV:CAC.

WINNER HIERARCHY

Rank primarily by:

1. completed Family registrations;
2. activated Families;
3. landing-page click rate;
4. qualified shares/forwards;
5. watch retention/completion;
6. raw views.

Do not select winners solely by views.

UTM STANDARD

Use stable, readable values such as:

utm_source=facebook|instagram|youtube|whatsapp
utm_medium=organic_social|paid_social|status|forward|broadcast
utm_campaign=otm_launch_20260816
utm_content=<creative_id_lowercase>

Do not put names, emails, phone numbers, Student information, or other personal data in URLs.

DO NOT

- publish;
- schedule;
- create Meta campaigns;
- spend;
- fetch private customer data;
- change product tracking code.

RETURN

- calendar paths;
- scorecard paths;
- budget scenarios;
- provisional winner rules;
- missing measurement dependencies;
- external effects, which must be zero.
```

---

# ORCHESTRATOR FINAL INTEGRATION PROMPT

```text
ONE TIME MISHNAYOS — WORK ULTRA FINAL INTEGRATION

Read all Worker A–H terminal outputs.

Do not redo completed work.

Perform only:

1. scope/conflict check against the latest PR #131 authority;
2. registry consistency and validator run;
3. Drive readback/count verification;
4. cross-link package IDs, asset IDs, calendar IDs, and measurement IDs;
5. create/update runtime records under:
   ops/marketing/runtime/2026-08-13-marketing-v3/**
6. create one final index:
   ops/marketing/LAUNCH-MONTH-OPERATING-INDEX.md
7. commit and push the child branch;
8. open/update the draft child PR targeting PR #183 branch.

No publishing, scheduling, broadcast, provider mutation, product code, deployment, or ad spend.

FINAL RETURN

- exact branch and draft PR;
- latest PR #131 authority readback;
- worker status table;
- Drive root and key folder links;
- source/moment/clip/package counts;
- registry validation result;
- research/funnel/scheduling/calendar/measurement paths;
- blockers;
- exact external effects;
- one next action for Shloimie;
- one next action for Rabbi Eli.
```
