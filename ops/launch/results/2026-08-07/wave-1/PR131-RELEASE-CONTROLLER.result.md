# PR #131 Wave 1 release-controller result

- Controller result: \`COMPLETED_WITH_EXACT_PROVIDER_BLOCKERS\`
- Recorded at: \`2026-08-07T16:18:46.192Z\`
- Repository: \`shloimie-beep/onetimev2\`
- Integration pull request: \`#131\`
- Integration branch: \`codex/one-time-complete-production-launch-20260805\`
- Exact deployed application source: \`f804980081cb2197689f3b4f3f77e58308b915af\`
- Provider mutations performed by the controller: **0**
- DNS/funnel switches performed by the controller: **0**

## Outcome

The final Wave 1 application candidate is integrated, fully gated, progressively deployed
to production web and worker services, and read back at the exact protected runtime
identity. All six authoritative Wave 1 child pull requests are merged. The complete
commercial launch remains intentionally incomplete because the public phase decision,
Zoom canary, first new recording canary, and billing TEST lifecycle have exact unresolved
gates.

## Integrated children

| Lane                        |   PR | Exact child commit                           | Integration merge                            |
| --------------------------- | ---: | -------------------------------------------- | -------------------------------------------- |
| Source of truth and tone    | #134 | \`2576b7e0d5e675e08d7c6134d272596f78e59210\` | \`3fa18eca39c3d448a4295be9b4d8c401bb808959\` |
| Landing corrections         | #137 | \`69ec9859a940d985752c38396fb9ef77ad71d65a\` | \`d06cf8cda6abb5807ef7460324510917316f12cc\` |
| Media production-broad code | #138 | \`f9acaa6b687905d14af738431fe9f31ed6efe534\` | \`b52a6b2491c579ef915bce26c59d40d159c066bb\` |
| Zoom result                 | #135 | \`c8c4cdae4b7549e801249ed0d24157c10cef4518\` | \`47b2cfee5ce0906f771414743574ea8502107417\` |
| Vimeo result                | #136 | \`74eb75086b766470e78a8a337abdda404cfaa925\` | \`51a7defb98aa029626c7539b2f6df84515b1d497\` |
| GHL result                  | #139 | \`d82e0bf664a1ea1330d82e54d8dc54a9a72c3d16\` | \`fd7fd6c6482752ebf7dd776757d212290a7771c7\` |

GitHub reports every child PR above as merged. The marketing packet PRs #132/#133
remain separate non-product deliverables and were not merged into the Wave 1 application
candidate.

## Controller integration corrections

The final integrated gate found and corrected two cross-lane defects:

1. \`ff3babee54d4221aaddc676a81b9f83f6bd30f07\` refreshed four checksum-bound
   visible-action source digests changed by the accepted landing/media lanes.
2. \`f804980081cb2197689f3b4f3f77e58308b915af\` aligned the remaining OT-01
   browser assertion with the canonical \`OT-01 Family Account Confirmation\` name.

The controller review of PR #138 also:

- bounded broad Drive discovery to one provider page per cycle;
- changed post-failure database-write accounting from a false zero to
  \`unknown_after_failure\`; and
- required explicit Admin occurrence selection rather than auto-selecting the first
  occurrence.

## Final candidate gate

GitHub's exact-head Linux checks all passed:

- Node 24 full verification;
- read-only migration verification;
- OPS-06 deterministic reliability/observability;
- PostgreSQL 16 assurance;
- PostgreSQL 18 assurance and restore clone; and
- PostgreSQL 16 learner-seat concurrency.

Local exact-head verification also passed:

- repository secret scan, brand rules, lint, typecheck, build, unit, and integration;
- 70/70 end-to-end browser tests;
- 26/26 accessibility tests;
- 10/10 performance and bundle-separation tests; and
- focused checksum and OT-01 browser regression proofs.

The Windows checkout's repository-wide Prettier invocation sees inherited CRLF worktree
conversion, so the authoritative whole-repository format proof is the successful exact-head
Linux Node check. Every changed/integrated file was also checked or normalized directly.

## Progressive production deployment

Only \`APP_VERSION\` and \`COMMIT_SHA\` were advanced for each service, with automatic
redeploy suppressed until the corresponding clean source upload. No GHL, Zoom, Vimeo,
media, sender, S3/KMS, OpenAI, Stripe, or transport variable was listed with values or
changed.

| Service | Service ID                               | Deployment ID                            | Status      | Image digest                                                                |
| ------- | ---------------------------------------- | ---------------------------------------- | ----------- | --------------------------------------------------------------------------- |
| Web     | \`d175ad94-5e3c-41c2-8cbc-daa1a299077d\` | \`14babe48-a531-4a5e-b22b-e34f0cb91d00\` | \`SUCCESS\` | \`sha256:e1b71cb8fb2a26132e638c55c299a89d22771ff40eff39c86e6c2629b914e10a\` |
| Worker  | \`742f60ed-dc2f-4321-85d0-019003d4e9b9\` | \`1f511ff5-6655-41a1-a486-99f72db3fb85\` | \`SUCCESS\` | \`sha256:c46af1ce63591d8df826797f6c5460b46e4141ff6a18253bac604452461d8462\` |

Both deployments used the repository Dockerfile. The worker used
\`railway.worker.staging.json\` with its continuous start command. Remote container
readback proved FFmpeg and ffprobe \`8.1.2\` are installed.

Railway's platform-supplied \`deployment.git_commit_sha\` retained
\`ed77a04dd24391d5b79be7f839d7f5752a57e0f9\` on the CLI-uploaded web snapshot. It is
not treated as candidate authority. Candidate identity is bound by the clean local and
remote branch head, exact deployment messages, protected \`APP_VERSION\` and
\`COMMIT_SHA\`, deployment/snapshot IDs, and immutable image digests.

## Production readback

- Both public domains return HTTP 200 for \`/health\`, \`/ready\`, and \`/version\`.
- Both protected diagnostic surfaces return HTTP 200 with \`no-store\`, exact version
  and commit \`f804980081cb2197689f3b4f3f77e58308b915af\`, deployment
  \`14babe48-a531-4a5e-b22b-e34f0cb91d00\`, and no blockers.
- Unauthenticated owner diagnostics return HTTP 403 on both domains.
- The ready worker heartbeat reports exact version/commit
  \`f804980081cb2197689f3b4f3f77e58308b915af\` and was 20–22 seconds old at
  final readback.
- \`delivery_outbox\`, \`support_outbox\`, and \`account_lifecycle_outbox\` each have
  zero ready, leased, expired-lease, retry, and dead-letter rows.
- In-container \`npm run db:verify\` passed with 102 migration files, 102 ledger rows,
  zero pending migrations, and zero issues through
  \`2271_ot16_f05_dispatch_context\`.
- Wave 1 added no migration, so no production migration mutation was run.

The public landing and signup smoke returned HTTP 200. The landing contains the real
\`Create your Family account\` CTA and isolated pre-registration copy; \`/signup\`
remains the real Family-account journey. No DNS, redirect, or funnel switch was made.

## Provider smoke disposition

### GHL — reconciled real provider result

- 38 direct Tisha B'Av emails were attempted and accepted.
- Final split: 36 delivered/opened, 1 hard bounce, and 1 sent-only unknown quarantined
  with no retry.
- All 38 contacts have the sent marker and duplicate-send protection.
- Yaakov is cancel-at-period-end with no refund, retained paid-period access, and a
  delivered GHL confirmation.
- Yael is a support-call request, not a cancellation; subscription/access/DND/marketing
  state was unchanged and one support opportunity is open.
- OT-02A remains Draft, inactive, and unenrolled with zero broad send.
- No Student contacts were created.

### Zoom — exact fail-closed blocker

The final deployed configuration still has \`ZOOM_CLASSROOM_PROVIDER_MODE=sink\`,
\`ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED=false\`, and
\`ZOOM_CLASSROOM_CANARY_ENABLED=false\`. Separate canonical S2S and Meeting SDK
credentials, production origin binding, host user identity, and provider-console policy
proof remain missing. The lane correctly stopped with zero meetings, registrants, joins,
cleanup mutations, GHL writes, or Student-contact delta.

### Vimeo/media — code deployed, provider canary blocked

The deployed code now includes bounded broad processing, explicit occurrence selection,
and FFmpeg/ffprobe. The first-recording canary remains blocked because there is no exact
AWS/S3/KMS binding, OpenAI project binding, canonical least-privilege Vimeo binding,
active Vimeo/OpenAI/S3 registry rows, or eligible new operator-owned recording. The
lane recorded zero uploads, objects, processing requests, Vimeo mutations, publications,
entitlements, or webhooks.

### Stripe — live intentionally off

\`STRIPE_LIVE_APPROVED=false\` and \`STRIPE_LIVE_BILLING_ENABLED=false\`. The existing
Yaakov cancellation was reconciled, but no new live charge authority was enabled.

## Rollback

- Preserved rollback branch:
  \`rollback/one-time-pre-complete-launch-20260805\` at
  \`a157c388d8dc292699f7cd1a1ef178918ee30885\`.
- Immediate prior successful web deployment:
  \`35de7372-d367-4cec-84f8-f6758058e759\`.
- Immediate prior successful worker deployment:
  \`6e2e806f-319f-403f-83a0-7b5b202236a2\`.

## Exact blockers and next action

1. Decide whether the public phase is real Family-account creation or pre-registration;
   do not change DNS/funnel/copy until the behavior is authoritative.
2. Authenticate an authorized Zoom operator, classify and verify the separate S2S and
   Meeting SDK apps, bind the exact production origin/host/policies, deploy and read back
   that configuration, then execute one disposable canary.
3. Provision and register exact AWS/S3/KMS, OpenAI project, and least-privilege Vimeo
   bindings; obtain one eligible new recording; deploy and read back the configuration;
   then execute one bounded recording canary.
4. Complete the exact-customer Stripe TEST lifecycle and webhook/access replay proof
   before any live billing enablement.

This closeout record and the canonical status update are documentation-only changes after
the exact application deployment. They do not change the deployed application source.
