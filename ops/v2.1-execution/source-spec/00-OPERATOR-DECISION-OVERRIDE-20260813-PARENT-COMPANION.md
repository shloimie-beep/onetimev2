# One Time Operator Decision Override — Parent Companion Experience

**Decision ID:** `OT-CTRL-20260813-PARENT-COMPANION`  
**Decision date:** 2026-08-13  
**Operator:** Shloimie Dratler  
**Status:** **LOCKED OPERATOR REPLACEMENT — SOURCE OF TRUTH**  
**Integration authority:** PR #131 only

## Purpose

Reduce post-signup friction by making the adult Parent account immediately useful and visibly connected to the learning experience, while preserving separate Student identities, child privacy, and the three-Student Family allowance.

This decision replaces the prior launch model in which the Parent account could not access learning content or interact with Rabbi Eli Scheller.

## Role and seat model

Assignable authorization roles remain exactly:

- `admin`
- `parent`
- `student`

Do not create a fourth persisted role merely to implement this experience.

The standard Family membership now provides:

- **one Parent Companion identity**, using the adult Parent email/password login; plus
- **up to three separate Student identities**, each using its own Student username and six-digit PIN.

The Parent Companion identity does **not** consume one of the three Student seats. A normal Family can therefore have one Parent Companion plus three Students: four authenticated identities in the household.

## Parent Companion capabilities

The authenticated Parent receives a scoped Parent Companion experience that may include:

1. View the canonical live class through a protected Parent-specific launch path.
2. View approved recordings and review material through a protected Parent-specific library projection.
3. Ask Rabbi Eli a Parent-labeled question or send a private Parent communication.
4. See Parent-safe Family schedule, attendance, progress, badges, and accomplishments.
5. Create, archive, restore, and reset the credentials of up to three Students.
6. Receive notices when a dependent Student's question, answer, worksheet, badge, or accomplishment is explicitly approved or published for Family visibility.
7. React with a simple Parent acknowledgment, such as a heart, to a dependent Student item that has been explicitly published/shared to the Family.
8. Open technical support and manage dependent Student login/reset issues.
9. Receive Family review prompts and Parent-facing guidance from Rabbi Eli.

Parent learning activity must be attributed to the Parent identity. It must not fabricate Student attendance, Student streaks, Student badges, or Student progress.

## Privacy boundary

The Parent Companion experience does not make all Student activity visible.

- Private Student questions and Rabbi replies remain private by default.
- A Parent sees a dependent Student item only when the item has an explicit Family-visible or published state.
- Student-private drafts, unapproved questions, moderation notes, raw provider data, and other children's information remain hidden.
- Parent questions are labeled as Parent questions and remain separate from Student questions.
- A Parent reaction is allowed only on the Parent's own dependent Student's Family-visible item.
- One household never sees another household's private activity.

## First-session and activation flow

A Family signup creates a real Parent account and establishes the Parent browser session immediately when session creation succeeds.

The new first-session flow is:

```text
Family signup committed
→ Parent is automatically signed in
→ Parent Companion welcome/home opens immediately
→ Parent sees the real One Time learning experience
→ guided first-session tutorial
→ Parent creates the first Student
→ Student signs in and joins live or starts a recording
```

The Parent must receive immediate value before being forced through a long setup sequence.

The first Parent Companion screen should prioritize two clear actions:

1. **SEE ONE TIME NOW** — open the next class, current live state, approved first recording, or a truthful short product preview when no full learning item is available.
2. **ADD YOUR FIRST STUDENT** — create the dependent Student login.

The tutorial may point to:

- where to see the next class;
- where to add a Student;
- where to copy or reset the Student PIN;
- where to see progress and badges;
- where to ask Rabbi Eli a Parent question;
- where to request technical help.

Do not require the Parent to sign in again after successful signup. Email confirmation remains a receipt and return path, not an activation gate.

## Activation events

Record distinct, idempotent product events:

- `family.account_created`
- `parent.companion_viewed`
- `parent.first_learning_opened`
- `parent.first_question_submitted`
- `student.created`
- `student.first_learning_started`
- `family.engaged`
- `student.item_published_to_family`
- `parent.family_item_reacted`

Recommended definitions:

- **Parent Companion activated:** Parent opened the protected Parent learning/class experience or an approved recording.
- **Student activated:** at least one Student joined the live class or started an approved recording.
- **Family engaged:** the household completed the configured repeat-use threshold across separate learning sessions/days.

The exact engagement threshold must be recorded in one configuration/decision and used consistently by One Time and GHL.

## Parent-to-Rabbi and Rabbi-to-Parent communication

Rabbi Eli must be able to:

- see Parent-labeled questions and adult conversations;
- reply privately to the Parent;
- publish only an explicitly approved Family-safe item;
- receive Parent support/login incidents through the governed Telegram/Admin workflow.

The Parent must be able to reply without creating a Student contact in HighLevel or exposing Student credentials.

## Rewards, sponsorship, and Family interaction

Authorized for Parent Companion V1:

- Family-visible achievement alerts;
- Parent hearts/acknowledgments on Family-visible dependent Student items;
- Parent-facing review prompts;
- existing simple badge/progress summaries.

Authorized as a later bounded product extension, not a launch blocker:

- Parent-funded sponsorships or donated rewards;
- monetary contributions tied to achievements;
- configurable Family reward goals;
- richer Parent comments or Family discussion threads.

Those later monetary/reward capabilities require a separate billing, refund, abuse, moderation, child-safety, and audit design. They may not be improvised through comments, Telegram, or GHL.

## Superseded decisions

This override supersedes the conflicting portions of:

- `DEC-016` — Parent receives no class/library/question access;
- `DEC-017` — adult learning is available only through a Student seat;
- `DEC-022` — Parent may not access any Student/Rabbi interaction;
- the PR #183 amendment that classified all Parent/family participation as later only.

The following remain valid:

- Students retain separate identities and credentials.
- Students are never HighLevel contacts.
- Parent cannot see private Student questions or replies unless explicitly published/shared to that Family.
- One Parent/account-owner login remains the launch household-owner model unless separately changed.
- The standard Family allowance remains up to three Students.

## Acceptance requirements

Before production acceptance, prove on the exact candidate:

1. Successful signup leaves the Parent authenticated.
2. A zero-Student Parent sees the Parent Companion welcome rather than a dead-end dashboard.
3. Parent can open the authorized Parent learning/class experience without receiving Student entitlements.
4. Parent learning does not increment Student attendance, streaks, badges, or progress.
5. Parent can create the first Student and manage/reset the Student PIN.
6. Parent can submit a Parent-labeled question to Rabbi Eli.
7. Parent cannot see an unapproved/private Student question or another household's data.
8. Parent receives a Family-visible alert only after explicit publication/share.
9. Parent can react to a Family-visible dependent Student item once, idempotently.
10. Student retains separate login, class state, private questions, and progress.
11. Mobile and desktop onboarding are accessible and have no dead-end or repeated-login step.
12. No Student HighLevel contact is created.

## Integration boundary

This document records the product decision. It does not authorize PR #183 or a marketing/GHL worker to edit product code, deploy, alter providers, or mutate production.

Codex must first audit current Parent, Student, classroom, library, question, notification, badge, and household capabilities; return the exact implementation delta; and integrate only through PR #131 with focused privacy, authorization, migration, browser, and rollback proof.