# P22 Corrected Ready-for-Review Handoff

## Identity

- Branch: `codex/v21-p22-learning-engagement`
- Correction claim checkpoint:
  `0430569088aeb4f244e5540dddf778b72525bc64`
- Corrected implementation SHA before this metadata commit:
  `459e9187500477312a69542fc2b1e7d2fc552dd3`
- Corrected implementation artifact digest:
  `2552e3b9211f596e3739945fb9f4766527706eddf5fcb755338426ff572af967`
- Reconciled containing control:
  `ddef233830979fd2a0e2d3a146bdd389b23a9c84`
- Claim: `e2ac53ae-128f-4d0c-b9a2-e74d05858f29`
- LEARNING_ENGAGEMENT lease:
  `9fd6a3b7-decc-454a-9a2e-953aaaebfe63`, released at
  `2026-07-29T04:18:18Z` for terminal `ready_for_review`.

## Correction completed

Admin question transitions, recognition corrections, attendance recording, and
attendance corrections now require assignment to the record's exact class in
addition to account/product scope. Direct cross-class mutation tests fail
closed.

Class members receive a sanitized published-question projection containing
only `questionId`, `classId`, approved question text, answer, and
`publishedAt`. It exposes no Student, household, recognition, transition, or
private moderation metadata and denies cross-class reads.

`approvedQuestionCount` now counts only `approved_for_class` and `published`
questions. First `answered_private` or approval still produces exactly one
Curious Learner recognition event, and later approval/publication remains
deduplicated. The rolling-window timestamp is the first transition to
`approved_for_class` or `published`: an earlier private answer does not
backdate leaderboard eligibility, and later publication does not refresh an
old approval into the window.

## Verification

- Focused Vitest: 11/11 passed across domain and service, including direct
  cross-class question mutation, attendance correction, no-repository-save,
  publication projection, and leaderboard state/time-basis tests.
- Full workspace typecheck passed.
- Focused ESLint and Prettier passed.
- `git diff --check` passed.
- Repository secret scan passed across 2,748 text files.

## Scope and steward work

The correction changes only the learning contract, domain/test, server service,
`P22-registration-001`, and the three P22 runtime files.
`P22-registration-001` now explicitly requests class-assigned registration of
the sanitized projection. No migration, central composer, root barrel,
manifest, lockfile, provider registry, or foreign runtime path changed.

## Effects

External authority is none; attempted/succeeded/reconciled `0/0/0`. No live or
provider effect occurred.

## Next action

Review corrected implementation `459e9187`, then fulfill
`P22-migration-001` and `P22-registration-001` without weakening the corrected
class or publication boundaries.
