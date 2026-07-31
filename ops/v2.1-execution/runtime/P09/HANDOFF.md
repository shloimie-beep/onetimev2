# P09 School-Seat Authority Convergence Request — Ready for Review

## Exact identity

- Branch: `codex/v21-p09-school-inquiry`
- Request-phase parent:
  `989b7fa979b62f4f78ae76900a73d0011b36f5e6`
- Pushed continuation control:
  `cc90f922663405d883a798db8d4278ef803bb7cb`
- Control state basis:
  `fdcba89094f6b8f9460db3d41f3602be2d476990`
- Claim: `129aacb2-3e46-484f-94c1-1b2122b62950`
- Writer: `codex-p09-seat-convergence-129aacb2`
- SCHOOL_INQUIRY lease:
  `5238d22d-51eb-4f74-9cec-a0bf337cc72f`
- Lease released `2026-07-31T04:51:04Z`, before
  `2026-07-31T05:48:00Z` expiry.
- Effect locks: none.

The final request-only checkpoint SHA is derived from the pushed remote branch;
it is not amended into its own contents.

## Immutable request

Created only:

`ops/v2.1-execution/runtime/P09/steward-requests/P09-migration-002.yaml`

Exact identities:

- raw Git-byte SHA-256:
  `538d6509a5170efc5c164f577d2054005edcd74c17d95e6128cb84ecb37c1a62`;
- canonical recursively sorted JSON payload digest:
  `d9958a9def7fa6d41f5c457a20ff44df8ba265f532e76dd397532ccfcf570dbb`;
- Git blob:
  `75cd8bb242eaaa59d7ebb215ea4d8881fb5354e1`.

The request defines one product-, runtime-tier-, and
verification-environment-scoped approved-School contract/configuration
authority. It requires the exact School household and active adult account
manager, positive seat allowance, USD price, billing start, terms, immutable
contract reference, reason, active-Admin authorizer, authorized time,
idempotency/canonical request evidence, optimistic version, exact readback, and
append-only audit/history in one transaction.

Family remains exactly three seats. No School role, School portal, bulk roster,
automated nurture, Student GHL identity/email, credential, provider secret,
direct Stripe mutation, or product-access grant is introduced.

## Exact supersession boundary

`P09-migration-002` supersedes only the overlapping approved-School
seat/configuration semantics of:

- immutable `P09-migration-001`, raw digest `f6612a8c…`; and
- immutable `P10-MIGRATION-001`, canonical payload digest `33dbeedf…`,
  contained in Git blob `6470da05…`.

All P09 inquiry, manual-follow-up, and acknowledgment semantics remain
unchanged. All P10 identity, credential, enrollment, revocation,
ownership-transfer, receipt, and audit semantics remain unchanged.

Applied migrations 2241 (`a3185722…`, blob `83d423ef…`) and 2249
(`eb5a6ba2…`, blob `d6e100ae…`) stay byte-identical. Their overlapping
allowance/configuration rows become compatibility evidence/projections only.
A canonical backfill is permitted only from complete, mutually consistent
predecessor evidence. Contradictory or incomplete rows must abort or be
quarantined as non-effective evidence; no table, ordinal, timestamp, or
last-write precedence may choose a winner.

## Scope and verification

This terminal changes exactly:

- `ops/v2.1-execution/runtime/P09/TASK-STATE.yaml`
- `ops/v2.1-execution/runtime/P09/HANDOFF.md`
- `ops/v2.1-execution/runtime/P09/NEXT-PROMPT.md`
- `ops/v2.1-execution/runtime/P09/steward-requests/P09-migration-002.yaml`

YAML/schema, exact request identity, predecessor digests, canonical payload,
four-path scope, diff hygiene, protected product/P10/request/migration bytes,
secret absence, active-then-released lease, and effects `0/0/0` passed.

No product code, test, SQL, migration allocation, predecessor request, P10
runtime, shared control, steward queue, provider, candidate, deployment, DNS,
billing, or other live-effect path changed.

## Exact next action

C00 must independently audit the final remote head as the exact four-path sole
child of `989b7fa9…`, reproduce all request and runtime digests, confirm the
timely lease release and effects `0/0/0`, and admit immutable
`P09-migration-002`. P09 stops. P10 remains pending until that admission; F02
alone may later allocate or write a successor migration under separate exact
authority.

## External effects

Authority `none`; attempted `0`, succeeded `0`, reconciled `0`.
