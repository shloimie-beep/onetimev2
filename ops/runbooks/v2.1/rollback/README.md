# v2.1 Containment and Rollback

Status: mechanism only. The planner produces a non-executable decision record.
It does not deploy, change configuration, stop services, restore data, mutate
DNS, contact customers, or perform provider effects.

## Triggers

Containment begins for cross-household or role authorization failure; secret,
protected-data, raw Zoom, or raw Vimeo exposure; wrong candidate or
configuration; migration or data-integrity failure; loss of a critical login,
class, billing, recovery, or inactive-access guarantee; duplicate account or
HighLevel creation; or queue behavior capable of repeating an external effect.

## Deterministic decision order

1. Contain: disable affected provider effects, stop unsafe queue claims,
   preserve leases/idempotency/logs/readback, stop risky signup or login, retain
   safe read-only paths, and notify both Admins through the secure incident
   route.
2. If web, worker, and matching configuration have one previously recorded
   artifact proven compatible with every applied migration, select application
   rollback. Keep provider effects disabled and never downgrade the database.
3. If that compatibility proof is absent, remain contained and select a
   migration-compatible roll-forward fix. Never improvise reverse SQL or manual
   production schema edits.
4. If database restore is requested, block it until the full destructive
   recovery gate in the backup/restore runbook passes.

The planner returns `executable: false` for every outcome. Execution needs a
separately approved, candidate-bound production change record.

## Application rollback controls

Web and worker move together to the same recorded artifact. Configuration uses
its matching digest. The database remains forward-only. Provider effects stay
disabled until accepted effects have exact readback, rejected effects are
classified for same-idempotency-key retry when safe, acceptance-unknown effects
are quarantined for human reconciliation, and no duplicate communication,
billing, access, or provider mutation remains possible.

## Domain and legacy behavior

Traffic may move only to the recorded safe target or a truthful maintenance
page. Never expose a preview environment. The unsafe old product does not
resume writes or old-password authentication, and the public join bridge
remains safe. Cached redirects and cookie scope require readback.

## Decision record

Record exact trigger, time, environment identity, candidate/configuration,
incident commander, containment completion, compatible artifact proof or reason
for roll-forward, database-restore gate state, external-effect inventory, and
reconciliation result. Use immutable digests and sanitized counts; exclude
secrets, tokens, personal data, child details, and raw provider links.
