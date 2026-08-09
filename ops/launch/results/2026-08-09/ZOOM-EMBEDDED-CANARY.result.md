# Zoom embedded canary — operator handoff

Date: 2026-08-09  
Branch: `codex/ot-p2-zoom-canary-20260809`  
Status: in progress; no Zoom meeting has been created yet

## Preserved facts

- Existing S2S app: **One Time One Timev4**.
- Existing General / Meeting SDK app: **One Time Zoom Stage Host**.
- S2S credentials were previously matched to protected key-holder material.
- Meeting SDK is enabled.
- Canonical production origin: `https://app.onetimeonetime.com`.

## Operator-changed facts

- Railway production service `one-time-web` now has canonical Zoom provider flags, the existing S2S mapping, the existing Meeting SDK mapping, the allowed origin, the host user mapping, and the exact operator-owned canary learner mapping.
- Learner mapping before correction (names only): `ZOOM_CLASSROOM_CANARY_LEARNER_KEY` was sourced from the legacy acceptance field `learnerRef`.
- Learner mapping after correction (names only): `ZOOM_CLASSROOM_CANARY_LEARNER_KEY` is sourced from `identity-authorization.private.json -> recipients.student.learner_key`.
- Production operator-canary configuration is permitted only for the exact allowlisted learner in the dedicated verification environment; broad or missing learner configuration remains fail-closed.
- The canonical operator Admin credential and password hash were not changed. This was verified after the Railway mapping update.

## Runtime source identity

- Railway project: `one-time-production` (`ce55ef20-1418-4ad3-aafa-f877fb992dc8`).
- Railway environment: `production` (`f911acfc-e206-44df-a569-9d69d709b94b`).
- Railway service: `one-time-web` (`d175ad94-5e3c-41c2-8cbc-daa1a299077d`).
- Deployment: `f2d0401e-4936-448b-bd4d-5e7753136a35` — `SUCCESS`.
- Deployment source: `railway up` from the local working tree on `codex/ot-p2-zoom-canary-20260809`, based on integration SHA `5154a5764bc778fec9db0f3ebc98ab5901809c24`.
- Runtime probes: `/health` **200**, `/ready` **200**, `/version` **200**.

## Effect ledger

- Zoom meetings created: **0**.
- Zoom registrants created: **0**.
- Attendance records created: **0**.
- GHL Student contacts created or modified: **0**.
- Customer notifications sent: **0**.
- Secrets recorded in this handoff: **0**.

## Remaining delta

- Deploy the corrected exact learner mapping and verify production health.
- Obtain a non-mutating authenticated Admin session or one-time operator login handoff.
- Run exactly one disposable embedded host/Student canary, including same-device reconnect and second-device denial.
- Reconcile attendance exactly once, delete the disposable Zoom meeting, restore any temporary Student credential exactly, and revoke canary sessions.

All credentials, account identifiers, learner keys, meeting identifiers, and join material are intentionally redacted.
