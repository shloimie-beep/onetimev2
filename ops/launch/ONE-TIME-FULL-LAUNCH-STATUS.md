# One Time Complete Production Launch — Status

Snapshot date: 2026-08-07 (Asia/Jerusalem)

## Executive status

Wave 1 code is integrated, fully gated, and deployed to production at exact source
\`f804980081cb2197689f3b4f3f77e58308b915af\`. Core administration, real no-card
Family-account signup, authentication, and Parent/Student application surfaces are live.

The complete production launch is **not complete**. Zoom and the first new recording are
still blocked at exact provider/account/configuration boundaries, and live billing remains
intentionally disabled. Deployed code, configured providers, canary proof, and broad
activation remain separate states.

## Current identities and checks

| Item                           | Current truth                                                                                                                                                                                                                                                    |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository / branch            | \`shloimie-beep/onetimev2\` / \`codex/one-time-complete-production-launch-20260805\`                                                                                                                                                                             |
| Pull request                   | PR #131, open and draft; mergeable \`MERGEABLE\`, merge state \`CLEAN\`                                                                                                                                                                                          |
| Exact integrated/deployed head | \`f804980081cb2197689f3b4f3f77e58308b915af\`                                                                                                                                                                                                                     |
| Production web                 | Deployment \`14babe48-a531-4a5e-b22b-e34f0cb91d00\`; image \`sha256:e1b71cb8fb2a26132e638c55c299a89d22771ff40eff39c86e6c2629b914e10a\`                                                                                                                           |
| Production worker              | Deployment \`1f511ff5-6655-41a1-a486-99f72db3fb85\`; image \`sha256:c46af1ce63591d8df826797f6c5460b46e4141ff6a18253bac604452461d8462\`                                                                                                                           |
| Exact-head checks              | All six GitHub checks passed: Node 24, migration verification, OPS-06, PostgreSQL 16 assurance, PostgreSQL 18 assurance/restore, and learner-seat concurrency                                                                                                    |
| Local browser gates            | 70 end-to-end, 26 accessibility, and 10 performance/bundle tests passed                                                                                                                                                                                          |
| Migration ledger               | 102/102 verified through \`2271_ot16_f05_dispatch_context\`; zero pending and zero integrity issues; Wave 1 added no migration                                                                                                                                   |
| Runtime health                 | Both \`app.onetimeonetime.com\` and \`join.onetimeonetime.com\` return HTTP 200 for health, readiness, and version                                                                                                                                               |
| Protected diagnostics          | Both domains return HTTP 200 with the probe token, exact source/deployment identity, no blockers, and \`no-store\`; unauthenticated access returns HTTP 403                                                                                                      |
| Worker and queues              | Exact-head worker heartbeat is ready and fresh; delivery, support, and account-lifecycle queues have zero ready, leased, expired-lease, retry, and dead-letter rows                                                                                              |
| Rollback                       | Preserved branch \`rollback/one-time-pre-complete-launch-20260805\` at \`a157c388d8dc292699f7cd1a1ef178918ee30885\`; immediate prior successful web/worker deployments are \`35de7372-d367-4cec-84f8-f6758058e759\` and \`6e2e806f-319f-403f-83a0-7b5b202236a2\` |

## Wave 1 integration

All six authoritative child lanes are merged with their exact child commits:

| Lane                           | Pull request | Exact child commit                           | Result                                                               |
| ------------------------------ | -----------: | -------------------------------------------- | -------------------------------------------------------------------- |
| Source of truth and email tone |         #134 | \`2576b7e0d5e675e08d7c6134d272596f78e59210\` | Integrated; superseded by locked real-Family-account public behavior |
| Landing corrections            |         #137 | \`69ec9859a940d985752c38396fb9ef77ad71d65a\` | Integrated and deployed                                              |
| Media production-broad code    |         #138 | \`f9acaa6b687905d14af738431fe9f31ed6efe534\` | Integrated, hardened, and deployed default-off                       |
| Zoom canary evidence           |         #135 | \`c8c4cdae4b7549e801249ed0d24157c10cef4518\` | Integrated exact fail-closed blocker proof                           |
| Vimeo canary evidence          |         #136 | \`74eb75086b766470e78a8a337abdda404cfaa925\` | Integrated exact fail-closed blocker proof                           |
| GHL live reconciliation        |         #139 | \`d82e0bf664a1ea1330d82e54d8dc54a9a72c3d16\` | Integrated reconciled live result                                    |

The controller also corrected four checksum-bound visible-action source digests and one
stale OT-01 browser assertion found by the final integrated gate.

## Area status

| Area                               | State                                       | Current truth                                                                                                                                                                                                | Exact next proof                                                                                                                                                   |
| ---------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Landing and Family signup          | COPY/Routing correction pending integration | Public behavior is locked to real Family-account creation with immediate free access through September 11; no card, no automatic charge, and up to three separate Student accounts.                          | Integrate the focused public copy and canonical app-origin routing correction; OT-CTRL owns deployment.                                                            |
| Admin, Parent, and Student         | LIVE                                        | Final integrated application code is deployed; role boundaries remain gated by the exact-head suites.                                                                                                        | One operator-owned real-role smoke when suitable accounts are available.                                                                                           |
| GHL                                | LIVE RESULT RECONCILED, APP SYNC OFF        | Pipeline/fields/imports and the direct Tisha B'Av send are reconciled. The app's event sync remains disabled. No Student contacts were created.                                                              | Preserve the result; enable no new app-driven workflow without an approved exact provider binding.                                                                 |
| Zoom                               | CODE DEPLOYED, PROVIDER OFF                 | Provider mode is \`sink\`; real-provider and canary flags are false. The separate S2S and Meeting SDK bindings, production origin, host user, and provider-console policy proof are missing.                 | Bind and verify the two app types and production origin, deploy the exact configuration, then run one disposable operator canary.                                  |
| Direct upload / processing / Vimeo | CODE DEPLOYED, PROVIDER OFF                 | Bounded broad processing, explicit occurrence selection, and FFmpeg/ffprobe 8.1.2 are deployed. Media provider variables and Vimeo/OpenAI/S3 registry rows remain absent.                                    | Bind exact AWS/S3/KMS, OpenAI project, and canonical least-privilege Vimeo account/token; obtain one eligible new operator recording; then run one bounded canary. |
| Drive ingest                       | CODE DEPLOYED, NOT BOUND                    | The broad intake is bounded to one provider page per cycle, but no authorized One Time folder/account binding exists.                                                                                        | Bind one dedicated folder and identity, then ingest one eligible file with dedupe/readback.                                                                        |
| Stripe and billing                 | LIVE OFF                                    | \`STRIPE_LIVE_APPROVED=false\` and \`STRIPE_LIVE_BILLING_ENABLED=false\`. Yaakov's existing subscription was reconciled as cancel-at-period-end with no refund and continued access through the paid period. | Complete the exact-customer TEST lifecycle and webhook/access replay proof before any live enablement.                                                             |
| Backup / rollback / observability  | RELEASE GATE PASSED                         | Exact deployments, migration ledger, worker heartbeat, queues, public health, protected diagnostics, and rollback targets are recorded.                                                                      | Keep the prior deployments immutable until the remaining provider canaries pass.                                                                                   |

## Provider result readback

### GHL

- Tisha B'Av direct-send ledger: 38 attempted and accepted; 36 delivered/opened,
  1 hard bounce, and 1 sent-only unknown quarantined without retry.
- All 38 contacts have the sent marker and duplicate-send protection.
- Yaakov: cancel at period end, no refund, access retained through the paid period,
  and the confirmation was delivered in GHL.
- Yael: support-call request only; no cancellation, subscription, access, DND, or
  marketing-status change; one support opportunity is open.
- OT-02A remains Draft, inactive, unenrolled, with zero broad send.

### Zoom

No live canary was attempted. There were zero meetings, registrants, joins, cleanup
mutations, GHL writes, or Student-contact delta. The next attempt must wait for the
exact account/app/origin bindings above.

### Vimeo/media

No upload, S3/OpenAI/Vimeo effect, publication, entitlement, webhook, or customer-visible
item was created. The deployed FFmpeg and Admin occurrence-selection gaps are closed in
code; the remaining provider/account/source blockers above are still exact.

## Release blockers

1. **Public copy/routing correction is pending integration.** The behavior is resolved: public signup creates a real Family account; any residual pre-registration wording must be removed before the next funnel release.
2. **Zoom is not production-canary proven.** Required canonical account/app/origin/host
   bindings and one disposable real occurrence remain missing.
3. **The first new recording is not production-canary proven.** AWS/S3/KMS, exact OpenAI
   project, canonical least-privilege Vimeo binding, and an eligible recording are missing.
4. **Live billing remains intentionally disabled.** The complete TEST lifecycle must pass
   before any live charge authorization.

No release blocker is being represented as code complete merely because its implementation
is deployed.

## Exact next action

Resolve the public phase decision first. In parallel, authorized provider owners should
close the Zoom and media binding checklists without changing broad enablement. After each
exact configuration is deployed and read back, execute only one bounded operator-owned
canary, reconcile every effect, and stop on any unknown outcome. Keep Stripe live billing
disabled until its TEST lifecycle is complete.
