# OPS-04 — Dry-Run, Approval, Apply, Rollback, and Replay Contract

## 1. State machine

The OPS-04 batch state machine is:

`discovered -> parsed -> previewed -> review_required | approved | rejected -> applying -> applied -> verified -> rolled_back`

`applying -> failed` is resumable. `previewed` can return to `parsed` when source, mapping, or database snapshot changes. `approved` becomes invalid when any bound hash, count, target fingerprint, or material match decision changes.

OPS-04 itself ends with either:

- `waiting_for_source_export` after implementation and synthetic proof; or
- `staging_rehearsal_complete_waiting_for_production_authorization` after a safe non-production rehearsal.

It never ends with a production import or campaign send.

## 2. Immutable source manifest

Each manifest includes:

- account and product scope;
- source purpose and adapter family/version;
- file IDs, full byte SHA-256, exact size, and safe path fingerprint;
- workbook/sheet identities and aggregate row counts;
- header/schema fingerprints;
- snapshot/incremental semantics;
- source observation/effective-time policy;
- stable ID columns/object types;
- consent/suppression provider semantics and authority;
- classification status;
- manifest canonicalization version;
- manifest SHA-256.

A filename is not identity. Any byte change creates a new file ID and manifest. No source binary is committed.

## 3. Mapping and database snapshot

The mapping artifact contains deterministic adapter rules, field ownership, status aliases, source authority, chronology rules, tag taxonomy, and software version. Canonical serialization produces `mapping_sha256`.

The database snapshot key covers the exact target database fingerprint and the relevant schema/migration set, canonical-contact update watermarks, identity/contact-point ownership watermarks, lead/membership/subscription/consent/suppression watermarks, and aggregate counts. It contains no raw personal values.

Preview is valid only for one manifest, mapping, and database snapshot.

## 4. Required dry-run artifacts

For every batch, write machine-readable JSON and human-readable Markdown:

1. `SOURCE-MANIFEST`;
2. `SCHEMA-AND-MAPPING-COVERAGE`;
3. `NORMALIZATION-REPORT`;
4. `MATCH-AND-DEDUPLICATION-PREVIEW`;
5. `HOUSEHOLD-SHARED-POINT-REPORT`;
6. `AUDIENCE-FACT-COUNTS`;
7. `CONSENT-SUPPRESSION-MATRIX`;
8. `OUTREACH-DISPOSITION-SNAPSHOT`;
9. `ROW-ACTION-PREVIEW`;
10. `REJECTS-AND-MANUAL-REVIEW`;
11. `APPLY-PLAN`;
12. `ROLLBACK-PLAN`;
13. `RECONCILIATION-TOTALS`;
14. `APPROVAL-RECEIPT-STATUS`;
15. post-apply `VERIFICATION-REPORT`;
16. post-rollback `ROLLBACK-VERIFICATION-REPORT`.

All Git evidence excludes raw rows, names, destinations, notes, source paths, and provider secrets. Row-level evidence uses opaque row IDs and HMAC fingerprints.

## 5. Dry-run diff actions

Each unique row version produces a deterministic decision and zero or more planned actions:

- `create_contact`;
- `link_external_identity`;
- `append_legacy_membership_event`;
- `append_lead_event`;
- `add_contact_point`;
- `add_contact_point_owner`;
- `append_channel_state_event`;
- `add_relationship`;
- `add_tag_assignment`;
- `link_source_provenance`;
- `set_migration_projection`;
- `no_op_unchanged`;
- `quarantine_manual_review`;
- `reject_insufficient_identity`.

Each action records target, precondition version, source authority/effective time, fields owned, before-state fingerprint, proposed after-state fingerprint, reason, and rollback class. Dry run must show field-level protection where a proposed old value loses to a newer canonical value.

## 6. Approval receipt

A valid import approval receipt is an external protected artifact containing:

- task ID `OPS-04`;
- target account/product and database fingerprint;
- batch key;
- manifest SHA-256;
- mapping SHA-256;
- database snapshot key;
- dry-run report SHA-256;
- exact approved reconciliation and action counts;
- permitted mode and environment;
- approving identity and authority;
- approval timestamp and expiration;
- cryptographic signature or repository-approved equivalent;
- explicit statement that import approval does not authorize any message send.

Apply refuses when any value differs. OPS-04 does not provide a production approval receipt.

## 7. Non-production guard

Before staging apply:

- connect with least privilege;
- verify the database’s explicit `ops04_nonproduction=true` marker;
- verify host/database fingerprint against the receipt or local guard policy;
- prove the environment is not the production Railway/project/database;
- ensure real transports and provider workers are disabled;
- snapshot or create a disposable database;
- record aggregate pre-apply counts and migration head;
- run a no-send assertion against outbox/provider tables.

A database name or hostname containing “test” or “staging” is insufficient by itself.

## 8. Apply ledger

Every action row includes:

