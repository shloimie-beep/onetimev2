# P21 Ready-for-Review Handoff

## Exact identity

- Branch: `codex/v21-p21-content-publication`
- Authorized start: `088b40476bd5ceeb0af901b6f78a4cb8c556671b`
- Atomic claim: `6a065ef4f8a23bce3c7ef6d6caa70a342114f12e`
- Claim reconciliation:
  `a790540f36ae5334391547584b2af823c0048ea8`
- Implementation: `9898edeb102b5bfce18985d327090275484b7eae`
- Claim: `3a93eeca-5035-4328-b685-e580f2b32ce6`
- Released `CONTENT_PUBLICATION` lease:
  `31423c6c-74ef-43cc-b3a8-75b425568619`
- Lease released: `2026-07-29T10:56:12Z`, before
  `2026-07-29T11:23:53Z`
- Artifact digest:
  `1f497465cc614f92cbed3188c9041a2d55874bb7108a2bd5373618a4471a8b58`
- Request payload:
  `36ee2283b5847844cc2ad84c4d8ec06403012f43133fa32a97328d9e58df5861`
- Request aggregate:
  `5546e47c0ea26f374889ad8a608d75c2afbcd6a348a0d27902d5ebb10cfdb274`

## Completed behavior

P21 now provides a source-complete isolated publication and protected-library
vertical slice:

- exact lifecycle transitions from review through Admin approval, durable
  private-publication request, published state, and archived/unpublished state;
- idempotent occurrence attachment, command receipts, optimistic versions,
  canonical request hashes, publication generations, and outbox intents;
- an injected private-publication port with no concrete live adapter and
  authority/replay validation before dispatch;
- five-minute renewable same-origin Student playback grants that never contain
  the opaque provider asset reference;
- exact active/grace Student, household, content, occurrence, published-state,
  and entitlement checks, with Parent, sibling, cross-household, inactive,
  unentitled, stale, and unpublished access denied neutrally;
- authorized library search across title, English transcript, date,
  class/topic, and structured Mishnah reference;
- Student-, household-, content-, and publication-version-scoped resume state,
  including current authorization checks on idempotent replays;
- transactional parameterized PostgreSQL adapters for publication, receipts,
  outbox, entitlements, and resume, with rollback on optimistic conflicts; and
- isolated Admin and Student client projections with canonical internal paths
  and no provider URL or provider-reference surface.

## Structured request

`P21-registration-001` requests the forward-only schema migration and governed
server, F05/F06 worker, and authenticated-client composition. P21 did not apply
the request, edit a migration, or touch any shared barrel, composer, route, or
registration file.

## Verification

- 5 focused files / 11 deterministic tests passed.
- Workspace TypeScript typecheck passed.
- Focused ESLint and Prettier passed.
- Exact normalized scope and `git diff --check` passed.
- Raw provider URL/bearer scan passed.
- Secret scan passed across 2898 repository text files.
- All 17 implementation/test Git-blob hashes and aggregate reproduced.
- Structured-request payload and aggregate reproduced.
- No known baseline failure was encountered.

## Acceptance status

All eight requirements and nine assigned cases have source implementation and
direct positive/negative coverage. Candidate-bound evidence remains pending.
The private publish/revoke cases additionally require later provider-sandbox or
operator-canary proof under exact external-effect authority.

## External effects

Authority was `none`; attempted `0`, succeeded `0`, reconciled `0`. No live
Vimeo, Drive, S3/KMS, or other provider was inspected or mutated. No effect lock
was claimed.

## Exact next action

C00 should independently audit the final remote head, sole-parent chain,
normalized scope, artifact and request digests, verification evidence, lease
release, and zero-effect record. I36/F02 may separately evaluate the immutable
steward request under their own authority.
