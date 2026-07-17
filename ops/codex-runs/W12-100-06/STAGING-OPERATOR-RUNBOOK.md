# W12-100-06 Staging Operator Runbook

## Purpose

Create the first usable One Time identity set in an isolated environment for launch-readiness proof:

- owner/admin
- parent/guardian
- three separate students in one synthetic household

This runbook intentionally does not include credentials, private destinations, database URLs, activation/reset tokens, contact details, or provider links.

## Required Environment

- Environment is `local`, `test`, or an explicitly isolated `staging`.
- Production configuration is rejected by the provisioning tool.
- Database target is isolated and not production-like.
- Delivery is `sink` only.
- Provider delivery transports are disabled.
- Portal Test Lab is not enabled in production configuration.
- Account and product scope are explicit and must match the loaded runtime configuration.

## Command Shape

Run only after the isolated environment variables are supplied by the operator through the approved secret channel:

```bash
ONE_TIME_IDENTITY_PROVISIONING_ENABLED=true \
OUTBOX_TRANSPORT_MODE=sink \
tsx scripts/w12-100/identity/provision-first-identity-set.ts \
  --environment=staging \
  --account-key=<explicit-account-key> \
  --product-key=<explicit-product-key> \
  --identity-set-key=<synthetic-identity-set-key> \
  --apply \
  --confirm-isolated
```

The command emits only:

- redacted scope hashes
- redacted resource hashes
- outcome statuses
- counts
- safety flags

It must not print activation links, reset links, tokens, passwords, email addresses, phone numbers, database URLs, provider URLs, or raw private rows.

## Expected First Run

- Bootstrap operator row: `created` or `already_exists`.
- Owner invitation: `created` or `already_exists`.
- Admin invitation: `created` or `already_exists`.
- Household and learner rows: `created` or `already_exists`.
- Parent activation: `created` or `already_exists`.
- Student setup: `update_blocked` with `parent_activation_required` until the parent is activated.
- Audit entry: one `w12_100_identity_provisioning_run` event with redacted metadata.
- External actions: `0`.
- Production mutations: `0`.

## Expected Second Run After Parent Activation

After the protected parent activation flow has been completed in the isolated environment, rerun the same command with the same scope and identity-set key.

- Existing rows and intents remain idempotent.
- Student setup is issued by the activated parent actor.
- Admin session is never used to impersonate parent or student.
- Audit entry count increases by one.
- External actions remain `0`.
- Production mutations remain `0`.

## Activation Delivery Later

Protected activation delivery will be supplied by a later, separately authorized delivery lane. This lane only writes lifecycle delivery intents into the sink transport and proves that the resulting report is redacted.

The later delivery lane must:

- use an approved isolated staging target
- receive explicit operator approval for recipient segment, copy, channel, and sender action
- avoid committing destinations, tokens, private links, raw message bodies, or credentials
- read activation material only through the approved secure operator channel at runtime
- record evidence as counts, hashes, statuses, and redacted summaries
- keep external actions and production mutations at zero unless a later prompt explicitly authorizes a bounded send

## Abort Conditions

Stop and record a blocker if any of these occur:

- loaded config is production or production-like
- database URL appears production-like
- account/product scope does not match runtime config
- delivery transport is not sink
- provider delivery is enabled
- output contains secret material or a private destination
- a student setup would be created by an owner/admin actor instead of the activated parent actor
- a conflict or update-blocked status appears outside the documented synthetic setup path
