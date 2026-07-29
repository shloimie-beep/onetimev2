# One Time v2.1 domain cutover

This runbook is a read-only plan. It does not authorize DNS, deployment,
provider, database, or customer effects.

Before traffic changes, the operator must bind an immutable candidate and
verify the v2.1 pre-cutover acceptance gates, a current backup/restore proof,
the migration-compatible rollback target, exact web/worker identity, and zero
unexpected external effects. If any gate fails, the old application remains
read-only and `join.onetimeonetime.com` remains the safe bridge.

The ordered domain subphase is:

1. Verify HTTPS, origin, and the exact candidate at
   `app.onetimeonetime.com`.
2. Verify application auth cookies omit `Domain`, are `Secure` and
   `HttpOnly`, use `SameSite=Strict`, and are not accepted on Join or marketing
   origins.
3. Verify the approved marketing origins point login to App and signup to
   Join.
4. Verify legacy login/signup links preserve only allowlisted source/UTM
   values; credentials, tokens, email addresses, provider references, and
   arbitrary targets are dropped.
5. Keep `join.onetimeonetime.com` available for at least 30 continuous days.
6. Disable old authenticated mutations and legacy challenge/session issuance;
   do not disconnect the read-only rollback/support boundary before production
   acceptance.
7. Verify Tisha browser paths return the non-interactive `410` ended-event
   page and every Tisha form/API request returns `410` without a write.
8. Observe at least 60 healthy minutes and reconcile identity, queues,
   migrations, effects, and exact web/worker candidate readback.

Every DNS or deployment mutation requires a separately approved, candidate-
bound authority record plus the exclusive infrastructure lock. Stop on a
redirect loop, cookie leakage, wrong origin, unknown effect, or loss of the
rollback boundary.
