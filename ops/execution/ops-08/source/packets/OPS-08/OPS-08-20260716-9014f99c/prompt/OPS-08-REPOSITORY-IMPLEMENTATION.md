<!-- OPS-08 direct prompt continuation 2 of 3; packet OPS-08-20260716-9014f99c -->

## OPS-08 repository implementation

Implement these safe, reversible controls on the selected code branch. Do not activate a provider or deploy production.

### 1. Configuration validation

Add protected configuration names:

- `PUBLIC_BASE_URL`
- `CANONICAL_HOST`
- `ALLOWED_HOSTS`
- `LEGACY_REDIRECT_HOSTS`
- `CALLBACK_HOSTS`
- `HEALTHCHECK_HOSTS`
- `ENFORCE_HTTPS`
- `TRUSTED_PROXY_HOPS`
- `APP_VERSION`
- `COMMIT_SHA`
- `CUTOVER_MODE`

`CUTOVER_MODE` values:

- `preserve_launch_domain`
- `isolated_staging`
- `authorized_cutover`

Default to `preserve_launch_domain`.

Production rules:

- `PUBLIC_BASE_URL` must be HTTPS, origin-only, and normalized.
- `CANONICAL_HOST` must equal the URL hostname.
- `ALLOWED_HOSTS` must be non-empty and normalized.
- `CALLBACK_HOSTS` must be a subset of allowed application hosts.
- `HEALTHCHECK_HOSTS` must contain only provider-documented healthcheck hosts; for Railway it is `healthcheck.railway.app`.
- A healthcheck host is valid only for `GET` or `HEAD` on the configured health path and must never be canonical, redirected, or accepted on application/callback routes.
- `APP_VERSION` cannot be `local`.
- `COMMIT_SHA` must be 40 lowercase hexadecimal characters.
- `authorized_cutover` must require an authorization-document path and SHA-256 that validates against the packet schema.
- real transport flags remain separately gated and default off.
- no config default may silently change the primary hostname.

Update `.env.example` with names and safe defaults only.

### 2. Host and proxy enforcement

Add middleware before application routes that:

- normalizes Host without trusting arbitrary forwarded headers;
- honors only the configured trusted-proxy hop count;
- returns 421 for unknown hosts;
- permits `healthcheck.railway.app` only for `GET`/`HEAD /health`, with no redirect and no access to any other route;
- rejects malformed, IP-literal, userinfo, port-confused, CRLF, and multiple-host inputs;
- records safe host-rejection metrics;
- never logs cookies, authorization headers, query tokens, or request bodies.

Tests must cover direct and proxied requests, ports, case, trailing dot, punycode normalization, unknown hosts, forged forwarded headers, a successful Railway healthcheck Host request on `/health`, and rejection of that Host on every non-health route.

### 3. Canonical and redirect policy

Create a route-aware policy:

- public GET/HEAD routes may redirect from an approved legacy host to the canonical host with 308;
- preserve path and query;
- fixed legacy path redirects remain explicitly tested;
- POST/PUT/PATCH/DELETE never use a generic hostname redirect;
- webhook, OAuth callback, signed internal, health, ready, and version paths never depend on a generic host redirect;
- callback registrations must point directly at the accepted host;
- no redirect loop;
- `join.onetimeonetime.com` remains approved throughout preparation and for at least 180 days after cutover.

### 4. Canonical URLs, robots, sitemap, analytics, and email links

Remove hard-coded canonical behavior.

- Build page-specific canonical URLs from `PUBLIC_BASE_URL`.
- Open Graph URL must match the page canonical.
- Generate `robots.txt`.
- Generate `sitemap.xml` containing only intended indexable public pages.
- Staging is `noindex, nofollow` and excluded from the sitemap.
- Protected pages remain noindex and private/no-store.
- Add a single server-side URL builder for email, reminder, support, login, class, and content links.
- Add an inventory test that fails on unapproved absolute production host literals.
- Add an analytics origin/configuration contract and dual-host cutover annotation without double counting.

