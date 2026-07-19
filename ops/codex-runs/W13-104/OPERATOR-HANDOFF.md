# W13-104 Private Operator Handoff

Private values belong only under `C:\Users\User\.onetime-w13-104-private\`.

Current production state:

- Live app remains unchanged and healthy at `https://join.onetimeonetime.com`.
- Live runtime source remains `007e0215d1186ca51163dea3b1c15303bf52a860`.
- W13-104 did not run production deploys, production database writes, external
  sends, CRM import applies, provider mutations, Stripe sessions, Buffer
  publications, or DNS changes.

Required next inputs:

- Fresh W13-104 native production backup/restore proof before any production
  deployment or production signup/database write.
- `EMAIL-INPUTS.private.json` for email canary/send work.
- `CRM-IMPORT-AUTHORIZATION.private.json` for any CRM import apply work.
- `CANARY-AUTHORIZATION.private.json` for provider-specific canaries.

Safety note:

- Missing provider inputs block only their provider lane.
- Do not paste reset links, passwords, email addresses, phone numbers, provider
  tokens, database URLs, source rows, or private CRM details into Git, PRs,
  screenshots, or public reports.
