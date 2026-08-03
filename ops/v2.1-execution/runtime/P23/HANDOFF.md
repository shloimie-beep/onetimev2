# P23 PostgreSQL-Safe Dedupe Ready-for-Review Handoff

## Exact identity

- Branch: `codex/v21-p23-student-notifications`
- Reconciled correction claim:
  `102c75c257dda033750d38e95b84ab05b8781507`
- Reconciliation control:
  `edff40fd3e362f932917c402cd9dbeb49b4ac77c`
- Reconciliation acquisition parent:
  `af433361f49dc4842835cf340c06f904ff2919b0`
- Corrected implementation:
  `2961e4a457be6dd1381a98c81258d7a3fb648b69`
- Claim: `096ffffc-1637-4602-a9a8-3084e03a50e1`
- Released lease: `471de353-37c6-4e38-a6da-d2db92c4b207`
- Artifact digest:
  `14ab3136df7262cc2656f35402e193786985bb5266e7adddc4f34ba44abb8a36`
- Unchanged request aggregate:
  `f984e5ee374f4612bdc7e7f500791545acb7b98acef74703018a13b086596c4f`

## Corrected result

Class-change and cancellation actions again render exact locked
**Open schedule** copy while retaining canonical `/app/student/calendar`.

The persisted dedupe key is now a versioned canonical JSON array in exact
`event_type`, `source_entity_id`, `recipient_student_id`, `source_version`
order. JSON escaping prevents literal NUL from crossing PostgreSQL text
parameters or columns while retaining an injective representation of field
boundaries and types. Same-tuple retries produce the same key; representative
NUL, delimiter, quote, bracket, and field-boundary adversarial tuples remain
distinct. The repository advisory-lock key uses the same NUL-free representation
principle because it is also a PostgreSQL text parameter.

A repository-level test captures the actual PostgreSQL query values and proves
the advisory and insert boundaries contain no literal NUL. The existing
`dedupe_key` text-column contract already supports the corrected representation,
so no request or migration change was necessary.

Every earlier lifecycle, privacy, race, retention, sound, timezone,
idempotency, canonical-route, tab-keyboard, and ancestry correction remains
intact. No request, migration, registration, provider/send, or external effect
was applied.

## Verification

- 4 focused files / 22 deterministic tests passed.
- Workspace TypeScript typecheck passed.
- Focused ESLint and Prettier passed.
- Exact correction scope and `git diff --check` passed.
- Secret scan passed across 2877 repository text files.
- Exact 14-artifact digest and unchanged two-request aggregate reproduced.
- Sole writer lease released at `2026-07-29T09:35:21Z`, before expiry.

Next action: C00 should review or integrate the superseding final after exact
remote-head, sole-parent, scope, digest, and effects verification.
