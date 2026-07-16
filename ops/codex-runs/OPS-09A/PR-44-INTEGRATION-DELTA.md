# OPS-09A PR #44 Integration Delta

PR: #44, `codex/ot107-student-ai-class-helper`

Before head: `560a07c66baddc99df38441299f3e57107d02137`

Canonical reference inspected: `origin/codex/ops03-staging-readiness-repair`
at `fb5f5eebc539afc9e93833e9417ee67524d62c36`.

## Branch-Local Repair

The shared migration contract test now verifies:

- required historical and OPS-03A migrations are present;
- migration IDs are unique and ordered;
- every applied migration records a checksum;
- the pg-mem rerun limitation remains documented by the expected rejection.

It no longer assumes a permanent final migration ID.

## OT-107 Compatibility Repair

`tests/e2e/ot-83r-portals.spec.ts` now follows the OT-107 private-question
contract:

- fill the `Ask privately` textbox;
- click `Preview private question`;
- assert the private question preview;
- explicitly click `Send private question`;
- verify the student question POST returns `201` and the submitted private
  question appears.

This preserves the intentional separation between ordinary Class Helper queries
and explicit private-question submission. It does not reintroduce the old direct
`Submit question` flow and does not weaken the helper/private-question boundary.

## Known Mergeability Blocker

After the scoped repair was pushed, GitHub reported
`mergeStateStatus=DIRTY` for PR #44. Local `git merge-tree` identifies the
shared migration proof hunk in
`tests/integration/telegram-db-foundation.test.ts` as the conflict surface
against `codex/ops03-staging-readiness-repair`.

OPS-09A did not create a broad canonical merge commit for PR #44 after the
operator nudge to keep this branch scoped to the private-question compatibility
fix. OT-113/OPS-08 can proceed with this explicit blocker rather than receiving
a widened leaf branch.

## Provider Safety Posture

No live AI provider canary, provider mutation, production/staging database
mutation, deployment, external send, or access/payment mutation was performed.
The original OT-107 evidence remains authoritative for branch semantics:
`ops/codex-runs/OT-107/FINAL-REPORT.md`.
