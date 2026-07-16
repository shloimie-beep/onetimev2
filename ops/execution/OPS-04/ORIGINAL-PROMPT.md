# OPS-04 — Direct Codex Execution Prompt

Act as the principal data-migration, CRM-integrity, identity-resolution, consent, PostgreSQL, and audit engineer for **OPS-04**.

Implement a production-grade, reversible legacy-audience reconciliation system in the standalone One Time repository. Read and obey every packet file as one binding contract:

- `CANONICAL-FIELD-TAG-STATUS-MAPPING.md`;
- `DUPLICATE-CONFLICT-POLICY.md`;
- `DRY-RUN-ROLLBACK-CONTRACT.md`;
- `ACCEPTANCE-MATRIX.md`;
- `AUDIT-NOTES.md`.

OPS-04 authorizes repository implementation, synthetic tests, dry-run tooling, reversible apply/rollback tooling, and a guarded rehearsal against a proven non-production database. **It does not authorize a production import or any campaign send.** Never create email, WhatsApp, Telegram, payment, access, account-invitation, provider-send, DNS, Railway, or production database side effects.

Use `OPS-04` in human-readable state, evidence, audit metadata, commits, and PR title. Use `ops04` only where machine identifiers cannot contain a hyphen.

## Target, base, worktree, and state

Target repository: `webcraft-media/onetimev2`.

Audited refs:

- convergence anchor `741af0c08ee1d43be4e220b7c6e4c77a2330adc2` on `codex/ot80-one-shot-final-convergence`;
- preferred compatible base `fb6b3266e2bb2689fdfc1f751764fd98ecca8f0a` on `codex/ot85-whatsapp-lead-assistant`;
- legacy-audience foundation `51cd99dc4434f0354ba229620ebe89558efeb120` on `codex/ot74-audience-reconciliation`.

Resolve the exact base before edits. Fetch refs; verify the convergence anchor is an ancestor of the preferred base. Use a fast-forwarded current head of `codex/ot85-whatsapp-lead-assistant` when it still contains the preferred SHA. A newer branch may be used only when `ops/execution/registry.json` identifies it as canonical and it descends from the preferred SHA. Otherwise use the exact preferred SHA. Do not use `main` unless it contains that ancestry. Do not silently merge sibling branches; port the smallest required seam and record source SHA/collision analysis.

Create or safely resume branch `codex/ops-04-legacy-audience-migration` in a separate clean worktree. Preserve unrelated work. Before the first product edit, create `ops/execution/OPS-04/` with:

- `ORIGINAL-PROMPT.md` containing this prompt;
- `STATE.json`;
- `INPUTS.json`;
- `BASE-RESOLUTION.json`;
- `DECISIONS.md`;
- `CHECKPOINT.md`;
- `REMAINING.md`;
- `TEST-RESULTS.md`.

Initial `STATE.json` records task `OPS-04`, packet `OPS-04-20260716-fd38cbd7`, resolved base branch/SHA, worktree, branch, phase `repository_audit`, status `in_progress`, and both production-import and production-send authorizations as `absent`. Update it atomically after every phase so a new session can resume without guessing or repeating protected row access. Preserve historical OT-74 evidence; do not relabel it as OPS-04.

## Mandatory read-only audit

Before implementation, inventory exact paths/checksums for migrations, migration ledger, existing OT-74 audience migration/contracts/domain/repository/router/UI/scripts/tests, canonical contacts and identities/contact points, lead/tag/note histories, households, memberships, subscriptions, billing/access, public signup, consent/suppression, communications/outbox/audit, CRM cards/filters, WhatsApp STOP/START, dependencies, supported PostgreSQL versions, and environment-name contracts with values redacted.

Treat OT-74 as partial foundation. Close these verified gaps without deleting history:

- normalized-row JSON rather than full-byte source identity;
- operator idempotency key included in batch identity;
- unkeyed SHA-256 identity fingerprints;
- unsafe `+972` inference for ambiguous local phones;
- email/phone-only matching and shared-point collapse risk;
- no first-class old IDs, membership history, subscriber axis, household chronology, or source-event chronology;
- coarse eligibility and incomplete required outreach states;
- rollback request rather than reversible action ledger;
- nondeterministic audit replay key;
- browser-posted raw row payload;
- unmounted router/panel;
- missing CRM fact cards/filters;
- public email-conflict upsert without field-level freshness protection.

