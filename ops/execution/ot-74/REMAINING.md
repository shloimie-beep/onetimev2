# OT-74 Remaining Work

1. PostgreSQL 16 CI proof remains pending remote CI; local verification used
   the repo pg-mem migration path and did not connect to a production database.
2. OT80 must mount the router/component explicitly; OT74 intentionally left all
   hooks unmounted.
