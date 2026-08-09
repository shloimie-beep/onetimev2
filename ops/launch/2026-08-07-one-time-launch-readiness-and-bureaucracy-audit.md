# One Time Launch Readiness and Bureaucracy Audit

Audit date: 2026-08-07 (Asia/Jerusalem)

Repository: `shloimie-beep/onetimev2`
Active branch: `codex/one-time-complete-production-launch-20260805`
Active pull request: #131
Candidate head inspected: `43968d4b6163f97799e14289c2424c1001ab5c37`

This is a point-in-time engineering and launch audit. It does not authorize live GHL, Stripe, or Zoom changes. Work remains the owner of live HighLevel UI/provider execution, Stripe browser actions, and Zoom browser actions.

## Post-audit locked update — 2026-08-09

Family signup is to use one required Terms checkbox and one integrated Terms document. The implementation and final acceptance must prove exactly one visible checkbox; no separate privacy, general-marketing, or Parent-newsletter control; correct versioned internal adult-email scope projections; and continued precedence for unsubscribe, DND, complaint, hard-bounce, suppression, and withdrawal. WhatsApp and Student-specific recording/recognition permissions remain separate.

The integrated Terms and incorporated legal sections still require the named qualified legal-review approval and digest-bound release evidence already required by the privacy package. This update does not itself approve legal text or authorize deployment.

## Executive Assessment

One Time is a strong late-stage application, not a finished provider-integrated launch. The core product is about **92% implemented**, the currently deployed experience is about **82% complete**, and the whole project is about **79% complete**. The distinction is deployment and production proof, not a hidden backlog of ordinary application screens.

The testing program was valuable. It caught migrations, role isolation, accessibility, browser journeys, replay, and provider-effect risks that matter for a child-facing paid application. It became excessive where historical control-plane rituals, duplicate audits, unchanged full-suite reruns, and permanent GHL workflows for one-time sends were treated like release work. Keep the safety gates; stop the paperwork.

The fastest safe route is five actions:

1. turn PR #131 into the exact release candidate and deploy the same SHA to web and worker;
2. let Work finish the narrowly defined HighLevel pipeline, readback, and direct emails;
3. bind Zoom and pass one current real occurrence on real Student devices;
4. publish the first recording by direct upload, then add Drive and repeatable media operation;
5. keep live billing off until one complete Stripe TEST lifecycle and GHL billing readback pass.

No new control tower, canary framework, launch ledger, prompt chain, or permanent one-off workflow is needed.

### Lead engineering recommendation

Ship the application in stages, but do not create multiple software release branches or weeks of percentage canaries:

- **Stage A — controlled free launch:** exact candidate, providers off except GHL intake/receipt, real Parent/Student smoke.
- **Stage B — August 16 class:** Zoom on for the canonical class only after one operator canary.
- **Stage C — first recording:** direct upload and one protected Vimeo asset; Drive may follow.
- **Stage D — paid launch:** Stripe and commercial GHL workflows only after TEST lifecycle proof.

This sequence limits blast radius using feature/provider gates already in the code. A new cohort framework would add time without improving the main risks.

## Percentage Table

| Measure                                           | Score | Confidence range | Main reason                                                                                                                                                               |
| ------------------------------------------------- | ----: | ---------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core application implementation                   |   92% |           89–95% | The role, administration, class, learning, support, privacy, and billing contracts are substantially built and tested; repeatable real-provider media remains incomplete. |
| Production deployment completion                  |   82% |           78–86% | Production is healthy and usable, but it is 13 commits behind the candidate and the exact production worker SHA was not independently readable.                           |
| Controlled free/pre-registration launch readiness |   88% |           84–92% | Landing, no-card signup, auth, DB records, and portals work; deploy the candidate and finish Work-owned GHL intake/receipt readback.                                      |
| August 16 first-class readiness                   |   70% |           62–78% | Schedule, occurrences, roster, and classroom code exist; Zoom credentials, a real occurrence, host/Student joins, attendance, and replay are not production-proven.       |
| Full paid/commercial launch readiness             |   60% |           52–68% | Billing/access logic and TEST paths exist, but live Stripe, commercial GHL workflows, and complete provider acceptance are deliberately off.                              |
| Overall project completion                        |   79% |           75–83% | Weighted judgment across product, deployment, free launch, class, media, communications, billing, and operations.                                                         |

