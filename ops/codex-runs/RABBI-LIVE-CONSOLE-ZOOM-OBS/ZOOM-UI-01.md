# ZOOM-UI-01 Complete Zoom real-control readiness

Status: operator_action_required until the canonical SDK app, exact origin, S2S meeting,
host authorization, and real-control canary phases are all ready.

Purpose: authorize the dedicated classroom-computer host surface,
`One Time Zoom Stage Host`, for Meeting SDK in-meeting control.

Required Zoom Marketplace UI steps:

1. Keep the existing admin-managed General app named `One Time Zoom Stage Host`.
2. Keep Meeting SDK enabled under **Features > Embed > Other Devices**.
3. Set only canonical protected SDK variables: `ZOOM_MEETING_SDK_CLIENT_ID`,
   `ZOOM_MEETING_SDK_CLIENT_SECRET`, and `ZOOM_MEETING_SDK_WEB_VERSION`.
4. Bind `ZOOM_MEETING_SDK_ALLOWED_ORIGIN` exactly to the `PUBLIC_BASE_URL` origin and to the
   existing General app Meeting SDK Web Domain allowlist.
5. Configure the separate S2S account/client, isolated meeting/passcode, and host variables
   listed in `ops/provider-actions/ZOOM-MEETING-SDK-APP-SETUP.md`.
6. Confirm the protected host can start or join only the isolated meeting as
   host or co-host.
7. Set `ZOOM_CLASSROOM_CANARY_ENABLED=true` only for one explicitly authorized governed
   isolated-staging canary, then disable it after proof.

Legacy `ZOOM_MEETING_SDK_KEY` and `ZOOM_MEETING_SDK_SECRET` remain compatibility aliases only.
They never satisfy real-control readiness.

Required control scope:

- Meeting SDK host/co-host in-meeting participant control.
- Participant roster and participant audio/video state events.
- Spotlight replace/remove.
- Active speaker events.

Storage rule: never commit the key, secret, meeting password, raw join URL, OBS
WebSocket password, or customer participant details. Store secrets only in
protected local storage or protected Railway PR Environment variables.
