# Tisha B'Av registration to GHL handoff repair

## Scope

This isolated release-branch repair corrects the Tisha B'Av registration handoff without changing
HighLevel, Railway, production, or any customer record.

## Proven root cause

The public registration route was correct, but `HIGHLEVEL_EVENT_SYNC_MODE` defaulted to `disabled`.
In that state the application persisted a `provider_off` HighLevel delivery and still returned
`confirmation_queued: true`. The route could therefore reserve a spot without adding the event tags,
enrolling OT-E01, or queuing a working fallback.

## Implemented controls

- Provider mode now requires a PIT, the exact canonical One Time location, and an exact OT-E01
  workflow ID at configuration load.
- Event registration records an additive event-only email permission projection. It never grants
  newsletter or general marketing permission.
- Existing withdrawal, suppression, unsubscribe, complaint, and hard-bounce states win over a later
  registration.
- HighLevel tag mutation requires contact readback proof. Workflow 409/422 responses are failures;
  they are not silently treated as enrollment success.
- `confirmation_queued` is true only after HighLevel succeeds or the explicitly authorized Resend
  fallback is durably queued.
- Resend fallback is created only after HighLevel is provider-off/failed, requires its own complete
  transport authorization and budgets, rechecks permission/suppression before sending, and uses a
  stable idempotency key.
- The worker consumes bounded fallback rows with a durable lease and never logs a private destination.
- A redacted single-registration reprocess command repairs an already-persisted provider-off delivery
  without accepting an email address or creating another signup.
- For an exact pre-2220 registration, that command may materialize one event-only permission only
  when the stored registration itself contains the canonical service-consent policy, purpose,
  email channel, source, and original timestamp. Missing or corrupt proof fails closed. It never
  backfills an audience and never grants newsletter/general-marketing permission.
- Initial registration and protected reprocess share a single-writer HighLevel delivery lease.
  Concurrent submissions cannot enroll OT-E01 twice, and a HighLevel retry cannot race the fallback
  worker or cancel a fallback owned by another active lease.
- The event registration path does not create an account lifecycle/login-code delivery.

## Safety result

- GHL mutations: `0`
- Emails sent: `0`
- Customer contacts changed: `0`
- Railway changes: `0`
- Production deploys: `0`
- Broad audience operations: `0`

All provider behavior in tests used in-memory adapters or an injected synthetic HTTP response.
