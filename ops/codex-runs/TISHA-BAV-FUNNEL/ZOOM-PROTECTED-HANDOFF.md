# Zoom Protected Handoff

Status: mapped in the protected PR #102 Railway preview runtime. Production mapping remains pending for the narrow Tisha release.

Do not paste a raw Zoom join URL, start URL, passcode, host key, or meeting secret into this repo.

Protected runtime fields:

- `ONE_TIME_TISHA_BAV_2026_ZOOM_JOIN_URL`
- `ONE_TIME_TISHA_BAV_2026_ZOOM_MEETING_REF`

Event:

- `tisha-bav-2026`
- Thursday, July 23, 2026
- 3:00 PM Eastern / 10:00 PM Israel

Rules:

- Use one event-specific meeting only.
- Do not modify Rabbi Eli Scheller's regular recurring class meeting.
- The app redirects to the protected URL only after registered-email verification, join-window validation, and a short-lived event session.
- The raw URL is never rendered into static HTML or JSON responses.

Verified preview:

- `/tisha-bav` and `/tisha-bav/live` return HTTP 200.
- Protected join configuration is present in Railway without being committed or printed.
- No raw Zoom URL appears in the landing page, live page, email copy, or repository handoff.
