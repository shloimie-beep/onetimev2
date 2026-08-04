# OT-LIVE-002 decision-store source evidence

## Control binding

- Control head: `339ad9c2a8d48fe76eec08bf6859525ced21c6b5`
- Authority index SHA-256: `cf4695fc1d59c268ffbd9d64f28bac4bd74335828c946946da2cf63b5bdc2c62`
- Source claim: `1aa15481-0c38-4445-aaac-12931bd958a7`
- Writer: `codex-ot-live-002-02-decision-store-source-1aa15481`
- Claim digest: `0ac0268ae887eef8f60a29040eefec65c84de587d1578c42214cc53b49195a7c`
- Claim expiry: `2026-08-05T09:14:28Z`
- GHL completion authority: consumed
- GHL terminal event: `4345c0cd8fbe1965f228859fd20e8165671d77b3bb05d53f876cc643fdcb6043`
- GHL provider lock: unclaimed

## Proposal verdict

`PASS — SOURCE PROPOSAL ONLY`

The proposal is campaign-bound by provider location, campaign, workflow, and
launch-tag identifiers. It stores immutable numbered decision versions,
supersedes rather than rewrites historical versions, and exposes only the
current projection. The transaction contract requires campaign-scoped advisory
locking, exact idempotency/request/snapshot hashes, an authority-supplied
`maximumAffectedRows`, and exact in-transaction count/hash/reason readback with
rollback on mismatch or unknown result.

`sourceFacts` is restricted by contract to sanitized booleans, enums, counts,
timestamps, and hashes. The API must reject names, email addresses, phone
numbers, postal addresses, notes, message bodies, and other direct contact
identifiers. This evidence packet contains no contact records or direct contact
PII.

## Files and pre-commit digests

- `packages/db/src/audience-reconciliation/governed-campaign-decision-store.proposal.sql`
  - SHA-256: `13766ec73845b3d7343cc456eece126f2ef02a02eb60b6d8e9ae8cf86f870558`
- `packages/db/src/audience-reconciliation/governed-campaign-decision-store.proposal.ts`
  - SHA-256: `b68e25a448bdf39fcccceed94d85749bc63f2ba343a3343adbd2e3399d111cff`
- `ops/codex-runs/OT-LIVE-002/decision-store-contract-check.mjs`
  - focused executable static contract check; its final digest is recorded by
    the source commit.

## Validation

- Focused contract test: `PASS` — 18 assertions, 0 failures.
- Focused TypeScript strict no-emit check: `PASS`.
- Node syntax check for the contract test: `PASS`.
- Focused ESLint using the repository's canonical config/dependencies: `PASS`.
- Prettier check for TypeScript and evidence JavaScript: `PASS`.
- Repository secret scan: `PASS` across 3,223 text files.
- Staged diff whitespace/scope check: `PASS` — exact four authorized files.
- Outside-scope runtime registration references: `0`.

The repository Prettier configuration has no SQL parser, so the SQL proposal is
covered by the focused contract test and staged `git diff --check` instead.

## Zero-effect proof

- Migration allocated or written: `0`
- Migration/shared barrel/registry/manifest/app entry edited: `0`
- Runtime import/export registration: `0`
- Database rows written: `0`
- Contacts or tags mutated: `0`
- Provider mutations: `0`
- Seed, pilot, or broad sends: `0`
- Schedule, publish, activate, or deploy effects: `0`

The reconciled production-data row ceiling remains `0`. This source checkpoint
does not grant or imply later migration, database, provider, contact, or send
authority.
