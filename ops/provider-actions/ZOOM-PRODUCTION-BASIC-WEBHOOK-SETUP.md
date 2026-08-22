# Zoom Production Basic provider-proof webhook setup

Status: **operator action required; not executed by this repository task**

This runbook activates provider proof only. It does not authorize deployment, meeting
mutation, participant joins, notifications, credential rotation, or production data reads.
Never place the webhook secret, raw request body, meeting UUID, passcode, ZAK, OAuth token,
join URL, or host email in Git, terminal output, logs, screenshots, tickets, or reports.

## Operator sequence

1. Deploy the exact reviewed candidate through the approved Railway path. Verify the
   runtime source SHA matches the reviewed candidate before any Zoom configuration.
2. Add `ZOOM_WEBHOOK_SECRET_TOKEN` through Railway protected-variable controls. Copy
   directly from Zoom, verify presence only, and never render, echo, enumerate, inspect,
   download, or persist the value.
3. In the existing approved Zoom app that owns the configured account, licensed host,
   and recurring Production Basic meeting, set the HTTPS event endpoint to
   `https://<approved-one-time-origin>/api/v1/providers/zoom/events`. Do not add a query,
   fragment, wildcard, alternate path, or non-approved origin. Do not create a second app
   or meeting.
4. Complete Zoom `endpoint.url_validation`. A successful response contains only
   `plainToken` and the HMAC-derived `encryptedToken`; do not capture either value.
5. Subscribe only to **Meeting has been started** (`meeting.started`) and
   **Meeting has been ended** (`meeting.ended`). Do not add participant, registration,
   recording, chat, transcript, or broad account events.
6. Activate or install that existing Zoom app only as required for the approved account.
   Before activation, verify the runtime has the reviewed canonical
   `ZOOM_S2S_ACCOUNT_ID`, `ZOOM_HOST_USER_ID`, and `ZOOM_REAL_CONTROL_MEETING_ID`
   bindings. A mismatch must remain fail closed and must not be fixed by broadening code.
7. Run one authorized isolated canary against the exact approved meeting instance. Include
   one intentionally invalid-signature synthetic request and confirm it produces no proof
   row or cleanup before starting and ending the canary meeting once.
8. Record only sanitized evidence: deployed SHA matched, endpoint validation accepted,
   invalid signature rejected, started proof correlated, ended proof correlated to the
   same digest-only instance, and exact-occurrence local cleanup completed once. Do not
   record secrets, raw UUIDs, identifiers, or payloads.

If any step is ambiguous, stop with `ZOOM_PROVIDER_PROOF_ACTIVATION_BLOCKED`. Leave the
subscription disabled and the runtime gate absent until the exact mismatch is resolved.
