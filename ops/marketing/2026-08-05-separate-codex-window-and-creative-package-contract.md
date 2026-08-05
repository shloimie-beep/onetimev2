# One Time Mishnayos — Separate Codex Window and Creative Package Contract

**Date:** 2026-08-05  
**Parent packet:** `ops/marketing/2026-08-05-one-time-organic-marketing-and-capcut-asset-prep.md`  
**Parent PR:** #132  
**Active product-launch PR:** #131  
**Status:** Bounded marketing-media lane; no product or provider authority

## 1. Separate Codex Window Is Required

This work must run in a **separate Codex window and separate git worktree** from the active complete-production launch window.

The active product-launch lane in PR #131 owns application code, shared hotspots, integrations, deployment, provider configuration, production canaries, and final acceptance. The marketing-media lane is a non-overlapping bounded lane. It owns only:

- read-only inspection of the approved Drive source media;
- creation of new derivative marketing clips, stills, contact sheets, manifests, and edit instructions;
- documentation under `ops/marketing/**` on its own branch;
- preparation of creative packages for Shloimie's review.

It does not own application source, migrations, tests, landing-page behavior, GHL, Meta, Google, YouTube, Vimeo, Stripe, Railway, DNS, contacts, campaigns, messages, access, payments, or deployment.

## 2. Exact Git / Worktree Protocol

The new Codex window must:

1. Fetch current remote state.
2. Read the current `AGENTS.md` from PR #131 and confirm the current PR #131 head.
3. Read PR #132 and both marketing packet files.
4. Create an isolated worktree and child branch from PR #132 head, for example:

```text
codex/one-time-marketing-creative-packages-20260805
```

5. Keep the child branch scoped to:

```text
ops/marketing/**
```

and references/manifests for newly created Drive derivatives.

6. Open a draft child PR targeting:

```text
chatgpt/one-time-marketing-asset-prep-20260805
```

7. Do not merge, rebase, retarget, or push to PR #131.
8. Do not use the same local checkout or dirty worktree as the active launch Codex window.
9. If the launch branch changes while this lane runs, re-read authority but continue only the non-overlapping media scope.
10. Stop and report a collision if another worker is editing the same `ops/marketing/**` result paths or the same Drive derivative folder.

This child-PR structure is deliberate:

```text
PR #131 — active complete-production launch
  └── PR #132 — marketing strategy and asset-prep authority
       └── child PR — actual media-package results and manifests
```

## 3. What “Package Each Video” Means

Do not hand Shloimie a pile of anonymous clips. Every planned social video must have a named, self-contained **Creative Package**.

A Creative Package is the complete production bundle for one publishable concept. It contains the video plan, exact source clips, static derivatives, copy, rights status, and review material.

### Creative Package ID

Use stable IDs:

```text
OTM-CP-001
OTM-CP-002
OTM-CP-003
```

### Package folder contract

```text
OTM-CP-001-what-if-he-looked-forward/
  00-brief/
    creative-brief.md
    audience-and-objective.md
    approved-claims.md
  01-source-selects/
    selects.csv
    source-manifest.csv
    contact-sheet.jpg
  02-clean-clips/
    rabbi/
    board-device/
    class-wide/
    students-rights-safer/
    screens-sefarim/
    voice-bites/
  03-video-build/
    30s-sequence.md
    capcut-build-sheet.md
    capcut-natural-language-prompt.txt
    captions.srt
  04-static-derivatives/
    feed-portrait/
    square-backup/
    story-vertical/
    carousel/
    cover-thumbnail/
  05-copy/
    facebook-caption.txt
    short-caption.txt
    headline-options.txt
    story-copy.txt
    alt-text.txt
    cta-status.txt
  06-rights-identity/
    rights-and-identity-status.csv
    blocked-assets.csv
  07-review/
    REVIEW-ME-FIRST.md
    preview-contact-sheet.jpg
    decision-log.md
```

The package can contain edit-ready media and instructions without containing a final rendered ad. The first human approval happens before the final CapCut render.

## 4. Initial Batch Size

Do not fully package all fourteen hooks at once. That would repeat the earlier overproduction problem.

### Batch 01 — fully package now

Create three complete packages:

| Package | Opening hook | Variable changed |
|---|---|---|
| `OTM-CP-001` | What if he looked forward to Mishnayos? | Hook only |
| `OTM-CP-002` | A real rebbe changes the screen. | Hook only |
| `OTM-CP-003` | One perek. One clear accomplishment. | Hook only |

