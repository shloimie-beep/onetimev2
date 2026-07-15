# OT-80 Remaining

1. Commit and push the OT-74 checkpoint records.
2. Integrate OT-72 provider sandbox/default-off infrastructure and reconcile
   provider-truth migration numbering.
3. Implement Day-One communications directly from the preserved archive unless
   a late refetch discovers a safe communications implementation lane.
4. Integrate OT-73 landing corrections, OT-75 release/observability tooling,
   and OT-76 strict certification harness.
5. Reconcile migrations, routes, app shell, public bundles, worker/outbox,
   action/route registry, and release manifest.
6. Run strict certification and CI, then publish one draft PR.
7. Attempt isolated staging only after gates allow it.

Carried from OT-71: combined proof, CI evidence, screenshots, draft PR, and
publication handoff remain pending until final OT80 convergence.

Carried from OT-74: PostgreSQL 16 CI and final mounted-route certification
remain pending until final OT80 convergence. The canonical audience path is
dry-run only and does not authorize production imports, sends, provider
mutations, or contact deletion.
