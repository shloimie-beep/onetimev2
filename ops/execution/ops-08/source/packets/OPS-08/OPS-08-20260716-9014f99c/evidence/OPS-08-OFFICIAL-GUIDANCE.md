# OPS-08 Official Guidance Ledger

**Task:** OPS-08  
**Packet:** OPS-08-20260716-9014f99c  
**Retrieved:** 2026-07-16  
**Use:** Read-only planning. Re-check every source immediately before an authorized change because provider behavior can change.

## Railway

1. **Working with Domains** — https://docs.railway.com/networking/domains/working-with-domains
   - A Railway custom domain requires the exact Railway-provided CNAME and TXT ownership records.
   - A missing verification TXT can leave a resolving hostname returning 404.
   - Railway documents that DNS propagation can take up to 72 hours.
   - Railway automatically provisions a Let's Encrypt certificate after correct domain configuration.
   - Railway supports root domains through CNAME flattening or dynamic ALIAS behavior.
   - Railway's current provider list identifies GoDaddy nameservers as not supporting that apex behavior.
   - OPS-08 consequence: an apex-to-Railway design cannot be presumed while GoDaddy remains authoritative. The later authorization must select one architecture: keep the apex on an approved redirect/edge, use a subdomain as primary, or separately authorize a nameserver/edge change that preserves all DNS and mail records.

2. **Healthchecks** — https://docs.railway.com/deployments/healthchecks
   - Railway uses a health endpoint during deployment activation.
   - Railway sends deployment healthchecks with the request hostname `healthcheck.railway.app`; applications that enforce Host must account for that hostname.
   - Deployment healthchecks are not a replacement for continuous external monitoring.
   - OPS-08 requires both Railway deployment gating and independent synthetic monitoring.
   - OPS-08 consequence: accept `healthcheck.railway.app` only for `GET`/`HEAD` on the configured healthcheck path. It must not become a canonical host, redirect host, callback host, or general application host.

3. **Variables Reference** — https://docs.railway.com/variables/reference
   - Railway exposes deployment and source metadata variables, including the Git commit SHA.
   - OPS-08 must compare Railway metadata, `/version`, and the authorized source SHA before any traffic move.

4. **Public Networking** — https://docs.railway.com/networking/public-networking
   - The service must listen on Railway's injected port.
   - Public and custom-domain inventory must be captured by project, environment, service, target port, domain, and certificate state.

## GoDaddy

1. **Manage DNS records** — https://www.godaddy.com/help/manage-dns-records-680
   - GoDaddy is treated only as the authoritative DNS/email-DNS control plane for OPS-08.
   - A records map names to IP addresses; CNAME records map a host label to another domain; MX records route mail; TXT records carry verification and sender-policy material.
   - No GoDaddy record or forwarding mutation is permitted during OPS-08 audit/preparation.
   - Any later GoDaddy operation must be executed by the named DNS operator from the private, checksummed change set.

## Public DNS evidence

1. **Google Public DNS DoH** — https://developers.google.com/speed/public-dns/docs/doh
2. **Google Public DNS JSON API** — https://developers.google.com/speed/public-dns/docs/doh/json
   - OPS-08 tooling may perform read-only DNS queries.
   - Stored evidence defaults to record-name/type/TTL plus SHA-256 of RDATA, not raw target values.
   - At least Google Public DNS, Cloudflare DNS, and one system/authoritative lookup must agree before a DNS gate passes.

## Email authentication and delivery

1. **Gmail sender guidelines** — https://support.google.com/mail/answer/81126
   - All senders need SPF or DKIM; higher-volume senders need SPF, DKIM, and DMARC.
   - Direct mail must align the visible From domain with SPF or DKIM for DMARC.
   - TLS, valid forward/reverse DNS for sending infrastructure, low complaint rates, and accurate headers are delivery controls.
   - Google recommends keeping complaint rates below 0.10% and avoiding 0.30% or higher.

2. **Resend domain management** — https://resend.com/docs/dashboard/domains/introduction
   - Repository history reports a default-off Resend seam, but the active sender is not yet proven.
   - Resend requires a verified sending domain, publishes provider-specific SPF/DKIM records, and supports a custom return path.
   - Resend recommends separating sending reputation with a sending subdomain. OPS-08 does not adopt that recommendation automatically; the final domain and mailbox architecture must preserve `info@onetimeonetime.com` and be operator-approved.

3. **Resend DMARC** — https://resend.com/docs/dashboard/domains/dmarc
   - DMARC depends on authenticated SPF or DKIM alignment.
   - Begin enforcement changes only after all legitimate senders are enumerated and passing.
   - OPS-08 stages DMARC observation before any stricter policy; no DMARC mutation is authorized by this packet.

4. **Standards**
   - SPF: https://www.rfc-editor.org/rfc/rfc7208
   - DKIM: https://www.rfc-editor.org/rfc/rfc6376
   - DMARC: https://www.rfc-editor.org/rfc/rfc7489
   - One-click unsubscribe: https://www.rfc-editor.org/rfc/rfc8058

## Stripe TEST webhooks

1. **Stripe webhooks** — https://docs.stripe.com/webhooks
   - Public endpoints must be HTTPS.
   - Stripe treats 3xx responses as failures; register the final endpoint URL instead of relying on a redirect.
   - Verify signatures against the unmodified raw body and the endpoint-specific test secret.
   - Test and live endpoints use different signing secrets.
   - Return 2xx promptly, deduplicate events, and process durable work asynchronously.
   - OPS-08 permits Stripe TEST canaries only. It never enables live-mode payment or webhook mutation.

## Zoom

1. **Zoom OAuth 2.0** — https://developers.zoom.us/docs/integrations/oauth/
   - The token exchange must use the same redirect URI configured in the Marketplace app.
   - Use and verify OAuth state.
   - OPS-08 must inventory every authorized redirect URL and preserve the current callback until the new origin is proven.
   - Zoom launch targets remain protected configuration and must never be written into this packet.

## Vimeo

1. **Vimeo developer portal** — https://developer.vimeo.com/
   - The audited repository declares Vimeo credential names and a webhook-secret name, but no provider callback registration was proven.
   - Before activation, OPS-08 must retrieve the current account-specific Vimeo callback requirements from the official developer portal, record the exact event set and signature method in private evidence, and prove replay/idempotency handling.
   - The internal `/internal/content-publications/v1/manifests` endpoint is a One Time signed publication intake and must not be misclassified as a Vimeo webhook.

## Source-of-truth rule

Provider dashboards and current official documentation outrank this ledger. Any conflict changes OPS-08 status to `blocked_provider_guidance_changed` until the packet evidence and tests are updated. No conflict authorizes a production or DNS change.
