# OT-80 Remaining

1. Commit and push the OT-72 checkpoint records.
2. Implement Day-One communications directly from the preserved archive unless
   a late refetch discovers a safe communications implementation lane.
3. Integrate OT-73 landing corrections, OT-75 release/observability tooling,
   and OT-76 strict certification harness.
4. Reconcile migrations, routes, app shell, public bundles, worker/outbox,
   action/route registry, and release manifest.
5. Run strict certification and CI, then publish one draft PR.
6. Attempt isolated staging only after gates allow it.

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