Write sanitized `ops/evidence/OPS-04/REPOSITORY-AUDIT.md` and `.json`. Never include real rows, names, destinations, secrets, or source paths.

## Source discovery and authorization

Implement two phases.

**Aggregate-only inventory:** under protected `OPS04_SOURCE_ROOT`, locate CSV, TSV, XLSX, and approved JSON. Before row authorization, emit only opaque file ID, adapter/version, byte size, full file SHA-256, safe path fingerprint, sheet names, normalized headers, physical/blank/error counts, aggregate type/nullability estimates, snapshot/incremental semantics, timestamp policy, stable-ID presence, and consent/suppression metadata. Do not print sample rows. Unclassified files remain `unclassified_source`.

**Authorized reconciliation:** non-synthetic row access requires `OPS04_ROW_ACCESS_AUTHORIZATION_PATH` binding exact manifest hash, allowed files, purpose `OPS-04-reconciliation`, actor, expiry, and environment. `OPS04_FINGERPRINT_HMAC_KEY` is required for non-synthetic HMAC fingerprints. Stream rows server-side or through CLI; never send raw rows through the browser. Store raw values only when strictly necessary, protected and encrypted; Git evidence contains opaque IDs, HMACs, reason codes, and aggregates.

`OPS04_STAGING_DATABASE_URL` is usable only when host/database fingerprint, environment, and an explicit database marker `ops04_nonproduction=true` prove non-production. A name containing “staging” is not proof. `OPS04_PRODUCTION_IMPORT_AUTHORIZATION_PATH` is intentionally absent; production apply must fail closed. There is no send authorization variable, and OPS-04 code must be structurally unable to enqueue outreach.

## Canonical independent facts

Implement the packet mapping exactly. Never treat “old system” as mutually exclusive with lead or active old-app user. Preserve independently:

- canonical person/organization and field-level provenance/version;
- lead history/current lead state;
- exact old-system external identities as text;
- append-only legacy membership events/current projection;
- current standalone subscriber/entitlement read only from canonical current systems;
- family, household, guardian, learner, and school/organization relations;
- many-to-many contact-point ownership;
- channel-specific consent and suppression events/projections;
- migration state;
- one primary outreach disposition plus channel-specific email/WhatsApp eligibility.

Schools remain leads unless separately entitled by existing canonical current records. Legacy active, plan, or status never creates current subscriber, access, portal, seat, class link, payment, or login.

Use additive forward-only PostgreSQL migration(s), allocating the first free number after the resolved ledger. Extend OT-74 safely; do not edit applied migrations. Cover immutable source files/sheets/manifests/mapping versions, source row identities/versions, external identities, legacy membership, contact points/owners, field provenance, lead/channel histories, candidates/evidence, quarantine/review decisions, dry-run/approval, deterministic actions, before/after versions, rollback, segment snapshots, reconciliation totals, and deterministic audits. Record selected migration filename/SHA in state.

## Normalization and matching

Version all normalization/mapping rules and hash canonical serialization.

- Email: trim/lowercase safely; preserve plus tags and dots; no provider-specific alias collapse.
- Phone/WhatsApp: maintained region-aware parser; E.164 only with reliable context; ambiguous local values become manual review; phone possession does not imply WhatsApp consent.
- Names: Unicode NFC and whitespace normalization; preserve spelling; never derive a person name from email.
- Old IDs: exact text, including leading zeros/punctuation.
- Dates: parse from declared source format/zone; preserve ambiguity; ingestion time is not effective time.
- Blank: never erases populated canonical data without explicit approved deletion ownership.
- Generic status: source-adapter interpretation only.
- Tags: provenance-aware display aids, never identity/status/consent/entitlement truth.

