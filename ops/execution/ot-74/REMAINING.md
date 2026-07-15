# OT-74 Remaining Work

1. Commit the implementation candidate.
2. Push `codex/ot74-audience-reconciliation`.
3. Open a draft PR against `codex/ot60r-recovery-convergence` if GitHub auth
   allows it.
4. PostgreSQL 16 CI proof remains pending remote CI; local verification used
   the repo pg-mem migration path and did not connect to a production database.
5. OT80 must mount the router/component explicitly; OT74 intentionally left all
   hooks unmounted.
