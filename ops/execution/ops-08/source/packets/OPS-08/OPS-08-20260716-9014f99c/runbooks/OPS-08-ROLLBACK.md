# OPS-08 Rollback Runbook

**Task:** OPS-08  
**Packet:** OPS-08-20260716-9014f99c  
**Objective:** Restore the last-known-good source, routing, callback, and link behavior without data loss.  
**Authority:** The named OPS-08 rollback owner may execute the private rollback manifest when any trigger fires. Rollback does not require a new approval inside the authorized maintenance window.

## OPS-08 automatic rollback triggers

Execute rollback when any one condition is met:

1. Source identity
   - Railway deployment SHA and `/version` SHA do not both equal the authorized target SHA.
   - A request reaches an unapproved Railway service or environment.

2. Availability
   - HTTP 5xx exceeds 5% in any one-minute window, or 2% in two consecutive five-minute windows.
   - `/ready` fails twice consecutively from two probe regions.
   - TLS hostname, chain, or expiry validation fails from two independent probes.

3. Authentication
   - login success falls below 98% for five consecutive minutes;
   - any session fixation, cross-account session, CSRF bypass, MFA bypass, or cookie-domain error is observed;
   - any eligible user can authenticate only through the old application.

4. Signup/data integrity
   - signup persistence failure exceeds 1% in any five-minute window;
   - one confirmed signup is acknowledged but not durably stored;
   - duplicate/idempotency behavior creates more than one durable lead for one approved canary.

5. Callbacks and integrations
   - a required signed callback has less than 99% successful direct delivery over five minutes;
   - a known valid canary fails signature verification;
   - a callback receives a 3xx response;
   - Stripe TEST, Zoom, Vimeo, email-provider, or support events are delivered only to an inactive host;
   - Zoom launch or Vimeo content access loses authorization boundaries.

6. Email
   - SPF, DKIM, or DMARC fails for an authorized canary;
   - the visible From or Reply-To is not `info@onetimeonetime.com`;
   - the return-path is not the approved aligned provider path;
   - hard-bounce rate exceeds 2%;
   - complaint rate reaches 0.10%;
   - an email link points to an unavailable or unintended hostname.

7. DNS/canonical behavior
   - resolvers disagree beyond twice the changed record's previous TTL plus 15 minutes;
   - the root or an email DNS record changes outside the authorized private manifest;
   - the primary host loops, drops path/query, or redirects a webhook/OAuth callback;
   - `join.onetimeonetime.com` becomes unavailable.

8. Product safety
   - landing, login, reminders, Stripe TEST webhooks, Zoom launch, Vimeo callbacks/content flow, support events, or required deep links are lost;
   - a live payment, unapproved provider send, or unintended access grant occurs.

The monitor may also request rollback for a credible risk not represented by a numeric trigger.

## OPS-08 immediate actions

1. The rollback owner states `OPS-08 ROLLBACK STARTED` in the incident channel with the authorization ID and UTC timestamp.
2. Freeze all additional DNS, deployment, callback, email, and provider changes.
3. Preserve logs, request IDs, resolver evidence, provider delivery IDs, and screenshots. Do not paste secrets or raw private DNS values.
4. Disable traffic promotion/canary automation.
5. Keep database writes available unless the incident is a confirmed data-integrity or security event.
6. For a security event, revoke affected sessions and provider credentials under the relevant incident runbook; do not improvise credential rotation in DNS chat.

## OPS-08 rollback order

### Step 1 — application/source

1. Re-activate the previous Railway deployment or deploy the recorded previous source SHA to the recorded previous service.
2. Verify the previous `/health`, `/ready`, and `/version`, including Railway's `healthcheck.railway.app` Host on `/health` and rejection of that Host on non-health routes.
3. Confirm schema compatibility before directing traffic. OPS-08 never rolls back a database migration destructively.
4. If the new schema is additive and backward-compatible, keep it dormant.
5. If the previous application cannot run against the new schema, route traffic to the preserved previous service/database path documented in the private rollback manifest and escalate; do not drop columns or data during the incident.

