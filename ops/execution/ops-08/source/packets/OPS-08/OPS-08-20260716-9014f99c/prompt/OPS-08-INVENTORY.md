<!-- OPS-08 direct prompt continuation 1 of 3; packet OPS-08-20260716-9014f99c -->

## OPS-08 read-only inventory

Create an inventory conforming to `schemas/OPS-08-INVENTORY.schema.json` at:

`ops/evidence/ops-08/inventory.json`

Use the packet toolkit and provider-native read-only commands where available.

### Repository inventory

Capture:

- selected source SHA and ancestry;
- all environment variable names that influence host, URL, cookie, proxy, email, provider, callback, analytics, and worker behavior;
- route table by method/path/class;
- all absolute URLs and hostname literals;
- all redirect calls and status codes;
- all canonical, Open Graph, sitemap, robots, analytics, and email-link generation;
- all OAuth redirect, webhook, callback, return URL, support event, and deep-link definitions;
- all provider dashboard descriptors/manifests in the repository;
- all tests and release evidence relevant to Railway, domains, source SHA, health, callbacks, email, migration, and rollback;
- every use of `PUBLIC_BASE_URL`;
- every current use of `join.onetimeonetime.com` or `onetimeonetime.com`.

Run secret-safe searches. Store findings, not secrets.

### Public DNS inventory

Query read-only:

- `onetimeonetime.com`
- `www.onetimeonetime.com`
- `join.onetimeonetime.com`
- `_dmarc.onetimeonetime.com`
- provider-specific selectors/return-path names only after discovering their names from protected provider evidence

Record A, AAAA, CNAME, MX, TXT, NS, and CAA by owner/type/TTL/RDATA SHA-256. Use at least:

- Google Public DNS DoH;
- Cloudflare DNS;
- one authoritative or approved system resolver.

Do not store private target values. Existing publicly resolvable RDATA may be retained only in private evidence; repository evidence uses digests.

Compute and preserve a root DNS fingerprint. Recompute it after every phase. Any unapproved root drift sets `status=blocked_unapproved_root_drift`.

### HTTP/TLS/domain inventory

For root, join, www, staging, Railway-generated, and candidate hosts, capture:

- resolution;
- HTTP status;
- redirect chain;
- path/query preservation;
- TLS SAN, issuer, chain validity, and expiry;
- HSTS and cache headers;
- canonical and Open Graph URL;
- robots and sitemap behavior;
- `/health`, `/ready`, and `/version`;
- source SHA and service identity;
- unknown-Host behavior.

No browser-only observation counts as DNS/source proof.

### Railway inventory

Use read-only Railway access only.

Capture by digest:

- project;
- environment;
- service;
- deployment;
- source SHA;
- branch/repository metadata;
- Railway-generated domain;
- custom domains and verification state;
- target port;
- healthcheck path/timeout and the Railway request hostname `healthcheck.railway.app`;
- restart, overlap, draining, replica, region, and service role;
- safe predefined variable names relevant to source/deployment identity.

If the CLI is linked to production or service identity is ambiguous, run only read-only commands and set `status=blocked_isolated_staging_required`. Do not deploy.

### Old-application traffic and migration inventory

Identify the old application and its login telemetry source. Use aggregated, privacy-preserving counts.

Eligible account definition:

- paid/current; or
- successful login, class access, reminder, payment, or support interaction in the prior 365 days.

Calculate a continuous 14-day window:

- eligible accounts;
- migrated accounts;
- unresolved identity conflicts;
- unique eligible accounts with a successful old-app authenticated session;
- new-app login attempts and successes;
- synthetic login success;
- P0/P1 auth incidents;
- seven-day auth-support ticket rate.

The migration gate passes only when:

- migrated equals eligible;
- identity conflicts equal 0;
- successful old-app accounts equal 0 for 14 days;
- new-app login success is at least 99.0%;
- synthetic login success is at least 99.9%;
- no P0/P1 auth incident occurred for 14 days;
- auth support rate is at most 1% and no high-severity ticket is unresolved.

If telemetry access is unavailable, record the exact access/owner/evidence needed and keep the gate blocked.

### Email inventory

For `info@onetimeonetime.com`, capture read-only:

- mailbox existence and reply handling;
- MX provider;
- every authorized sending service;
- the single SPF policy and lookup count;
- DKIM selectors and alignment;
- DMARC policy/reporting and aligned sources;
- envelope return-path;
- From and Reply-To configuration;
- provider TLS and forward/reverse DNS responsibility;
- bounce/complaint webhook;
- suppression behavior;
- unsubscribe obligations by template class;
- every hostname used in email links;
- staging recipient allowlist and sink behavior.

Repository history reports a default-off Resend seam, but do not assume Resend is active. Provider dashboard evidence determines the sender.

Never change email DNS during OPS-08 audit/preparation.

### Callback inventory

Complete every row in the callback matrix with exact private dashboard evidence and repository-safe digests.

At minimum inventory:

- Stripe TEST webhook endpoints, event sets, endpoint-specific secrets by digest, success/cancel return URLs;
- Zoom OAuth redirect URLs, OAuth state behavior, launch origin, event webhooks;
- Vimeo callback URLs, event set, current signature/replay contract;
- internal OT-86 publication and social endpoints;
- email-provider bounce/complaint endpoints;
- support-system event endpoints;
- analytics allowed origins;
- landing/signup/login/deep links;
- all historical email links.

Do not classify `/internal/content-publications/v1/manifests` as a Vimeo provider callback.
