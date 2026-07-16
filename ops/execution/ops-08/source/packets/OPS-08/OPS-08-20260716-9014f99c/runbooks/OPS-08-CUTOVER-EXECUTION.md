<!-- OPS-08 cutover runbook continuation 2 of 2; packet OPS-08-20260716-9014f99c -->

## OPS-08 execution sequence

The exact DNS action is architecture-specific. The order below is invariant.

### Phase 0 — deploy and source verification

1. Promote or deploy only the authorization's exact target SHA to the authorization's exact Railway project/environment/service.
2. Do not enable public custom-domain traffic yet.
3. Verify:
   - Railway deployment source SHA;
   - `GET /version` SHA;
   - `GET /health` 200 under the normal service host;
   - Railway deployment healthcheck 200 with request Host `healthcheck.railway.app`;
   - the same healthcheck Host receives 421 on `/`, `/ready`, `/version`, login, application, and callback routes;
   - `GET /ready` 200;
   - expected target port;
   - startup and migration logs contain no production migration-on-start;
   - all protected transports remain in their authorized modes.
4. Any SHA mismatch is an immediate stop.

### Phase 1 — provider/callback candidate proof

1. Register or enable the candidate URL only when the authorization includes the provider action.
2. Keep the current callback active when the provider permits dual registration.
3. For Stripe TEST:
   - use the candidate endpoint's unique test signing secret;
   - submit signed canary events;
   - require raw-body signature verification, idempotent duplicate handling, and direct 2xx with no 3xx.
4. For Zoom:
   - keep the current OAuth redirect authorized;
   - add the candidate redirect only when allowed;
   - verify OAuth state and exact redirect URI use;
   - verify launch access without logging protected launch targets.
5. For Vimeo:
   - verify the exact current signature/replay contract and event set;
   - keep existing callback delivery available through rollback.
6. For support and email-provider events:
   - verify signature, idempotency, durable receipt, and no redirect.
7. Do not continue when any required provider cannot keep a reversible current registration or when the candidate canary fails.

### Phase 2 — DNS/operator action

1. The DNS operator confirms the authorization ID, target SHA, target service digest, maintenance window, monitor, rollback owner, change-set digest, and rollback-set digest.
2. The DNS operator applies only the private record operations, in manifest order.
3. No email DNS record is changed.
4. No unlisted root record is changed.
5. The operator reads back each owner, type, TTL, and value digest.
6. The monitor performs three-resolver DNS checks and TLS checks.
7. Do not use browser success alone as DNS proof.

### Phase 3 — canonical behavior

After the intended primary hostname resolves and TLS is valid:

1. Probes hit the primary hostname directly.
2. Public GET/HEAD routes on legacy application hosts may redirect with 308 only when the route matrix says redirect is safe.
3. Webhook, OAuth callback, signed internal, health, ready, and version paths never depend on a generic hostname redirect.
4. `join.onetimeonetime.com` remains available:
   - it may continue serving the application, or
   - it may redirect only public GET/HEAD routes while callback exclusions remain direct.
5. Preserve path and query strings. URL fragments cannot be preserved by an HTTP redirect and must be handled by client-side deep-link tests.
6. Canonical tags, Open Graph URLs, sitemap URLs, robots rules, analytics origin, and generated email links must agree with the authorized primary origin.
7. Existing email messages and bookmarks pointing at `join.onetimeonetime.com` must continue working.

### Phase 4 — functional canary

Run, in order:

1. landing page and static assets;
2. signup form validation and one approved synthetic persistence transaction;
3. login, MFA where applicable, logout, session rotation, and return-to deep links;
4. owner/admin CRM and dashboard;
5. parent and student portals;
6. reminders in sink/test mode, then authorized email canary;
7. Stripe TEST webhook and billing projection;
8. Zoom launch authorization without exposing the target;
9. Vimeo callback/publication and content deep link;
10. support event intake;
11. legacy path redirects;
12. sitemap, robots, analytics, privacy, terms, and 404 behavior.

No canary may charge a payment method, create a live provider object, message an unapproved recipient, or grant unintended access.

### Phase 5 — observation

1. Observe continuously for at least 120 minutes before declaring the window successful.
2. Keep one-minute probes for the first 30 minutes, then five-minute probes through 24 hours.
3. Watch exact rollback triggers from `runbooks/OPS-08-ROLLBACK.md`.
4. Record DNS/TLS state every five minutes during the first hour.
5. Record source SHA, service, deployment, callback status, and error metrics at T+0, T+15, T+30, T+60, T+120.
6. Do not remove old DNS targets, old callbacks, old service, or `join.onetimeonetime.com`.

## OPS-08 post-cutover retention

- Keep the previous service warm for at least seven days and for at least twice the maximum pre-cutover TTL plus 24 hours, whichever is longer.
- Preserve `join.onetimeonetime.com` for at least 180 days.
- Removing the launch hostname requires a separate authorization and 30 consecutive days of zero required callback use plus no unresolved deep-link/support evidence.
- Preserve rollback manifests, authorization, resolver evidence, synthetic reports, and callback canaries according to the repository evidence policy.
- Restore lowered non-root TTLs only after 24 hours of healthy observation and a DNS-operator-approved TTL restoration manifest.
- DMARC enforcement, email provider migration, nameserver migration, and application cutover are independent changes unless the authorization explicitly combines them.

## OPS-08 completion state

Set `cutover_complete` only when:

- 24-hour monitoring passes;
- all acceptance gates still pass;
- root, launch, primary, TLS, source, callbacks, email links, and analytics read back correctly;
- no critical flow loss occurred;
- the rollback path remains available;
- the product owner and technical owner record completion.

Otherwise remain in `cutover_observing` or execute rollback.
