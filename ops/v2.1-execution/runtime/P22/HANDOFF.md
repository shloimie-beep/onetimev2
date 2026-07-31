# P22 Terminal-Correction Handoff

## Authority

- Branch basis: `a5ebe504b464f0ad140f3ab235d682ae79b54822`
- Reconciled control: `c22354f184f046a1cb817e0c9cd415aec7c37449`
- Claim: `4fde7d30-26be-4792-8406-da4ab8d6cd80`
- Writer: `codex-p22-terminal-correction-4fde7d30`
- LEARNING_ENGAGEMENT lease:
  `e0f2587b-0d2e-4900-966d-56b0fae8dee0`, released task-locally at
  `2026-07-31T08:43:00Z`
- Implementation head: `d08c113f859c69691110aea8f1621e6f2b1082ba`
- Effects: `0/0/0`

## Terminal correction

The fresh terminal correction makes
latest revoked review events canonical for badge recalculation, separates
ordinary internal attendance projection context from audited Admin
corrections, binds correction actor/reason/audit metadata to the latest source
event, class-binds review-material reads after roster authorization, returns
an explicit privacy-safe badge DTO, and rejects padded idempotency keys before
server hashing. Older exact correction replay after a successor is a no-write
success, and the badge repository now proves nine-row initialization,
ordinary award preservation, audited revoke/restore, stable timestamps,
immutable rule version, exact replay, and per-family version isolation.

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

Focused domain, service, and repository suites pass: 3 files, 40 tests.
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
