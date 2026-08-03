# v2.1 Backup and Restore Gate

Status: mechanism only. This runbook does not authorize or perform a backup,
restore, deployment, provider operation, production mutation, or destructive
recovery. Real R44 evidence is absent and this gate is not passed.

## Gate boundary

Before any production schema or data mutation, an operator must bind the exact
candidate and change authority, then supply a completed encrypted production
backup or recoverable point-in-time marker no more than 30 minutes old.
Provider status by itself is not evidence. The record must identify the exact
source database and include:

- backup identifier and point-in-time marker;
- creation and completion timestamps;
- encrypted state;
- schema/migration and aggregate-row fingerprints;
- object checksum and post-completion verification timestamp, both completed
  before mutation and evaluation;
- retention expiry at least 35 days after creation;
- restore procedure version.

Future-dated creation, completion, or checksum evidence fails closed, as does
any placeholder source, backup, point-in-time, procedure, or isolated-target
identity. Run the pure validator in
`scripts/operations/v21/backup-restore/evidence.ts` before provider or data
access. Any missing, malformed, expired, mismatched, or stale field fails
closed.

## Isolated restore drill

A restore drill is current for at most 90 days and becomes invalid immediately
after a material architecture change. The operator-created record must prove:

1. the selected backup decrypted and restored into an isolated target;
2. migrations, checksums, and aggregate fingerprints matched;
3. Admin roles matched and no sessions survived;
4. network isolation and least-privilege access held;
5. class/content/audit/outbox state matched;
6. receipt-journal recovery matched;
7. purge ledger and independent replica recovered;
8. a deleted seed remained deleted;
9. all provider effects were disabled;
10. measured RPO was no more than 15 minutes and RTO no more than 30 minutes;
11. cleanup occurred only after recorded authorization.

Traffic remains disabled until purge-ledger replay, negative deletion proof,
and the complete signed evidence have been independently reviewed. A production
replacement is never implied by an isolated restore.

## Destructive recovery

A production database restore is blocked unless the incident commander declares
recovery necessary, all web and worker writes are stopped, the exact restore
point and loss window are known, later provider effects are inventoried, the
isolated restore passes, production replacement has explicit authority, and
post-restore provider/outbox reconciliation is ready. No reverse SQL, manual
schema edit, or restore over a live database is allowed.

The deterministic planner in
`scripts/operations/v21/backup-restore/rollback.ts` reports gate state only. Its
`executable` field is always `false`.

## Evidence handling

Evidence contains immutable identifiers, digests, timestamps, sanitized counts,
and decisions only. Never include secrets, credentials, raw provider URLs,
personal data, customer payloads, or unsanitized database contents.
