# OPS-08 Rollback Runbook

Status: readiness draft only. No cutover was performed.

Rollback prerequisites for a future authorized window:

1. Private DNS before snapshot digest and rollback-set digest.
2. Previous service/deployment digest and confirmed warm service.
3. Previous callback registration digest and rollback-set digest.
4. Named rollback owner and monitor.
5. Restore old canonical config, confirm join.onetimeonetime.com, then verify health, ready, version, login, signup, callback canaries, and DNS fingerprints.
