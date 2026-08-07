# One Time Complete Production Launch — Status

Snapshot date: 2026-08-07 (Asia/Jerusalem)

Detailed evidence and recommendations: `ops/launch/2026-08-07-one-time-launch-readiness-and-bureaucracy-audit.md`.

## Executive status

The application is usable in production for core administration, Family signup, authentication, and top-level Parent/Student access. It is not yet the complete production launch. The safest realistic assessment is **79% overall complete (75–83% confidence range)**.

The shortest path is not more planning. It is: release the exact PR #131 candidate, finish the Work-owned HighLevel configuration, prove one real Zoom occurrence, publish one real recording through the guarded media path, and keep billing disabled until its TEST lifecycle and provider readback pass.

## Current identities and checks

| Item                     | Current truth                                                                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Repository / branch      | `shloimie-beep/onetimev2` / `codex/one-time-complete-production-launch-20260805`                                                                                                           |
| Pull request             | PR #131, open and draft; mergeable `MERGEABLE`, merge state `CLEAN`                                                                                                                        |
| Candidate head           | `43968d4b6163f97799e14289c2424c1001ab5c37`                                                                                                                                                 |
| Production web source    | Operator-reported `3b7e5a98f3a52c59bcbe2261644409e00d609bb8`; the public version endpoint is intentionally presence-only and does not expose the SHA                                       |
| Production worker source | Not independently readable from the public surface in this audit; exact web/worker SHA equality is a release acceptance item                                                               |
| Candidate gap            | 13 commits and 85 changed files after the reported production source; no migration file changed in that gap                                                                                |
| Migration inventory      | 102 SQL migrations through `2271_ot16_f05_dispatch_context.sql`; last production ledger proof was 102/102 with checksum `3fdfc7f5a162ce04687fd4c6fb6cc790f333a8e9a5a2e876adf2dd8095a3fbe4` |
| PR checks                | Five visible PR checks pass. The Node gate includes build, unit/integration coverage, Playwright, accessibility, and performance.                                                          |
| Reliability workflow     | Exact-head run `31122258189` remains queued after the prior Actions incident. It is not a branch-protection requirement and must not block deployment merely because it is queued.         |
| Public health            | `/health`, `/ready`, and `/version` return HTTP 200; login and recovery render; protected app routes redirect unauthenticated users to login                                               |
| Production data          | Operator reports 2 active Admin accounts, 1 Parent, 4 Students, and an active session                                                                                                      |

## Percentage summary

| Measure                                           | Score | Confidence range |
| ------------------------------------------------- | ----: | ---------------: |
| Core application implementation                   |   92% |           89–95% |
| Production deployment completion                  |   82% |           78–86% |
| Controlled free/pre-registration launch readiness |   88% |           84–92% |
| August 16 first-class readiness                   |   70% |           62–78% |
| Full paid/commercial launch readiness             |   60% |           52–68% |
| Overall project completion                        |   79% |           75–83% |

These are judgment ranges based on deployed behavior, branch-only work, production proof, provider dependencies, and safety gates—not a count of stale acceptance rows.

## Area status

