# One Time v2.1 domain rollback

Rollback starts with containment: disable the affected external-effect
capability, preserve leases/idempotency/readback, and stop new queue claims if
replay safety is uncertain. Web and worker roll back together only to a
recorded migration-compatible artifact; the database is not automatically
downgraded.

If the new application cannot safely accept traffic:

- switch public login/signup calls to action to a truthful maintenance or
  transition page;
- keep `join.onetimeonetime.com` as the safe bridge;
- never restore old writes or old-password authentication;
- use only the recorded prior DNS target, never preview content;
- verify cached redirects and host-only cookie scope after the change;
- reconcile every accepted or unknown provider effect by exact provider ID.

Database restore is outside this runbook and requires the destructive-recovery
procedure, exact restore point, isolated-target proof, explicit authority, and
post-restore effect reconciliation.
