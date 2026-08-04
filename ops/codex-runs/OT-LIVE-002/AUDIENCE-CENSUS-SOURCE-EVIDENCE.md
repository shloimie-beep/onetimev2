# OT-LIVE-002 governed audience census runner source evidence

Disposition: `SOURCE_ONLY_GHL_CURSOR_PROGRESSION_CORRECTION_PROOF_GREEN`.

## Authority and immutable source binding

- Claim: `fd080c16-4db6-45e3-864a-212103a5212e`
- Claim raw SHA-256: `0e6f542a529a14a0d6492e499e74d7f2971202012b7f4039825c871b2014912d`
- Claim branch: `codex/ot-live-002-ghl-pagination-contract-correction-20260804`
- Exact base/source before this successor: `b204b026d7733c29c514d3c5febbea948c5e67e7`
- Exact base tree: `84f49a3ef767cafcd56acf10b894784b6f2fdb28`
- Control readback at issuance: `ae92e22baf5436d93b60e0b19b377debc19aa907`
- Remote correction branch before the one authorized push: exact base/source and
  tree above.

The terminal source head/tree and the raw SHA-256 of all three paths are read
back after the normal fast-forward push and returned to C00. They are not
self-referentially embedded here.

## Exact three-path scope

1. `scripts/highlevel/governed-campaign-audience-census.ts`
2. `scripts/highlevel/governed-campaign-audience-census.test.ts`
3. `ops/codex-runs/OT-LIVE-002/AUDIENCE-CENSUS-SOURCE-EVIDENCE.md`

Migration 2260 remains byte-for-byte unchanged. Its normalized Git-blob
SHA-256 is still
`93e7879ce7861cd37733335ca64e49310af1025fc099e6bce4abadb8f25c3740`.

## Source verdict

The successor preserves the default-off, read-only census boundary and corrects
its HighLevel pagination contract:

- exact OT-15 location, campaign, workflow, and launch-tag binding;
- positive operator-supplied `maximumProviderContacts` and
  `maximumAffectedRows`;
- exact live `contacts`/`meta`/`traceId` response-envelope binding with safe
  typed pagination counters and stable `meta.total` reconciliation;
- `currentPage`, `nextPage`, and `prevPage` are validated as known typed fields
  but never used as progression authority because the observed provider keeps
  their `1`/`2`/null values static while the cursor and contact data advance;
- both documented request cursors (`startAfter` and `startAfterId`) carried in
  an internal typed cursor, accepted only when issued by a validated page, and
  reconstructed against the fixed origin/path/location/limit; each pair and
  encoded cursor must be nonblank, well typed, and nonrepeating;
- provider `nextPageUrl` is structural evidence only: its origin, path, exact
  query-key set, and every expected query value must match, but it is never
  followed;
- the separately documented `contacts`/`count` response is accepted only when
  the page is self-evidently terminal because it cannot supply both request
  cursors for a continuation;
- bounded provider pages and stable accumulated total count; exact-total
  termination without an extra fetch even when an unused cursor is advertised;
  repeated/blank/unissued/prematurely absent cursor rejection; empty-page,
  changed-total, rows-over-total, over-ceiling, cross-location, and duplicate
  rejection; and provider-order-independent canonical sorting and hashes;
- an explicit `REPEATABLE READ READ ONLY` database transaction across exact
  account, product, runtime, verification environment, campaign, and provider
  binding;
- durable `adult_household_contact_links` matching first, in exact account,
  product, and HighLevel location scope;
- campaign-domain provider hashes computed inside PostgreSQL from the durable
  provider binding without selecting or returning the raw provider identifier;
- unique account/product contact matching by normalized-email SHA-256 as the
  only fallback, followed by unique exact scoped adult identity readback;
- durable mapping duplicates, non-synced mappings, duplicate contact/adult/email
  matches, archived adults, and cross-scope decoys fail closed;
- the unversioned `adult_ghl_identity_link.verified_contact_ref_hash` is never
  positive identity proof and can only make a conflicting match more restrictive;
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

The provider transport now supplies only the full campaign-domain contact hash,
the full normalized-email hash when a canonical deliverable address exists, and
typed consent/deliverability/suppression states. Neither protected input is
included in the decision source-facts envelope except for the already-governed
campaign contact hash; raw provider identifiers and normalized addresses never
leave their read boundaries.

## HighLevel contract evidence

- The predecessor two-page diagnostic made exactly two canonical read-only GETs
  with version `2023-02-21`, limit 100, and no retry or third page. Both returned
  HTTP `200`, 100 contacts, exact root keys `contacts`, `meta`, `traceId`, and
  the same exact seven meta keys validated by this parser.
