# OPS-04 — Acceptance Matrix

A row passes only with evidence. “Implemented” without a test, report, or inspected artifact is not accepted.

| ID | Acceptance requirement | Required evidence | Gate |
|---|---|---|---|
| OPS-04-A01 | Clean isolated worktree and exact base resolution | `BASE-RESOLUTION.json`, clean-status capture, full SHA | Blocking |
| OPS-04-A02 | OPS-04 state persisted before product edits | initial `STATE.json` commit/diff chronology | Blocking |
| OPS-04-A03 | Existing OT-74 foundation audited, not blindly duplicated | repository audit with path/checksum/gap matrix | Blocking |
| OPS-04-A04 | Additive forward-only migration allocated without collision | migration ledger, file SHA-256, migration test | Blocking |
| OPS-04-A05 | Fresh PostgreSQL database migrates from zero | real PostgreSQL 16 report | Blocking |
| OPS-04-A06 | Existing OT-74 schema upgrades with synthetic historical rows | upgrade fixture and real PostgreSQL 16 report | Blocking |
| OPS-04-A07 | Immutable full-byte source manifests | unit/integration test showing same name/different bytes create new file ID | Blocking |
| OPS-04-A08 | Aggregate-only source inventory before row authorization | CLI test and redacted inventory report | Blocking |
| OPS-04-A09 | Non-synthetic row access fails without exact receipt | negative authorization tests | Blocking |
| OPS-04-A10 | HMAC identity fingerprints; no plain low-entropy hashes in evidence | crypto tests and evidence scan | Blocking |
| OPS-04-A11 | Region-aware phone normalization; ambiguous local numbers quarantine | normalization tests | Blocking |
| OPS-04-A12 | Exact old IDs preserved as text | leading-zero/punctuation tests | Blocking |
| OPS-04-A13 | Contact, lead, legacy, current subscriber, relationship, consent, suppression, migration facts independent | schema/domain tests and CRM projection | Blocking |
| OPS-04-A14 | Active old-app user can remain lead | synthetic scenario and counts | Blocking |
| OPS-04-A15 | Former/cancelled old user can remain active lead | synthetic scenario and counts | Blocking |
| OPS-04-A16 | Current subscriber is read from canonical standalone state only | negative mutation test and projection test | Blocking |
| OPS-04-A17 | School remains lead without separate entitlement | school fixtures and access-table zero diff | Blocking |
| OPS-04-A18 | Separately entitled school is reported but entitlement is not imported | entitled-school fixture | Blocking |
| OPS-04-A19 | Shared email/phone does not merge people | household/shared-point tests | Blocking |
| OPS-04-A20 | Email/phone and stable-ID conflicts quarantine | candidate/quarantine tests | Blocking |
| OPS-04-A21 | No name-only or fuzzy auto-merge | negative matcher tests | Blocking |
| OPS-04-A22 | Newer canonical data cannot be overwritten | stale/freshness integration tests | Blocking |
| OPS-04-A23 | Consent/suppression precedence is channel-specific and correct | unsubscribe, STOP, bounce, unknown-consent tests | Blocking |
| OPS-04-A24 | Existing suppression cannot be cleared by import | negative update tests | Blocking |
| OPS-04-A25 | Five primary outreach dispositions are mutually exclusive | projection test and reconciliation equation | Blocking |
| OPS-04-A26 | Email and WhatsApp eligibility snapshots are separate | segment snapshot tests | Blocking |
| OPS-04-A27 | Every OPS-04 segment exposes `sends_allowed=false` | contract and API test | Blocking |
| OPS-04-A28 | No campaign/outbox/provider/account/access/payment side effect | before/after zero-diff report | Blocking |
| OPS-04-A29 | Batch/row/action/audit identities deterministic | replay test; no random key material | Blocking |
| OPS-04-A30 | Concurrent apply is at-most-once | real PostgreSQL worker race test | Blocking |
| OPS-04-A31 | Partial failure resumes from action ledger | failure injection/resume test | Blocking |
| OPS-04-A32 | Dry-run binds manifest, mapping, database snapshot, counts | report schema and tamper tests | Blocking |
| OPS-04-A33 | Approval mismatch fails closed | manifest/mapping/snapshot/count/expiry/signature negative tests | Blocking |
| OPS-04-A34 | Rollback restores only batch-owned unchanged values | rollback tests with no later edits | Blocking |
| OPS-04-A35 | Rollback preserves later human/system edits | rollback-conflict test | Blocking |
| OPS-04-A36 | Replay after verified apply is no-op | exact same input replay test | Blocking |
| OPS-04-A37 | CRM mounts protected audience route/surface | authenticated API/browser tests | Blocking |
| OPS-04-A38 | CRM cards and filters expose all independent facts | screenshots, DOM assertions, filter tests | Blocking |
| OPS-04-A39 | CRM uses standalone shell and route-level chunks, not BNA | dependency and bundle report | Blocking |
| OPS-04-A40 | Mobile/tablet/desktop accessibility passes | Playwright/axe evidence at defined viewports | Blocking |
| OPS-04-A41 | Public `/api/v1/leads` remains idempotent | same-key replay and changed-payload conflict tests | Blocking |
| OPS-04-A42 | Public signup remains provider-independent and scope is server-derived | dependency/API tests | Blocking |
| OPS-04-A43 | Public signup cannot silently transfer shared identity ownership | shared-point signup test | Blocking |
| OPS-04-A44 | Reconciliation totals balance exactly | machine-readable totals report | Blocking |
| OPS-04-A45 | 100,000-row inventory/normalization benchmark meets or explains thresholds | performance JSON with runtime/RSS/hardware | Blocking |
| OPS-04-A46 | 50,000-row reconciliation benchmark is chunked/indexed and bounded | performance JSON and query plans | Blocking |
| OPS-04-A47 | Secret and PII evidence scans pass | scanner output | Blocking |
| OPS-04-A48 | Synthetic rehearsal applies, verifies, rolls back, and replays | end-to-end rehearsal report | Blocking |
| OPS-04-A49 | Safe staging rehearsal runs only after explicit non-production proof | environment guard evidence or documented `not_configured` | Conditional |
| OPS-04-A50 | Missing source does not prevent code/test completion | final state `waiting_for_source_export` with resumable command | Blocking when source absent |
| OPS-04-A51 | Source rows and binaries are absent from Git history/diff | repository scan | Blocking |
| OPS-04-A52 | Production import authorization remains absent | final state and PR declaration | Blocking |
| OPS-04-A53 | Production send authorization remains absent | final state and no-send proof | Blocking |
| OPS-04-A54 | Draft PR contains exact branch/head/base/migration/test/disposition facts | PR readback | Blocking |

