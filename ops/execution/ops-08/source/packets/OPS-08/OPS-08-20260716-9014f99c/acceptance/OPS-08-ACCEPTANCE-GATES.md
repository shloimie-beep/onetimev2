# OPS-08 Acceptance Gates

**Task:** OPS-08  
**Packet:** OPS-08-20260716-9014f99c  
**Rule:** Every pre-cutover gate is fail-closed. `not_observed`, `not_run`, a missing digest, or missing access is a failure for cutover. Safe repository work may still complete and transition to `ready_for_dns_operator_action`.

## OPS-08-G00 — Packet integrity and durable state

Pass only when:

- every manifest path and every file listed in `CHECKSUMS.sha256` verifies, with no missing or extra packet file;
- `ops/codex-runs/OPS-08/state.json` exists before any repository modification and records the packet-manifest and checksum-file SHA-256 values;
- the state contains `task_id=OPS-08`, this packet ID, current phase, exact source SHA, command/evidence log paths, and mutation counters;
- every phase transition is written atomically and timestamped;
- secret scanning confirms no credential, raw private DNS target, provider token, webhook secret, mailbox password, Zoom launch URL, Vimeo access token, or Stripe secret is present.

## OPS-08-G01 — Immutable source and convergence

Pass only when:

- one immutable 40-character Git SHA is selected;
- the selected SHA is fetched directly from `webcraft-media/onetimev2`;
- `git status --porcelain` is empty before implementation;
- ancestry proves the selected SHA contains the accepted OT-81 product/certification foundation or an explicitly superseding accepted anchor;
- the selected SHA contains all application capabilities being cut over;
- separate draft branches required by the selected product scope are either converged into the SHA or explicitly excluded without removing a currently live flow;
- the selected SHA is recorded as an audit/implementation target, not a production authorization;
- the release branch and PR state are recorded;
- no branch name is used as a substitute for the SHA.

The audited baseline `97fa0c91758888f4e9de0af17d70002a0124669f` is an audit anchor only. It is not automatically the final source.

## OPS-08-G02 — Repository-side cutover controls

Pass only when tests prove:

- production requires a non-`local` `APP_VERSION`;
- production requires `COMMIT_SHA` to equal a 40-character lowercase Git SHA;
- `PUBLIC_BASE_URL` is an HTTPS origin with no path, query, or fragment;
- `CANONICAL_HOST` exactly matches the `PUBLIC_BASE_URL` hostname;
- `ALLOWED_HOSTS` is non-empty in production and contains only normalized hostnames;
- unknown Host values receive 421 before application routing;
- `healthcheck.railway.app` is accepted only for `GET`/`HEAD /health` and rejected on all other routes;
- trusted-proxy hop count is explicit and tested;
- HTTP-to-HTTPS and legacy-host redirects apply only under the route policy;
- webhook, OAuth callback, internal signed, health, ready, and version routes do not depend on a generic redirect;
- canonical tags are page-specific and derived from `PUBLIC_BASE_URL`;
- sitemap and robots output is host-aware;
- staging is noindex;
- generated email links use one centralized URL builder;
- `/version` reports exact source SHA and safe deployment identity;
- the read-only inventory, synthetic probe, callback-matrix, deliverability, and reversible-manifest validators run in CI;
- no real transport is enabled by these changes.

## OPS-08-G03 — Isolated Railway staging

Pass only when:

- staging has a distinct Railway project or an environment/service boundary proven not to be production;
- project, environment, service, deployment, domain, and target-port identifiers are captured by digest;
- the exact selected SHA is deployed;
- Railway source metadata and `/version` both equal that SHA;
- `/health` returns 200 for 30 consecutive one-minute probes;
- `/ready` returns 200 for 30 consecutive one-minute probes;
- Railway-generated domain and staging custom domain both pass TLS and route tests;
- healthcheck path, `healthcheck.railway.app` request-host handling, timeout, restart policy, overlap/draining behavior, and target port are recorded;
- the Railway deployment healthcheck passes while the same healthcheck Host is denied on non-health routes;
- staging has no production database, no production secrets, no live provider callbacks, and no unrestricted real recipients.

Repository-reported `READY_FOR_STAGING_AUTH` is not a pass.

