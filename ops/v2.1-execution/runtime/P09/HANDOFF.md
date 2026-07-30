# P09 School Inquiry Correction — Ready for Review

## Exact identity

- Branch: `codex/v21-p09-school-inquiry`
- Rejected final: `a81e5e98e21eeb1df8d0ff21dd6b948a33a65d46`
- Correction atomic claim:
  `86d5f5ffd046505c4df336ea40dd83c6559d3255`
- Reconciled control:
  `3fd19332799a28a7efd7cde00712ba8ca091bf14`
- State-based acquisition:
  `e6a6729bc109816124ef2e7beef5e42aa398b147`
- Correction implementation:
  `a420dd5823c0f7a7dc553fd08991c0e4507b8c24`
- Claim: `555a5878-9a7f-4486-a6e0-a959dc9ab1a1`
- SCHOOL_INQUIRY lease:
  `8ca16a74-fa49-4c61-8aa8-b50416b50913`
- Lease released: `2026-07-29T11:41:43Z`, before
  `2026-07-29T12:26:54Z` expiry.
- Final metadata head: derive with `git rev-parse HEAD`; C00 records the exact
  observed remote head.

## Corrected behavior

The repository contract now performs one atomic
create-or-return-winning-receipt operation for the exact
product/runtime/environment/operation/normalized-email key. A uniqueness-race
winner is validated against the same canonical request and protected
zero-account/access/nurture invariants, then returned as an exact deduplicated
result. It is never overwritten.

The public command accepts exactly the four required fields with phone and note
genuinely optional. Omitted optional fields are persisted as canonical `null`;
extra fields still fail closed.

The acknowledgment intent no longer stores the public UI success message as
delivery copy. It binds the locked `OT-01` School acknowledgment:

- template `OT-01.school_acknowledgment`, version `2.1.0`;
- sender `office`;
- exact approved subject and body; and
- content digest
  `ee97274c3fbe2bae470da87aa15b7049fddc2677dc794dc5e94a42e78b7de4fb`.

Replay also rejects template/version/digest drift.

All prior manual-sales-only, zero access/account/subscription/nurture,
Admin-approved School configuration, and ordinary Parent/Student reuse
invariants remain.

## Scope and structured requests

The correction implementation changed exactly six P09-owned source/test files.
This final checkpoint additionally updates only P09 `TASK-STATE.yaml`,
`HANDOFF.md`, and `NEXT-PROMPT.md`.

`P09-migration-001` and `P09-registration-001` remain byte-identical,
unapplied, and outside this correction. No migration, shared composer, root
barrel, provider adapter, or live configuration was changed.

## Exact digests

- Nine-artifact implementation digest:
  `1635950b5f6eb1a117912199bdc8b8d2bf36bd5c5397c3388bcbc1990c746a57`.
- P09-migration-001:
  `f6612a8c3b435ca86f8dd8c5ce18ea9a1d91d4c4c0348fb5607eb6681c66b5df`.
- P09-registration-001:
  `f78ab4076227222509f61b5d430188cbdaee369adf0bd6ebe82703482171fef1`.
- Request aggregate:
  `9229edbdabbeedc6ee7ad17eef595ff36e5f6b99f72b0ea73d23e05ab08ddb42`.

## Verification

- Four focused test files: 16/16 passed.
- Direct tests cover four-required-field submission, canonical optional nulls,
  template/digest binding and drift, and two concurrent same-email submissions
  producing one durable lead/acknowledgment.
- Workspace typecheck passed.
- Focused ESLint and Prettier passed.
- Exact correction scope and diff hygiene passed.
- Secret scan passed across 2,891 repository text files.
- Implementation and unchanged request digests reproduced from Git blobs.

## External effects

Authority `none`; attempted `0`, succeeded `0`, reconciled `0`. No provider
inspection/mutation, acknowledgment send, GHL action, migration, registration,
or steward application occurred.

## Exact next action

C00 should independently audit the superseding final remote head, ancestry,
six-file correction scope, exact digests, validation evidence, lease release,
and zero-effect record.
