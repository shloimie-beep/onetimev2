# OPS-04P — One Time Staging Provider Readiness Inventory

## Mission

Perform a read-only, evidence-backed inventory of every external provider needed for the Rabbi's One Time day-one product. Determine what is configured, what is only sink/mock scaffolding, what exact protected variable or account mapping is missing, and what canary is safe to run later. Do not implement features or mutate provider state.

## Canonical source

- Repository: `webcraft-media/onetimev2`
- Exact source SHA: `fb3c397ce8ece100cf7873fdddcd940a1552ea9b`
- Staging origin: `https://ot99-web-staging.up.railway.app`
- Railway project ID: `7c8eee26-7a6a-4684-826d-9f4377d67d46`
- Work from a clean isolated checkout.
- Create branch `codex/ops04p-provider-readiness-inventory` only for sanitized evidence and the final report.

## Providers and workflows to inspect

1. Resend or the currently selected One Time email provider.
2. Meta WhatsApp Cloud or the currently selected WAPI/Whapi One Time provider.
3. Telegram Bot API for the Rabbi/owner bot and the operator/admin bot.
4. Zoom for meeting/classroom/registrant/SDK capabilities.
5. Vimeo for identity, upload, privacy, playback and webhook capabilities.
6. Stripe TEST mode for product, price, portal, checkout and webhook configuration.
7. Buffer for organization, channels/profiles, drafts, scheduling and publishing capabilities.
8. OpenAI/provider-neutral retrieval runtime for the student helper.
9. BNA signed support-event ingress and BNA content-publication ingress.

## Read-only rules

- Inspect variable names, modes, service bindings and secret references; never print secret values.
- Provider calls must be read-only identity/status calls only.
- Do not register or delete webhooks.
- Do not send email, WhatsApp, Telegram or social messages.
- Do not create Zoom registrants or meetings.
- Do not upload/change Vimeo content.
- Do not create Stripe sessions, customers, subscriptions or charges.
- Do not publish through Buffer.
- Do not modify Railway variables or deployments.
- Do not touch DNS, production, or the dirty `C:\Users\User\BNA v2.0` checkout.

Missing credentials are findings, not hard-stop conditions. Continue the complete inventory and mark the provider `UNCONFIGURED`, `PARTIAL`, `SINK_ONLY`, `READ_ONLY_READY`, or `CANARY_READY`.

## Required evidence

For every provider record:

- Provider/account label, redacted.
- One Time ownership/scope.
- Runtime service that should own it.
- Protected variable names present/missing, without values.
- Current mode: off, sink, mock, test or live.
- Existing adapter/client/worker paths in the exact source tree.
- Existing webhook route and whether its configured external destination matches.
- Required scopes/capabilities.
- Read-only account/status result.
- Safe canary prerequisite.
- Rollback/disable switch.
- Data classification and logging restrictions.
- Exact blocker owner: code, configuration, external account or operator decision.

Explicitly investigate the known obsolete Stripe test webhook pointing at `http://join.onetimeonetime.com` and report the exact correct staging webhook route. Do not change it in this task.

## Deliverables

Create:

- `ops/codex-runs/OPS-04P/ORIGINAL-PROMPT.md`
- `ops/codex-runs/OPS-04P/STATE.json`
- `ops/codex-runs/OPS-04P/PROVIDER-MATRIX.json`
- `ops/codex-runs/OPS-04P/PROVIDER-MATRIX.md`
- `ops/codex-runs/OPS-04P/CANARY-ORDER.md`
- `ops/codex-runs/OPS-04P/FINAL-REPORT.md`
- `ops/codex-runs/OPS-04P/RESUME.md`

Run secret scans over every deliverable. Reports may contain provider object IDs only when they are non-secret and necessary; otherwise redact them. Never include tokens, passwords, signing secrets, database URLs, private webhook secrets, personal phone numbers or personal email addresses.

Commit and push the sanitized report branch and open a draft PR against `codex/ops03-staging-readiness-repair`. No product code changes are allowed.

## Final response

Return the exact branch/SHA/PR, a one-line status per provider, the recommended canary order, and confirmation that no external/provider/runtime mutations occurred.
