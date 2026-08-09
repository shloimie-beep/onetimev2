# Resend recovery result

- Window: `OT-P1 — Resend Recovery`
- Date: 2026-08-09
- Branch: `codex/ot-p1-resend-recovery-20260809`
- Integration base: `codex/one-time-complete-production-launch-20260805` (PR #131)
- Status: implementation and focused local proof complete; production canary pending

## Delta baseline

The newest canonical result and merged PR #134 were read before provider inspection.

Preserved facts:

- Resend is enabled and bound in production.
- The lifecycle flow already used a durable encrypted outbox and transactional token issuance.
- Reset/setup tokens were already single-use, newer issuance revoked older unused tokens, and canonical adult password reset revoked prior sessions.
- PR #134 was repository-only and did not change the provider.

Operator-changed facts read back safely:

- The production web and worker services have a Resend API credential present; its value was not read back into this result.
- The sending domain `onetimeonetime.com` is verified in Resend.
- Sender and reply-to are both `info@onetimeonetime.com`.
- Production web and worker lifecycle delivery use transactional provider transport.
- A webhook secret is present and webhook intake is enabled.
- The configured One Time endpoint is `https://join.onetimeonetime.com/api/v1/delivery/resend/webhook`.

Unresolved production delta at checkpoint:

- Resend does not yet list the One Time webhook endpoint; only an unrelated endpoint was present.
- The migration, web, and worker changes must be deployed.
- One fresh real reset for `sdratler@gmail.com` must complete through recipient receipt, reset consumption, and final webhook reconciliation without a duplicate.
- SPF, DKIM, and DMARC must be read from the received canary message headers.

No secret, token, reset URL, cookie, provider message identifier, or password is recorded here.

## Production queue readback

The current queue was read from inside the running Railway web service because its database uses an internal-only hostname.

- Historical row counts: 5 `provider_delivered`, 7 `sink_delivered`, and 1 `superseded`.
- No row is currently queued, leased, retrying, unknown, provider-off, or dead-lettered.
- Each of the five historical provider rows has exactly one recorded attempt and no last error code.
- The latest historical provider row was created on 2026-08-08 and is a password reset.
- In the pre-recovery schema, `provider_delivered` records Resend API acceptance rather than recipient delivery. These rows therefore cannot be promoted to final delivered without webhook evidence.

## Implemented recovery

- Password-reset lifetime is owned by coordinated draft PR #140; its identical 30-to-60-minute hunk is intentionally not duplicated here.
- Activation lifetime is exactly seven days.
- Exact transactional reset and activation copy is enforced with sender and reply-to `info@onetimeonetime.com`.
- Student lifecycle issuance is suppressed without creating an email outbox row.
- Resend acceptance uses a stable delivery-key idempotency header across attempts.
- Ambiguous provider results enter `unknown` and retry with the same idempotency key so the provider result is reconciled before another effect can occur.
- Provider acceptance is separated from final delivery state.
- Resend webhook parsing uses the official nested `data.email_id` shape.
- Signed webhook events reconcile delivered, bounced, complained, and failed states idempotently; duplicates are harmless and adverse final states cannot be overwritten by a late delivered event.
- Provider identifiers remain hashed in lifecycle delivery storage.

## Focused local proof

- `12/12` focused integration tests passed across reset request/readback, token lifecycle and session revocation, activation/Student suppression, outbox lease/retry/unknown result, and webhook signature/duplicate/final states.
- TypeScript typecheck passed.
- Secret scan passed across 3,391 repository text files.
- Changed TypeScript files pass the repository formatter.
- Git whitespace validation passed.

Production proof will be appended after the deployment and disposable canary.
