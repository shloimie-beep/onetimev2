# P21 Canonical Content-State Writer Handoff

## Identity and authority

- Branch: `codex/v21-p21-publication-scope-correction`
- Adopted integration parent:
  `d89a0f38dfe695c323f56a28e7c2b0bd890d4ef9`
- Controller authorization:
  `c22354f184f046a1cb817e0c9cd415aec7c37449`
- Claim: `06848315-08fd-40aa-8ff1-3c5cda4c42e4`
- Writer: `codex-p21-content-state-writer-06848315`
- Released lease: `030212ad-7da5-4877-b29b-85de75a4380c`
- The containing commit is the terminal P21 source head. Verify local, tracking,
  and live remote equality before integration.

## Completed implementation

P21 now derives canonical content execution scope from the exact approved
`content_processing_versions` row joined to `content_sources_v21` on account,
product, source key, source digest, and object version. Product, runtime tier,
and verification environment are never defaulted or accepted from a caller.
The same scope fences the configured Vimeo binding and every locked pending
provider job before any provider, outbox, publication, materialization,
completion, or receipt write.

Fresh review-ready registration appends exactly:

1. `null -> received`
2. `received -> validating`
3. `validating -> processing`
4. `processing -> needs_review`

Exact replay requires the immutable projection/source binding and canonical
`needs_review` version 4, verifies all four prior events, and performs no event
or aggregate write. All canonical aggregate versions are locked and read from
`canonical_aggregate_states`; publication versions are never reused as
canonical expected versions.

Approve, request-publish, reconciled private publication, unpublish, and
archive append operation-namespaced canonical events in the same database
transaction as the publication CAS and all related provider/outbox,
materialization/completion, and receipt writes. The raw `content_id` is the
aggregate key. The canonical hash binds the full derived scope, source,
content/version, operation, states, canonical version, actor, and authoritative
publication request hash. Only event inserts mutate canonical aggregate state;
there is no direct aggregate-state DML.

Admin owns approve, request-publish, unpublish, and archive. The reconciler owns
bootstrap and accepted Vimeo publication readback. `attach_occurrence` and
`record_revoked` emit no state event, so publication and canonical versions may
diverge safely.

## Verification

- Five focused files passed with 29 tests.
- Workspace TypeScript typecheck passed.
- Focused ESLint and Prettier passed.
- Repository proof covers the exact source join, canonical `FOR UPDATE`, four
  ordered bootstrap event inserts, write-free replay, canonical/publication
  version divergence, operation-namespaced idempotency, changed replay,
  rollback, and absence of direct aggregate-state DML.
- Service proof covers attach before and after approval, revocation cleanup
  divergence, source/provider-scope mismatch, and injected canonical failure
  rollback for approve, request-publish, publication readback, unpublish, and
  archive.
- `P21-registration-003` passed the committed steward-request schema and
  supersedes stale `P21-registration-002`. It binds registration to integrated
  migration 2253 and this event writer.
- Scope, diff, secret, request, YAML, and static gates passed as recorded in
  `TASK-STATE.yaml`.

## Effects and remaining work

No provider inspection or mutation, send, deployment, migration edit,
backfill, candidate mutation, or external effect occurred. Effects are
`0/0/0`.

This is `ready_for_review`, not candidate-ready, operator-accepted, or
production-released. C00/I36 must independently verify the terminal branch,
integrate the exact source head, and disposition `P21-registration-003`.
Candidate-bound end-to-end, provider, operator, and release evidence remains
outside this task.

## Exact next action

C00/I36 verifies remote equality, the exact nine-path delta, the focused and
static gates, migration-2253 dependency, and `P21-registration-003`; then it
integrates the terminal P21 head or returns one bounded rejection.