The body footage, voice bites, music plan, duration, proof sequence, and CTA remain the same across these three packages.

### Remaining hooks

Create compact queued concept cards for hooks 4–14, but do not cut or fully package them yet. Each queued card should contain:

- hook;
- audience tension/desire;
- best likely source category;
- proof required;
- static-image concept;
- possible objection;
- blocked claim or rights question;
- status `queued_after_batch_01_results`.

## 5. Static Images Are Part of Every Package

The strategy is not “video only,” and it is not “make a pile of flyers.”

Each Creative Package must include static derivatives built from the same central concept as the video. This lets one approved idea become several posts without inventing unrelated content.

### Required static derivatives

1. **Photo-led hook card**
   - Real Rabbi/class/student image or original video frame.
   - One short hook, generally three to seven words.
   - Large black/yellow type.
   - Minimal supporting copy.

2. **Proof card**
   - Real board, sefer, class, slide, or portal screenshot.
   - One concrete program fact.
   - No overloaded list of features.

3. **Story image**
   - Vertical composition.
   - One question, poll prompt, hook, or CTA.
   - Large readable text with uncluttered safe areas.

4. **Cover / thumbnail**
   - Used for the Reel/Short cover or YouTube thumbnail when applicable.
   - One face or one clear class moment.
   - No tiny explanatory copy.

5. **Optional carousel**
   - Three to five panels.
   - Suggested flow: hook → real experience → proof → parent benefit → CTA.

### Working production formats

Use these as the internal production sizes unless the platform changes before export:

| Use | Working format |
|---|---|
| Facebook/Instagram feed portrait | 1080 × 1350 |
| Square backup/share image | 1080 × 1080 |
| Story/Reel cover | 1080 × 1920 |
| Facebook link/share card | 1200 × 630 |
| YouTube thumbnail | 1280 × 720 |

Re-check the destination platform immediately before final export.

## 6. Flyer Policy

True flyers are a minority format.

Use a flyer only when the information itself is the reason to post:

- launch date;
- class time;
- enrollment deadline;
- free-access deadline;
- pricing or plan announcement;
- event invitation;
- schedule change.

Do not turn normal organic content into text-heavy flyers. Most static output should feel like a strong photograph or real class moment with a sharp headline.

### Target static mix

- approximately 45% real-photo hook cards;
- approximately 25% proof cards and real screenshots;
- approximately 20% quote/story/accomplishment cards;
- no more than approximately 10% true informational flyers, unless an active launch event requires more.

This is a production target, not a permanent algorithm rule.

## 7. Image Source Priority

Use sources in this order:

1. Original Rabbi teaching video frames.
2. Original Rabbi headshots.
3. Original class photographs.
4. Original slides, board/device views, sefarim, and portal screenshots.
5. Approved graphic elements and logos.

Do not use generated or altered Rabbi faces. Do not use generated students. Product-page lifestyle illustrations approved elsewhere in PR #131 are not identity sources and are outside Batch 01 unless Shloimie explicitly approves them for a specific static concept.

Every face-bearing static output must preserve:

- original Drive ID;
- original filename;
- source video timecode when applicable;
- rights status;
- identity-integrity status.

## 8. Recommended Publishing Output From One Concept

One approved concept should normally produce:

- one 20–30 second vertical master;
- one 7–12 second micro-cut;
- one feed portrait static image;
- one Story image;
- one cover/thumbnail;
- one caption set;
- optionally one carousel.

This supports three or four daily outputs **across surfaces**, not four separate hard-sell feed posts on the same Facebook Page.

Suggested initial distribution:

- Facebook Page feed: one primary post daily; occasionally a second lighter post;
- Facebook/Instagram Stories: one or two derivatives daily;
- YouTube Shorts: one vertical video daily when the channel is ready;
- static/carousel posts: rotate between video days rather than competing with every video at the same moment.

## 9. Batch 01 Static Concepts

### OTM-CP-001 — What if he looked forward to Mishnayos?

- Primary image: excited student/class reaction with Rabbi visible where possible.
- Backup image: Rabbi smiling with the classroom behind him.
- Static headline: `LOOKING FORWARD TO MISHNAYOS?`
- Proof line: `A real live class. One perek at a time.`

