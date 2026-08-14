# One Time Operator Decision Override — Parent Welcome Video and Activation Funnel

**Decision ID:** `OT-CTRL-20260814-PARENT-WELCOME-VIDEO`  
**Decision date:** 2026-08-14  
**Operator:** Shloimie Dratler  
**Status:** **LOCKED OPERATOR REPLACEMENT — SOURCE OF TRUTH**  
**Integration authority:** PR #131 only

## Purpose

Reduce the immediate post-signup drop-off by giving the Parent a compelling, concrete One Time experience before requiring Student setup.

The approved onboarding asset is an approximately **90-second horizontal/landscape introduction video**. It introduces the One Time Mishnayos experience and must become the first prominent content shown to a newly registered Parent.

The exact approved source file/Drive ID must be selected or confirmed by Shloimie. Codex must not guess the asset from a filename or silently bind an uncertain source.

## Locked first-session experience

After a successful Family signup:

```text
Family account committed
→ Parent session established automatically
→ Parent Companion home opens
→ Welcome video is the first prominent content
→ Parent sees the real One Time experience
→ Parent can add the first Student
→ Student signs in and begins learning
```

The Parent must not be sent to a dead-end dashboard or required to sign in again.

## Parent Updates placement

The welcome video must also appear as the **pinned featured item at the top of the Parent Updates section**.

Rules:

- The welcome video is rendered above the ordinary chronological update feed.
- A later notice, newsletter, or reminder does not push the welcome video below the fold.
- Ordinary updates remain sorted newest-first beneath the featured item.
- The welcome video is modeled as a dedicated featured/onboarding media slot, not disguised as an ordinary text-only notice.
- During the initial launch, the welcome video remains available through Parent Updates for replay.
- For a zero-Student/new Parent, the welcome card opens expanded.
- After the Parent watches substantially or creates a Student, the interface may reduce it to a compact replay card, but it must remain easy to reopen.

## Video presentation

The approved video is horizontal and must retain its intended 16:9 composition.

Required behavior:

- responsive 16:9 frame on desktop, tablet, and mobile;
- no vertical crop or face-cutting conversion;
- inline playback;
- autoplay **muted** when the browser, reduced-motion preference, and data conditions permit;
- never autoplay with sound;
- visible controls and a clear sound/unmute affordance;
- poster image/first frame before playback;
- captions available and enabled by default when the approved caption track exists;
- keyboard-accessible playback and controls;
- truthful fallback poster plus Play action when autoplay is blocked;
- no raw Vimeo URL, provider bearer, or unscoped Drive URL in client-visible data;
- use the existing first-party/protected playback boundary or an equally governed Parent-specific playback descriptor.

The video must not delay the Parent shell behind a large blocking download. Use a poster as the initial visual, bounded metadata/adaptive loading, and a stable layout with no cumulative layout shift.

## First-session actions

The welcome card must make the next actions obvious:

1. **ADD YOUR FIRST STUDENT** — primary setup action for a zero-Student household.
2. **SEE THE NEXT CLASS** or the truthful current learning action — secondary action when the Parent learning surface is ready.
3. **GET HELP** — direct route for login/access problems.

Do not bury Student setup after unrelated dashboard options.

## Activation and conversion measurement

Record distinct, idempotent, household-scoped events:

```text
family.account_created
parent.portal_opened
parent.welcome_video_impression
parent.welcome_video_started
parent.welcome_video_25_percent
parent.welcome_video_50_percent
parent.welcome_video_75_percent
parent.welcome_video_completed
parent.add_student_clicked
student.created
student.first_learning_started
family.engaged
```

Rules:

- An impression does not count as activation.
- An autoplay start alone does not count as meaningful activation.
- `parent.companion_activated` is recorded when the Parent performs a verified meaningful action, initially defined as the first of:
  - at least 10 seconds of visible welcome-video playback;
  - opening the protected Parent class/library experience;
  - submitting a Parent-labeled question.
- `parent.welcome_video_completed` may use a truthful completion threshold such as 90% watched rather than requiring the final media frame.
- All milestone events are deduplicated per household, Parent, video version, and event type.
- Parent video activity must never create Student attendance, streak, badge, or progress.

Required launch funnel reporting:

```text
Family signup
→ Parent portal opened
→ Welcome video started
→ 25%
→ 50%
→ 75%
→ completed
→ Add Student clicked
→ Student created
→ Student first learning
→ Engaged Family
```

The report must show both counts and conversion percentages between adjacent steps.

## GHL projection

One Time remains authoritative for product and viewing events. GHL receives only the adult/household projection required for lifecycle communication.

Recommended household-opportunity fields:

```text
OT Parent Portal Opened At
OT Welcome Video Started At
OT Welcome Video Completed At
OT Add Student Clicked At
```

The detailed 25/50/75 playback events may remain in One Time analytics/marketing registry unless a demonstrated GHL workflow requires them.

Projected lifecycle behavior:

```text
family.account_created
→ Family Account Created — Parent Not Activated

parent.companion_activated
→ Parent Companion Activated — Student Setup Pending

student.created
→ Student Created — Not Yet Learning
```

No Student HighLevel contact is created.

## Email implication

The first Family email should send the Parent to the Parent Companion experience and describe the short welcome video as the easiest way to understand One Time.

The Student-setup email should follow only after the Parent has meaningfully activated the Parent Companion experience and no Student exists.

Do not tell a Parent to sign in again when the current browser session is already established.

## Content-source and safety boundary

Before binding the asset:

- identify the exact approved source file and checksum;
- verify duration, dimensions, orientation, audio, captions, and rights;
- verify the selected video is the intended approximately 90-second introduction;
- preserve the original source unchanged;
- create or reuse one governed content item/version;
- require Admin/operator approval before the item becomes the Parent welcome video;
- support safe replacement with a later approved version;
- preserve historical analytics by video/version ID.

If the exact source is not yet named, Codex should return a short candidate list of likely horizontal 60–120 second videos from approved One Time sources and stop before binding one.

## Current implementation fact to reconcile

The current Parent Updates contract supports only text-oriented `notice`, `newsletter`, and `reminder` records, and the mounted Updates UI renders a basic chronological text list. The implementation must add a governed featured-media contract rather than hardcoding a provider URL into the component.

## Acceptance requirements

Before production acceptance, prove on the exact candidate:

1. Successful signup leaves the Parent authenticated.
2. The Parent Companion home shows the approved welcome video as the first prominent content.
3. `/app/parent/updates` shows the welcome video pinned above normal updates.
4. Future/newer updates do not displace the pinned welcome item.
5. The video preserves 16:9 composition at 390px, 768px, and desktop widths.
6. Autoplay is muted and inline when permitted; blocked autoplay falls back truthfully.
7. Reduced-motion preference prevents forced autoplay.
8. Captions, controls, keyboard operation, and accessible labeling work.
9. No raw Vimeo/Drive/provider URL is exposed.
10. Parent playback is authorized and another household is denied without metadata leakage.
11. Video impression/start/quartile/completion events are idempotent and truthful.
12. Parent activation does not alter Student progress.
13. Add Student CTA reaches the authenticated first-Student path.
14. Funnel counts and adjacent-step percentages can be read back for an operator-owned canary.
15. No Student GHL contact is created.

## Integration boundary

This document records the product decision. It does not authorize PR #183 or a marketing/GHL worker to edit product code, configure providers, deploy, or mutate production.

Codex must implement or hand off the bounded product delta through PR #131, preserve active worker ownership, and avoid opening a duplicate Parent/portal/content worker if one already exists.