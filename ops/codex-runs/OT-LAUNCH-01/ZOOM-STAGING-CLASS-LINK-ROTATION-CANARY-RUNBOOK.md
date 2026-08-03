# Zoom staging class-link rotation and S2S canary runbook

Status: **SUPERSEDED HISTORICAL PLAN — DO NOT EXECUTE**.

The authoritative reviewed job is
`ops/provider-actions/ZOOM-MEETING-SDK-APP-SETUP.md`. Current execution status remains only in
`ops/goals/OT-LAUNCH-01/BOARD.yaml`.

## Protected resource to rotate

Rotate and revoke the current tokenized Family class target stored in governed staging as
`ONE_TIME_PROTECTED_CLASS_TARGET_URL`. The value, token, query string, and any recognizable
fragment must never be copied into chat, terminal output, screenshots, logs, tickets, commits, or
evidence.

This rotation is separate from the Zoom Meeting SDK Development secret rotation already recorded
in `ZOOM-SDK-CREDENTIAL-INCIDENT.md`. Do not regenerate SDK or S2S credentials unless a separate
incident specifically requires it.

## Preconditions

1. Keep `ZOOM_CLASSROOM_CANARY_ENABLED=false` and
   `ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED=false` while rotating.
2. Confirm the target environment is governed staging, never production.
3. Confirm the existing General app and existing S2S app are the intended resources. Do not
   create replacements.
4. Confirm the isolated canary meeting is not the Rabbi recurring meeting and has no real
   customer invitees.
5. Obtain explicit authorization for the consuming old-link denial check, replacement-link
   smoke, staging variable change set, and one real Zoom canary.

## Rotation

1. At the protected class-target source, revoke the current tokenized target and issue one
   replacement for the same governed staging purpose.
2. Move the replacement through the source's native protected-copy control directly into the
   protected `ONE_TIME_PROTECTED_CLASS_TARGET_URL` variable. Do not read it back into diagnostics.
3. Verify the old target is denied and the replacement reaches only the intended protected class
   destination. Record only sanitized status/timestamp booleans; never record either URL or a
   digest derived from protected material.
4. If either verification is ambiguous, clear `ONE_TIME_PROTECTED_CLASS_TARGET_URL`, keep all Zoom
   real-provider/canary flags false, and stop.

## Exact Zoom readiness variables

Canonical SDK app and origin binding:

- `PUBLIC_BASE_URL`
- `ZOOM_MEETING_SDK_CLIENT_ID`
- `ZOOM_MEETING_SDK_CLIENT_SECRET`
- `ZOOM_MEETING_SDK_WEB_VERSION`
- `ZOOM_MEETING_SDK_ALLOWED_ORIGIN`

S2S meeting provisioning:

- `ZOOM_S2S_ACCOUNT_ID`
- `ZOOM_S2S_CLIENT_ID`
- `ZOOM_S2S_CLIENT_SECRET`
- `ZOOM_REAL_CONTROL_MEETING_ID`
- `ZOOM_REAL_CONTROL_MEETING_PASSCODE`

Host authorization:

- `ZOOM_HOST_USER_ID`

Provider and canary gates:

- `ONE_TIME_RUNTIME_ENVIRONMENT=isolated_staging`
- `ZOOM_CLASSROOM_ENABLED=true`
- `ZOOM_CLASSROOM_PROVIDER_MODE=real`
- `ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED=true`
- `ZOOM_CLASSROOM_CANARY_LEARNER_KEY=full_app_preview_student_1`
- `ZOOM_CLASSROOM_CANARY_ENABLED=true`

## Exact General-app origin requirement

Add exactly `https://ot99-web-staging.up.railway.app` to the Meeting SDK Web Domain allowlist of
the **existing** General app with Strict Mode and subdomain checking enabled. Set
`PUBLIC_BASE_URL` and `ZOOM_MEETING_SDK_ALLOWED_ORIGIN` to that same exact HTTPS origin. Add no
wildcard, path, localhost, production origin, customer destination, App Home URL, or replacement
app.

## One bounded S2S/Meeting SDK canary

After rotation verification and all readiness phases are green:

1. Enable the real-provider and canary flags for the governed staging runtime only.
2. Join once as the protected host and once as fictional Student 1.
3. Read back participant mapping by bounded `customer_key`, then run ask-unmute with participant
   consent, mute, spotlight, remove spotlight, active-speaker readback, and Done/reset.
4. Replay one executed command and confirm idempotent rejection.
5. Stop. Do not invite a customer, use the Rabbi recurring meeting, or expand the canary.

## Verification evidence

Record only:

- runtime/commit/deployment identifiers;
- readiness phase names and ready/blocked status;
- HTTP status and safe application/provider error category;
- fictional participant labels;
- command type and executed/rejected status;
- `old_target_denied`, `replacement_target_valid`, and `target_value_recorded=false`;
- confirmation that secret values, links, tokens, ZAK, passcodes, and raw participant identifiers
  are absent.

## Rollback and disable

On any unexpected result:

1. Set `ZOOM_CLASSROOM_CANARY_ENABLED=false`.
2. Set `ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED=false`.
3. Set `ZOOM_CLASSROOM_PROVIDER_MODE=sink`.
4. Clear the governed staging S2S/host/meeting values if their scope or handling is in doubt.
5. Keep the rotated old class target revoked. If the replacement is suspect, revoke it too and
   clear `ONE_TIME_PROTECTED_CLASS_TARGET_URL`; never restore the exposed value.
6. Remove the staging origin from the existing General app only if the canary is abandoned or the
   origin binding is suspect. Do not remove the isolated PR origin without a separate decision.

Rollback must not alter production, the Rabbi recurring meeting, the existing S2S app, or real
customer access.