Do not change the configured production origin until exact authorization.

### 5. Source, health, readiness, and version proof

Keep:

- `/health` as lightweight liveness;
- `/ready` as dependency readiness;
- `/version` as safe source/build identity.

Require `/version` to expose:

- application version;
- exact commit SHA;
- target app;
- safe service/environment/deployment identity digests or non-secret deployment labels.

Add startup and CI checks that compare build SHA to runtime configuration. A mismatch must fail readiness.

### 6. Callback safety

For every mounted provider callback:

- parse the exact raw body before global JSON parsing when the provider requires it;
- verify signature and timestamp/freshness using the provider's current official contract;
- perform constant-time comparisons;
- implement durable receipt and idempotency before side effects;
- return direct 2xx quickly;
- reject invalid signature/replay;
- test duplicate deliveries;
- never leak provider errors or secrets;
- never rely on a generic hostname redirect.

Stripe remains TEST-only. Test/live endpoint secrets are distinct.

For Zoom and Vimeo, implement only the safe seam required by the selected source. Do not invent an endpoint or enable a provider when the product branch does not contain the capability.

### 7. Email readiness

- `ONE_TIME_EMAIL_FROM` and `ONE_TIME_EMAIL_REPLY_TO` must validate as `info@onetimeonetime.com` only when authorized real email mode is enabled.
- Staging defaults to sink and requires a protected explicit recipient allowlist for any provider canary.
- Add message-catalog tests for From, Reply-To, link host, unsubscribe classification, and no secret/protected URL leakage.
- Add bounce/complaint durable idempotency and suppression tests when the selected source includes a provider event seam.
- Add read-only SPF/DKIM/DMARC/return-path verification tooling.
- Do not publish DNS or enable real email.

### 8. Synthetic probes and evidence tooling

Add or adapt the packet toolkit under repository-owned paths.

Probes must cover:

- DNS digests/TTLs and resolver agreement;
- TLS;
- redirect chain;
- landing/static assets;
- signup exact-once persistence;
- login/MFA/logout/return-to;
- protected role routes;
- health/ready/version SHA;
- legacy paths;
- Stripe TEST signed event and duplicate;
- Zoom OAuth/launch sandbox;
- Vimeo callback/publication sandbox;
- support-event sandbox;
- email catalog links;
- robots/sitemap/canonical/Open Graph;
- unknown Host.

Destructive probes require an explicit non-production flag and approved fixture identity. Production probe mode is read-only unless the authorization explicitly names a canary.

### 9. Reversible manifests

Generate:

- inventory JSON;
- acceptance report JSON;
- a `readiness_draft` reversible change manifest conforming to the packet schema while authorization is absent;
- explicit nulls for unavailable private digests rather than guessed values;
- private change-set and rollback-set digest references only after the named operators provide them;
- source/service before/after digests;
- callback before/after URL digests;
- config before/after value digests;
- ordered execution and rollback steps.

Never embed raw private values. A `readiness_draft` must have `authorization_sha256=null` and `root_mutation_authorized=false`. It may become `authorized` only after the exact authorization, private DNS/callback/config digests, root fingerprint, and target service evidence all validate.

### 10. Tests and CI

Add focused tests and CI commands for OPS-08. Required minimum:

- config unit tests;
- host/proxy/redirect integration tests;
- canonical/robots/sitemap/email-link tests;
- health/version/source tests;
- route inventory and callback classification tests;
- synthetic probe dry-run tests;
- inventory/schema/reversible-manifest validation;
- no-secret/no-private-DNS scan;
- root-fingerprint mutation guard;
- existing landing/signup/login/portal/provider tests on the selected source;
- build, typecheck, lint, targeted formatting, unit, integration, e2e, accessibility, and performance gates supported by that source.

Do not weaken existing gates to make OPS-08 pass. Record inherited failures separately with exact evidence.
