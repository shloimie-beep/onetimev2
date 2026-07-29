# P33 Corrected Runtime Operations Handoff

## Identity

- Correction claim head: `a956c9dd1c9d072a54e640fc004684f2e037c033`
- Correction reconciliation control:
  `f84e9d3da1e131cab0714bd24441b08133b7c1a6`
- Implementation head: `5531d6907353fd4d3935469a3574bd63c17cfc23`
- Interface/steward metadata head:
  `5540fe42d0c81ae30deaf0c258c56b756be65e67`
- Final head: derive with `git rev-parse HEAD`; C00 records the observed remote
  head.
- Contract version: `2.0.0`
- Contract digest:
  `cc9fa1dccc66731c91100b008cb9567a9821020559e040aa2ac38baa8bc93a95`
- OPERATIONS_RUNTIME lease:
  `76b4bb8b-af8b-4fcf-9ed7-4054ed8fe57a`, released task-locally at
  `2026-07-29T02:10:00Z`

## Corrected behavior

The candidate now declares exact runtime ID/role/artifact, queue ID/class,
worker type, all seven provider expectations, maximum observation age, and
migration-required policy. Health is ready only when each inventory is
nonempty, unique, exact, structurally valid, finite/nonnegative, qualified,
fresh, and complete. Missing, duplicate, extra, malformed, stale, or
unqualified required evidence is Sev1. A required unavailable provider without
an outage age is Sev1.

Every runtime is compared to its exact candidate runtime expectation. Missing
and extra runtimes fail; scheduled, webhook, migration, web, and worker
artifacts never self-compare.

Migration evidence requires valid positive ordinals, canonical names, lowercase
SHA-256 values, uniqueness, qualified fresh readback, and a deterministic
inventory digest equal to the exact candidate digest.

Diagnostics use explicit response allowlists and safe identifier syntax.
Credential-shaped keys, Basic/Bearer/JWT values, secret hashes, signed URLs,
query tokens, PII, raw provider/database URLs, and secret-bearing context/error
text are blocked. Runtime identity, health, and alerts scan the source plus the
exact serialized final body. Any finding returns only the fixed safe 503 body.

The router now requires `authorizeAdmin` to return a typed, current,
server-session-derived exact Admin principal. Anonymous, Parent, Student, stale
Admin, and client-asserted roles receive concealed 404 responses and invoke no
observers.

Worker heartbeat accepts health input, validates it, and derives state and
readiness codes from the resulting snapshot. Callers cannot assert ready.

## Exact exports

- `apps/web/src/server/operations/index.ts`
  `6f47a8ca18fcb8d3280e4010cdb83dd7eaedb7414dcd222877f4b6fc27899b98`
- `apps/web/src/server/operations/router.ts`
  `eea412fe898f1706de0f1665c712d5064dbb244f8d8d305036554524891d4981`
- `packages/observability/v21/contracts.ts`
  `bae76246d3e12a9d9f3e8bf6bb9eef66c46433033066725632106357cda25600`
- `packages/observability/v21/health.ts`
  `2a24cae7211d7715fec34287c17c01ceb7a7f2e60d593ae8474a79d567bd7582`
- `packages/observability/v21/index.ts`
  `af7ddcd77655a7d1dfb4f6660e080939dfecf5ba221820ef17775e15baa5c959`
- `packages/observability/v21/redaction.ts`
  `ca7c71f08a24188a923d94ddabd601df87a0dab239e4923f0b87a1f0c30f23ad`
- `packages/observability/v21/runtime-identity.ts`
  `d7ea7b54fbb56ddb2c73358b68aad8297cdc882aa40642745d1a703239737aed`

The earlier `d643626a` and `9ac5c08a` contracts are superseded.

## Steward requests

All requests pin exact implementation `5531d690`, semantic version `2.0.0`, and
contract digest `cc9fa1dc`:

- registration:
  `147708b8e8837547379644bf2f246255ecf557eb090d38e2ee2571aa3df4cf84`
- configuration:
  `bc302e61e51f8ce464d416bef5f4ed67dc7aecf17bcbfc6d85b6ca9d3153f0ee`
- deployment:
  `f962b490cccdab80b04ef9d4499c9e2c801cdcd1be64464577f8864c65856830`

## Verification and effects

- Full secret scan: passed across 2,730 repository text files.
- Full workspace lint and typecheck: passed.
- Focused correction suite: 4 files, 40 tests, passed.
- P33 formatting and diff hygiene: passed.
- Effects authority none; attempted/succeeded/reconciled `0/0/0`.

## Next action

I36 must independently verify implementation `5531d690`, metadata `5540fe42`,
all seven export hashes, and canonical digest `cc9fa1dc`, then integrate the
interface before C00 authorizes P34. It must separately disposition the three
exact-interface-pinned steward requests.