## OPS-08-G04 — Critical product flows

Pass only when all tests pass against the exact staging deployment:

- landing 200 and all critical static assets 200;
- signup validation works and one synthetic lead persists exactly once;
- compatibility endpoint behavior remains deliberate and tested;
- login success, bad password, rate limit, CSRF, MFA when applicable, logout, session rotation, and return-to paths pass;
- owner/admin CRM and dashboard authorization pass;
- parent and student portal isolation pass;
- reminders remain sink/test unless separately authorized;
- Stripe TEST event, duplicate, invalid signature, and stale timestamp cases pass;
- Zoom OAuth state/redirect and authorized launch pass without exposing protected targets;
- Vimeo callback/publication, duplicate, invalid signature, and content deep link pass according to the current provider contract;
- support event intake and duplicate handling pass;
- `/one-time`, `/one-time/signup`, and `/rabbi-member` redirect exactly once to the expected path;
- required historical `join.onetimeonetime.com` deep links still resolve.

Any confirmed acknowledged-but-not-persisted signup is an immediate failure.

## OPS-08-G05 — Host, canonical, SEO, analytics, and cache

Pass only when:

- root, launch, intended primary, www, staging, Railway-generated, and callback-only hosts have an explicit disposition;
- unknown hosts receive 421;
- public canonical host behavior has no loop and preserves path/query;
- signed callback routes return no 3xx;
- public pages have page-specific canonical URLs;
- Open Graph URLs agree with canonical URLs;
- protected pages are `noindex` and `private, no-store`;
- staging robots policy blocks indexing;
- primary robots and sitemap use the authorized origin;
- analytics accepts the new origin without double-counting the dual-host window;
- static cache policy cannot retain an obsolete canonical document longer than the rollback plan accounts for.

## OPS-08-G06 — Old-application migration completion

Define an eligible account as any account that is paid/current or had a successful login, class access, reminder, payment, or support interaction in the prior 365 days.

Pass only when, for a continuously measured 14-day window:

- `migrated_accounts == eligible_accounts`;
- unresolved identity conflicts equal 0;
- successful authenticated old-app accounts equal 0;
- new-app login success rate is at least 99.0%;
- synthetic new-app login success is at least 99.9%;
- no P0/P1 authentication incident occurred;
- seven-day auth-related support tickets are at most 1% of eligible accounts and no high-severity ticket is unresolved;
- password reset, MFA recovery, parent/student role, and session revocation paths are proven;
- the migration query definition, aggregation period, privacy treatment, and result digest are recorded.

Anonymous bots and failed credential stuffing do not count as successful old-app accounts, but they remain security telemetry.

## OPS-08-G07 — Email and `info@onetimeonetime.com`

Pass only when:

- the mailbox exists, can receive from two external providers, and replies are monitored;
- current MX is inventoried and unchanged by the application cutover;
- exactly one SPF policy exists at each sending domain and includes every authorized sender;
- SPF DNS lookup count is at most 10;
- every active sender passes DKIM;
- DMARC exists and every canary aligns and passes;
- return-path is the approved provider path and SPF passes;
- visible From and Reply-To are exactly `info@onetimeonetime.com`;
- canaries show encrypted transport;
- all observed sender IPs have provider-managed forward/reverse DNS consistency;
- bounce and complaint webhooks are signed, durable, idempotent, and suppress future sends;
- hard-bounce rate is below 2%;
- complaint rate is below 0.10%;
- applicable subscribed/marketing mail has visible and one-click unsubscribe;
- 100% of catalog links resolve to expected content/auth behavior;
- staging cannot send outside its protected recipient allowlist;
- no email-DNS mutation is present in the standard application cutover manifest.

A DMARC policy increase is not required for OPS-08 and must not be bundled without separate authorization.

## OPS-08-G08 — OAuth, webhook, callback, and support inventory

Pass only when every row in `matrices/OPS-08-CALLBACK-MATRIX.csv` has:

- an identified owner;
- an exact current registration state;
- an exact candidate URL recorded privately and a repository-safe digest;
- required event types/scopes;
- signature and replay rules;
- idempotency key;
- raw-body policy;
- redirect policy;
- dual-registration capability;
- successful candidate canary;
- successful rollback canary;
- no embedded secret material.

