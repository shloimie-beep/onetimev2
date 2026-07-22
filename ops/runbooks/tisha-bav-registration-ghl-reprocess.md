# Tisha B'Av registration delivery reprocess

This runbook repairs one already-persisted Tisha B'Av registration whose HighLevel delivery is
`provider_off`, `pending`, or `failed`. It does not create a second registration and does not accept
an email address as input.

## Preconditions

- The exact release containing migration `2220_tisha_bav_event_email_permission.sql` is deployed.
- `HIGHLEVEL_EVENT_SYNC_MODE=provider`.
- `HIGHLEVEL_LOCATION_ID=pBSnOK2nkdxp6gf9Rg3o`.
- `HIGHLEVEL_TISHA_BAV_WORKFLOW_ID` is the reviewed OT-E01 workflow ID.
- `HIGHLEVEL_PRIVATE_INTEGRATIONS_TOKEN` is present in protected runtime configuration.
- The registration has `granted` event-only email permission and no suppression, unsubscribe,
  complaint, or hard-bounce state; or it is the exact pre-2220 registration whose own stored metadata
  proves the canonical Tisha B'Av service-consent policy, event-only purpose, email channel, source,
  and original capture timestamp.
- The operator has obtained the registration key through a protected database lookup. Do not use an
  email address in the command or terminal transcript.

## Execute one bounded reprocess

Set `TISHA_BAV_REGISTRATION_KEY` only in the protected execution environment, then run:

```text
npm run tisha:registration:reprocess
```

The command prints only a SHA-256 registration reference, the resulting delivery status, and whether
the guarded fallback was queued. It never prints the destination, PIT, workflow ID, or provider
payload.

## Expected behavior

- An already-succeeded HighLevel delivery is a no-op.
- A provider-off/failed delivery is retried without inserting a second registration.
- A proven pre-2220 registration receives at most one idempotent event-only permission projection.
  Missing/corrupt stored consent proof blocks delivery; the command never infers permission from the
  wider contact database and never grants newsletter/general-marketing permission.
- Required event and source tags are verified before OT-E01 enrollment.
- HTTP 409/422 responses are failures; they are not treated as enrollment success without a supported
  exact provider readback.
- A pending fallback is cancelled only after HighLevel succeeds.
- A completed or actively leased fallback blocks HighLevel retry to prevent duplicate confirmation
  email.
- HighLevel delivery is leased before any provider call. Concurrent public submissions and concurrent
  reprocess attempts cannot enroll the same registration twice. HighLevel retry and fallback-worker
  claims are mutually exclusive, and fallback cancellation requires the same active lease owner.
- Resend fallback is queued only after HighLevel fails and only when the separately guarded fallback
  configuration is explicitly enabled.

Do not run this command for a broad list. Any multi-registration repair requires a separately reviewed
manifest, exact count, suppression proof, bounded budget, and operator authorization.
