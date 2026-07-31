# P22 Terminal Successor-Correction Handoff

## Authority

- Branch basis: `9723a32f028db1791048549d9661d64bf36bc644`
- Reconciled control: `55ecbdc41e3ea7b341e000c6aeb74c7e1f8f8c49`
- Claim: `d8a3ff1d-edfd-4327-9047-3788d765f7bd`
- Writer: `codex-p22-authority-successor-renewal-d8a3ff1d`
- LEARNING_ENGAGEMENT lease:
  `706d5e11-9ba4-4a1b-83b8-4beba9779aeb`, released task-locally at
  `2026-07-31T07:56:00Z`
- Implementation head: `5c7439fa6bc7600fb62e6eac5b118affeba7704a`
- Effects: `0/0/0`

## Completed correction

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

This heartbeat also fixes explicit deterministic ledger event identities and
SQL arity, adds the seventh stored badge projection with per-family evidence
and audited Admin-only revocation metadata, and binds review proof to the
validated `review_material` artifact on the occurrence-keyed canonical
publication. Registration remains fail closed until I36 supplies the missing
canonical content-state writer/populator.

Badge GET is read-only over persisted active awards. Ordinary canonical P18
attendance changes, question qualification/correction, and review
completion/correction drive projection recalculation. Ordinary recalculation
can award but not revoke; only a reasoned, source-audit-bound assigned-Admin
correction can revoke or restore. Source-event replay retriggers the
digest-idempotent projection callback so a prior post-commit projection
failure is repairable without rewriting an already-current projection.

Approved-question leaderboard timing now uses the first immutable
approved/published transition, distinct from answered-or-approved Curious
qualification. Recognition facts carry the exact household binding, and
review history is exact class, Student, and household fenced after roster
authorization. Moderated published-question composition remains a sanitized
server projection routed only through the client-route successor request.

## Verification

Focused domain, service, and repository suites pass: 3 files, 34 tests.
Workspace typecheck reports only pre-existing Stripe Status widening and
missing Playwright dependency diagnostics; no P22 diagnostic is present.
Focused ESLint, Prettier, diff hygiene, exact 16-path scope, immutable
predecessor hashes, and all five successor-request schema/11-requirement/
10-AC01 checks pass.

## Next action

C00 should review the terminal branch. I36 should disposition the five exact
`-002` successor requests and provide the canonical content-state
writer/populator before registering the fail-closed review-material seam. The
immutable `P22-migration-001` and `P22-registration-001` requests are evidence
only and must not be applied.