These scores are not derived from the 243-row acceptance contract's stale `unimplemented` fields. That document is a normative test inventory, not a current progress ledger.

### Evidence behind the scores

#### 1. Core application implementation — 92% (89–95%)

- **Completed evidence:** 671 unit tests passed in the reported candidate run; focused integration tests passed; the GitHub Node gate passed build, Playwright, accessibility, and performance. Admin, Parent, Student, auth, signup, scheduling, occurrences, enrollment, attendance, progress, access, support, questions, privacy, billing, and operations code is present.
- **Remaining work:** repeatable broad-production media mode; focused Zoom SDK compatibility check; provider configuration/readback; small integrated acceptance defects if found.
- **Branch-only:** 13 commits after production add Parent/Student class detail, Student lesson detail/playback, cancellation/refund copy, workflow readback, dual-role and household selection, occurrence classroom, moderation, signup receipt, Student privacy, peer-export exclusion, and journey alignment.
- **Deployed:** core administration, Family signup, auth, top-level portals, scheduling, enrollment, attendance, progress, access administration, support/account/operations surfaces.
- **Production-proven:** public health/readiness; login/recovery rendering; protected-route redirect; operator-reported active Admin/Parent/Student records and active session.
- **Test-only:** many provider adapters, billing lifecycle effects, negative role cases, accessibility/performance, and canary planners.
- **Externally blocked:** GHL, Zoom, Vimeo/Drive credentials, and later Stripe activation.

#### 2. Production deployment completion — 82% (78–86%)

- **Completed evidence:** `/health`, `/ready`, and `/version` return HTTP 200. Landing, login, recovery, and Family signup render. Protected app routes redirect unauthenticated users to login.
- **Remaining work:** deploy exact candidate to both web and worker, record both SHAs, verify heartbeat/readiness, perform rollback-ready smoke.
- **Branch-only:** 13 commits / 85 changed files after `3b7e5a98`; no migration file changed in this delta.
- **Deployed:** operator reports production source `3b7e5a98f3a52c59bcbe2261644409e00d609bb8` for the current app build.
- **Production-proven:** application and database are in active use. Public version is presence-only, so the SHA is not publicly disclosed.
- **Test-only:** exact-head CI and many role/provider journeys.
- **Externally blocked:** production worker identity requires deployment-console readback; Railway CLI was not available in this audit environment.

#### 3. Controlled free/pre-registration launch readiness — 88% (84–92%)

- **Completed evidence:** the public landing page and no-card Family signup are live; login and recovery exist; production has an active Parent, four Students, and Admin users; live charging is disabled.
- **Remaining work:** candidate deployment, one fresh Family signup, signup receipt, Parent/Student credential use, and GHL save/reopen/direct-send readback.
- **Branch-only:** durable signup receipt, role/household selection, privacy improvements, and the newest Parent/Student detail journeys.
- **Deployed:** public acquisition and basic account use.
- **Production-proven:** form/auth surfaces and current records; not every latest role journey.
- **Test-only:** negative isolation and full journey matrices for the newest candidate.
- **Externally blocked:** Work-owned HighLevel pipeline and sender/suppression readback.

#### 4. August 16 first-class readiness — 70% (62–78%)

- **Completed evidence:** the locked start is 2026-08-16 19:00 +03; recurrence, 90-day occurrences, enrollment, one-device access, embedded classroom, attendance, questions, moderation, and host/Student contracts exist.
- **Remaining work:** activate exact Zoom apps/scopes/origin, provision a disposable/current occurrence, verify host ZAK and Student Meeting SDK joins, test reconnect/concurrency, and record attendance.
- **Branch-only:** occurrence-specific Student classroom and class details.
- **Deployed:** schedule/roster/application class management, according to the prior launch checkpoint and operator report.
- **Production-proven:** no current real Zoom class proof on the exact candidate.
- **Test-only:** sink adapters, signatures, provisioning/idempotency, access windows, and simulated classroom journeys.
- **Externally blocked:** Work-owned Zoom browser activation and Shloimie's real tablets/host acceptance.

#### 5. Full paid/commercial launch readiness — 60% (52–68%)

