# Steward Change-Request Protocol

Feature tasks do not edit shared hotspots owned by a steward.

Create a request under the task branch:

`ops/v2.1-execution/runtime/<TASK-ID>/steward-requests/<KIND>-<sequence>.yaml`

Kinds:

- `migration`
- `server_registration`
- `client_registration`
- `worker_registration`
- `config`
- `dependency`
- `contract_barrel`
- `domain_barrel`
- `route_branding`
- `ghl_registry`
- `deployment`

Each request contains exact owning task, rationale, desired semantic change, proposed symbols/routes/config keys/dependencies, compatibility assumptions, requirement/case IDs, verification, and conflicts. Do not paste secrets or raw provider data.

The requester pushes the immutable request on its own task branch. C00 records
the request digest in `control/STEWARD-QUEUE.yaml`, assigns its canonical
steward and target checkpoint, and records `applied` or `rejected` with the
result digest. The requester acknowledges that result before task completion.

F02 owns migrations and its runtime allocation proposal; C00 mechanically
mirrors approved allocations into the global control file. P28 owns the
canonical GHL workflow registry during feature development. F07 owns global
styles/branding. I36 owns final central registration, config, lockfiles,
generated registries, and integration mechanics.
