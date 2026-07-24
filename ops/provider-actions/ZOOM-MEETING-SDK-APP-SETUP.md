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

## Distinct disposable PR #105 canary

This sequence is authorized only by decision
`zoom-distinct-disposable-isolated-canary-20260724` and supersedes the older multi-student
provisioning sequence above for this one proof.

1. Pin and deploy the exact PR #105 successor containing the disposable-canary guard repair.
   Require every `/version` commit field to equal that successor; the previously observed
   `944f46b...` runtime is an absolute stop.
2. Reuse only the existing General app and exact PR #105 preview origin. Add no persistent-staging
   or production origin and create no second app.
3. Create one isolated private-network job from that exact successor. Its environment must satisfy
   the new disposable preflight while provider mode remains `sink`, real-provider remains `false`,
   and canary remains `false`. It must not bind the Tisha target, protected class target, an
   existing meeting ID/passcode, `BNA_KEYHOLDER_DIR`, or any persistent-staging value.
4. Require a fresh absent protected-state path and run
   `npm run zoom:real-control:disposable:provision` once. Sanitized output must report
   `mode=distinct_disposable_pr105_canary`, `phase=ready`, exact source verified, fictional
   Student 1 only, both protected targets unbound, zero invitations, and no printed protected
   value.
5. Install only the canary-specific meeting material in the isolated PR #105 preview. Run one host
   plus fictional Student 1 proof covering participant-event readback, consented unmute, mute,
   spotlight/remove spotlight, active-speaker readback, Done/reset, replay, expiry,
   cross-student denial, and idempotency. Stop for human verification, rate limiting, source drift,
   missing protected input, or any unexpected participant.
6. Immediately return the isolated preview to `sink`, real-provider `false`, and canary `false`.
   Clear the one-shot provision authorization, set only
   `ZOOM_DISPOSABLE_CANARY_CLEANUP_AUTHORIZATION=DELETE_ONE_CREATED_PR105_DISPOSABLE_MEETING_ONCE`,
   and run `npm run zoom:real-control:disposable:cleanup`.
7. Cleanup may obtain its target only from the signed v3 state. It must prove exact scope before one
   meeting delete, verify absence, and append a secret-free `deleted` tombstone. Never blindly
   retry a timeout, 429, 5xx, ambiguous outcome, or scope mismatch.
8. Destroy only the isolated job and canary-specific private state/configuration after sanitized
   readback. Confirm the Tisha and recurring meetings were untouched, customer
   invitations/notifications remained zero, persistent staging and production were unchanged, and
   no provider request occurred after disable.

The protected state and evidence must never contain raw meeting IDs, passcodes, join URLs, SDK or
S2S credentials, ZAK, signatures, access tokens, participant identifiers, customer keys, emails,
or private destinations.

## Existing-meeting reconciliation cleanup only

This is a one-time repair for the existing signed schema-v3 journal whose create source is exactly
`96e54d9688ff174ac8265ce3b3a6216abb6292dc`, sequence is exactly `4`, phase is
`cleanup_required`, and failure category is exactly `registration_outcome_ambiguous`. It cannot
create, register, patch, join, control, or select a different meeting.

Deploy the repair successor only to the preserved isolated runner. Keep every sink/real/canary
gate off and retain the original operation ID, protected journal path, protected keyholder path,
origin, learner key, attestation, and cleanup authorization. Require:

- `ZOOM_REAL_CONTROL_EXPECTED_SOURCE_SHA=96e54d9688ff174ac8265ce3b3a6216abb6292dc`
- `ZOOM_DISPOSABLE_CANARY_REPAIR_EXPECTED_SOURCE_SHA=<exact repair successor SHA>`
- `RAILWAY_GIT_COMMIT_SHA=<the same exact repair successor SHA>`
- `ZOOM_DISPOSABLE_CANARY_CLEANUP_AUTHORIZATION=DELETE_ONE_CREATED_PR105_DISPOSABLE_MEETING_ONCE`
- `ZOOM_DISPOSABLE_CANARY_RECONCILIATION_AUTHORIZATION=RECONCILE_DELETE_ONE_EXISTING_PR105_96E54D_MEETING_ONCE`
- `ZOOM_REAL_CONTROL_PROVISION_AUTHORIZATION` absent

Run only `npm run zoom:real-control:disposable:reconcile-cleanup`.

Before any journal transition or delete, the command requires the signed meeting ID, type `2`,
protected host, unique operation-bound topic, fixed isolated agenda, duration `60`, disabled
join-before-host, no alternative host, and the original deterministic create head to match. The
only accepted provider normalization is an absolute scheduled-start delta of at most 60 seconds.
Both registrant notification flags must be explicitly `false`. General email notification must be
explicitly `false`, or may be omitted only when no alternative host exists and the journal proves
the exact deterministic original create head. Any explicit `true`, missing registrant flag,
unknown value, larger/invalid time delta, or other identity mismatch stops before journal
transition and `DELETE`.

The command appends signed sequence `5` / `cleanup_delete_in_flight`, including the exact repair
successor SHA in the HMAC chain, before exactly one delete, then performs exactly one meeting GET.
Only the canonical Zoom meeting-resource `404` with code `3001` proves absence and permits the
secret-free sequence `6` / `deleted` tombstone, which retains that repair-head binding. A timeout
or ambiguous response retains sequence `5`; a later invocation from that same exact repair head
performs absence reconciliation only and never repeats the delete. A completed tombstone is
idempotent and loads no provider context. Generic or OAuth `404` responses do not prove absence.

Only after sanitized `phase=deleted`, `deleted_tombstone_written=true`, and provider counts are
read back may the separate provider-only executor remove the preserved runner and state volume.
Do not remove either resource from this repository task.