- **Completed evidence:** $67/month policy, no-card free period, access/grace/inactive contracts, cancellation/refund policy, TEST webhook ingestion, replay recovery, OT-03 checkpoints, and guarded OT-16 paths are built.
- **Remaining work:** exact live Stripe product/price/customer binding, full TEST lifecycle, webhook readback/replay, wrong-customer denial, GHL OT-03/04/05/06/13/16 readback, and explicit live-charge authorization.
- **Branch-only:** latest cancellation/refund policy and governed workflow readback.
- **Deployed:** billing/access administration and payment-disabled product behavior.
- **Production-proven:** fail-closed/no-charge state; no live commercial transaction.
- **Test-only:** Stripe lifecycle and access transition coverage.
- **Externally blocked:** Work-owned Stripe/GHL browser execution and later Shloimie approval to enable live charges.

#### 6. Overall project completion — 79% (75–83%)

- **Completed evidence:** a broad, coherent application is running; the candidate is mergeable and heavily tested; migration/restore and role/privacy controls are strong.
- **Remaining work:** exact release, GHL, Zoom, repeatable media/Drive, paid billing, and final integrated acceptance.
- **Branch-only:** the latest 13 commits.
- **Deployed:** most core management and account functionality.
- **Production-proven:** core reachability/use, not complete provider automation.
- **Test-only:** most high-risk provider lifecycle combinations.
- **Externally blocked:** provider credentials/UI and human/device acceptance.

## What Is Live Now

| Capability           | Current live truth                                                                                                                                                                                              |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Landing              | HTTP 200 at both app and join domains; canonical public content renders                                                                                                                                         |
| Family signup        | `/signup` redirects to the join domain; the no-card Family form renders and states the Student model                                                                                                            |
| Login and recovery   | Both render; protected role routes redirect to login when unauthenticated                                                                                                                                       |
| Production accounts  | Operator reports 2 active Admins, 1 Parent, 4 Students, and an active session                                                                                                                                   |
| Admin management     | Dashboard plus contacts, households, users, Students, class scheduling, occurrences, enrollment, attendance, progress, access, billing administration, support, audit, account, and operations areas are usable |
| Parent/Student       | Top-level portals are present and usable; latest detail/privacy improvements are not yet deployed                                                                                                               |
| Database             | Last verified ledger is 102/102 migrations through `2271_ot16_f05_dispatch_context`; the candidate adds no migrations after the reported production source                                                      |
| Health/observability | Public health/readiness/version are green and protected routes fail closed                                                                                                                                      |
| Payment safety       | Live payment transport and live-charge authorization remain off                                                                                                                                                 |
| Provider safety      | GHL, Zoom, media broad mode, and WhatsApp remain gated rather than silently simulating live behavior                                                                                                            |

This audit did not use an administrator credential, so it does not claim a new authenticated production journey beyond the supplied operator evidence.

## What Is Built but Not Deployed

Production is reported at `3b7e5a98...`; PR #131 is at `43968d4b...`. The 13 later commits are:

1. `0dc14483` — Parent and Student class detail.
2. `d4142365` — Student library lesson detail.
3. `001d8fe6` — cancellation/refund policy.
4. `7d445296` — governed workflow readback.
5. `1de18392` — dual-role selection.
6. `627bf05d` — household selection.
7. `9f1e501b` — occurrence-specific Student classroom.
8. `b67fbe33` — question moderation.
9. `7a96b0d8` — governed signup receipt.
10. `3cbd7fbb` — self-managed Student privacy.
11. `84b4e69b` — peer-detail exclusion from Student exports.
12. `a6ca46c5` — journey tests aligned with the durable receipt.
13. `43968d4b` — presence-only keyholder readiness.

The delta is 85 files with no migration change. That makes a candidate deployment plus targeted post-deploy smoke safer and faster than another migration rehearsal.

## What Is Still Missing