### OTM-CP-002 — A real rebbe changes the screen.

- Primary image: Rabbi pointing at the Mishnah text or teaching screen.
- Backup image: wide class image showing the hybrid screen/class experience.
- Static headline: `A REAL REBBE CHANGES THE SCREEN.`
- Proof line: `Live from Eretz Yisrael. Available on demand.`

### OTM-CP-003 — One perek. One clear accomplishment.

- Primary image: sefer plus Rabbi teaching or a clear Mishnah slide.
- Backup image: child engaged with the lesson.
- Static headline: `ONE PEREK. ONE CLEAR ACCOMPLISHMENT.`
- Proof line: `Steady learning. Real progress.`

All CTA copy remains provisional until the live landing behavior is re-verified.

## 10. Completion Criteria for the Separate Window

The separate Codex window is complete only when:

1. it proves it used a separate worktree and child branch;
2. it records the current PR #131 head it read without modifying PR #131;
3. it creates three complete Batch 01 Creative Packages;
4. it creates queued concept cards for hooks 4–14;
5. each complete package contains both video and static derivatives;
6. each package includes exact source IDs and timecodes;
7. real images and real video frames are prioritized over flyer graphics;
8. unknown-rights material is blocked from the review-ready package;
9. no face is generated or altered;
10. no original Drive file is moved, renamed, changed, or deleted;
11. no social post, campaign, ad, or provider action occurs;
12. the child PR changes only result documentation under `ops/marketing/**`;
13. the handoff gives Shloimie one review page per package and one exact next decision.

## 11. Launcher Prompt for the Separate Codex Window

```text
SEPARATE CODEX WINDOW — ONE TIME CREATIVE PACKAGE LANE

This is a separate bounded marketing-media window. Do not run this inside the active complete-production launch worktree.

Repository: shloimie-beep/onetimev2
Active product launch: PR #131
Marketing parent: PR #132

First:
1. fetch current remote state;
2. read current AGENTS.md from PR #131;
3. record the current PR #131 head;
4. read these two files from PR #132:
   - ops/marketing/2026-08-05-one-time-organic-marketing-and-capcut-asset-prep.md
   - ops/marketing/2026-08-05-separate-codex-window-and-creative-package-contract.md

Create a separate worktree and a child branch from PR #132 head named approximately:

codex/one-time-marketing-creative-packages-20260805

Open a draft child PR targeting:

chatgpt/one-time-marketing-asset-prep-20260805

Do not modify, merge, rebase, retarget, or push to PR #131. Do not use the launch window's checkout or dirty worktree.

Execute only the bounded marketing-media scope:

- inspect the three exact pilot source videos listed in the parent packet;
- prepare the shared Quick-Cut Kit;
- create three complete Batch 01 Creative Packages:
  OTM-CP-001, OTM-CP-002, and OTM-CP-003;
- create compact queued concept cards for hooks 4–14;
- include both video-edit packages and static-image derivatives in every complete package;
- prioritize original Rabbi teaching footage, original headshots, original class photos, board/device views, sefarim, slides, and real screenshots;
- make photo-led posts, proof cards, Story images, covers/thumbnails, and optional carousels;
- use true flyers only for schedule, price, deadline, or event information;
- create Drive derivatives only in the bounded new package folders;
- write result manifests and handoffs only under ops/marketing/** on the child branch.

Do not:
- edit application code, migrations, tests, landing-page behavior, configuration, or product copy;
- mutate Railway, GHL, Meta, Google, YouTube, Vimeo, Stripe, DNS, contacts, campaigns, messages, access, or payments;
- publish, schedule, boost, or run ads;
- move, rename, change, or delete original Drive files;
- create or alter faces;
- use generated students;
- add unlicensed music;
- expose private student or family data;
- use unsupported claims or an unverified CTA.

Return:
1. separate worktree and branch proof;
2. current PR #131 authority readback;
3. exact Drive source inventory;
4. shared Quick-Cut Kit location;
5. OTM-CP-001, OTM-CP-002, and OTM-CP-003 locations;
6. video selects, static derivatives, copy, rights status, and review sheet for each package;
7. queued cards for hooks 4–14;
8. all blockers;
9. external-effect counts;
10. one exact next review action for Shloimie.

Do not solve the full marketing system. Complete only Batch 01 and its reusable package structure.
```
