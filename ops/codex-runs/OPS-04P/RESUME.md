# OPS-04P Resume

Use this if the inventory needs to be picked up after this report.

## Checkout

```powershell
cd C:\Users\User\.ops04p-worktrees\OPS-04P
git status --short --branch
git rev-parse HEAD
```

Expected branch:

`codex/ops04p-provider-readiness-inventory`

Base branch:

`origin/codex/ops03-staging-readiness-repair`

Prompt source SHA:

`fb3c397ce8ece100cf7873fdddcd940a1552ea9b`

Staging origin:

`https://ot99-web-staging.up.railway.app`

## Read-Only Rechecks

```powershell
Invoke-WebRequest -Uri https://ot99-web-staging.up.railway.app/health -Method GET -UseBasicParsing
Invoke-WebRequest -Uri https://ot99-web-staging.up.railway.app/version -Method GET -UseBasicParsing
Invoke-WebRequest -Uri https://ot99-web-staging.up.railway.app/ready -Method GET -UseBasicParsing
```

Use `railway variable list --json` only with a sanitizer that prints variable names, booleans, non-secret modes, or fingerprints. Never print raw protected values.

## Current Provider Blockers

- Resend: missing `RESEND_API_KEY`, exact canary email, lifecycle delivery key, and optional webhook signing secret.
- WhatsApp/WAPI/Whapi: selected provider decision, token/secret/verify token, exact canary recipient, and canary authorization are missing/off.
- Telegram: token, webhook secret, owner/operator mapping, single-consumer gate, canary chat, and transport enablement are missing/off.
- Zoom: real provider credentials, host/test meeting or template, SDK credentials, webhook secret, and canary authorization are missing/off.
- Vimeo: token/client/account/webhook variables are missing.
- Stripe TEST: secret key, webhook secret, account/product/price/portal/webhook/publishable resource variables are missing; obsolete webhook target must be replaced with the staging route in a later authorized task.
- Buffer: token, organization id, and destination ids are missing.
- OpenAI/helper: no provider-neutral external runtime contract or credentials are configured.
- BNA support: support disabled; BNA receiver/signing/attachment/workspace mapping missing.
- BNA content publication: OT86 publish signing variables and publisher mapping missing.

## Correct Stripe TEST Route

`https://ot99-web-staging.up.railway.app/api/v1/billing/webhooks/provider`

Do not use `http://join.onetimeonetime.com` for staging.

## Validation Commands

```powershell
node -e "const fs=require('fs'); for (const f of ['ops/codex-runs/OPS-04P/STATE.json','ops/codex-runs/OPS-04P/PROVIDER-MATRIX.json']) JSON.parse(fs.readFileSync(f,'utf8')); console.log('json ok')"
npm run secret:scan
git diff --check
```

## Mutation Boundary

OPS-04P is evidence/report-only. Do not send email, WhatsApp, Telegram, social posts, payments, Zoom mutations, Vimeo uploads, Railway variable changes, deployments, DNS changes, or production/BNA mutations from this task.