| Area                 | Missing or unproven item                                                                                                                               | Type                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| Release              | PR is draft; exact head is not on production web and worker                                                                                            | Deployment                |
| Production identity  | Exact current worker SHA is not independently readable; public version intentionally hides it                                                          | Readback                  |
| Admin/Parent/Student | One current real-role integrated smoke on the deployed candidate                                                                                       | Human acceptance          |
| Zoom                 | Activated S2S and Meeting SDK credentials, exact origin, host user, current occurrence, ZAK, Student joins, attendance, replay                         | Provider + human          |
| Zoom compatibility   | Current client join payload still supplies deprecated `sdkKey`; perform one focused compatibility check against the chosen current SDK version         | Small code/provider check |
| Content              | `ONE_TIME_CONTENT_MEDIA_MODE` supports only `off`, `synthetic_canary`, and one-recording `provider_canary`; no repeatable broad-production mode exists | Code/config               |
| Drive                | Dedicated One Time folder plus authorized service-account access and exact-folder readback                                                             | External binding          |
| Processing           | Candidate proof with normative current transcription/generation models and FFmpeg runtime                                                              | Provider canary           |
| Vimeo                | Owner-scoped token/account/webhook secret bound to the candidate and one current private publish/readback                                              | External binding          |
| Recording library    | One current private asset through review, publish, Student playback, sibling denial, unpublish/replay                                                  | Integrated acceptance     |
| GHL                  | Final pipeline/UI save-readback, sender/suppression readback, workflow IDs, direct migration/Tisha send receipts                                       | Work-owned external       |
| Communications       | Live workflow execution and customer messaging; WhatsApp remains correctly dormant                                                                     | External                  |
| Stripe               | Complete TEST customer/subscription/webhook/access lifecycle and later live enablement                                                                 | Work-owned external       |
| Backup/rollback      | Bind the final exact SHA to web/worker, take final backup evidence, keep prior deployment rollback target                                              | Release acceptance        |
| Observability        | Final exact-head worker heartbeat/queues/provider state after deployment                                                                               | Release acceptance        |

### Zoom recommendation and time

Do not restart Zoom architecture. The broad provider path already creates meetings, registers Students, generates participant/host signatures, obtains host ZAK, and selects the full client view below 900 px—appropriate for tablets. Current Zoom documentation says component view is desktop-oriented, while client view is the mobile path; the existing responsive selection follows that split.

Use this minimum sequence:

1. activate/read back the existing Server-to-Server OAuth app and Meeting SDK app in the same Zoom account;
2. bind only the exact account/client/host/origin/version variables;
3. provision one disposable/current occurrence, not a historical compromised meeting;
4. join as host and one Student first; then use three real Student devices for final acceptance;
5. verify attendance and retry/reconnect do not duplicate meetings or registrants; disable canary-only gates after proof.

Estimated effort: **4–8 focused hours** if credentials/scopes are ready, normally **1–2 business days** including real-device scheduling, and **3–5 days** only if Zoom app activation or account scopes require support. Historical meeting cleanup and 30-sample performance ceremonies should not gate this.

