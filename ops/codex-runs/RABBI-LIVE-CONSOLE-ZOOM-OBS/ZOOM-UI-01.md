# ZOOM-UI-01 Create One Time Meeting SDK App

Status: operator_action_required when `ZOOM_MEETING_SDK_KEY` or
`ZOOM_MEETING_SDK_SECRET` is missing.

Purpose: authorize the dedicated classroom-computer host surface,
`One Time Zoom Stage Host`, for Meeting SDK in-meeting control.

Required Zoom Marketplace UI steps:

1. Open Zoom Marketplace.
2. Choose **Develop**, then **Build App**.
3. Create a **Meeting SDK** app named `One Time Zoom Stage Host`.
4. Add the Railway PR Environment origin to the SDK allowlist.
5. Copy the SDK key into protected local or Railway PR variable
   `ZOOM_MEETING_SDK_KEY`.
6. Copy the SDK secret into protected local or Railway PR variable
   `ZOOM_MEETING_SDK_SECRET`.
7. Confirm the classroom Zoom account can start or join the class meeting as
   host or co-host.

Required control scope:

- Meeting SDK host/co-host in-meeting participant control.
- Participant roster and participant audio/video state events.
- Spotlight replace/remove.
- Active speaker events.

Storage rule: never commit the key, secret, meeting password, raw join URL, OBS
WebSocket password, or customer participant details. Store secrets only in
protected local storage or protected Railway PR Environment variables.
