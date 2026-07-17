# OPS-11 Login Delivery

Status: `not_sent`

No activation/reset email has been sent in OPS-11.

## Rules

- Send exactly one protected operator activation or reset email only after
  production routes and core journeys pass.
- Resolve destination from protected `ONE_TIME_OWNER_TEST_EMAIL`; if absent,
  use the single canonical active production owner/admin.
- Never print the destination.
- Never print an activation/reset link or token.
- Never email a password.
- Link must be production `/activate` or `/reset-password`, hashed, expiring,
  single-use, rate-limited, and absent from logs/evidence.
- Prove one outbox intent, one provider acceptance, one audited result, and no
  duplicate.

If destination is ambiguous, keep healthy production live and block only the
email handoff.
