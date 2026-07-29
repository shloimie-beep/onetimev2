# P21 Superseding Ready-for-Review Handoff

## Exact identity

- Branch: `codex/v21-p21-content-publication`
- Authorized start: `088b40476bd5ceeb0af901b6f78a4cb8c556671b`
- Rejected final: `24f82a7484f2889349f7768d29ec7f2545cfa45a`
- Correction claim: `355d7b126fe2db7b2e8061f86585d724866998a6`
- C00 reconciliation/authorization:
  `3fd19332799a28a7efd7cde00712ba8ca091bf14`
- State-based acquisition parent:
  `e6a6729bc109816124ef2e7beef5e42aa398b147`
- Corrected implementation: `a272161866af85f3b93dbfa60d6c940601553b3b`
- Claim: `f7ed5c86-2b2a-4e58-930a-b602ac9f1657`
- Released `CONTENT_PUBLICATION` lease:
  `2ea04691-d951-4c3b-90cf-e1909f42be7c`
- Lease released: `2026-07-29T11:53:30Z`, before
  `2026-07-29T12:26:54Z`
- Artifact aggregate:
  `3b25a254872b8dba3400c38092eedcb4ca43108f080222c8fd33a2b6087acbee`
- Steward-request payload:
  `3118761ab1ae1bd75101ae9dafe435018e3292584f5c938b574e1a3231f69387`
- Steward-request aggregate:
  `c961e50261a7d30044a0f51205017dfdbc2d669e5fcd6f5eb6a7b9244f3b43ca`

## Corrected behavior

This final supersedes the rejected P21 final and addresses only the authorized
publication-safety blockers:

- approval now fails closed against preexisting immutable content-version,
  participant-snapshot/review, redaction-review, and named Admin-attestation
  evidence;
- the web service has no provider mutation port or dispatch path; it can only
  atomically apply a completed F05/F06 worker readback for one stable fenced
  ProviderOperation with exact canonical request identity, private and
  available Vimeo state, exact content-version correlation, exactly one
  canonical asset, durable One Time readback, and ambiguity denial;
- successful completion atomically persists the published record, exact receipt,
  versioned Student assignments, versioned library projections, and protected
  Student/adult recording notices;
- playback grants are five-minute same-origin capabilities bound to exact current
  content/publication/grant, assignment, Student, session, enrollment, access,
  service-account-consent, privacy, and revocation versions and states;
- recording-participation and member-recognition choices are deliberately absent
  from playback authorization;
- unpublish is `published -> approved` and increments the durable
  playback-grant generation immediately; archive remains a separate transition;
  and
- governed product/occurrence relations validate exact versions, persist in the
  aggregate transaction, replay idempotently, and reject conflicting governance.

Adult notices open only `/app/parent`; they never expose or provide Parent
playback. Student playback actions remain protected same-origin Student routes.
No provider asset reference enters a grant, library item, or notice.

## Structured request

`P21-registration-001` was strengthened for the forward-only F02 schema and
I36/F05/F06 authenticated route, worker, readback, and client composition. P21
did not apply the request, edit a migration, register a shared route/worker, or
perform runtime schema creation.

## Verification

- 5 focused files / 13 deterministic tests passed.
- Workspace TypeScript typecheck passed.
- Focused ESLint and Prettier passed.
- Exact scope and `git diff --check` passed.
- Direct-provider-mutation and client provider-reference scans passed; the only
  URL match is a deliberate unsafe-URL negative test fixture.
- Secret scan passed across 2898 repository text files.
- All 17 implementation/test Git-blob hashes and aggregate reproduced.
- Structured-request payload and aggregate reproduced.
- No known baseline failure was encountered.

## External effects

Authority was `none`; attempted `0`, succeeded `0`, reconciled `0`. No live
Vimeo, Drive, S3/KMS, or other provider was inspected or mutated. No effect lock
was claimed.

## Exact next action

C00 should independently audit the exact superseding remote head, sole-parent
chain, bounded scope, artifact/request digests, verification evidence, lease
release, and zero-effect record. F02/I36 may later evaluate the unapplied
steward request under their own authority.
