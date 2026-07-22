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

Do not set any of these on persistent staging or production.

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

## Controlled verification sequence

1. Confirm the target Railway environment is the isolated draft-PR environment and its base is
   the PR #100 branch; do not change persistent staging.
2. Add only the variables above and redeploy the PR environment.
3. Open the protected Rabbi Live Console, confirm `meeting_sdk_host`, and open **Protected Zoom
   Host**. Confirm the short-lived role-1 signature starts the one isolated canary meeting.
4. Join only the three fictional registrants. Confirm participant mapping succeeds by stable
   `customer_key` and not by display name.
5. Select Student 1, have Student 1 click **I'm Ready**, accept Zoom's unmute prompt if desired,
   and start video from the participant client if spotlight is to be tested.
6. From the Rabbi console run: **Ask Unmute**, **Spotlight**, **Remove Spotlight**, **Mute**, then
   **Done**. Confirm the roster state follows Zoom events and Done resets the stage.
7. Replay one executed command, submit one expired command, and target Student 2 with Student 1's
   command context. Confirm all three are rejected.
8. Stop after this canary. Do not invite customers, use the Rabbi's regular meeting, or change
   production/persistent staging.

The REST Meetings API is used only for meeting creation, registrants, and ZAK acquisition. It is
not used or described as an in-meeting mute/spotlight control surface.
