# OT-LIVE-002 decision-store repository implementation evidence

Disposition: `SOURCE_ONLY_IMPLEMENTATION_PROOF_GREEN`.

## Exact authority and source binding

- Latest remote control head: `8049998af04791a73b0abf79e846cfdc6959baf5`
- Claim issuance control head: `996ea88aab1bb4ec345a8e705155c6a2e0a39bfc`
- F02 terminal raw SHA-256:
  `8ff1f60f311871e5e12ae589a9be6d78d6ee9dc8fd6fd590551f14341b7cbea9`
- Accepted migration source/tree:
  `e5bc19812cc990b9d84e3371202cb4f4c37ab470` /
  `afccb02b57884fd4eda02f648aed5d5a705c239b`
- Accepted migration normalized-LF SHA-256:
  `93e7879ce7861cd37733335ca64e49310af1025fc099e6bce4abadb8f25c3740`
- Claim: `f59e9a15-cd23-42e2-a1ad-053ff15c9cbf`
- Latest claim status/readback: `active`, expiry `2026-08-05T10:08:25Z`
- Claim raw SHA-256:
  `1d4c0fe09872b3a95b91c7094e0698c9ad026a58ef0fdc714ef59a714b92f14d`
- Branch: `codex/ot-live-002-decision-store-implementation-20260804`
- Exact remote branch before the authorized push: absent (no competing writer)
- Request commits cherry-picked in exact order:
  `0cf2224f984c023162bf2286028df8e3d2723adf`, then
  `e41cea45a4e3fc99c4cf968872992f2992090d18`

The final source head/tree and every committed path digest are read back after
the single normal commit and push; they are returned with this evidence rather
than self-referentially embedded in this file.

## Exact eleven-path boundary

1. `packages/db/src/audience-reconciliation/governed-campaign-decision-store.proposal.sql`
2. `packages/db/src/audience-reconciliation/governed-campaign-decision-store.proposal.ts`
3. `ops/codex-runs/OT-LIVE-002/decision-store-contract-check.mjs`
4. `ops/codex-runs/OT-LIVE-002/DECISION-STORE-SOURCE-EVIDENCE.md`
5. `ops/codex-runs/OT-LIVE-002/MIGRATION-REQUEST.yaml`
6. `packages/db/src/audience-reconciliation/governed-campaign-decision-store.ts`
7. `packages/db/src/audience-reconciliation/governed-campaign-decision-store.test.ts`
8. `packages/db/src/index.ts`
9. `tests/integration/governed-campaign-decision-store.test.ts`
10. `scripts/postgres-assurance/governed-campaign-decision-store-pg18-proof.ts`
11. `ops/codex-runs/OT-LIVE-002/DECISION-STORE-IMPLEMENTATION-EVIDENCE.md`

Migration 2260 and every other migration, shared registry, manifest,
application path, provider adapter, contact path, and deployment path are
outside the diff.

## Repository verdict

The exported PostgreSQL repository enforces:

- one `SERIALIZABLE` transaction and an exact runtime/environment/account/
  product/campaign/four-provider-ID advisory lock;
- exact current base-row selection with `FOR UPDATE`;
- each requested contact's next `decisionVersion` from the maximum immutable
  historical version in the exact scope, including disappearance and later
  reintroduction;
- a deterministic collision-safe decision key using the full protected
  provider-contact SHA-256 plus decision version, with raw-looking arbitrary
  GHL IDs and hash/version mismatches rejected before connection;
- positive `maximumAffectedRows` and precomputed inserted-plus-superseded row
  ceiling before mutation;
- exact idempotency/request/snapshot/ordered-decision replay with zero mutation
  statements and zero affected rows;
- one-way current-row supersession plus immutable append;
- exact in-transaction current row, ordered decision, projection hash, and
  reason-count readback before commit;
- rollback on ceiling, mismatch, or unknown result, with no automatic retry;
- the exact sanitized source-fact allowlist, no raw PII/private identifiers or
  Student records, and result effects fixed at zero for contacts, providers,
  and sends.

## Validation and native proof

- TypeScript strict no-emit: `PASS`
- Focused implementation tests: `4/4 PASS`
- Focused pg-mem integration tests: `4/4 PASS`
- Focused migration pg-mem tests: `4/4 PASS`
- Static source contract: `42/42 PASS`
- Formatting and whitespace: `PASS`
- Disposable native PostgreSQL: exact `18.4` / `180004`
- Migration inventory: fresh `91/91` apply and `91/91` replay
- Same-scope concurrent reconciliation: exactly one winner, one fenced loser
- Current-row contention: second transaction rejected with SQLSTATE `55P03`
- Historical reintroduction, exact replay, idempotency conflict, ceiling,
  mismatch, unknown-result, and environment-isolation probes: `PASS`
- Native database disposition: dropped
- Native WSL cluster/temp-directory disposition: stopped and removed

## Zero-effect ledger

- Migration files created, edited, registered, or allocated: `0`
- Live/staging/production database connections: `0`
- Live/staging/production schema or row effects: `0`
- Provider/GHL/Resend/DNS/Forward Email effects: `0`
- Contact, tag, Student, Customer, seed, pilot, or broad-send effects: `0`
- Schedule, publish, activation, billing, deployment, or control effects: `0`
- Disposable local proof databases remaining: `0`
- Disposable local proof clusters/directories remaining: `0`
