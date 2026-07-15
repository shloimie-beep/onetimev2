# OT-52P Student Journeys

Implemented as feature-local service/router/UI modules, not mounted in the live app.

## Covered

- Student dashboard derives learner only from `actor.student_learner`.
- Upcoming classes and class launch use protected descriptors.
- Library and review items are scoped to the resolved learner.
- Progress, reward balance, and updates are scoped to the resolved learner.
- Support preview is local only and reports `external_send_performed: false`.
- Helper is unavailable by default and does not provide a fake answer.

## Student-Safe UI Checks

- No sibling selector.
- No billing, household-management, archive/restore, student-access setup, CRM, admin, or "view as" controls.
- No raw provider URLs or provider copy in rendered markup.
