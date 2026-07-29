# P08 Family Signup — Ready for Review

## Identity

- Branch: `codex/v21-p08-family-signup`
- Authorized start: `49431959f58f284bdc13ca931acf09f980fc483a`
- Claim: `798ccc6e-82cc-4eb6-82ca-167cc3998042`
- Reconciled authorization:
  `d8639ce20ce92a0f49ce8d69b57b09b355d09246`
- Reconciliation acquisition parent:
  `629577e2ea6da2fdeca7754a6f314b6b254e952e`
- Contract implementation:
  `0c386529ea7e9487a457e51cc5be9500a6c29b52`
- Corrected interface checkpoint:
  `b7601c002d2c37d0ef7760c328015f9a8d590893`
- Product implementation:
  `7e20798c1161da0594cea363d1047335c9ae4fbe`
- Interface digest:
  `f54e4381b53aa83522a2b15561a51a03319272a439afa8657c13655776c0d23c`
- FAMILY_SIGNUP lease released: `2026-07-29T01:07:03Z`
- External effects: authority none; attempted 0; succeeded 0; reconciled 0

## Implemented behavior

- Public intake accepts exactly one `family` or `school` classification.
  Missing, unsupported, array, and hybrid payloads fail before any write.
- The Family form contains only adult identity, password, timezone, and required
  legal acceptance. It contains no card, Student, consent, reminder, phone, or
  country field. School inquiry contains no password, card, household, or
  Student fields.
- Before `2026-09-13T16:24:00.000Z`, Family signup creates immediate cardless
  free access with three available Student seats and no setup-email dependency.
  Exactly at and after the boundary it persists inactive access and continues
  to Checkout without a rolling trial or form-side financial effect.
- Normalized email reuses one adult and HumanAccount. An existing active Family
  account receives the generic sign-in-or-reset path without a duplicate write.
- Verified GHL link wins, then exact normalized-email match. Multiple or
  disagreeing matches quarantine only GHL synchronization; local signup and
  valid free access remain available.
- Identity, credential when needed, household, access, stable request, and GHL
  outbox persist through one local transaction. Same-key retries recover the
  durable result and outbox; changed request hashes fail closed.

## Interface and steward work

The stable export artifact SHA-256 is
`52d75f1604b05983482d677f0d0df12df47e88adf7574f968e0bd910f4f4c685`.
The repository-canonical combined digest is
`f54e4381b53aa83522a2b15561a51a03319272a439afa8657c13655776c0d23c`.
C00/I36 may integrate it to unlock P09.

No migration, route, barrel, composer, or shared registry was edited. The exact
requests are:

- `P08-migration-001`:
  `5691d8d054c4e36724f6f12b0a5d62d1d5d6691b0b405824d81484d71b8df1c3`
- `P08-registration-001`:
  `8db3dbbd36b0de487659877b6e4e256721e2029221f9c5eb35ff9037541939e0`

## Verification

- Focused P08 suites: 4 files, 13/13 assertions passed.
- Targeted ESLint, repository typecheck, focused Prettier, secret scan, canonical
  interface digest, and `git diff --check`: passed.
- Full unit suite: 566/567 passed.
- The sole failure is inherited and outside P08 ownership:
  `tests/unit/highlevel/sender-registry-v1-1.test.ts` expects 19 automation
  assets while the integrated registry contains 22.

## Exact next action

C00/I36 should verify the exact pushed final head, integrate the corrected
interface checkpoint for P09, route the migration and registration requests to
their owners, and review P08 for integration. No provider or financial effect
was performed.
