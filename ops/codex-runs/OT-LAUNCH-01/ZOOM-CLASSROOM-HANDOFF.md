# OT-LAUNCH-01 — Zoom classroom readiness handoff

## Scope

- Branch: `codex/zoom-real-control-activation`
- Pull request: `#105`
- Base: `codex/rabbi-live-console-zoom-obs`
- Isolated preview: `https://ot99-web-onetimev2-pr-105.up.railway.app`
- Production changed: **NO**
- Persistent staging changed: **NO**

## Current provider truth

- The existing admin-managed Zoom General app has Meeting SDK enabled and remains restricted to
  the isolated PR origin. Do not create another app.
- The isolated Railway environment has protected `ZOOM_MEETING_SDK_CLIENT_ID`,
  `ZOOM_MEETING_SDK_CLIENT_SECRET`, and `ZOOM_MEETING_SDK_WEB_VERSION`.
- `ZOOM_MEETING_SDK_KEY` and `ZOOM_MEETING_SDK_SECRET` are compatibility aliases only and never
  satisfy real-control readiness.
- The existing Server-to-Server OAuth app was not modified by this continuation.
- The current isolated runtime lacks `ZOOM_ACCOUNT_ID`, `ZOOM_S2S_CLIENT_ID`,
  `ZOOM_S2S_CLIENT_SECRET`, `ZOOM_HOST_USER_ID`, `ZOOM_REAL_CONTROL_MEETING_ID`, and
  `ZOOM_REAL_CONTROL_MEETING_PASSCODE`.
- A protected staging class target was exposed in private diagnostic output. The protected
  resource bound to `ONE_TIME_PROTECTED_CLASS_TARGET_URL` must be rotated/revoked before any real
  canary. No value or fragment is recorded here.

## Fail-closed readiness

Real host control stays unavailable until all four independently reported phases are ready:

1. **SDK app** — canonical SDK client ID, client secret, explicit web version, and exact
   `ZOOM_MEETING_SDK_ALLOWED_ORIGIN` / `PUBLIC_BASE_URL` HTTPS-origin binding.
2. **S2S meeting provisioning** — account ID, S2S client ID/secret, isolated meeting ID, and
   meeting passcode.
3. **Host authorization** — protected host user ID.
4. **Real-control canary authorization** — `ZOOM_CLASSROOM_CANARY_ENABLED=true` in an explicitly
   authorized `isolated_staging` runtime only.

The broader runtime/classroom/real-provider gates must also be active. Missing setup or
authorization returns typed provider-off/not-ready responses before Zoom client construction or
provider invocation. Readiness output contains variable names only.

## Verification state

- Admin, Student, and Rabbi fake-adapter journeys remain accepted in persistent staging.
- Safe tests cover role-0/role-1 signatures, bounded customer-key participant mapping,
  participant-consent unmute/video behavior, spotlight replace/remove, Done/reset, replay,
  expiry, cross-student/cross-account denial, exact-origin blocking, and provider-off UI truth.
- No real provider call, host join, participant join, meeting mutation, link rotation, credential
  write, deployment, or human challenge was performed in this continuation.

## Remaining governed action

Follow `ZOOM-STAGING-CLASS-LINK-ROTATION-CANARY-RUNBOOK.md`. First rotate/revoke the protected
class target. Only then add the exact staging origin to the existing General app, install the
protected S2S/host/meeting values in governed staging, explicitly authorize one canary, and
disable it after proof.

Do not use the Rabbi recurring meeting, invite a customer, or modify production.

## Migration convergence

PR #105 adds no migration. Integrate application changes only; do not reintroduce or rename the
historical Zoom migration.