- Both observed pages reported the static scalar tuple `currentPage=1`,
  `nextPage=2`, `prevPage=null`, and the same safe `total=1499`, while their
  protected contact data and dual cursor pair advanced. The second locally
  reconstructed request exactly matched the first response's cursor pair.
- Page-one sanitized body evidence was 85,834 bytes with SHA-256
  `aa86cca6560070a7187ae805d80bd101d7e18d692bafd9125307236296f78918`;
  page two was 92,600 bytes with SHA-256
  `6922849567595c0960ce6332b979f31907b7dd51d851a2317953c654515af893`.
  The predecessor parser accepted page one but rejected page two only at its
  now-removed `currentPage did not match the requested page` invariant.
- On both pages, the next-URL origin, path, and exact query-key set matched the
  canonical locally reconstructed request; the URL itself was never followed.
  No cursor, contact, query, token, or body value was retained or returned.

- The earlier pagination-contract claim-authorized diagnostic made exactly one
  `GET /contacts/` request with version `2023-02-21`, the canonical location,
  `limit=1`, no cursor, one response, and no retry. HTTP status was `200`.
- Sanitized response evidence: top-level keys were exactly `contacts`, `meta`,
  and `traceId`; `contacts` was an array of length 1; the body was 1,104 bytes
  with SHA-256
  `9e0adb338d1104539aaf4979e69b1cadba41107f28d39980000ba1d9331f665f`.
- Sorted `meta` keys were exactly `currentPage`, `nextPage`, `nextPageUrl`,
  `prevPage`, `startAfter`, `startAfterId`, and `total`. Safe integer evidence
  was `currentPage=1`, `nextPage=2`, and `total=1499`; `prevPage` was null.
  `startAfter` was a safe-integer cursor and was not retained. No cursor value
  was retained.
- `nextPageUrl` was a 145-byte string with SHA-256
  `f603f45c6222148e1aef1182e70d3b063dc934bbc95abcb41abb90546817d7cb`;
  its sanitized structure was canonical origin
  `https://services.leadconnectorhq.com`, path `/contacts/`, and exact query
  keys `limit`, `locationId`, `startAfter`, and `startAfterId`. The observed
  `startAfterId` was a 20-byte string with SHA-256
  `981ca273d237a51ecbadd421123b7d0e35d633deab693dc0737ff4c74afaf639`.
- No contact value, opaque cursor value, token, URL query value, response body,
  or private field was output, persisted, or committed.
- Canonical origin is pinned to `https://services.leadconnectorhq.com`; no
  environment-supplied origin or version can receive the private integration
  token.
- The documented, deprecated `GET /contacts/` request contract defines version
  `2023-02-21`, `locationId`, both `startAfter` and `startAfterId`, and maximum
  `limit` 100. Its documented `contacts`/`count` response remains a distinct,
  exact, terminal-only parser contract:
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
- Corrected focused runner suite: `13/13 PASS`.
- Full focused domain/reader/runner/migration/decision-store/integration suite:
  `49 PASS`, `1 native-only SKIP` (`50` total across seven files).
- pg-mem fresh migration plus real decision-store composition: `PASS`, zero
  decision rows
- No PostgreSQL process or database connection was authorized or invoked by
  this correction; the predecessor PostgreSQL 18 proof remains unchanged.
- Observed/documented envelope separation, static-counter acceptance,
  dual-cursor-only reconstruction and progression, unissued/repeated/premature
  cursor rejection, exact-total stop with an unused cursor, canonical URL
  validation, stable total and page/accumulated ceilings, provider DND
  status/casing/contradiction,
  origin/version pin, timeout sanitization, pool cleanup, replay cardinality,
  reintroduction, and hash-compatibility regressions: `PASS`
- Deterministic candidate builder: `4/4 PASS`
- Predecessor identity-contract static assertions remain recorded as
  `12/12 PASS`; the affected runner assertions were rerun in the focused suite.
- Cursor-progression static assertions: `12/12 PASS`
- Repository build, exact-path ESLint, formatting, whitespace, path scope,
  migration integrity, diff, and secret/static scans: `PASS`
- Disposable database/cluster created: `0`

## Zero-effect ledger

- Live/staging/production database connections or writes: `0`
- Decision-store executions or decision-row writes: `0`
- GHL/provider reads during this source-only correction: `0`; the sanitized
  one-page and two-page diagnostic evidence above was inherited from terminal
  predecessor authorities and was not recreated
- Provider write methods introduced: `0`
- GHL contact/tag/workflow/campaign/seed/reply/pilot/broad-send effects: `0`
- Resend/DNS/Forward Email/WhatsApp effects: `0`
- Contact, Customer, or Student effects: `0`
- Migration, registry, manifest, deployment, billing, schedule, publish, or
  activation effects: `0`
- Disposable PostgreSQL clusters/databases remaining: `0`
