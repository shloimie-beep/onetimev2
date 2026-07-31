# P22 Substantive Heartbeat Handoff

## Authority

- Branch basis: `9723a32f028db1791048549d9661d64bf36bc644`
- Reconciled control: `55ecbdc41e3ea7b341e000c6aeb74c7e1f8f8c49`
- Claim: `d8a3ff1d-edfd-4327-9047-3788d765f7bd`
- Writer: `codex-p22-authority-successor-renewal-d8a3ff1d`
- LEARNING_ENGAGEMENT lease:
  `706d5e11-9ba4-4a1b-83b8-4beba9779aeb`, expires
  `2026-07-31T08:20:00Z`
- Effects: `0/0/0`

## Implemented through this heartbeat

The eight authorized product/test paths now carry all four scope dimensions.
P22 attendance, consent, and name writes are removed. Canonical P18
attendance, privacy `member_recognition` consent, and P12 identity are
SELECT-only identity-bound ports. Questions use a fenced projection plus
distinct append-only transition and recognition ledgers in one transaction,
with exact replay, changed-hash conflict, stale rollback, and first-only
qualification recognition.

Leaderboard output suppresses canonical peer Student IDs, keeps a compatibility
opaque `studentId`, exposes `entryKey`, separates actual and display names,
uses latest canonical consent regardless of input order, makes withdrawal
label-only, and derives aliases from an unambiguous full-scope encoding.
Unknown audiences and states fail closed; Admin class visibility is no longer
unconditional.

Post-checkpoint hardening adds canonical completed-occurrence schedule
coverage with enrollment-time fences, privacy-safe peer aggregates, immutable
recognition append sequence, scoped advisory idempotency serialization,
current-owner/supersession-bound consent, class-bound direct announcements,
and Student-authenticated review completion plus append-only reasoned Admin
revoke/restore evidence.

## Verification

Focused domain, service, and repository suites pass: 3 files, 25 tests.
Workspace typecheck reports only pre-existing Stripe Status widening and
missing Playwright dependency diagnostics; no P22 diagnostic is present.

## Next action

After pushing this heartbeat checkpoint, finish the remaining live-review
authority checks, schema-validate the five exact successor requests, run all
final integrity gates, update the terminal runtime triplet, release the lease,
and push.