- deterministic action key;
- batch, row version, and match decision key;
- action type and target entity;
- target precondition version;
- fields owned by OPS-04;
- protected before-state rollback patch or reversible event references;
- attempt number and worker claim;
- status: `planned`, `claimed`, `committed`, `no_op`, `quarantined`, `failed`, `verified`, `rolled_back`, or `rollback_conflict`;
- applied entity/version;
- actor and timestamps;
- error code without raw PII;
- verification result.

The ledger is the source of truth for resume and rollback. Logs are not sufficient.

## 9. Transaction and concurrency behavior

- One advisory lock per batch state transition.
- Apply workers claim bounded chunks with row locks.
- Unique action keys enforce at-most-once semantic mutation.
- Each chunk is one transaction.
- A failed chunk rolls back completely and leaves unclaimed/planned actions resumable.
- Candidate and target versions are revalidated inside the transaction.
- A stale target is quarantined rather than overwritten.
- Replaying a verified batch yields only deterministic no-ops.
- A verified batch cannot be cloned under a new human label to bypass idempotency.

## 10. Verification

Post-apply verification proves:

- every planned action has a terminal status;
- committed entity versions match ledger values;
- no unexpected canonical contact, lead, current subscription, access, account, payment, or outbox change occurred;
- legacy membership and external identity histories are complete and scoped;
- tag assignments are provenance-owned;
- channel-state precedence is correct;
- the five outreach dispositions contain the expected subjects and are all send-disabled;
- reconciliation equations balance;
- row, subject, and action counts match approval;
- audit events exist exactly once;
- no source rows or destinations leaked into evidence.

Any mismatch sets batch state `failed` or `review_required`; it is not silently accepted.

## 11. Rollback classes

| Class | Rollback behavior |
|---|---|
| Append-only event created by batch | Mark/reverse through canonical compensating event or remove only when schema safely permits and no later dependency exists |
| Batch-only external identity link | Remove/link-inactivate when no later source or activity depends on it |
| Batch-only tag assignment | Delete assignment by action key; preserve same tag from other provenance |
| Batch-created contact point owner | Remove only when no later verification/use depends on it |
| Batch-created contact | Soft-archive only if no later non-batch activity, relation, subscription, payment, access, communication, or provenance exists |
| Canonical field update | Restore only when current field version equals batch-applied version |
| Relationship | Remove only if batch-owned and no later dependent entity exists |
| Current subscription/access/payment | OPS-04 must never mutate; any observed change is a verification failure |
| Outreach/outbox/provider item | OPS-04 must never create; any observed item is a verification failure |

Rollback conflicts remain visible and require manual review. Rollback never erases the audit trail.

## 12. Replay contract

### Same inputs and unchanged database

- identical manifest, mapping, snapshot, and batch key;
- identical row decisions and counts;
- no new canonical entities, facts, tags, notes, or audit events;
- terminal action statuses read as no-op/replayed.

### Changed source bytes

- new file/manifest/batch identity;
- prior approval invalid;
- full new preview required.

### Changed mapping

- new mapping key and batch identity;
- prior approval invalid;
- old decisions remain immutable evidence.

### Database changed after preview

- new snapshot or stale precondition;
- affected actions quarantine;
- new preview required for material differences.

### Replay after rollback

- requires a new database snapshot and approval when any canonical state changed;
- does not reuse stale before-state patches;
- still preserves deterministic source and row identities.

## 13. Reconciliation totals

Reports must balance:

- files: discovered = classified + unclassified + rejected;
- rows: physical = blank + parser reject + normalized occurrence;
- occurrences: normalized = exact duplicate occurrence + unique row version;
- unique rows: matched existing + staged new + manual review + rejected insufficient identity + already migrated no-op;
- actions: planned = creates + updates + links + fact appends + tags + no-ops + quarantines;
- attempts: attempted = committed + no-op + stale quarantine + failed;
- rollback: attempted = reversed + already reversed + conflict + failed;
- outreach: subject universe = blast candidate + migration invitation eligible + manual review + suppressed + already migrated.

Independent audience fact counts overlap and must not be presented as additive recipient totals.

## 14. No-send proof

Before and after every synthetic/staging rehearsal, capture aggregate counts and maximum IDs/timestamps for:

- delivery outbox;
- provider command/outbox tables;
- email send records;
- WhatsApp send records;
- Telegram send records;
- account invitations;
- access grants;
- payment/checkout records.

OPS-04 must produce a zero diff in all of them. Any nonzero diff fails the task and triggers rollback/investigation.

## 15. Evidence retention

- Source binaries remain outside Git.
- Raw row snapshots are not retained by default.
- When protected rollback material contains sensitive values, encrypt it and enforce retention/deletion policy.
- Evidence reports and screenshots are scanned for email, phone, token, secret, absolute-path, and source-row patterns.
- CHECKSUMS files cover every committed evidence artifact.
