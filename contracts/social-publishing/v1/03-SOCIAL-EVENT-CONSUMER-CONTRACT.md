# OT-86A approved-for-social event consumer contract

## Exclusive input

The only content event that can create a social source or draft job is:

- `event_type`: `content.approved_for_social`
- `origin`: `ot86a-content-pipeline`
- `schema_version`: `1`

The deployed OT-86A schema and signature/authentication mechanism are authoritative. Runtime validation occurs before business dispatch. An internal admin endpoint, arbitrary JSON import, web scraper, raw transcript search, or different event type may not bypass this gate. `payload_sha256` is recomputed as the lowercase SHA-256 of RFC 8785 canonical JSON after removing the `payload_sha256` member.

## Durable inbox

Persist before dispatch:

- event id and idempotency key;
- origin/type/schema version;
- tenant/content/version/sequence;
- raw-body SHA-256 or broker payload hash;
- authentication identity/key id;
- received time and validation outcome;
- processing status and sanitized failure code.

Unique constraints cover event id, idempotency key, and `(tenant_id, content_id, version_id, sequence)`. An identical replay returns prior processing state. A duplicate identifier with changed bytes is quarantined and audited.

## Validation order

1. Authenticate transport or broker identity.
2. Verify raw-byte signature/checksum when present.
3. Parse JSON with bounded size/depth.
4. Validate exact schema and origin/type.
5. Validate approval and aggregate privacy flags.
6. Validate every excerpt/media reference and checksum.
7. Validate sequence and version relationship.
8. Persist inbox receipt.
9. Dispatch a draft-generation job.

No Buffer call is permitted in these steps.

## Privacy fail-closed rules

Reject or quarantine when any aggregate or asset flag indicates learner name, voice, face, question, or private data. Reject media subject classifications outside `no_people`, `rabbi_only`, and `graphics_only`. Reject unapproved URLs, unknown asset checksum, raw private transcript, internal note, or sibling record reference. A text/metadata privacy scanner is defense in depth and never converts a flagged event into accepted content automatically.

## Independence

The consumer may be disabled or absent without changing OT-86A approval, publication, One Time library, or student KB behavior. OT-86A never waits synchronously for a social draft or Buffer result.
