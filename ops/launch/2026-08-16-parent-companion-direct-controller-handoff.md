# One Time — Direct Parent Companion Controller Handoff

**Date:** 2026-08-16  
**Status:** Current operator handoff  
**Product integration authority:** PR #131 only  
**Decision source:** PR #183

## Why this handoff exists

The Parent Companion decisions are committed on the PR #183 control branch, not yet on the active PR #131 product branch. A controller working only from the PR #131 checkout will not see them unless it explicitly fetches and reads PR #183 or this handoff.

## Required reading

Read these files from branch `chatgpt/one-checkbox-and-launch-marketing-v2-20260813` / PR #183:

1. `ops/v2.1-execution/source-spec/00-OPERATOR-DECISION-OVERRIDE-20260813-PARENT-COMPANION.md`
2. `ops/v2.1-execution/source-spec/00-OPERATOR-DECISION-OVERRIDE-20260814-PARENT-WELCOME-VIDEO.md`
3. `ops/marketing/2026-08-13-parent-companion-pipeline-email-and-rabbi-voice-amendment.md`
4. `ops/launch/2026-08-14-parent-welcome-video-codex-prompt.md`

## Locked Family offer

> **One Parent Companion identity plus up to three separate Student identities.**

The Parent Companion does not consume one of the three Student seats.

## Parent Companion capabilities

The authenticated Parent must be able to:

1. See and manage the household's Student accounts.
2. Create up to three Students.
3. View each Student's status, username, setup state, and Parent-safe progress.
4. Reset or replace a dependent Student's six-digit PIN and handle Student login/support issues.
5. Open the canonical class through a protected Parent-specific classroom/join action.
6. View approved recordings and review material through a protected Parent-specific library projection.
7. Ask Rabbi Eli a Parent-labeled question or communicate privately with him.
8. See Parent-safe attendance, progress, badges, accomplishments, and Family-visible updates for dependent Students.
9. Receive an alert when a dependent Student item is explicitly approved/published for Family visibility.
10. Add one simple Parent acknowledgment, such as a heart, to an explicitly Family-visible dependent-Student item.
11. Open support and manage dependent Student technical problems.

## Critical classroom-link rule

The Parent may receive a protected **Join class** action or first-party route.

Do **not** expose, email, store in client-visible data, or display a raw Zoom URL or provider credential. Parent classroom access must use the same governed entitlement/redirect model as other protected access, scoped to the Parent identity and household.

## Privacy and attribution boundaries

- Students retain separate identities, usernames, and PINs.
- Parent access is attributed to the Parent identity.
- Parent viewing must not create Student attendance, streaks, badges, or progress.
- Private Student questions and Rabbi replies remain private by default.
- A Parent sees a dependent Student question/accomplishment only after explicit Family-visible publication/share.
- A Parent never sees another household's private information.
- No Student becomes a HighLevel contact.

## First-session flow

```text
Family signup committed
→ Parent session established automatically
→ Parent Companion home opens
→ approved ~90-second horizontal welcome video is first prominent content
→ Parent can open the real learning experience
→ Parent adds first Student
→ Student signs in and begins learning
```

The first Parent screen should prioritize:

1. `SEE ONE TIME NOW`
2. `ADD YOUR FIRST STUDENT`
3. `GET HELP`

The welcome video must also remain pinned above normal updates at `/app/parent/updates`.

## Required product events

Implement distinct, idempotent, household-scoped events:

- `family.account_created`
- `parent.portal_opened`
- `parent.welcome_video_impression`
- `parent.welcome_video_started`
- `parent.welcome_video_25_percent`
- `parent.welcome_video_50_percent`
- `parent.welcome_video_75_percent`
- `parent.welcome_video_completed`
- `parent.add_student_clicked`
- `parent.companion_activated`
- `parent.first_question_submitted`
- `student.created`
- `student.first_learning_started`
- `family.engaged`
- `student.item_published_to_family`
- `parent.family_item_reacted`

## Current implementation surfaces to audit

At minimum inspect:

- Parent route/session and first post-signup destination;
- Parent overview;
- Parent Student management;
- Parent schedule/class detail;
- Parent Updates;
- Parent progress and badges;
- Parent support;
- Student question visibility/publication states;
- protected classroom redirect/join contract;
- protected library/playback contract;
- notifications;
- GHL household lifecycle event projection.

Known current files include:

- `apps/web/src/client/app/portal-entry.tsx`
- `apps/web/src/client/app/parent/summary/ParentSummaryWorkspace.tsx`
- `apps/web/src/client/app/parent/updates/ParentUpdates.tsx`
- `packages/contracts/src/portals/parent-summary/index.ts`

Do not assume these are the only affected files.

## Acceptance requirements

Before production acceptance, prove:

1. Parent remains authenticated after signup.
2. A zero-Student Parent reaches a useful Parent Companion home, not a dead end.
3. Parent can see/manage up to three Student identities.
4. Parent can reset a dependent Student PIN.
5. Parent can open the protected class through a Parent-scoped action.
6. No raw Zoom/provider link is exposed.
7. Parent can view an approved recording through Parent-scoped protected playback.
8. Parent viewing does not alter Student progress.
9. Parent can submit a Parent-labeled question to Rabbi Eli.
10. Parent cannot see private Student questions or another household's information.
11. Parent receives Family-visible alerts only after explicit publication/share.
12. Parent can react once, idempotently, to a Family-visible dependent item.
13. Welcome video is first prominent content and pinned in Updates.
14. Mobile and desktop onboarding have no repeated-login or dead-end step.
15. No Student HighLevel contact is created.

## Integration rule

Do not let PR #183 implement product code directly. The PR #131 controller must:

1. read these decisions;
2. identify any current worker already owning Parent portal/onboarding/content files;
3. append this scope to that worker or create one bounded current-head worker if none exists;
4. reconcile conflicts with older DEC-016, DEC-017, and DEC-022;
5. integrate only through PR #131 with focused authorization, privacy, browser, event, rollback, and deployment proof.
