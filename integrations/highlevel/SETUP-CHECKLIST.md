# HighLevel Setup Checklist

## Account And Location

- Confirm the One Time HighLevel account and location.
- Record the location ID in protected runtime config and `workflows.yaml`.
- Create a Private Integration Token with only the scopes needed for contacts,
  workflows, conversations, and payments read/reconciliation.
- Store credentials outside Git.

## Custom Fields

- Create the custom fields listed in `workflows.yaml`.
- Paste the resulting field IDs back into `workflows.yaml`.
- Verify fields are parent/household fields only. Do not create student fields.

## Tags

- Create the initial `OT | ...` tags listed in `workflows.yaml`.
- Confirm the tags are for workflows and human visibility only.
- Confirm no HighLevel tag grants One Time portal access.

## Workflows

- Build OT-01 through OT-10 in the HighLevel UI.
- Paste workflow IDs into `workflows.yaml` and protected env values.
- Test with the configured test contact only.
- Record last-tested date and setup evidence links in `workflows.yaml`.

## LC Email DNS

- Use `LC-EMAIL-DNS-CHECKLIST.md` for the dedicated sending subdomain setup.
- Prepare `mail.onetimeonetime.com` for LC Email.
- Keep visible sender and reply-to as `info@onetimeonetime.com`.
- Do not change DNS or send a broad campaign without exact operator
  authorization.

## Webhooks

- Configure HighLevel outbound webhooks only after the isolated router is wired
  in the convergence lane.
- Use the configured shared secret or native HighLevel signature mode.
- Send only allowlisted business events.
- Do not include raw card/customer objects.

## Activation Gate

- `HIGHLEVEL_MODE=provider`
- `HIGHLEVEL_SYNC_ENABLED=true`
- Location ID configured.
- Private Integration Token configured.
- Outbound webhook secret configured.
- Workflow IDs recorded.
- No production contact upload through code.
- Dry-run mapping counts reviewed before any local apply.
