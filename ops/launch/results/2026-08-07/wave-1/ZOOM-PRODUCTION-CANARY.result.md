# Wave 1 Zoom production canary result

- Date: 2026-08-07
- Status: **BLOCKED — exact production Zoom configuration/account blocker**
- Integration branch: `codex/one-time-complete-production-launch-20260805`
- Candidate commit: `43968d4b6163f97799e14289c2424c1001ab5c37`
- Child branch: `codex/ot-wave1-zoom-canary-20260807`
- Railway deployment: `35de7372-d367-4cec-84f8-f6758058e759`
- Live canary attempts: **0**

## Controller deployment readback

The controller's exact candidate commit was deployed before any live-canary decision. Railway showed deployment `35de7372-d367-4cec-84f8-f6758058e759` as active and successful for the web service. The public production probes returned HTTP 200:

- `/version`: `PUBLIC_RELEASE_AVAILABLE`
- `/health`: `PUBLIC_HEALTH_OK`
- `/ready`: `PUBLIC_READY`

The public version response intentionally does not expose a commit SHA. Candidate identity was established from the controller's immutable deployment readback and the matching Railway deployment record.

## Independent preflight

| Gate                                                 | Result                                     | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Separate Server-to-Server OAuth and Meeting SDK apps | **BLOCKED**                                | The production service has only the legacy `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, and `ZOOM_CLIENT_SECRET` variables. The canonical S2S variables (`ZOOM_S2S_ACCOUNT_ID`, `ZOOM_S2S_CLIENT_ID`, `ZOOM_S2S_CLIENT_SECRET`) and Meeting SDK variables (`ZOOM_MEETING_SDK_CLIENT_ID`, `ZOOM_MEETING_SDK_CLIENT_SECRET`) are absent. The Zoom Marketplace sessions available to this lane were signed out, so the legacy credential tuple could not be safely classified as either app. |
| Production SDK origin allowlist                      | **BLOCKED**                                | `PUBLIC_BASE_URL` is `https://join.onetimeonetime.com`, but `ZOOM_MEETING_SDK_ALLOWED_ORIGIN` is absent. The Meeting SDK app console was unavailable while signed out, so its production allowlist and strict-domain settings could not be verified.                                                                                                                                                                                                                              |
| Production provider enablement                       | **BLOCKED**                                | `ZOOM_CLASSROOM_PROVIDER_MODE=sink`, `ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED=false`, and `ZOOM_CLASSROOM_CANARY_ENABLED=false`. `ZOOM_HOST_USER_ID` is absent. The lane correctly fails closed.                                                                                                                                                                                                                                                                                     |
| Tablet/mobile Meeting SDK view                       | **PASS (code)**                            | The web client uses the global `ZoomMtg` Client View path, not Component View. This matches Zoom's documented browser support requirement for mobile and tablet clients.                                                                                                                                                                                                                                                                                                          |
| No raw Zoom join URL leakage                         | **PASS (code/tests)**                      | The provider adapter consumes `join_url` internally, returns only a digest/token reference, and the client/server contracts reject raw join URL fields. Static inspection found no active classroom response path that exposes a raw join URL.                                                                                                                                                                                                                                    |
| Bootstrap, entitlement, occurrence, lease, reconnect | **PASS (code/tests)**                      | The Student launch grant is limited to 60 seconds; enrollment/access/consent/registration/occurrence gates are enforced; the lease is 90 seconds with 30-second heartbeat behavior and same-lineage reconnect; a second device is denied.                                                                                                                                                                                                                                         |
| Meeting safety policy                                | **PARTIAL / BLOCKED on provider readback** | Meeting creation explicitly disables join-before-host, mutes on entry, disables participant video, and enables the waiting room. No-rename, participant chat/file-transfer/screen-share, waiting-room lock, and cloud-recording policy could not be verified at the Zoom account/user/app layer while the provider console was unavailable. Zoom documents `auto_recording=none` as the meeting-create default; no speculative API field change was made.                         |
| Attendance merge and admin visibility                | **PASS (tests)**                           | Focused readiness, attendance, admin-read-model, embedded-adapter, and learner-classroom suites passed.                                                                                                                                                                                                                                                                                                                                                                           |
| Student HighLevel contacts                           | **PASS for this lane's delta**             | No live canary or HighLevel write was attempted, so the Student-contact delta attributable to this lane is exactly zero. No claim is made about the unrelated pre-existing account-wide contact total.                                                                                                                                                                                                                                                                            |

Official support references used for the policy boundary:

- [Zoom Meeting SDK web browser support](https://developers.zoom.us/docs/meeting-sdk/web/browser-support/)
- [Zoom Meeting APIs](https://developers.zoom.us/docs/api/meetings/)
- [Zoom SDK OAuth information and allowlist controls](https://developers.zoom.us/docs/build-flow/basic-info/oauth-info/)

## Exact blocker and bounded-canary decision

The exact deployed production candidate cannot perform an authorized, origin-bound Zoom canary because all of the following are true at the deployed service boundary:

1. The distinct S2S OAuth credential set is absent.
2. The distinct Meeting SDK credential set is absent.
3. The production Meeting SDK allowed origin is absent.
4. The Zoom host user identifier is absent.
5. Provider, real-provider, and canary execution remain disabled/sinked.
6. The signed-out Zoom Marketplace session prevents verification of the existing apps' types, scopes, domains, and account/user meeting-policy settings.

Reusing or remapping the legacy credential tuple without provider-console verification would risk mixing incompatible app types and would not establish the required SDK-origin or account-policy controls. The safe and contract-compliant outcome is therefore to stop before the single bounded mutation. This is an exact provider/account configuration blocker, not a reader, test, or deployment blocker.

## Effects and reconciliation

Because the canary was blocked before mutation, the reconciled effect ledger is:

| Effect                 | Created | Deleted/reverted | Residual |
| ---------------------- | ------: | ---------------: | -------: |
| Zoom meetings          |       0 |                0 |        0 |
| Zoom registrants       |       0 |                0 |        0 |
| Zoom participant joins |       0 |                0 |        0 |
| Zoom cleanup mutations |       0 |                0 |        0 |
| HighLevel writes       |       0 |                0 |        0 |
| Student-contact delta  |       0 |                0 |        0 |

No customer message, customer identity, production meeting, or disposable provider object was created.

## Validation

Twenty focused test files passed: **260 tests passed, 0 failed**.

- Zoom provider, disposable-canary, reconciliation, scope, protected-target, and safety suites
- Embedded classroom client/server, workspace, router, adapter, and composition suites
- Learner classroom, attendance/admin readiness, and protected-target CLI integration suites

No code correction was necessary or justified by the preflight. Provider-account policy is intentionally not inferred from local code.

## Required remediation before the one live canary

1. Authenticate to the production Zoom Marketplace/account using an authorized operator session.
2. Identify and verify the existing Server-to-Server OAuth and Meeting SDK apps separately, including account ownership and required scopes.
3. Verify the Meeting SDK app's exact production origin/domain controls for `https://join.onetimeonetime.com`.
4. Verify account/user policy for waiting-room lock, participant rename, participant screen sharing, participant chat, file transfer, and Zoom cloud recording.
5. Populate the canonical production variables through the protected Railway deployment path, including the host user identifier; do not repurpose an unclassified legacy credential tuple.
6. Enable the provider/canary gates only through the approved bounded-canary deployment, obtain a fresh exact deployment readback, then execute exactly one disposable operator canary and reconcile every effect.

No secrets or credential values are included in this result.