## Required viewport matrix

- 360 × 800;
- 390 × 844;
- 768 × 1024;
- 1440 × 900 or larger desktop.

Screenshots must use synthetic/redacted data only.

## Required PostgreSQL matrix

- fresh PostgreSQL 16 database;
- upgrade PostgreSQL 16 database with migrations through the integrated OT-74 foundation and synthetic historical dry-run rows;
- concurrent apply/rollback test on real PostgreSQL 16;
- migration checksum verification;
- repeat migration run proving already-applied behavior.

If the resolved repository supports an additional PostgreSQL major version in CI, run the same fresh migration smoke test there and record the result.

## Required performance thresholds

- 100,000-row inventory and normalization: target no more than 180 seconds and less than 1 GiB peak RSS on the recorded CI-sized runner;
- 50,000-row database reconciliation: target no more than 300 seconds and less than 1 GiB peak RSS;
- no per-row full-table lookup pattern;
- no unbounded browser payload or report containing all rows;
- API pages and UI aggregate queries remain bounded and indexed;
- regression above 20 percent versus the same fixture/baseline requires written investigation.

## Final disposition rules

| Condition | Required final OPS-04 state |
|---|---|
| Code/tests/synthetic proof complete; source export absent or row access unauthorized | `waiting_for_source_export` |
| Safe non-production source/staging rehearsal complete | `staging_rehearsal_complete_waiting_for_production_authorization` |
| Production target detected or guard inconclusive | `blocked_production_guard` after all safe work is complete |
| Material identity/consent defects remain | `review_required` |
| Production import requested without exact later receipt | Refuse; retain prior safe state |
| Campaign send requested in OPS-04 | Refuse; no send code path |
