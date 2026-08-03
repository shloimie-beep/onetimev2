# External Authority and Effect Recovery Protocol

## Canonical paths

- Authority record:
  `ops/v2.1-execution/authority/<candidate-or-none>/<task>/<authority-id>/GRANT.yaml`
- Immutable C00-recorded revocation:
  `ops/v2.1-execution/control/authority-revocations/<authority-id>/<sequence>.yaml`
- Current authority status index:
  `ops/v2.1-execution/control/AUTHORITY-STATUS.yaml`
- Immutable effect event:
  `ops/v2.1-execution/effects/<candidate-or-none>/<task>/<effect-id>/events/<sequence>-<state>.yaml`
- Mutable current pointer:
  `ops/v2.1-execution/effects/<candidate-or-none>/<task>/<effect-id>/CURRENT.yaml`
- R45 observation:
  `ops/v2.1-execution/observations/<candidate>/<production-deployment-digest>/OBSERVATION-RECORD.yaml`

Grant and revocation records are append-only, checksum-bound, and contain no
secret. A grant identifies exact external approver evidence, scope, expiry,
candidate, provider asset, operation, budget, and fencing token. C00 does not
grant authority: after validating an external grant or revocation, it updates
the current control-branch authority-status index and provider lock.

Every ready-entry effect lease binds the grant digest, complete
`AUTHORITY-STATUS.yaml` digest, authority status-entry digest, latest revocation
digest (or null), provider-lock lease/fencing token, and check time. Immediately
before each `reserved` event, the worker fetches `origin/codex/v21-control`,
revalidates that all those values are current, status is `active`, the grant is
unexpired, and no later revocation exists. It copies those exact digests into
the event. A revoked, expired, or status-drifted authority cannot reserve a new
effect.

## Effect state machine

```text
reserved -> cancelled | attempted_unknown | succeeded
cancelled -> closed
attempted_unknown -> succeeded | reconciled | cleanup_pending
succeeded -> reconciled | cleanup_pending
reconciled -> cleanup_pending | closed
cleanup_pending -> closed
```

Every transition is a new immutable event linked by `previous_event_digest`;
`CURRENT.yaml` points to the latest event. Before the external call, the
`reserved` event must be committed and pushed. After the call, provider/runtime
readback determines the next state and is committed/pushed.

After the reserved push and immediately before the external call, fetch the
control ref once more. If the authority-status index/revocation head, provider
lock, fencing token, or lease changed, do not call the provider; append
`cancelled` and then `closed`. This closes the check-to-effect race without
reusing the reservation.

On a fresh window, `reserved` or `attempted_unknown` never authorizes a retry.
Read the provider/runtime using the original idempotency key and exact provider
identity first. Retry only when readback proves no effect was accepted and the
fresh control-ref authority status, grant, revocation head, lease, and budget
remain valid. A wrong-provider, stale fencing token,
over-budget, uncleanable, or ambiguous destructive effect is a hard stop.

## Observation recovery

R45 pushes the observation record before starting the 60-minute clock and
checkpoints exact source timestamps and evidence digests throughout. A new
window may continue only when independent metric-source timestamps prove
continuous observation of the unchanged deployment. If a monitoring gap
prevents that proof, candidate/deployment identity changes, or a nonessential
second deployment occurs, record the invalid interval and restart the clock.