### Step 2 — callbacks

1. Re-enable every prior callback registration using the private rollback manifest.
2. Disable the candidate callback only after the prior endpoint has a successful signed canary.
3. Stripe TEST:
   - restore the prior test endpoint;
   - use its prior endpoint-specific secret;
   - resend one retained test event and one duplicate;
   - require direct 2xx, signature pass, and idempotent handling.
4. Zoom:
   - restore the prior authorized redirect and launch origin;
   - retain the candidate redirect until active sessions are understood, unless it is the incident cause.
5. Vimeo, email-provider, and support events:
   - restore prior endpoints and subscriptions;
   - verify durable receipt and deduplication.
6. Never rely on a generic HTTP redirect for callback rollback.

### Step 3 — DNS and routing

1. The DNS operator verifies the private rollback-set SHA-256 against the authorization.
2. Apply rollback operations in the exact recorded order.
3. Restore record values before increasing TTLs.
4. Do not change MX, SPF, DKIM, DMARC, or return-path unless the incident was an explicitly authorized email-DNS change. The standard OPS-08 cutover contains no email-DNS mutation.
5. Read back owner, type, TTL, and value digest for every restored record.
6. Query Google, Cloudflare, and an authoritative/system resolver until the prior value digests are visible.
7. Keep both old and new services online during resolver convergence.

### Step 4 — canonical and link behavior

1. Set the application canonical origin back to the prior approved origin.
2. Restore prior public redirect rules.
3. Confirm `join.onetimeonetime.com` serves all legacy email links and deep links.
4. Confirm sitemap, robots, analytics origin, and Open Graph URLs match the restored origin.
5. Purge only caches named in the private rollback manifest. Do not perform broad cache invalidation without evidence.

## OPS-08 rollback verification

The rollback is technically complete only after all of the following pass twice, five minutes apart:

- root, launch, and prior primary DNS value digests match the rollback manifest from three resolver paths;
- TLS is valid for every active hostname;
- prior `/version` SHA and service identity match;
- landing and signup load;
- one approved synthetic signup is durably stored exactly once;
- login, MFA if applicable, logout, and return-to deep links work;
- owner/admin, parent, and student protected routes enforce correct authorization;
- reminders remain in the intended mode;
- Stripe TEST webhook direct delivery, signature, and idempotency pass;
- Zoom launch authorization passes;
- Vimeo callback/content flow passes;
- support event intake passes;
- no callback is receiving 3xx;
- `info@onetimeonetime.com` canary authenticates and every link resolves;
- `join.onetimeonetime.com` remains available.

## OPS-08 post-rollback actions

1. Set state to `rolled_back`.
2. Keep the failed target and evidence intact; do not delete the deployment or logs.
3. Export provider delivery reports and resolver evidence by digest.
4. Record impact start/end, detected trigger, exact changed IDs, and recovery evidence.
5. Continue monitoring for at least 120 minutes.
6. Restore ordinary TTLs only after the rollback is stable and the DNS operator approves the TTL restoration.
7. Open a corrective repository change; do not retry the cutover in the same window unless the technical owner, product owner, DNS operator, monitor, and rollback owner issue a new exact authorization.
8. Any live payment, unintended send, unauthorized access, or data integrity issue becomes a separate incident with provider/security ownership.

## OPS-08 failed rollback escalation

If the private rollback set cannot be applied or the previous service is unhealthy:

1. keep `join.onetimeonetime.com` on the last known working path whenever possible;
2. serve an approved maintenance response only for public GET/HEAD routes;
3. keep webhook endpoints returning direct, signed, durable responses where safe;
4. do not redirect signed callbacks to a maintenance page;
5. preserve the database and provider event queues;
6. escalate to Railway, DNS, and provider support using private account references;
7. maintain the `rolled_back` state with `restore_probe_passed=false` until full restoration is proven.
