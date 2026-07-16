# Human approval, audit, correction, and retraction contract

## Authorization

Use existing repository roles/permissions. Separate capabilities for viewing drafts, editing drafts, approving/scheduling, retrying provider failures, and requesting/confirming retraction. A service account cannot self-approve generated content. Authorization is checked server-side for every action.

## Approval evidence

Approval records:

- approval id and opaque actor id;
- UTC time and policy version;
- tenant/content/version/draft/revision ids;
- exact revision SHA-256 and ordered media checksums;
- destination ids/platform/capability versions;
- scheduled time and IANA timezone;
- privacy scan/attestation result;
- correlation id and optional sanitized operator rationale.

Changing any bound value invalidates approval and any pending publish command.

## Publish command gate

A command is executable only when its schema is valid, schedule is due, revision and approval checksums match current immutable records, destination remains ready, privacy flags are all false, no superseding/cancel/retraction exists, and the actor authorization decision is still valid under repository policy. The scheduler acquires a lease/lock to prevent concurrent execution and records causation.

## Audit events

Audit at minimum:

- event accepted/rejected/quarantined;
- draft generated/edited/superseded;
- privacy scan pass/fail;
- approval granted/invalidated;
- destination/schedule selected or changed;
- command created/leased/reconciled/retried;
- provider create/update/cancel/delete result;
- correction and retraction request/result;
- readiness/configuration state changes.

Audit excludes access tokens, raw provider headers, private learner data, and unapproved raw transcript. It stores safe ids, checksums, status codes, actor/service ids, UTC times, authorization decision ids, and correlation/causation ids.

## Correction

A correction never mutates a published approved revision. Create a new draft revision, rerun privacy scan, require a new approval and schedule, and link it to the original provider post. If provider update is supported and the post is still scheduled/unpublished, the adapter may update after reconciliation. Otherwise create a new corrective post workflow and record the relationship.

## Retraction

An authorized request moves to `retraction_requested`. Reconcile provider state first.

- When automatic deletion is supported and positively confirmed, enter `retracted` and store confirmation evidence hash/time.
- When unsupported, unauthorized, ambiguous, or not confirmable, enter `retraction_manual_required`, create an operator task with safe destination/post references, and keep the item visibly open.
- Manual confirmation of removal requires an authorized human, timestamp, evidence reference, and audit; only then transition to `retracted`.
- A provider timeout or `2xx` without confirmable post absence is not sufficient evidence of retraction.

## Retention

Retain audit, approvals, commands, checksums, and provider ids according to existing compliance policy even after cancellation/retraction. Do not retain rejected learner/private payload bodies longer than needed for security handling; store hashes and safe reason codes where possible.
