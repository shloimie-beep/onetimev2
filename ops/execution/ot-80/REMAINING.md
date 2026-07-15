# OT-80 Remaining

1. Commit and push the OT-76 certification harness checkpoint records.
2. Run final OT80 convergence certification and decide draft PR handoff while
   candidate remains `NOT_READY`.
3. Reconcile migrations, routes, app shell, public bundles, worker/outbox,
   action/route registry, and release manifest.
4. Run strict certification and CI, then publish one draft PR.
5. Attempt isolated staging only after gates allow it.

Carried from OT-71: combined proof, CI evidence, screenshots, draft PR, and
publication handoff remain pending until final OT80 convergence.

Carried from OT-74: PostgreSQL 16 CI and final mounted-route certification
remain pending until final OT80 convergence. The canonical audience path is
dry-run only and does not authorize production imports, sends, provider
mutations, or contact deletion.

Carried from OT-72: remote PostgreSQL assurance rerun remains pending after
OT80 push. Provider integrations remain default-off and no live charge, send,
webhook registration, provider mutation, deployment, DNS change, or production
database mutation is authorized.

Carried from Day-One communications: parent/student activation, password reset,
MFA recovery, support, and delayed-access protected-route sends remain dormant
until their state machines, routes, authorization, expiry/revocation rules, and
provider paths are real and tested.

Carried from OT-73: final cross-lane screenshot/accessibility/performance proof
remains pending until OT80 final certification. Public landing and signup
behavior is merged, and no deployment was performed.

Carried from OT-75: staging activation remains blocked on explicit external
evidence for Railway/service names, staging domain, backup/PITR, restore drill,
active source SHA, migration ledger checksum, database reference drift,
duplicate-data audit, worker isolation, provider-state readback, and
owner/admin bootstrap. These are activation-only blockers; OT75 introduced no
external mutation.

Carried from OT-76: audit mode passes, but strict Day-One certify mode fails
honestly with 10 blockers. The current candidate is not Day-One certified.
