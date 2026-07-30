# P09 School Inquiry Repository and Route — Ready for Review

## Exact identity

- Branch: `codex/v21-p09-school-inquiry`
- Current control authorization:
  `26f29aeb6734948dd8b80ab85a342831defaecc9`
- READY state base: `f2b4a9faefdb5f780c9b620fedb413d408d27a19`
- Expected pre-resume branch head:
  `33a21a45005271f1bbe09c8587df1e52fac1a95a`
- Authorized integration base:
  `c0a1e04b8f3ffcaa65b8c6c2a1ec64edf7c1346a`
- Substantive implementation:
  `05488497a7ca96841c235118c1e5da0bf9270ca1`
- Substantive parent: exact authorized integration base `c0a1e04b`
- Claim: `c18bb60c-98f2-4448-b768-67fcafed9438`
- PUBLIC_SIGNUP lease:
  `45e4c80f-b3a7-445b-a888-0dbed3c3429e`
- Lease released task-locally at `2026-07-30T18:31:32Z`, before
  `2026-07-30T20:01:13Z` expiry.
- Final metadata head: derive with `git rev-parse HEAD`; C00 records the exact
  remote value after independent readback.

## Implemented behavior

The branch now contains a concrete PostgreSQL School-signup repository. It
uses a transaction-scoped advisory lock over the exact
product/runtime/environment/operation/normalized-email key, then reads or
atomically creates one `school_inquiries_v21` record and one
`school_inquiry_acknowledgments_v21` intent. The normalized-email unique key
and `ON CONFLICT ... DO NOTHING` recovery preserve one durable winner; replay
returns that exact receipt and canonical drift fails closed.

The repository reconstructs the receipt from durable rows and rejects any
drift in:

- request scope, operation, normalized email, or canonical request digest;
- adult-only manual-follow-up state;
- zero account, login, household, Student, subscription, access, nurture, and
  provider-identity effects; or
- the locked `OT-01.school_acknowledgment` version `2.1.0`, sender `office`,
  approved subject/body, and content digest
  `ee97274c3fbe2bae470da87aa15b7049fddc2677dc794dc5e94a42e78b7de4fb`.

Approved-School configuration uses the existing Parent/Student model. It reads
the exact approved row `FOR UPDATE` and commits only an optimistic
version-step update. It creates no School role, portal, bulk roster, or
automated nurture.

The task-owned feature descriptor mounts exactly:

`POST /api/v2.1/signup/school-inquiry`

Its strict payload accepts required `school_name`, `contact_first_name`,
`contact_last_name`, and `email`, plus only optional `phone` and `note`.
Account, role, access, portal, consent, campaign, nurture, Student, WhatsApp,
Stripe, and arbitrary extra fields fail before service/repository submission.
`production_read_only` fails before submission. The successful response claims
only a committed local inquiry, pending acknowledgment intent, and manual
follow-up; inline provider effects remain zero.

## Scope

The substantive commit adds exactly four authorized paths:

- `apps/web/src/server/features/signup/school/router.ts`
- `apps/web/src/server/features/signup/school/router.test.ts`
- `packages/db/src/signup/school/repository.ts`
- `packages/db/src/signup/school/repository.test.ts`

The terminal commit changes only the P09 runtime triplet. No central composer,
config, landing page, migration, integration/control file, provider registry,
worker, deployment, DNS, billing, or other task path changed.

The descriptor is intentionally not centrally installed here. I36 owns that
separate registration checkpoint.

## Verification

- Five focused files: 26/26 tests passed.
- The repository harness applies the exact immutable
  `2249_v21_school_inquiry.sql` bytes after omitting only its explicitly marked
  PostgreSQL trigger block for pg-mem.
- Durable inquiry/acknowledgment replay, canonical conflict, transactional
  rollback, `production_read_only`, and optimistic approved-School
  configuration all passed locally.
- Existing service, domain, and contract tests remain green, including the
  concurrent same-email winner behavior.
- Workspace typecheck passed.
- Focused ESLint and Prettier passed.
- Secret scan passed across 3,095 repository text files.
- Exact scope and diff hygiene passed.
- Four-artifact raw Git-blob aggregate:
  `cfd846747005ecfaf86a78ee1f958ddab8b5a252e5f5efe7e06b45014d22398a`.
- Immutable migration 2249 raw Git-blob SHA-256:
  `eb5a6ba248ebcd080b1a17b8eec0ca0ee0f4c2d79c5d440e6f6c16d1dfebf914`.

No native PostgreSQL binary is installed in this worktree. I36's native
migration verification remains the candidate gate; no migration bytes were
changed.

## External effects

Authority `none`; attempted `0`, succeeded `0`, reconciled `0`. No provider
inspection or mutation, message or acknowledgment send, Student contact,
campaign enrollment, WhatsApp action, Stripe action, migration execution
outside the local ephemeral harness, deployment, or DNS action occurred.

## Exact next action

C00 should independently audit the final remote head and authorize I36 to
preserve this ancestry, merge the four implementation paths, and centrally
register `schoolInquiryFeatureRegistration`.
