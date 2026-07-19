# W13-104 Private Operator Handoff

Private values belong only under `C:\Users\User\.onetime-w13-104-private\`.

Current production state:

- Live app is W13-104 at `https://join.onetimeonetime.com`.
- Live `/version` reports `w13-104-public-cls-688fc70`.
- Live runtime source is `688fc70cf64b72bc52f4ea7511d8593750d7ab45`.
- Production web deployment:
  `74a6b736-dd67-4966-bdf6-b7dd80280d1a`.
- Production worker deployment:
  `0a0d730c-fa00-4338-b446-a8dcb8832c17`.
- Fresh production PostgreSQL 18 backup/restore proof passed in run
  `w13-104-prod-pg18-20260719T064642Z`.
- No production signup submit, CRM import apply, external send, provider
  mutation, Stripe session, Buffer publication, DNS change, or source-of-truth
  change was performed.

Required next inputs:

- `EMAIL-INPUTS.private.json` for email canary/send work.
- `CRM-IMPORT-AUTHORIZATION.private.json` for any CRM import apply work.
- `CANARY-AUTHORIZATION.private.json` for provider-specific canaries.
- A usable `OPERATIONS_PROBE_TOKEN` only if protected internal diagnostics must
  be called.

Safety note:

- Missing provider inputs block only their provider lane.
- Do not paste reset links, passwords, email addresses, phone numbers, provider
  tokens, database URLs, source rows, or private CRM details into Git, PRs,
  screenshots, or public reports.
