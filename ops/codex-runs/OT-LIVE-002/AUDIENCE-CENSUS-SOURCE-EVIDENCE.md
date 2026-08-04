# OT-LIVE-002 governed audience census runner source evidence

Disposition: `SOURCE_ONLY_DEFAULT_OFF_CENSUS_PROOF_GREEN`.

## Authority and immutable source binding

- Claim: `72ae541e-cc5b-464a-881d-62f92b857479`
- Claim raw SHA-256: `9fa41a197f05d1aa848fdc1a45031121391a7debd241384b2a7b76c239aed9d1`
- Claim branch: `codex/ot-live-002-decision-store-implementation-20260804`
- Exact base/source before this successor: `6149907cb2611835514b1ffa5622c8fb7d5927e8`
- Exact base tree: `9abda7772ec7e3af78abdcc24a0657d8f49ccaf6`
- Latest control readback before terminal validation: `96969eb099041c6837d0c9b5e7d1e9b392394fdb`
- Control movement after issuance: only `CONTROL-LEASE.yaml`; the claim remains active and unchanged.
- Remote source branch before the one authorized push: exact base `6149907cb2611835514b1ffa5622c8fb7d5927e8`.

The terminal source head/tree and the raw SHA-256 of all eight paths are read
back after the normal fast-forward push and returned to C00. They are not
self-referentially embedded here.

## Exact eight-path scope

1. `packages/domain/src/audience-reconciliation/governed-campaign-census.ts`
2. `packages/domain/src/audience-reconciliation/governed-campaign-census.test.ts`
3. `packages/db/src/audience-reconciliation/governed-campaign-census-reader.ts`
4. `packages/db/src/audience-reconciliation/governed-campaign-census-reader.test.ts`
5. `scripts/highlevel/governed-campaign-audience-census.ts`
6. `scripts/highlevel/governed-campaign-audience-census.test.ts`
7. `tests/integration/governed-campaign-audience-census.test.ts`
8. `ops/codex-runs/OT-LIVE-002/AUDIENCE-CENSUS-SOURCE-EVIDENCE.md`

Migration 2260 remains byte-for-byte unchanged. Its normalized Git-blob
SHA-256 is still
`93e7879ce7861cd37733335ca64e49310af1025fc099e6bce4abadb8f25c3740`.

## Source verdict

The successor implements a default-off, read-only census preparation boundary:

- exact OT-15 location, campaign, workflow, and launch-tag binding;
- positive operator-supplied `maximumProviderContacts` and
  `maximumAffectedRows`;
- bounded provider pages and total count, repeated/blank cursor rejection,
  cross-location and duplicate rejection, and provider-order-independent
  canonical sorting and hashes;
- an explicit `REPEATABLE READ READ ONLY` database transaction across exact
  account, product, runtime, verification environment, campaign, and provider
  binding;
- account-scoped canonical contact matching by in-SQL normalized-email SHA-256,
  without selecting or returning the raw email;
- exact canonical contact consent, suppression, email-DND, deliverability,
  active-adult, family/school, access, and active self-Student evidence;
- exact validated `{marketing_suppressed, service_suppressed,
evidence_digest, version}` link suppression envelope;
- runtime validation of all provider/database enums, history shape, hashes,
  versions, source facts, and safe-integer increments;
- fail-closed exclusion/review precedence; inclusion requires every adult,
  consent, deliverability, suppression, identity, school, Student, and current
  access fact to be positively safe;
- full protected SHA-256 references and full-hash-plus-version decision keys;
- historical maximum version readback, including reintroduction after a prior
  supersession;
- current versions reused only when scope cardinality and the final
  idempotency/request/snapshot/decision history are all exact; any mismatch
  rebuilds the whole snapshot at historical maximum plus one;
- the real decision-store capability is composed but never called; results fix
  database, provider, contact, Student, and send effects at zero.

The repository does not define how the existing
`adult_ghl_identity_link.verified_contact_ref_hash` producer hashes raw GHL
contact IDs. The new domain-separated hash therefore records provider hash
compatibility as unproven for real transport rows and forces those rows to
`review`. It cannot silently create an eligible audience.

## HighLevel contract evidence

- Canonical origin is pinned to `https://services.leadconnectorhq.com`; no
  environment-supplied origin or version can receive the private integration
  token.
- The retained read fallback is the documented, deprecated `GET /contacts/`
  contract with version `2023-02-21`, `locationId`, `startAfterId`, maximum
  `limit` 100, and top-level `contacts` plus `count`:
  <https://marketplace.gohighlevel.com/docs/ghl/contacts/get-contacts/index.html>
- The public Search Contacts page documents `POST /contacts/search` but does
  not expose a complete public request/response pagination schema, so no search
  pagination fields were invented:
  <https://marketplace.gohighlevel.com/docs/ghl/contacts/search-contacts-advanced/>
- The documented email DND channel key is `Email`; statuses are exactly
  `active`, `inactive`, and `permanent`. `active` and `permanent` suppress,
  `inactive` proves only that channel DND is inactive, and missing/unknown or
  contradictory aliases remain unknown/review. Channel inactivity is not
  treated as marketing opt-in:
  <https://marketplace.gohighlevel.com/docs/2021-04-15/ghl/contacts/upsert-contact/>
- Every provider GET has a ten-second abort timeout and returns only a sanitized
  stable failure code; response bodies, tokens, and private fields are never
  logged.

## Validation

- TypeScript strict no-emit: `PASS`
- Focused domain/reader/runner/integration suite: `30/30 PASS`
- pg-mem fresh migration plus real decision-store composition: `PASS`, zero
  decision rows
- Disposable PostgreSQL: exact `18.4` / `180004`
- Native exact-account/cross-account-decoy hash join: `PASS`
- Native active-adult, active-self-Student absence, canonical suppression/DND,
  and malformed-envelope fail-closed probes: `PASS`
- Provider DND status/casing/contradiction, count/cursor/page/total ceiling,
  origin/version pin, timeout sanitization, pool cleanup, replay cardinality,
  reintroduction, and hash-compatibility regressions: `PASS`
- Formatting, whitespace, exact path scope, migration integrity, diff, and
  secret/static scans: `PASS`
- Disposable database/cluster: stopped and removed

## Zero-effect ledger

- Live/staging/production database connections or writes: `0`
- Decision-store executions or decision-row writes: `0`
- GHL/provider reads during source proof: `0`
- Provider write methods introduced: `0`
- GHL contact/tag/workflow/campaign/seed/reply/pilot/broad-send effects: `0`
- Resend/DNS/Forward Email/WhatsApp effects: `0`
- Contact, Customer, or Student effects: `0`
- Migration, registry, manifest, deployment, billing, schedule, publish, or
  activation effects: `0`
- Disposable PostgreSQL clusters/databases remaining: `0`