Apply the matching hierarchy in `DUPLICATE-CONFLICT-POLICY.md`: prior verified row link, exact stable old ID, verified crosswalk, verified unshared point, corroborated email+phone, strictly unique one-point evidence, explicit relation plus corroboration, safe new identity, otherwise quarantine. Never auto-match on name, fuzzy similarity, location, tag, plan, or status. Evaluate all candidates; never choose the first row.

Quarantine multiple top candidates, email/phone disagreement, stable-ID disagreement, shared unresolved point, cross-scope match, person/organization or family/school/adult/learner role conflict, archived/merged uncertainty, contradictory current entitlement, ambiguous chronology, lower-authority overwrite attempt, and stale preview. Do not silently merge people or households.

## Freshness, consent, and outreach

Every mutation compares source authority, effective/observed time, field version, and ownership. Lower-authority or older data may append provenance/history but cannot overwrite a newer canonical value. Blank imports do not clear. Revalidate match and target versions inside apply; changed targets become `stale_preview` manual review.

Consent/suppression precedence is:

1. legal hold/global DNC;
2. STOP/unsubscribe/opt-out;
3. hard bounce/invalid/wrong number;
4. unresolved identity/manual-review hold;
5. OPS-04 migration hold;
6. unknown consent/purpose mismatch;
7. verified purpose-specific opt-in;
8. lower-confidence subscribed export.

Legacy active does not imply consent; cancellation does not imply unsubscribe; subscribed exports never override newer blocks; cleaned semantics are manual review unless authoritative; existing suppression is never cleared by OPS-04.

Compute one mutually exclusive primary disposition in this order:

1. `manual_review`;
2. `suppressed`;
3. `already_migrated`;
4. `migration_invitation_eligible`;
5. `blast_candidate`.

`blast_candidate` is a review pool, not send permission. Create channel-specific email and WhatsApp snapshots. Every segment contract exposes `sends_allowed=false`. Add packet-defined namespaced tags with provenance; rollback removes only batch-owned assignments.

## Determinism, dry run, apply, rollback

Manifest identity uses ordered full file hashes/sizes/adapter versions. Mapping identity uses canonical rules/code version. Database snapshot identity uses schema/migration and relevant aggregate watermarks without PII. Batch identity binds account, product, manifest, mapping, and database snapshot—not human labels. Row, decision, action, and replayable audit keys are deterministic; no random material participates in uniqueness.

Dry run creates JSON and Markdown reports required by `DRY-RUN-ROLLBACK-CONTRACT.md`: manifest, mapping coverage, normalization, matching/shared points/conflicts, independent audience facts, consent/suppression, five outreach dispositions, field-level diff, apply plan, rollback plan, approval status, and reconciliation totals. Reports state `production_import_authorized=false` and `campaign_send_authorized=false`.

Implement apply for synthetic and proven safe non-production rehearsal only. Validate an exact approval receipt binding target fingerprint, manifest, mapping, snapshot, dry-run hash, counts, actor, mode, and expiry. Use a batch advisory lock, bounded transactional chunks, deterministic action uniqueness, and safe row claims such as `FOR UPDATE SKIP LOCKED`. Revalidate target versions before writes. Never hard-delete contacts and never write migration outreach to delivery/provider outboxes.

The reversible ledger stores action key, batch/row/decision, target/version precondition, owned fields, protected before-state or reversible event refs, attempts/status, applied version, actor/time, and verification. Rollback is idempotent: reverse only batch-owned unchanged data; preserve later human/signup/provider/system edits; soft-archive a batch-created contact only when no later dependency exists; unsafe reversals become rollback conflicts. Replay after apply is no-op; changed bytes/mapping/snapshot require a new preview/approval.

## Public signup and standalone CRM

Keep `/api/v1/leads` canonical, idempotent, provider-independent, and server-scoped. Same key/same payload replays; same key/different payload conflicts. Fix freshness/ownership behavior so public signup and imports cannot overwrite newer human/canonical fields or transfer shared destinations silently. School signup remains lead-only. Add bundle/dependency tests proving public pages do not import OPS-04, provider, CRM, or BNA runtime code.

