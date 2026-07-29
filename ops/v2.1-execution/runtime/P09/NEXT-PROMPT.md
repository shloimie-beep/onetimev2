MODEL: GPT-5.6-SOL
REASONING: HIGH
SERVICE TIER: PRIORITY
MODE: INDEPENDENT_REVIEW_AND_INTEGRATE

Independently review and integrate the One Time v2.1 P09 School inquiry and
approved-school account implementation.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-p09-school-inquiry
Authoritative control ref: origin/codex/v21-control
Task state: ops/v2.1-execution/runtime/P09/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/P09/HANDOFF.md

Exact identities:

- authorized start: `088b40476bd5ceeb0af901b6f78a4cb8c556671b`;
- atomic claim: `64e5626832e3b849f61e1f020d12acb25d13e0e9`;
- reconciled control: `a790540f36ae5334391547584b2af823c0048ea8`;
- implementation: `248d51f4ac3cb7266efcd30e459fa17d5ccdd431`;
- claim: `92d411ff-e9c0-431d-ab69-e7b71935e4e5`;
- SCHOOL_INQUIRY lease `55f80667-a56c-4eeb-b04c-dcd40700466e`,
  released `2026-07-29T10:48:47Z` before expiry.

Reproduce:

- nine-artifact digest
  `15010bb505bbda47e798cd295600fec89af8727196dabce1741ca4fd3430a4bd`;
- P09-migration-001 digest
  `f6612a8c3b435ca86f8dd8c5ce18ea9a1d91d4c4c0348fb5607eb6681c66b5df`;
- P09-registration-001 digest
  `f78ab4076227222509f61b5d430188cbdaee369adf0bd6ebe82703482171fef1`;
- request aggregate
  `9229edbdabbeedc6ee7ad17eef595ff36e5f6b99f72b0ea73d23e05ab08ddb42`.

Independently prove:

- the `/school` model has exactly four required and two optional fields, exact
  CTA/success copy, and no account/access/role/portal fields;
- one normalized adult email creates one manual-follow-up lead and one durable
  acknowledgment, while an exact retry deduplicates and changed fields fail
  closed;
- inquiry produces zero Parent login, passwordless claim, household, Student,
  subscription, product access, Family/newsletter/conversion/reactivation, or
  other nurture intent;
- approved-school allowance, price, billing start, and terms require a current
  Admin plus exact approval/scope/account-manager/household/version match; and
- approved schools reuse ordinary Parent/Student roles and routes with no School
  role, School portal, bulk roster, or automated school nurture.

The implementation contains no live GHL/provider port. Do not apply either
structured request during source review. Provider-sandbox and production
operator-canary evidence require separate candidate-bound authority.

External authority is `none`; effects attempted `0`, succeeded `0`, reconciled
`0`. No provider inspection, mutation, send, enrollment, registration,
migration, or steward application is part of P09 review.
