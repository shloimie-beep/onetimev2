# ZOOM-UI-01 — Meeting SDK General app setup

Status: **operator action required**. This is the exact follow-up to PR #100 job
[`ZOOM-UI-01`](../codex-runs/RABBI-LIVE-CONSOLE-ZOOM-OBS/ZOOM-UI-01.md).
Zoom's current Marketplace flow uses a **General app**, not the legacy
"Meeting SDK app" label.

## App and feature

1. In Zoom App Marketplace, choose **Develop > Build App > General App**.
2. Name the app `One Time Zoom Stage Host` and select **Admin-managed**.
3. Under **Features > Embed**, enable **Meeting SDK** and select **Other Devices**.
4. Use the app's **Development** credentials for this isolated Railway PR environment only.

## Exact protected credentials and Railway variables

Copy values from the General app's Development credentials without pasting them into a ticket,
chat, log, commit, or build output:

- Development **Client ID** → `ZOOM_MEETING_SDK_CLIENT_ID`
- Development **Client Secret** → `ZOOM_MEETING_SDK_CLIENT_SECRET`
- Meeting SDK web version → `ZOOM_MEETING_SDK_WEB_VERSION=6.2.0`

Bind the runtime to the exact HTTPS origin configured as the General app's Meeting SDK Web
Domain. This value is not a credential, but it must still be governed configuration:

- Exact SDK Web Domain origin → `ZOOM_MEETING_SDK_ALLOWED_ORIGIN`
- Runtime public URL → `PUBLIC_BASE_URL`

Both variables must resolve to the same origin. Paths, wildcards, localhost, HTTP, and a
production origin are rejected by the host-control readiness gate.

The existing Server-to-Server OAuth app remains separate and supplies REST meeting/registrant
provisioning plus the host ZAK:

- `ZOOM_ACCOUNT_ID`
- `ZOOM_S2S_CLIENT_ID`
- `ZOOM_S2S_CLIENT_SECRET`
- `ZOOM_HOST_USER_ID`

The protected `ZOOM_HOST_USER_ID` must identify a **Licensed** Zoom user, and Meeting
registration must be available for that host. If Zoom returns `registration_not_enabled`, change
the host/license policy in the Zoom admin portal; do not replace the canary with the Rabbi's
regular meeting.

Copy the isolated canary's protected meeting material into only this PR environment:

- `ZOOM_REAL_CONTROL_MEETING_ID`
- `ZOOM_REAL_CONTROL_MEETING_PASSCODE`

Do not set any of these on persistent staging until governed staging integration is explicitly
authorized. Never set this canary configuration on production.

`ZOOM_CLASSROOM_CANARY_ENABLED=true` is the final, separate real-control authorization. Keep it
false until the protected class target is rotated, all readiness phases pass, and the operator
has explicitly authorized one governed isolated-staging canary. Disable it immediately after
the proof or on any unexpected provider response.

## Exact redirect and origin allow-list

Permit only these exact PR #105 values:

- OAuth Redirect URL: `https://ot99-web-onetimev2-pr-105.up.railway.app/api/v1/live-class/zoom/oauth/callback`
- OAuth Allow List entry: `https://ot99-web-onetimev2-pr-105.up.railway.app/api/v1/live-class/zoom/oauth/callback`
- Meeting SDK Web Domain: `https://ot99-web-onetimev2-pr-105.up.railway.app`

Turn **Strict Mode** on, keep the subdomain check on, and add no wildcard, localhost,
persistent-staging, production, Zoom App Home URL, or private customer destination. This
implementation does not use a Zoom in-client app surface or General-app OAuth callback; the
redirect entry satisfies Marketplace configuration only. Host ZAK retrieval continues through
the separately authorized Server-to-Server OAuth app.

For a later governed staging canary, add exactly
`https://ot99-web-staging.up.railway.app` to the **existing** General app's Meeting SDK Web
Domain allowlist and set both runtime origin variables to that exact origin. Do not create a new
app and do not add production.

## Controlled verification sequence

1. Rotate/revoke the exposed protected staging class target according to
   `../codex-runs/OT-LAUNCH-01/ZOOM-STAGING-CLASS-LINK-ROTATION-CANARY-RUNBOOK.md` before any
   provider canary.
2. Confirm the target is an explicitly governed isolated-staging environment; do not change
   production.
3. Add only the variables above, verify the exact origin binding, and redeploy that governed
   environment.
4. Open the protected Rabbi Live Console, confirm `meeting_sdk_host`, and open **Protected Zoom
   Host**. Confirm the short-lived role-1 signature starts the one isolated canary meeting.
5. Join only the three fictional registrants. Confirm participant mapping succeeds by stable
   `customer_key` and not by display name.
6. Select Student 1, have Student 1 click **I'm Ready**, accept Zoom's unmute prompt if desired,
   and start video from the participant client if spotlight is to be tested.
7. From the Rabbi console run: **Ask Unmute**, **Spotlight**, **Remove Spotlight**, **Mute**, then
   **Done**. Confirm the roster state follows Zoom events and Done resets the stage.
8. Replay one executed command, submit one expired command, and target Student 2 with Student 1's
   command context. Confirm all three are rejected.
9. Set `ZOOM_CLASSROOM_CANARY_ENABLED=false` and stop after this canary. Do not invite customers,
   use the Rabbi's regular meeting, or change production.

The REST Meetings API is used only for meeting creation, registrants, and ZAK acquisition. It is
not used or described as an in-meeting mute/spotlight control surface.
