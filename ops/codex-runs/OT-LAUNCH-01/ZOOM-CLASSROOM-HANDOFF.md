# OT-LAUNCH-01 — Zoom classroom handoff

## Scope

- Branch: `codex/zoom-real-control-activation`
- Pull request: `#105`
- Base: `codex/rabbi-live-console-zoom-obs`
- Isolated preview: `https://ot99-web-onetimev2-pr-105.up.railway.app`
- Provider-reachability attempt commit: `405d38e` (`fix: enable Zoom WebRTC control token`)
- Production changed: **NO**
- Persistent staging changed: **NO**

## Provider and meeting state

- The admin-managed Zoom General app is restricted to the PR preview, Meeting SDK is enabled, the app has the minimal admin meeting-read scope required for local authorization, and local authorization completed in the operator account.
- The exposed Development secret was rotated before testing resumed. Only the isolated PR web-service secret was replaced. See [ZOOM-SDK-CREDENTIAL-INCIDENT.md](./ZOOM-SDK-CREDENTIAL-INCIDENT.md).
- Existing server-to-server OAuth authentication succeeds.
- Exactly one isolated type-2 meeting exists. The provider reports it in `waiting` state, owned by the configured test host, with registration disabled. No customer was invited and no Rabbi recurring meeting was touched.
- The application generates short-lived role-0 and role-1 Meeting SDK JWTs server-side. Current web signatures explicitly set `video_webrtc_mode=1`; host joins include the host's ZAK token.
- Learners map to Zoom participants through deterministic 32-character per-join `customerKey` values, never display names alone. Existing isolated demo rows are reconciled to the bounded format without a schema migration. Camera and unmute remain participant-consent actions.

## Verification state

- Three fictional learner states are seeded.
- The protected Join Class and Rabbi Live Console surfaces are deployed.
- Student Ready, authorization/replay/expiry denial, cross-student denial, cross-account mapping denial, and Done/reset pass focused tests.
- Real mute/unmute and spotlight controls are implemented through the Meeting SDK host surface, not the REST Meetings API. Spotlight uses Zoom's current `operate: 'replace' | 'remove'` contract.
- SDK failures shown in the product contain only an allowlisted code/category pair; raw provider reason and message strings never reach the DOM.
- Focused tests: 4 files, 22 tests passed.
- Typecheck: passed.
- Build: passed.
- Secret scan: passed across 1,788 text files.
- Prettier and `git diff --check`: passed.

## Single remaining blocker

At `2026-07-22T10:10:04Z`, the single post-deployment host join was rejected by Zoom with code 1. The redacted SDK diagnostic explicitly reports that Zoom rate-limited the join and requires reCAPTCHA verification. No retry loop was run.

That attempt proved provider reachability and the reCAPTCHA boundary only. It did **not** prove a completed Meeting SDK join, participant events, mute/unmute, spotlight, or active-speaker control.

Exact operator action: in the current signed-in Zoom browser session, complete Zoom's reCAPTCHA/rate-limit verification, then run one host join and one Student 1 join from PR #105. Do not create another app or meeting, change any credential, or touch production/persistent staging.

Until that human provider challenge is completed, live participant events, ask-to-unmute/mute, spotlight/remove-spotlight, and active-speaker verification remain blocked at the provider join boundary.

The temporary preview-operator session used for isolated browser verification was revoked, and its isolated account role was returned to `viewer`.

## Migration convergence

PR #105 adds no migration. The base branch's historical Zoom migration is byte-identical to persistent staging's applied `2212_rabbi_live_console_zoom_obs` ledger entry. Integrate application changes only; do not reintroduce or rename the historical `2210` Zoom migration.
