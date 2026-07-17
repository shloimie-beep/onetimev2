# W12-03 — Parent and student Portal Test Lab

## Outcome

Give the operator a complete, visible parent/student experience using separate safe test identities and representative content. Do not make the admin identity double as a parent and do not implement impersonation.

## Base/isolation

Target `webcraft-media/onetimev2`; dynamically select current accepted release source; create clean branch/worktree `codex/w12-03-portal-test-lab`.

## Required journeys

Create a staging/test-only, idempotent Portal Test Lab that provisions fictional data through normal domain services:

- one fictional household;
- one fictional parent login;
- up to three fictional learner profiles;
- one separate learner login per learner;
- one scheduled class and protected join state;
- one recorded lesson/library item;
- one review sheet/output;
- progress/attendance/reward example;
- one private learner question/helper example;
- billing shown explicitly as synthetic/test or unavailable—not real.

Parent journey: activate/login, view household and children, create/reset/suspend/restore learner access, view schedule/content/progress/billing/support, launch a protected learner-class action without entering the child session.

Student journey: direct login resolves exactly one learner, view only own dashboard/class/library/review/rewards/questions/helper, no sibling enumeration or raw provider URLs.

Admin journey: an owner/admin-only Test Lab page shows generated test identities by non-secret label, reset/reseed/status actions, and safe links to login pages. It must never reveal current passwords/secrets or enter another role’s session. Use protected handoff or one-time activation/reset links outside Git.

## UX/testing

Use the canonical product shell/brand on 360, 390, 768, and 1440 widths. Add complete loading/empty/error/offline/session-expiry states, accessibility, keyboard/focus, privacy cache controls, and negative role/sibling tests. Capture screenshots with fictional data only.

## Continuity/safety

Maintain task artifacts under `ops/codex-runs/W12-03/`. Finish fixtures/tests if staging access is absent. No production users, email send, database mutation, deploy, or raw credential evidence. Document shared server/navigation/migration hotspots. Commit, push, open draft PR.
