# P09 School Inquiry and Approved-School Accounts — Ready for Review

## Exact identity

- Branch: `codex/v21-p09-school-inquiry`
- Authorized start: `088b40476bd5ceeb0af901b6f78a4cb8c556671b`
- Atomic claim: `64e5626832e3b849f61e1f020d12acb25d13e0e9`
- Reconciled control: `a790540f36ae5334391547584b2af823c0048ea8`
- Reconciliation parent: `c284998cc927cb4a48516c9d1ba34c325d28a04b`
- Implementation: `248d51f4ac3cb7266efcd30e459fa17d5ccdd431`
- Claim: `92d411ff-e9c0-431d-ab69-e7b71935e4e5`
- SCHOOL_INQUIRY lease: `55f80667-a56c-4eeb-b04c-dcd40700466e`
- Lease released: `2026-07-29T10:48:47Z`, before its
  `2026-07-29T11:23:53Z` expiry.

## Implemented behavior

The public School contract and form model expose exactly school name, contact
first name, contact last name, and email as required fields; phone and note are
optional. The CTA is `Send school inquiry`, and the success copy is
`Thanks—we received your school inquiry. We’ll be in touch shortly.`

Submission canonicalizes the adult email and persists one manual-sales adult
lead plus one durable acknowledgment intent. An exact normalized-email retry
returns the existing acknowledgment without allocating or writing another lead.
A changed request under the same normalized email fails closed.

Every inquiry result explicitly records zero product accounts, households,
Student accounts, subscriptions, access grants, and nurture intents. The local
service has no GHL/provider port and completes zero inline provider effects.

Approved-school configuration requires a current Admin, an exact approved
record, matching scope, adult account manager, household, and optimistic
configuration version. It manually sets seat allowance, price, currency,
billing start, and terms while fixing the experience to ordinary Parent and
Student accounts. It creates no School role, portal, bulk roster, or automated
nurture.

## Structured requests

- `P09-registration-001` requests only root exports, `/school` and submission
  composition, an existing Admin configuration surface, and the absence of any
  School portal/role/job.
- `P09-migration-001` requests forward-only, environment-scoped inquiry,
  acknowledgment, dedupe, and approved-school configuration persistence.

Neither request was applied. No route, composer, barrel, migration, registry,
provider, or live configuration was changed.

## Exact digests

- Nine-artifact implementation digest:
  `15010bb505bbda47e798cd295600fec89af8727196dabce1741ca4fd3430a4bd`.
- P09-migration-001:
  `f6612a8c3b435ca86f8dd8c5ce18ea9a1d91d4c4c0348fb5607eb6681c66b5df`.
- P09-registration-001:
  `f78ab4076227222509f61b5d430188cbdaee369adf0bd6ebe82703482171fef1`.
- Request aggregate:
  `9229edbdabbeedc6ee7ad17eef595ff36e5f6b99f72b0ea73d23e05ab08ddb42`.

## Verification

- Four focused files and 12 positive/negative assertions passed.
- Workspace typecheck passed.
- Focused ESLint and Prettier passed.
- Exact nine-owned-file plus two-request scope and diff hygiene passed.
- Secret scan passed across 2,891 repository text files.
- Artifact and request digests reproduced from immutable Git blobs.

## Independent audit

I36 must independently reproduce the digests and prove all four assigned cases
before integration. Provider-sandbox and production-operator-canary delivery
and safely matched adult-lead evidence remain downstream and require their own
exact authority; they are not claimed by this source implementation.

## External effects

Authority is `none`; attempted `0`, succeeded `0`, reconciled `0`. No live GHL
inspection or mutation, send, enrollment, provider action, steward application,
registration, or migration occurred.
