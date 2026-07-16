<!-- OPS-08 cutover runbook continuation 1 of 2; packet OPS-08-20260716-9014f99c -->

## OPS-08 preparation timeline

### T-14 days or earlier — persist and freeze facts

1. Verify `CHECKSUMS.sha256`.
2. Create `ops/codex-runs/OPS-08/state.json` before changing repository code.
3. Capture the repository graph, open PRs, candidate SHAs, and ancestry.
4. Select one audit candidate, not a production target. Record the selection algorithm and SHA.
5. Capture read-only public DNS from at least three resolver paths. Store RDATA digests, TTLs, and resolver agreement.
6. Capture read-only Railway project/environment/service/deployment/domain/port/health/version metadata.
7. Capture provider callback registrations and exact event sets in private evidence; store only URL and secret digests in repository evidence.
8. Capture all current email DNS and sending sources in private evidence; store only digests in repository evidence.
9. Start the 14-day old-app login and new-app login evidence window.
10. Freeze new untracked callback origins and untracked email-sending sources.

No DNS TTL is changed in this phase.

### T-7 days — isolated staging and dual-origin proof

1. Deploy the exact selected SHA only to isolated staging after staging authorization.
2. Set `APP_VERSION` and `COMMIT_SHA` from the immutable build/deployment source; production-like startup must reject `local`.
3. Set staging to noindex and block public search indexing.
4. Exercise the complete route/probe plan against the Railway-generated domain and the staging custom hostname.
5. Prove host allowlisting:
   - approved hosts succeed;
   - `healthcheck.railway.app` succeeds only on `GET`/`HEAD /health` and receives 421 on non-health routes;
   - an unknown `Host` receives 421;
   - provider callbacks are accepted only on explicitly registered callback hosts;
   - forwarded-host handling matches the configured trusted-proxy hop count.
6. Prove canonical generation, sitemap, robots, analytics origin, and email-link generation from one configured primary origin.
7. Run Stripe TEST webhook canaries with an endpoint-specific test secret and no redirects.
8. Run Zoom sandbox/OAuth callback proof without exposing protected launch URLs.
9. Run Vimeo callback/readiness proof using the current official account requirements.
10. Run support-event and deep-link canaries.
11. Send deliverability canaries only to an approved recipient allowlist. Real campaign/reminder sending remains disabled.

### T-72 hours — optional low-TTL preparation

This phase requires a separate DNS-operator approval for TTL-only changes.

1. The root/apex remains untouched, including its TTL.
2. MX, SPF, DKIM, DMARC, return-path, and all email DNS remain untouched.
3. Only records named in the approved private TTL manifest may be lowered.
4. Affected non-root application records may be set to 300 seconds when their current TTL is greater than 300.
5. Preserve the before TTL and value digest for every record.
6. Query three resolver paths until the new TTL is observed.
7. If any value changes while lowering TTL, stop and execute rollback; a TTL-only phase must not alter RDATA.

### T-24 hours — final gate readback

1. Re-fetch the authorized target SHA and prove it is the deployed SHA.
2. Prove staging health, readiness, version, database migration compatibility, and rollback compatibility.
3. Re-run all synthetic probes and signed callback canaries.
4. Confirm migration metrics:
   - migrated accounts equal eligible accounts;
   - unresolved identity conflicts equal zero;
   - successful old-app accounts over the prior 14 days equal zero;
   - new-app login success over the prior 14 days is at least 99.0%;
   - no P0/P1 authentication incident occurred in the prior 14 days.
5. Confirm the root fingerprint still equals the audit fingerprint.
6. Confirm `join.onetimeonetime.com` remains active and unchanged.
7. Confirm the current and rollback provider registrations are still present.
8. Confirm the old application remains warm and its data path remains readable.
9. Validate the exact authorization document and the private change-set/rollback-set digests.
10. Set state to `authorized_window_pending`. Any failed check returns the state to the corresponding blocked status.

### T-2 hours — operational freeze

1. Freeze application deploys, schema changes, DNS edits, provider callback changes, email DNS changes, and template/link changes.
2. Announce the window to the monitor, rollback owner, DNS operator, application owner, and support owner.
3. Start one-minute synthetic probes from at least three regions.
4. Capture baseline error, latency, login, signup, callback, reminder, email, and support metrics.
5. Confirm incident communication channels and status ownership.
6. Open the private change set and private rollback set in read-only mode; do not copy values into chat, GitHub, logs, or this packet.