Mount OPS-04 only in the authenticated standalone One Time CRM, never the broad BNA shell. Add protected aggregate source/batch surfaces, five outreach cards, independent fact chips, filters for lead/legacy/active-old/current-subscriber/family/school/consent/suppression/migration/outreach, conflict queue, batch hashes/totals, apply/rollback status, and labels “prepared only — sending disabled.” No raw rows or destination values in screenshots/evidence. Use role/CSRF/no-store protection, bounded pagination, route-level code splitting, and accessible responsive behavior at 360×800, 390×844, 768×1024, and desktop.

Provide repository-conventional CLI/server commands for inventory, manifest verification, authorized dry run, report verification, safe apply rehearsal, verify, rollback, replay, totals, and performance. Machine-readable outputs, failed-guard nonzero exits, and no raw PII are mandatory.

## Required proof

Create deterministic synthetic fixtures covering active/former legacy users who remain leads, current subscriber, unique family, shared household email, shared phone, school without entitlement, separately entitled school, email/phone conflict, stable-ID conflict, archived contact, ambiguous local phone, missing name/destination, invalid identity, subscribed then newer unsubscribe, WhatsApp STOP, unknown cleaned semantics, already migrated, concurrent duplicate apply, newer canonical edit after preview, and rollback with/without later edits.

Pass every row in `ACCEPTANCE-MATRIX.md`. At minimum prove:

- deterministic normalization, file/mapping/batch/row/action/audit identities;
- exact old-ID and chronology preservation;
- shared-point/household safety and conflict quarantine;
- independent lead/legacy/subscriber/family/school/consent/suppression/migration facts;
- schools remain leads absent separate entitlement;
- all five outreach states and channel snapshots, all send-disabled;
- no outbox/provider/account/access/payment diff;
- replay, partial-resume, concurrency, stale-preview protection, rollback/replay;
- fresh PostgreSQL 16 migration and upgrade from OT-74 with synthetic historical rows;
- real PostgreSQL 16 locks/constraints/indexes;
- CRM visibility/filter/card/tag/accessibility and BNA/public-bundle isolation;
- public signup idempotency/provider independence/shared-point safety;
- exact reconciliation equations;
- secret and PII scans;
- 100,000-row inventory/normalization target within 180 seconds and under 1 GiB RSS;
- 50,000-row database reconciliation target within 300 seconds and under 1 GiB RSS, with bounded chunked SQL and query plans.

Record hardware and explain material runner differences or regression above 20 percent.

## Execution and final disposition

Execute in order: base/state; audit; aggregate source discovery; model/mapping; migration/repositories; normalization/matching; consent/outreach; dry-run/approval; safe apply/rollback/replay; public signup protections; CRM integration; synthetic/focused tests; fresh/upgrade PostgreSQL; concurrency/performance; full verify/scans/bundle checks; optional safe staging rehearsal; final evidence/state/commit/PR.

Always run synthetic apply, verification, rollback, and replay. If source exports are absent or row access unauthorized, complete all source-independent code/tests/UI and finish `waiting_for_source_export` with exact missing source families, authorization requirements, and resumable command—never invent counts. If a safe staging rehearsal completes, finish `staging_rehearsal_complete_waiting_for_production_authorization`. A production target or inconclusive guard yields `blocked_production_guard` after all safe work. OPS-04 can never finish `production_import_complete` or `campaign_sent`.

Commit appropriate implementation and sanitized evidence under `ops/execution/OPS-04/` and `ops/evidence/OPS-04/`, including an evidence index with SHA-256. No source binaries, real rows, secrets, destinations, or loose uncommitted patch.

Create a focused commit beginning `OPS-04:`, push `codex/ops-04-legacy-audience-migration`, and open a draft PR titled:

`[OPS-04] Legacy audience reconciliation and migration`

The PR body states resolved base SHA, migration filename/checksum, exact tests, synthetic/staging/source disposition, authorizations absent, no provider side effects, and blockers. Do not claim production readiness.

Return branch/full remote SHA, draft PR URL, resolved base, migration/checksum, implementation summary, exact verification matrix, source and rehearsal disposition, production import authorization `absent`, campaign send authorization `absent`, rollback/reconciliation blockers, and final OPS-04 state. Never return raw rows, personal data, secrets, or provider destinations.