Current provider references: [Zoom Meeting SDK authorization](https://developers.zoom.us/docs/meeting-sdk/auth/), [Zoom component view](https://developers.zoom.us/docs/meeting-sdk/web/component-view/), and [Zoom SDK Key migration](https://developers.zoom.us/docs/meeting-sdk/sdk-key-migration/).

### Vimeo, processing, and Drive recommendation and time

The fastest first recording is **direct app upload**, not Drive. A prior real 1.82 GB canary already proved the external chain through private Vimeo, captions, protected Student playback, sibling denial, and unpublish. Repeat it once on the current candidate because the normative model/runtime and deployment have changed.

For speed:

- bind the existing owner-scoped Vimeo token, account ID, and webhook secret;
- use the guarded one-recording provider canary for the first real class recording;
- publish with private/no-public-view settings and protected in-app playback;
- implement/enable repeatable broad-production media mode immediately after the first asset;
- add the dedicated Drive folder by sharing exactly that folder with the One Time service account;
- use the existing exact-folder polling adapter for launch. Do not add a new Drive push/Pub/Sub framework merely to publish the first recording.

Estimated effort: **0.5–1 business day** to publish the first recording once credentials are present; **1–2 additional business days** for broad repeatable operation plus Drive binding and replay proof.

Current provider references: [Vimeo video uploads](https://developer.vimeo.com/api/upload/videos), [Google Drive resource notifications](https://developers.google.com/workspace/drive/api/guides/push), and [Google Drive sharing/permissions](https://developers.google.com/workspace/drive/api/guides/manage-sharing).

## Five Actual Launch Blockers

1. **The release candidate is still a draft and is not deployed.** This is the single highest-leverage blocker.
2. **Work-owned HighLevel configuration/readback is incomplete.** It blocks reliable Warm Lead and lifecycle messaging, not basic app use.
3. **Zoom lacks current production proof.** Code is present; provider binding and real-device acceptance are missing.
4. **The media path is one-recording canary-only.** It can safely publish the first recording, but cannot yet be called complete weekly automation.
5. **Live paid billing is intentionally off.** It is not a blocker for free launch or the first class, but it is a blocker for commercial launch.

The queued reliability workflow is **not** a sixth blocker. Five visible exact-head PR checks are green, the base branch has no required-check protection, and the queued job has not started. Cancel/re-run it once when Actions is healthy if desired; do not wait indefinitely or rebuild the release process around it.

## Canary Work to Keep

| Lane                   | Minimum safety validation to keep                                                                                                                               | Why it matters                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Production release     | One full exact-head CI gate after the last code change; migration assurance; backup/rollback; exact web/worker SHA; health/heartbeat                            | Prevents mixed-source deployment and irreversible migration failure                |
| Parent/Student roles   | One real Parent plus separate Student credentials/devices; forbidden route, sibling, and peer-detail negatives                                                  | Automated fixtures cannot prove actual credentials/device/session isolation        |
| Zoom                   | One current occurrence; host + Student joins; three real Student devices for final acceptance; reconnect/concurrency; attendance; provider readback; no raw URL | Exercises credentials, browser media, account scopes, and idempotency              |
| Vimeo/media            | One real representative recording on the candidate; processing/model readback; private asset; protected playback; sibling denial; replay/unpublish              | External transcoding, privacy, and callback behavior cannot be inferred from mocks |
| Drive                  | One exact authorized folder and one representative file; dedupe/replay and source deletion/permission behavior                                                  | Prevents wrong-folder import and duplicate assets                                  |
| GHL reusable workflows | One operator-owned adult seed per distinct reusable workflow family; save/reopen IDs; recipient/sender/suppression at send time                                 | Prevents wrong-recipient messages and unsaved provider configuration               |
| GHL direct emails      | Exact adult recipient set, suppression/DND/unsubscribe/complaint/hard-bounce check, sender readback, idempotency/receipt                                        | Direct does not mean ungoverned                                                    |
| Stripe                 | One complete TEST checkout/payment/failure/grace/cancel/reactivate/refund lifecycle; exact customer; replay; no live charge                                     | Billing errors can remove access or charge the wrong customer                      |
| Accessibility          | Automated exact-head accessibility gate plus one keyboard/mobile smoke on changed critical screens                                                              | Child/parent usability and legal/accessibility risk                                |
| Operations             | Restore proof, rollback command/target, queue/heartbeat/alert readback                                                                                          | Required for recovery, not bureaucracy                                             |

## Canary Work to Replace with Manual Smoke

| Existing pattern                                                                                            | Replacement                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Repeating the complete Playwright viewport/browser matrix after provider-only or documentation-only changes | Run focused affected tests; do one desktop and one mobile/tablet operator smoke; run the full matrix once on the final code head |
| Historical Zoom disposable-meeting cleanup/classification as a release prerequisite                         | Use a new disposable/current occurrence and one readback; preserve old evidence without cleaning it into readiness               |
| 30-sample or broad permutation Zoom performance ceremony                                                    | Existing automated performance gate plus one host and three real devices on the actual network                                   |
| Multiple separate Zoom canaries for provisioning, join, attendance, and replay                              | One scripted operator session that records all four results against one occurrence                                               |
| Re-running the old 1.82 GB Vimeo exercise repeatedly                                                        | One current representative file after candidate/config change; afterward monitor normal first production recording               |
| Separate Drive notification framework before the first recording                                            | Direct upload first; then one exact-folder polling smoke with one file                                                           |
| Provider UI readback by both Work and Codex                                                                 | Work performs the UI action and returns one safe ID/status/receipt; Codex verifies application-side readback                     |
| Full repository review after every small isolated fix                                                       | Focused test and diff review per fix; one final full candidate gate                                                              |
| Multiple role acceptance packets                                                                            | One integrated Admin → Parent → Student journey with negative checks and a single concise receipt                                |

## Bureaucracy to Stop

The following remain historical evidence only and must not be release gates or receive routine updates:

- `ops/v2.1-execution/control/READY-QUEUE.yaml`;
- `ops/v2.1-execution/CLAIM-AND-LEASE-PROTOCOL.md`;
- `ops/v2.1-execution/templates/READY-ENTRY.yaml` and `STEWARD-REQUEST.yaml`;
- `ops/v2.1-execution/runtime/**/steward-requests/**` and old `STEWARD-REQUESTS.yaml` files;
- `ops/goals/OT-LAUNCH-01/BOARD.yaml` as an execution authority;
- old queued-task, assigned-task, copied-chat, and provider handoff packets under `ops/goals/OT-LAUNCH-01/handoffs/`;
- `ops/execution-windows/2026-07-27/queue.yaml` and other obsolete execution-window queues;
- terminal/closeout packets whose only purpose is to prove another packet was written;
- duplicate readiness audits and repository-wide rereads when these two current launch documents already state the checkpoint;
- `OT-02A` activation for the one-time old-member email;
- any `OT-02C` or Tisha follow-up workflow creation/repair/reuse;
- Codex duplicating Work's live GHL, Stripe, or Zoom browser work.

Operational practices to stop:

- claim files and lease renewals;
- steward requests for ordinary bounded edits;
- copying chat messages into handoff files as completion proof;
- blocking on stale historical canary cleanup;
- treating every workflow/canary row as a mandatory launch blocker;
- rerunning unchanged historical matrices;
- full CI after documentation-only changes;
- creating a permanent automation for a single controlled email;
- producing another plan instead of completing the five actions below.

Do **not** remove recipient/suppression checks, idempotency, child-data isolation, exact Stripe customer matching, provider-effect readback, rollback, secret protection, final integrated acceptance, or real role testing.

## Minimum Launch Path

| Outcome                             | Shortest safe path                                                                                                                                                    | What may remain off                                  |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1. Accept Warm Leads                | Work saves the five-stage pipeline, confirms future funnels enter `Warm Leads`, stores source in fields, and read-backs the public intake mapping                     | Zoom, Vimeo, Drive, Stripe, broad nurture            |
| 2. Pre-register families            | Deploy exact candidate; run one no-card Family signup; verify receipt, adult-only GHL projection, Parent account, and no charge                                       | Zoom, media, paid billing                            |
| 3. Open Parent and Student accounts | Shloimie uses one Parent and separate Student credentials/devices; verifies role/household selection, isolation, class/library visibility, support/privacy            | Zoom can remain off until class canary               |
| 4. Run the August 16 live class     | Bind existing Zoom S2S + Meeting SDK apps; prove one occurrence; run three-device final smoke; leave raw links hidden                                                 | Vimeo/Drive and paid billing                         |
| 5. Publish the first recording      | Direct upload the real recording; process with locked tools/models; review; publish private Vimeo asset; verify Student playback/denial; then add Drive               | Drive may follow the first direct upload             |
| 6. Later enable paid billing        | Complete Stripe TEST lifecycle and commercial GHL readback; bind exact live product/price/customer; explicitly authorize live charges; monitor first real transaction | WhatsApp and broad marketing remain optional/dormant |

## Exact Next Five Actions

### 1. Release PR #131 exact head

- **Owner:** Codex prepares/verifies; Shloimie approves release.
- **Exact system:** GitHub PR #131 and Railway production web + worker.
- **Dependency:** final source/code changes complete; five current green checks; rollback target retained.
- **Completion proof:** PR no longer draft; exact candidate SHA recorded for both web and worker; 102/102 migration readback; public health/readiness; worker heartbeat; one Admin/Parent/Student smoke; rollback target documented.
- **Stop condition:** web/worker SHA mismatch, migration/checksum drift, failed readiness/heartbeat, new high-severity role/privacy defect, or no rollback target.
- **Performer:** Codex for repo/checks; Shloimie for production approval. Work is not needed.
- **Estimate:** 2–4 hours.

### 2. Finish the narrow HighLevel launch configuration

- **Owner:** Work.
- **Exact system:** live HighLevel location, pipeline, adult contacts, direct API email endpoint, sender/suppression readback.
- **Dependency:** locked decisions DEC-101 through DEC-106; correct sender access; exact adult recipient sets.
- **Completion proof:** stages saved/reopened in the locked order; `b87...` read back as `Active Member`; event and not-yet-account public cohorts use their explicit stages; source fields populated; no Student contact; one direct Tisha email receipt; one direct old-member migration email receipt; `OT-02A` inactive; no `OT-02C`.
- **Stop condition:** suppression/consent unknown, wrong location/sender/stage, Student identity present, duplicate/unknown send outcome, or save/reopen mismatch.
- **Performer:** Work. Codex verifies only repository/app-side readback. Shloimie resolves business recipient decisions if needed.
- **Estimate:** 4–8 focused hours, depending on Work availability.

### 3. Activate and prove one Zoom occurrence

- **Owner:** Work for Zoom UI; Codex for focused compatibility/support; Shloimie for real-device acceptance.
- **Exact system:** Zoom S2S OAuth app, Meeting SDK app, Railway Zoom variables, One Time occurrence/classroom/attendance.
- **Dependency:** Action 1; same Zoom account for host/meeting/apps; exact production origin; current SDK version.
- **Completion proof:** one meeting per occurrence; per-Student registrants; host starts with ZAK; one Student join then three real Student devices; reconnect/one-device rule; attendance captured; no raw URL; retry creates no duplicate.
- **Stop condition:** account/origin/scope mismatch, deprecated join payload rejection, unknown provider effect, raw-link exposure, duplicate meeting/registrant, or attendance mismatch.
- **Performer:** Work + Codex + Shloimie as above.
- **Estimate:** 1–2 business days; 3–5 only with provider escalation.

### 4. Publish the first recording, then make media repeatable

- **Owner:** Codex; Shloimie supplies/approves the representative recording.
- **Exact system:** One Time direct upload, managed S3, FFmpeg/OpenAI processing, review, Vimeo private publication/webhook, Student library; then Google Drive exact-folder ingest.
- **Dependency:** Action 1; owner-scoped Vimeo credentials/webhook secret; S3/OpenAI/FFmpeg configuration; one authorized canary ID.
- **Completion proof:** real file received once; current model/profile readback; private Vimeo asset; captions/metadata; Admin approval; Student playback; sibling denial; replay no duplicate; unpublish/recovery; afterward a dedicated Drive folder ingests one file once.
- **Stop condition:** wrong provider account/folder, public Vimeo visibility, secret exposure, unknown upload outcome, duplicate asset, child/access leak, or failed cleanup/recovery.
- **Performer:** Codex for code/runtime/provider binding permitted by scope; Shloimie for file and visual acceptance. Work is not needed for Vimeo/Drive.
- **Estimate:** 0.5–1 day for first direct recording; 1–2 more days for broad mode + Drive.

### 5. Prove billing in TEST and schedule the later paid cutover

- **Owner:** Work for Stripe/GHL UI; Codex for application-side verification; Shloimie for live-charge authorization.
- **Exact system:** Stripe TEST, One Time billing/access, GHL OT-03/04/05/06/13/16, Railway payment gates.
- **Dependency:** Actions 1 and 2; exact product/price/customer metadata; commercial copy and free-period cutoff.
- **Completion proof:** checkout → active → failed/grace → recovery → cancel/end → reactivate/refund paths; exact customer match; webhook replay idempotent; access correct; GHL readback correct; no live charge during test. Later live cutover has explicit approval and first-transaction monitoring.
- **Stop condition:** customer/price mismatch, missing suppression, unknown webhook effect, access disagreement, duplicate effect, or any unapproved live-charge path.
- **Performer:** Work + Codex + Shloimie as above.
- **Estimate:** 1–2 business days after GHL is ready; full commercial launch **4–8 business days** from now if provider access is timely.

## Final recommendation on testing

The correct policy is:

- focused tests for each code change;
- no full-suite rerun for documentation-only or unchanged provider UI work;
- one full exact-head candidate gate after the final code change;
- one bounded real operator smoke per provider family;
- one integrated Admin → Parent → Student → class → recording acceptance before declaring complete launch;
- one complete Stripe TEST lifecycle before live charging.

That is enough. More process beyond this point would mostly measure the process rather than reduce launch risk.
