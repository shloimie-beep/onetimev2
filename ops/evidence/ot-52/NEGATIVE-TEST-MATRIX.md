# OT-52P Negative Test Matrix

## Service Tests

- Fourth active learner is rejected with `LEARNER_LIMIT_REACHED`.
- Archived learner stops counting toward the active limit.
- Restoring an archived learner is rejected when three active learners already exist.
- Parent cannot read/update another household by changing IDs.
- Parent reward write cannot target another household learner by guessed learner key.
- Owner session cannot silently use parent portal actions.
- Student dashboard does not include another household learner.
- Student reward write is rejected.
- Credential adapter material leak is rejected with `SERVER_ERROR`.
- Raw external provider URL from adapter is rejected before serialization.
- Helper query without adapter returns `ADAPTER_UNAVAILABLE`.

## Router Tests

- Anonymous request returns 401 and `Cache-Control: no-store`.
- Wrong role and wrong product return privacy-safe forbidden responses.
- Write request without CSRF is blocked before service invocation.
- Student launch ignores body learner attempts and uses actor subject.

## UI Tests

- Parent UI excludes raw provider URLs and central shell assumptions.
- Student UI excludes sibling, billing, parent-control, CRM, and admin affordances.
- Permission/offline/partial-error/session-expired states expose alert/status roles.
- 30-sample static render harness stays under threshold.
