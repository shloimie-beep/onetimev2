# OT-LIVE-002 immutable migration-request correction evidence

## Control and source binding

- Control head: `fb70bd65344513161c240e3ed6dfa30e0ad7fb54`
- Claim: `38937cb0-37e4-4fbf-8bbb-e7c07d75aeda`
- Claim raw SHA-256: `36f5f0729d08c319dcc00689fd9d058728cc74b3968148161757ddaac50465ff`
- Branch: `codex/ot-live-002-governed-campaign-20260804`
- Base head: `0cf2224f984c023162bf2286028df8e3d2723adf`
- Base tree: `3aad6be5e00d10e647daac7c5b034d6ccd6ae704`
- Migration request: `OT-LIVE-002-MIGRATION-001`
- Requested ordinal: `2260`
- Allocation state: `REQUESTED_NOT_ALLOCATED`
- Ordinal usable: `false`
- Sole allocator and migration writer: `F02`

The malformed unrelated local ref `codex/v21-integration (1)` prevented the
ordinary fetch command. The exact remote control head was independently read
back with `git ls-remote`, and its commit and claim blob were already present in
the local object store. The unrelated ref was not changed or removed.

## Exact five-path correction

1. `packages/db/src/audience-reconciliation/governed-campaign-decision-store.proposal.sql`
2. `packages/db/src/audience-reconciliation/governed-campaign-decision-store.proposal.ts`
3. `ops/codex-runs/OT-LIVE-002/decision-store-contract-check.mjs`
4. `ops/codex-runs/OT-LIVE-002/DECISION-STORE-SOURCE-EVIDENCE.md`
5. `ops/codex-runs/OT-LIVE-002/MIGRATION-REQUEST.yaml`

No migration, barrel, registry, manifest, application, runtime-registration, or
deployment path is included.

## Corrected immutable contract

- Runtime tier and verification environment are bound in keys, uniqueness,
  indexes, advisory locking, request/snapshot hashes, idempotency replay, the
  current projection, and its canonical hash.
- The exact HighLevel location, campaign, workflow, and launch-tag identifiers
  are constrained. A raw provider contact identifier is prohibited; only a
  lowercase SHA-256 protected reference is accepted.
- Decisions are append-only and versioned. Existing rows may change only once,
  from `superseded_at = NULL` to a timestamp; body updates and deletes fail.
- `sourceFacts` has an exact typed allowlist. PII, arbitrary/free-form fields,
  notes, messages, transcripts, Student records, credentials, cookies, tokens,
  secrets, and private provider fields are rejected at the boundary.
- Schema-time backfill is exactly zero. Database, contact, provider, Student,
  tag, seed, pilot, broad-send, activation, and deployment effects are zero.
- PostgreSQL 18 and pg-mem acceptance require fresh apply, migration-ledger
  replay, append-only behavior, environment isolation, exact readback, and
  rollback on ceilings, mismatches, or unknown outcomes.
- Requirements bound: `OTV2-GHL-135`, `OTV2-GHL-137`, `OTV2-GHL-138`,
  `OTV2-EMAIL-145`, and `OTV2-PROVIDER-231`.

## Raw SHA-256 inventory before source commit

- SQL proposal: `c9adfe71d825d9e44822e11cb157de3db054a572fd4a8bf69329039f03463138`
- TypeScript proposal: `445bc86f658f2e0b7e68abf93c880bb08b9ad81d409a31a6d43920ee414201cc`
- Contract checker: `adf12eb6b76c7ee689fd2417cb5cab8b3118943665141763f16f27d96039b594`
- Immutable migration request: `058b22cd1607bef98010083b5e98634bfcc07016928c7ff5ccdb6575ab601846`

The immutable migration-request digest is the raw SHA-256 of
`MIGRATION-REQUEST.yaml`: `058b22cd1607bef98010083b5e98634bfcc07016928c7ff5ccdb6575ab601846`.

## Validation

- Focused static contract: `PASS` — 28 assertions, zero failures.
- TypeScript strict no-emit: `PASS`.
- ESLint with repository configuration: `PASS`.
- Migration-request YAML parse and binding: `PASS`.
- Node syntax check: `PASS`.
- Prettier for TypeScript, JavaScript, YAML, and Markdown: `PASS`.
- SQL validation: focused contract plus `git diff --check`; the repository
  Prettier configuration has no SQL parser.
- Exact path-scope and whitespace check: `PASS`.

## Zero-effect ledger

- Migration files created, edited, registered, or allocated: `0`
- Shared/runtime/application paths edited: `0`
- Database connections or SQL executions: `0`
- Schema-time backfill rows: `0`
- Database rows written: `0`
- Contacts or tags mutated: `0`
- Provider mutations: `0`
- Seed, pilot, or broad sends: `0`
- Schedule, publish, activation, or deployment effects: `0`

This source checkpoint is an immutable semantic request only. Ordinal 2260 and
every other migration ordinal remain unusable until F02 accepts the exact
request under a separate allocation authority.
