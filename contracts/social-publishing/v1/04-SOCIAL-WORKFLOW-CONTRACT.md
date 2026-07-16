# Social draft, approval, scheduling, publication, and correction workflow

## Records and revision identity

Repository-native equivalents must cover:

- social source linked to OT-86A event/content/version;
- immutable draft revisions and renderer version;
- ordered media bindings and checksums;
- privacy scan/attestation;
- human approvals bound to one exact revision checksum;
- destination selections and capability snapshots;
- scheduled publish commands and attempts;
- provider post/update identifiers and sanitized response hashes;
- correction and retraction cases;
- audit events and idempotent inbox/outbox records.

A draft edit always creates a new revision. It never updates an approved revision in place. `revision_sha256` is the lowercase SHA-256 of RFC 8785 canonical JSON after removing the `revision_sha256` member.

## States

| State                        | Meaning                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------- |
| `draft_generated`            | System produced a new immutable candidate revision from an approved event.   |
| `review_needed`              | A human must review or a prior approval was invalidated.                     |
| `approved`                   | Authorized human approved one exact revision and privacy result.             |
| `scheduled`                  | Approved revision is bound to ready destination(s) and a future time.        |
| `publishing`                 | Scheduler owns an idempotent provider operation/reconciliation.              |
| `published`                  | Provider confirms the post/update exists and ids are stored.                 |
| `failed`                     | Typed failure; retry/correction rules are recorded.                          |
| `correction_needed`          | Published or scheduled content requires a new revision/approval.             |
| `retraction_requested`       | Authorized human requested removal; provider capability is being reconciled. |
| `retracted`                  | Provider deletion/removal is positively confirmed.                           |
| `retraction_manual_required` | Provider cannot confirm automated removal; an operator task is open.         |
| `cancelled`                  | Unpublished work was intentionally cancelled.                                |

## Allowed transitions

- `draft_generated → review_needed`.
- `review_needed → approved`, `review_needed → cancelled`, or `review_needed → draft_generated` for a newly generated revision.
- `approved → scheduled`, `approved → review_needed`, or `approved → cancelled`.
- `scheduled → publishing`, `scheduled → review_needed`, `scheduled → correction_needed`, or `scheduled → cancelled`.
- `publishing → published`, `publishing → failed`, or `publishing → correction_needed`.
- `published → correction_needed` or `published → retraction_requested`.
- `failed → review_needed`, `failed → scheduled` only for a verified transient retry of the unchanged approved command, `failed → correction_needed`, or `failed → cancelled`.
- `correction_needed → draft_generated`, `correction_needed → retraction_requested`, or `correction_needed → cancelled` when unpublished.
- `retraction_requested → retracted`, `retraction_requested → retraction_manual_required`, or `retraction_requested → failed`.
- `retraction_manual_required → retracted` only after authorized human evidence confirms removal; otherwise it remains open.
- `cancelled` and `retracted` are terminal for that command/revision.

All other transitions are rejected and audited.

## Approval invalidation

Approval is bound to revision checksum, ordered media checksums, destination set, renderer/capability version, privacy result, and scheduled time. Any change to text, hashtags, metadata, media, destination, destination capability, timezone, or scheduled time invalidates approval, cancels any pending command idempotently, and moves to `review_needed`.

## Renderer rules

Renderers exist for `linkedin`, `facebook`, `instagram`, and `x`. Each renderer:

- uses only approved excerpts and event metadata;
- escapes unsafe markup and strips executable links/HTML;
- applies server-configured destination limits and media requirements;
- returns warnings/errors rather than silently truncating approved meaning;
- records renderer version and source excerpt ids;
- never invents quotes, learner testimony, or facts absent from the approved event;
- never uses a learner name, voice, face, question, or private data.

Unknown or unsupported destination types remain preview-only with a blocked readiness reason.

## No auto-publication

Event receipt, draft generation, preview rendering, privacy scanning, and approval creation contain no Buffer write. The scheduler is the only component allowed to invoke provider create/update/delete methods, and only from a valid due publish or retraction command. There is no environment flag or hidden endpoint that bypasses human approval, destination selection, and schedule.
