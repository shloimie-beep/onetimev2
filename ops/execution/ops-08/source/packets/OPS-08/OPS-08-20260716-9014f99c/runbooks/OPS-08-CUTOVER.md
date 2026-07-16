# OPS-08 Controlled Cutover Runbook

**Task:** OPS-08  
**Packet:** OPS-08-20260716-9014f99c  
**Default disposition:** `blocked_no_cutover_authorization`  
**Time zone:** Asia/Jerusalem  
**Launch hostname that must be preserved:** `join.onetimeonetime.com`  
**Root hostname that must not change during audit/preparation:** `onetimeonetime.com`

## OPS-08 authority boundary

This runbook does not authorize a production cutover. It becomes executable only when a separate document validates against `schemas/OPS-08-AUTHORIZATION.schema.json` and its SHA-256 is written into an `authorized` reversible change manifest. That authorization must bind the exact target port and healthcheck contract plus private DNS, callback, and application-configuration change-set digests.

Before that authorization exists:

- do not change any apex/root record, root forwarding rule, root certificate, or root hosting target;
- do not change `join.onetimeonetime.com`;
- do not change MX, SPF, DKIM, DMARC, return-path, or mailbox records;
- do not register, disable, or rotate production provider callbacks;
- do not enable real email, WhatsApp, Telegram, payment, Zoom, Vimeo, or support-event transport;
- do not deploy into a production-linked Railway environment;
- do not treat an open draft PR, branch name, Railway deployment, or `/health` response as release approval.

When safe repository work and read-only evidence are complete but GoDaddy, Railway, mailbox, or provider access is unavailable, set the OPS-08 state to `ready_for_dns_operator_action`. That state means code/readiness work is complete; it does not mean cutover is authorized.

## OPS-08 architecture decision required

Railway currently documents that GoDaddy authoritative DNS does not provide the apex CNAME-flattening/dynamic-ALIAS behavior required for a direct Railway apex target. The later authorization must select exactly one architecture:

1. `OPS-08-JOIN_PRIMARY_ROOT_REDIRECT`
   - `join.onetimeonetime.com` remains the application origin.
   - The root remains on an approved HTTPS redirect/edge and preserves path and query.
   - Use only when the product owner explicitly chooses the launch hostname as canonical.

2. `OPS-08-WWW_PRIMARY_ROOT_REDIRECT`
   - `www.onetimeonetime.com` is the application origin and may CNAME to the Railway target.
   - The root remains on an approved HTTPS redirect/edge and preserves path and query.
   - `join.onetimeonetime.com` remains available and redirects only after all callback exclusions are proven.

3. `OPS-08-APEX_EDGE_TO_RAILWAY`
   - An approved edge service terminates apex TLS and routes to the exact Railway service.
   - The edge and all A/AAAA values are part of the private, reversible change set.
   - The edge must preserve method/body for callbacks and must not rewrite signed payloads.

4. `OPS-08-AUTHORITATIVE_DNS_MIGRATION_FOR_APEX`
   - Authoritative nameservers move to a provider that supports apex flattening/dynamic ALIAS.
   - This is a distinct, high-risk DNS migration. Every existing DNS record, DNSSEC state, mail record, verification record, and TTL must be captured and restored at the new provider before delegation.
   - The nameserver migration and application cutover should be separate windows unless an explicit technical-owner and DNS-operator authorization combines them.

No OPS-08 tooling may infer this choice.

## OPS-08 required evidence before the window

All acceptance gates in `acceptance/OPS-08-ACCEPTANCE-GATES.md` must pass. In particular:

- one immutable source SHA is selected and is an ancestor of the deployed Railway source;
- an isolated staging project/environment/service exists and is not production-linked;
- `/health`, `/ready`, and `/version` identify the expected service and exact SHA;
- Railway's `healthcheck.railway.app` Host succeeds only on `GET`/`HEAD /health` and is denied on all other routes;
- root, launch, staging, Railway-generated, and intended-primary hostnames are inventoried;
- the root DNS fingerprint captured at audit start still matches immediately before authorization;
- all active old-app users meet the migration thresholds;
- `info@onetimeonetime.com` exists and sender, reply-to, SPF, DKIM, DMARC, return-path, TLS, bounce, and complaint evidence pass;
- every OAuth redirect, webhook, provider callback, support event, email link, and deep link has an owner and a tested migration disposition;
- the old service and old callbacks can remain active through rollback and propagation;
- the private DNS change set and private rollback set have independent SHA-256 values and have been read back by the DNS operator;
- a monitor and rollback owner have acknowledged the exact window.

## OPS-08 runbook continuation order

The controlled runbook continues in the following exact order:

1. `runbooks/OPS-08-CUTOVER-PREPARATION.md`
2. `runbooks/OPS-08-CUTOVER-EXECUTION.md`

Both chapters are mandatory. Neither file independently authorizes a production change.