| Area                                      | State                   | What is true now                                                                                                                                           | Next proof                                                                                                                       |
| ----------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Landing and Family signup                 | LIVE                    | Landing and no-card Family signup render in production                                                                                                     | One post-release signup smoke and durable receipt                                                                                |
| Login and recovery                        | LIVE                    | Login and forgot-password surfaces render; protected routes redirect correctly                                                                             | One real recovery smoke without exposing tokens                                                                                  |
| Admin                                     | LIVE / CANDIDATE AHEAD  | Dashboard and management areas are usable; latest detail screens are branch-only                                                                           | Deploy head and smoke dashboard, user, Student, class, attendance, content, and ticket paths                                     |
| Parent and Student                        | LIVE / CANDIDATE AHEAD  | Top-level portals exist; class/lesson detail, household/role selection, occurrence classroom, moderation, and Student privacy improvements are branch-only | One real Parent plus separate Student device smoke after deployment                                                              |
| Class and attendance                      | APP READY, PROVIDER OFF | Schedule, occurrences, roster, enrollment, attendance, and access contracts exist                                                                          | One exact occurrence with provider readback and replay proof                                                                     |
| Zoom                                      | NOT LIVE                | Broad real-provider code is composed, including S2S provisioning and Meeting SDK launch; credentials/origin and a current real-device canary are missing   | One Admin/host plus three Student-device joins, attendance, reconnect, no raw URL, no duplicate provider effects                 |
| Direct upload / processing / Vimeo        | GUARDED CANARY READY    | A historical 1.82 GB real-file canary proved upload, transcription, private Vimeo publication, protected playback, sibling denial, and unpublish           | Repeat once on the deployed candidate with the locked model/config; then implement/enable repeatable broad-production media mode |
| Drive ingest                              | NOT BOUND               | Adapter and exact-folder path are built; no authorized One Time folder/service-account binding was found                                                   | Share one dedicated folder with the service account and ingest one file with dedupe/readback                                     |
| GHL                                       | WORK-OWNED EXTERNAL     | Adult-only projection and readback contracts exist; live pipeline/workflows/sends remain a Work task                                                       | Save/reopen IDs, sender/suppression proof, and direct-send receipts; no Student contacts                                         |
| Stripe and billing                        | TEST-READY, LIVE OFF    | Billing/access/grace/cancel/refund contracts and TEST ingestion exist; live charge authorization is off                                                    | Exact-customer TEST lifecycle, webhook replay, access transitions, then explicit later live enablement                           |
| Privacy / child isolation / accessibility | STRONG, CANDIDATE AHEAD | Student isolation, peer exclusion, data rights, CSRF, suppression, and automated accessibility coverage exist                                              | Post-release real-role negative checks and accessibility smoke                                                                   |
| Backup / rollback / observability         | KEEP AS RELEASE GATE    | Migration assurance, PostgreSQL 16/18 restore checks, health/readiness, worker heartbeat, and rollback evidence exist                                      | Bind final release SHA to web and worker and keep the previous known-good deployment immutable                                   |

## Five actual blockers

1. **Release candidate not deployed.** PR #131 is still a draft and production is 13 commits behind its head.
2. **HighLevel live configuration/readback incomplete.** Work owns this. It blocks reliable Warm Lead intake messaging and commercial lifecycle communication, not basic app inspection.
3. **Zoom not production-proven.** Credentials, origin, meeting provisioning, host ZAK, real Student joins, attendance, and replay must pass once on the current candidate.
4. **Media is canary-only, not repeatable broad production.** The fastest first recording can use the existing one-recording provider canary, but weekly operation needs a repeatable broad-production mode plus an authorized Drive binding.
5. **Paid billing remains intentionally disabled.** Live Stripe customer/price/webhook/charge behavior and GHL billing workflows require a complete TEST lifecycle before any live enablement.

## Release gate policy

Keep recipient/suppression checks, idempotency, child-data isolation, exact Stripe customer matching, provider-effect readback, rollback, secret protection, real role testing, and one final integrated acceptance.

Stop using old Ready queues, claims, leases, steward requests, terminal packets, copied-chat handoffs, duplicate audits, repeated unchanged repository-wide reviews, and permanent workflows for one-time emails. Use focused tests per change, one full candidate gate near release, and one bounded real provider smoke per provider family.

## Locked HighLevel decisions recorded on 2026-08-07

- Pipeline stages: `Warm Leads` → `Free Event / Tisha B’Av Signups` → `Old App — Active` → `Old App — Inactive` → `New Funnel / Pre-Registered` → `Active Member` → `Canceled / Lost`.
- `Old App` stages are temporary. Stage ID `b87ce5c3-d877-4009-99bd-6012da7e455d` maps to `Active Member`.
- Acquisition starts at `Warm Leads`; event and public pre-registration cohorts use their explicit stages, while source identity remains in source/funnel/campaign fields.
- Tisha B’Av gets one direct API email only. There is no `OT-02C` and no Tisha workflow repair/reuse.
- Active old-app members get one direct one-time migration email. Do not activate `OT-02A` for it.
- Work owns live HighLevel UI/provider execution.

## Timing estimate

- Controlled free/pre-registration release: **same day to 1 business day** after candidate deployment and the Work-owned GHL intake/readback.
- Zoom ready for the August 16 class: **1–2 business days** if the existing S2S and Meeting SDK apps activate cleanly; **3–5 days** only if Zoom account scopes/origin/app activation need support.
- First private recording by direct upload: **0.5–1 business day** after credentials are bound; repeatable media plus Drive: **1–2 additional business days**.
- Full paid/commercial launch: **4–8 business days** after the above, assuming timely GHL and Stripe access and no provider-account escalation.
