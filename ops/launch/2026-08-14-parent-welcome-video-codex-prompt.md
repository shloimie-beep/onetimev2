# One Time — Parent Welcome Video Codex Handoff

Paste the prompt below into the existing PR #131 controller. It is an ownership/readback and bounded implementation handoff. Do not open a duplicate worker when an existing Parent/portal/content worker can own the delta.

```text
ONE TIME — ADD THE PARENT WELCOME VIDEO TO THE CURRENT PARENT COMPANION PLAN

Repository:
shloimie-beep/onetimev2

Sole product integration authority:
PR #131
codex/one-time-complete-production-launch-20260805

Control/source decisions:
PR #183

FIRST RE-FETCH CURRENT STATE

Read:

1. current PR #131 AGENTS.md, STATUS, and EXECPLAN;
2. current PR #131 head and currently active Parent/portal/content workers;
3. PR #183;
4. ops/v2.1-execution/source-spec/00-OPERATOR-DECISION-OVERRIDE-20260813-PARENT-COMPANION.md;
5. ops/v2.1-execution/source-spec/00-OPERATOR-DECISION-OVERRIDE-20260814-PARENT-WELCOME-VIDEO.md;
6. ops/marketing/2026-08-13-parent-companion-pipeline-email-and-rabbi-voice-amendment.md;
7. apps/web/src/client/app/parent/summary/ParentSummaryWorkspace.tsx;
8. apps/web/src/client/app/parent/updates/ParentUpdates.tsx;
9. packages/contracts/src/portals/parent-summary/index.ts;
10. existing protected content/player contracts and Parent authorization boundaries.

DO NOT OPEN A DUPLICATE WORKER

First identify whether an existing Parent Companion, Parent portal, content, or onboarding worker already owns these files. If so, append this exact requirement to that worker and return ownership. If not, create one fresh bounded branch from the current PR #131 head.

LOCKED PRODUCT REQUIREMENT

After successful Family signup:

Family account committed
→ Parent session established
→ Parent Companion opens
→ approved approximately 90-second horizontal welcome video is the first prominent content
→ Parent can add the first Student
→ Student begins learning

The same video must be the pinned featured item above the normal feed on:

/app/parent/updates

Ordinary updates remain newest-first below it. Newer notices/newsletters/reminders may not displace the welcome video.

ASSET IDENTIFICATION

The exact approved video has not yet been named in this prompt.

Do not guess.

Inspect only approved One Time sources, including the new Mishnayos New folder and existing approved promo/source folders, and return a short candidate list limited to horizontal videos between 60 and 120 seconds.

For each candidate return:

- Drive file ID/link;
- filename;
- duration;
- dimensions;
- orientation;
- size;
- checksum when available;
- one-sentence visual/content description;
- rights/approval state.

Stop before binding an asset unless the exact operator-approved video is already unambiguously identified in current source-of-truth evidence.

IMPLEMENTATION SHAPE

Do not hardcode a Vimeo or Drive URL into ParentUpdates.tsx.

Add a governed Parent welcome-media/content slot and a Parent-authorized playback descriptor.

Prefer a separate featured/onboarding field in the Parent summary contract rather than overloading the existing text-only ParentUpdate kind.

Required behavior:

- 16:9 responsive frame;
- preserve horizontal composition;
- autoplay muted and inline when permitted;
- never autoplay sound;
- reduced-motion disables forced autoplay;
- truthful poster/play fallback;
- visible controls and sound affordance;
- captions when approved track exists;
- keyboard and screen-reader accessibility;
- stable aspect-ratio box and no layout shift;
- no raw provider URL/bearer in browser-visible data;
- Parent-specific authorization and cross-household denial;
- safe unavailable state if the content slot is unset or revoked.

FIRST-SESSION CTA

Below or adjacent to the video, prioritize:

1. ADD YOUR FIRST STUDENT
2. SEE THE NEXT CLASS / truthful current learning action
3. GET HELP

Do not bury Student setup under unrelated dashboard options.

TRACKING

Implement idempotent household-scoped events:

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

Do not count an impression or immediate muted autoplay start as meaningful activation.

Record parent.companion_activated on the first verified meaningful Parent action, initially:

- at least 10 seconds of visible welcome-video playback; or
- protected Parent class/library open; or
- Parent-labeled question submission.

Parent playback must not increment Student attendance, streak, badge, or progress.

REPORTING

Provide operator-readable counts and adjacent-step percentages for:

signup
→ Parent portal open
→ video start
→ 25%
→ 50%
→ 75%
→ completion
→ Add Student click
→ Student creation
→ first Student learning
→ engaged Family

GHL HANDOFF

Do not mutate GHL from this worker.

Emit/define the application-side adult-household projection needed for:

OT Parent Portal Opened At
OT Welcome Video Started At
OT Welcome Video Completed At
OT Add Student Clicked At

Preserve no Student GHL contacts.

TEST AND ACCEPTANCE

Prove:

- authenticated Parent first session;
- zero-Student state;
- pinned Updates placement;
- future update ordering;
- 390px, 768px, and desktop rendering;
- autoplay/fallback/reduced-motion behavior;
- captions/keyboard/a11y;
- Parent authorization and cross-household denial;
- no raw provider leakage;
- event dedupe and percentages;
- no Student progress mutation;
- Add Student CTA destination;
- safe unset/revoked media behavior.

BOUNDARIES

- PR #131 remains the only integration/deployment authority.
- Do not duplicate the issue #172 protected Library canary.
- Do not repeat a Vimeo upload/transcription effect.
- Do not change GHL pipelines/workflows.
- Do not publish, deploy, or bind an uncertain asset.
- Do not alter Zoom, Telegram, billing, or marketing-media lanes.

RETURN

1. exact current owner/worker;
2. current Parent Updates implementation truth;
3. exact approved asset or candidate list;
4. bounded file/write scope;
5. branch/PR if implementation begins;
6. contract and playback design;
7. event/reporting design;
8. tests/proof;
9. blockers;
10. one operator action required from Shloimie.
```