Stripe TEST, Zoom, Vimeo, email-provider, and support callbacks must be direct endpoints. Generic host redirects are not a migration mechanism.

## OPS-08-G09 — DNS and TLS readiness

Pass only when:

- public DNS is captured from Google, Cloudflare, and an authoritative/system resolver;
- value digests and TTLs agree;
- the root fingerprint at authorization time equals the audit fingerprint;
- no root mutation occurred during audit or preparation;
- no MX/SPF/DKIM/DMARC/return-path mutation occurred;
- the authorization selects one documented apex/subdomain architecture;
- Railway custom-domain CNAME and TXT ownership requirements are satisfied for the exact service when applicable;
- TLS chain and SAN are valid for every active hostname;
- no certificate warning occurs from three probe regions;
- any optional non-root TTL-only preparation changed no RDATA;
- the private change set and rollback set both validate and have distinct SHA-256 digests.

## OPS-08-G10 — Monitoring and rollback

Pass only when:

- external probes run every 60 seconds from at least three regions;
- dashboards cover HTTP 5xx, latency, login, signup persistence, callback success, provider queues, email bounces/complaints, TLS, and DNS;
- a named monitor has acknowledged the window;
- a named rollback owner has private access to the rollback set;
- the previous service and deployment are healthy;
- the old service remains warm for at least seven days and at least twice the maximum prior TTL plus 24 hours;
- a rollback drill restores source, route behavior, one callback canary, canonical configuration, and critical probes;
- the rollback drill performs no destructive database migration;
- all numeric rollback triggers in `runbooks/OPS-08-ROLLBACK.md` are alertable.

## OPS-08-G11 — Exact production authorization

Pass only when a document validates against `schemas/OPS-08-AUTHORIZATION.schema.json` and includes:

- exact target Git SHA;
- exact Railway target project/environment/service/deployment digests, target port, `/health` path, and `healthcheck.railway.app` request host;
- exact primary hostname and retained launch hostname;
- selected architecture ID;
- private DNS change-set and rollback-set references and SHA-256 values;
- private callback change-set and rollback-set references and SHA-256 values, including an explicit zero-registration set when no callback mutation is authorized;
- application-configuration change-set SHA-256;
- exact maintenance window in Asia/Jerusalem;
- named monitor;
- named rollback owner;
- migration evidence digest and metrics;
- acceptance report digest;
- at least product-owner and technical-owner approval;
- explicit root-mutation decision;
- minimum 180-day launch-host preservation.

Without this document, the maximum state is `ready_for_dns_operator_action`.

## OPS-08-G12 — Change-scope safety

Pass only when:

- the manifest contains only authorized source, application config, callback, and DNS operations;
- raw secret/provider/DNS values are absent from GitHub, chat, logs, and packet artifacts;
- each operation has a rollback operation;
- email DNS is absent unless a separate email-DNS authorization exists;
- production sends, live payments, unrestricted Zoom/Vimeo mutations, and unintended access grants remain disabled;
- the launch hostname is not removed;
- root mutation flag matches the exact authorization;
- the mutation audit count equals the operator log.

## OPS-08-G13 — Cutover observation

After traffic moves, pass only when:

- all critical probes pass continuously for 120 minutes;
- 5xx remains below 1% over each 15-minute window;
- login success remains at least 99%;
- signup persistence failures remain below 1% and zero acknowledged writes are lost;
- required callback success remains at least 99% with no known-valid signature failure;
- TLS and DNS agree from three regions;
- email authentication remains 100% for canaries;
- no complaint threshold is reached;
- `join.onetimeonetime.com` remains available;
- no rollback trigger fires.

## OPS-08-G14 — Twenty-four-hour completion

Set `cutover_complete` only after 24 hours when:

- every prior gate still passes;
- ordinary non-root TTL restoration is approved and verified;
- no provider, support, or deep-link backlog exists;
- root, primary, join, source SHA, service identity, callbacks, sitemap, robots, analytics, and email links read back correctly;
- rollback remains possible;
- product and technical owners record completion.

A successful two-hour window without the 24-hour gate remains `cutover_observing`.
