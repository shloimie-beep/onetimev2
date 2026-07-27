# A05 — PR, branch, clone, and worktree preservation/closure audit

**Result path:** `ops/audits/2026-07-26/parallel-control-tower/A05-result.md`  
**Audit date:** 2026-07-26  
**Mode:** read-only GitHub audit; local inventory design only  
**Repository:** `shloimie-beep/onetimev2`  
**Control checkpoint:** `e986b5e6502b1168b3eb28e200fd49ac8de46477`  
**Conductor PR:** `#97`  
**Audited conductor head:** `53a18e771488c61cf271cb33a0bcacee2c7135f4`  
**GitHub mutations performed:** none  
**Branches/worktrees/files modified or deleted:** none

## 1. Executive verdict

**CONFIRMED CURRENT TRUTH — V1.** The remote repository has **105 open PRs** in the audited snapshot. Only **#97** (the conductor) and **#105** (the existing Zoom cleanup lane) qualify as category A active lanes.

**CONFIRMED CURRENT TRUTH — V2.** Control checkpoint `e986b5e6502b1168b3eb28e200fd49ac8de46477` is one commit behind the audited conductor head. The intervening commit changes only control/intake/handoff records; it does not replace the Board-recorded accepted deployed product source. Preservation and closure records must keep the deployed product SHA, conductor SHA, and historical release heads distinct.

**CONFIRMED CURRENT TRUTH — V3.** Fifteen PR heads are exact ancestors of the audited conductor and qualify as category C only after exact-head preservation and fresh ancestry readback: #1, #2, #17, #23, #27, #33, #39, #40, #53, #60, #61, #73, #89, #91, #92.

**NEW FINDING — V4.** PR #90 is graph-diverged from the conductor line at #89 and carries **9 unique staging-evidence commits**. It is category B, not C: preserve the exact head before closing it as superseded evidence.

**NEW FINDING — V5.** PR #106 is graph-diverged from the conductor at #92 and carries **36 commits not on the conductor line**. Its current head `0d69de15e3c5e7a5e51f2b9262c992ea153c51fb` also differs from the Board's recorded authorized narrow-production head `acddcc8cd012c5cdc5bfc08cbc80550bef8719ba`. It is category D and must not be closed or treated as the exact authorized release without semantic/head-history adjudication.

**NEW FINDING — V6.** PRs #109 and #110 are not interchangeable visual patches. They are graph-diverged from common base #92, both currently non-mergeable, and each carries substantial unique history. Both are category E and must remain open until both heads are preserved and a canonical visual lineage is selected.

**NEW FINDING — V7.** PRs #42 and #44 currently point to heads later than the heads named by earlier convergence records. Their current unique deltas are not proven represented. They are category D.

**UNPROVEN — V8.** The operator-supplied clone/worktree counts, dirty states, five named local-only commit objects, dirty HighLevel registry, dirty “BNA v2.0” checkout, and alleged One Time diff inside BNA commit `a82f6c1` cannot be verified through GitHub. They are preservation inputs only. No local writer may start until a sanitized metadata census confirms them.

**CONFIRMED CURRENT TRUTH — V9.** Existing repository secret-scan pass claims are insufficient to authorize preservation publication for binary, archive, screenshot, untracked, all-ref/history, private-destination, provider-ID, or stable Student/media metadata classes. A protected non-echoing scan and explicit incomplete-binary state are required before new remote preservation refs or committed summaries.

**Verdict:** run preservation first under one Board-assigned `OT-HYGIENE` writer. Do not run closure yet. No product implementation is recommended by A05.

## 2. Category and conclusion legend

### 2.1 PR categories

- **A:** keep open; active canonical lane.
- **B:** preserve exact head/evidence, then eligible to close as superseded.
- **C:** exact ancestor of conductor; eligible to close only after preservation and fresh ancestry proof.
- **D:** non-ancestor, skipped, or head-drift lane requiring semantic review.
- **E:** duplicate/conflicting branch; preserve every competing head and obtain a canonical choice.
- **F:** unknown or unsafe to classify.

### 2.2 Conclusion classes

Every finding and PR row is classified as **NEW FINDING**, **CONFIRMED CURRENT TRUTH**, **SUPERSEDED/HISTORICAL**, or **UNPROVEN**.

### 2.3 Important interpretation

Closing a PR does not itself delete the branch or Git objects. The “unique-work loss risk” column measures the practical risk if closure is followed later by branch/worktree cleanup, repository migration, or object expiry. Therefore even category C receives an independent preservation ref/bundle before closure.

## 3. Canonical control and release facts

- The current control pointer is `OT-LAUNCH-01`.
- Board is the only current assignment/status authority.
- PR #97 is the persistent-staging conductor, not a blanket release authority.
- Board records accepted deployed product source `a22009f4dce6bae6b0553ea9007ff40eceaffd25`; later Board/control/evidence commits must not be described as deployed runtime.
- The active Zoom cleanup successor remains PR #105 at `2d22f46a40364c670d20fa197e78ead2a2f79c8e`; provider cleanup is paused, not superseded.
- Current GHL truth remains fail-closed; historical GHL readback PRs are evidence, not automatic writer assignments.
- Mergeability is a transient GitHub snapshot, not a disposition criterion.

## 4. Disposition summary


| Category | Meaning | Count | PRs |
|---|---|---:|---|
| A | Keep open: active canonical lane | 2 | #97, #105 |
| B | Preserve evidence, then close as superseded | 79 | #3, #4, #5, #6, #7, #8, #9, #10, #11, #12, #13, #14, #15, #16, #18, #19, #20, #21, #22, #24, #26, #28, #29, #30, #31, #32, #34, #35, #36, #37, #41, #43, #45, #46, #47, #48, #49, #50, #51, #52, #54, #55, #56, #57, #58, #59, #62, #63, #64, #65, #66, #67, #68, #69, #70, #71, #72, #74, #75, #76, #77, #78, #80, #81, #82, #83, #84, #85, #86, #87, #88, #90, #104, #107, #113, #115, #117, #121, #122 |
| C | Exact ancestor of conductor; closure candidate only after preservation | 15 | #1, #2, #17, #23, #27, #33, #39, #40, #53, #60, #61, #73, #89, #91, #92 |
| D | Non-ancestor/head-drift lane requiring semantic review | 6 | #38, #42, #44, #79, #106, #116 |
| E | Duplicate/conflicting branch | 3 | #25, #109, #110 |
| F | Unknown/unsafe PR classification | 0 | None. Local clone/worktree claims remain unproven outside the PR manifest. |


## 5. Ancestry methodology and limits

**CONFIRMED CURRENT TRUTH.** Exact ancestor status was assigned only where A05 had direct GitHub compare proof or an exact current-head/base chain terminating in a directly proved ancestor.

**SUPERSEDED/HISTORICAL.** Category B often rests on authoritative semantic convergence/adjudication records rather than exact Git ancestry. The original head can still contain unique evidence, commit messages, rejected alternatives, or deployment/test records; those heads must be retained.

**UNPROVEN.** “Graph not independently proven” does not mean non-ancestor. It means A05 did not obtain a compact direct compare for that head. The preservation prompt re-runs `git merge-base --is-ancestor` locally before any closure and stops on disagreement.

**CONFIRMED CURRENT TRUTH.** A PR description or green CI can prove stated intent/test history but cannot alone prove current commit reachability, runtime deployment, or semantic equivalence.

## 6. Evidence-reference legend


| Code | Exact source |
|---|---|
| `EV-BOARD` | `shloimie-beep/onetimev2`, conductor head `53a18e771488c61cf271cb33a0bcacee2c7135f4`: `ops/goals/OT-LAUNCH-01/BOARD.yaml`, `DECISIONS.yaml`, `CURRENT.yaml`, `GOAL.md`, `SPEC.yaml`, and `ACCEPTANCE.yaml`. |
| `EV-GRAPH` | GitHub compare-API snapshots taken during A05. Directly proved: #1→#97, #2→#97, #17→#61, #23→#61, #40→#61, #60→#61, #89→#91, checkpoint→current conductor; exact-base chains are identified in the manifest. |
| `EV-GRAPH-90` | Compare `9465999305d7e0530f171711c1418c17151fb79f` (#90) to `e3d3736546f48b3834d6698838befe20884005f1` (#91): `diverged`, merge base `ac02ce9cd4f690d3b305b30ec1eef4e18d48cd5c`, 9 commits unique to #90, 26 unique to #91. |
| `EV-GRAPH-106` | Compare `0d69de15e3c5e7a5e51f2b9262c992ea153c51fb` (#106) to conductor `53a18e771488c61cf271cb33a0bcacee2c7135f4`: `diverged`, merge base `5ddd7b604c01744dd562050ae9b51124f7732594`, 36 commits unique to #106, 193 unique to conductor. |
| `EV-TISHA-DIVERGENCE` | Compare #109 head `1779254768dacebb84aeac5d71b56b5abfba2534` to #110 head `38358961cff6c6bf44621ab9e3f6b88061586618`: `diverged`, merge base `5ddd7b604c01744dd562050ae9b51124f7732594`, 40 commits unique to #109 and 26 unique to #110. |
| `EV-PR17` | PR #17 at `dfef7de2035e08f1ee72e0133ccf656fe7a74444`; records accepted early lanes, evidence-only #10, excluded alternate #3/#9 history, and the selective proof port. |
| `EV-PR23` | PR #23 at `741af0c08ee1d43be4e220b7c6e4c77a2330adc2`; records OT72–OT76 and audience/communications semantic convergence. |
| `EV-OT99` | PR #39 at `96b429053d13a139595ed3bd0ea3c854cc2500e8`; `artifacts/OT-99/preflight/candidate-adjudication.json`; `artifacts/OT-99/release-manifest.json`. |
| `EV-OPS09/OPS08` | `ops/codex-runs/OPS-09/FLEET-REPORT.md` and historical OPS-08 readiness evidence. |
| `EV-OPS10` | PR #54, PR #60, PR #61 and `ops/codex-runs/OPS-10/FINAL-REPORT.md`; exact earlier-head notes are preserved in their PR descriptions. |
| `EV-W12` | PR #73 at `0d8d7168f066668f035176d777bdaaa4dcc5accd`; `ops/codex-runs/W12-99/FINAL-REPORT.md`. |
| `EV-W12-100` | PR #89 at `ac02ce9cd4f690d3b305b30ec1eef4e18d48cd5c`; `ops/codex-runs/W12-100-CONVERGENCE/FINAL-REPORT.md`; `RELEASE-MANIFEST.json`. |
| `EV-W13` | PR #91 at `e3d3736546f48b3834d6698838befe20884005f1`, PR #92 at `5ddd7b604c01744dd562050ae9b51124f7732594`, and PR #97 metadata. |
| `EV-A04` | Accepted A04 read-only audit result: PR #116 is not current execution authority and requires semantic re-authoring/review on current conductor source. |


## 7. Complete PR disposition manifest

| PR | Class | Conclusion class | Mergeable snapshot | Title | Head | Base | Ancestry to current conductor | Unique commits/blobs represented? | Evidence | Required preservation | Closure template | Unique-work loss risk |
|---:|:---:|---|:---:|---|---|---|---|---|---|---|:---:|---|
| #1 | **C** | SUPERSEDED/HISTORICAL | YES | Foundation: standalone landing and lead-capture slice | `codex/foundation-landing-lead-v1`<br>`3465bd7d4c6b6829a6be6e4b4f8a003d608f3680` | `main`<br>`610b585f3d221addd4e7b824c92a5cc256cffcf9` | Exact ancestor of conductor; direct compare proof. | YES—exact commit reachability from conductor. | EV-GRAPH; PR metadata | Scan exact head; create non-force remote preservation ref plus local bundle/checksum; re-prove ancestry. | `CT-C` | No commit loss while conductor survives; discoverability/ref risk remains until preservation. |
| #2 | **C** | SUPERSEDED/HISTORICAL | YES | OT-12 CRM Core V1 | `codex/crm-core-v1`<br>`4ac288968ba24e30a5c3f8c6924f492eedf4338f` | `codex/foundation-landing-lead-v1`<br>`3465bd7d4c6b6829a6be6e4b4f8a003d608f3680` | Exact ancestor of conductor; direct compare proof. | YES—exact commit reachability from conductor. | EV-GRAPH; PR metadata | Scan exact head; create non-force remote preservation ref plus local bundle/checksum; re-prove ancestry. | `CT-C` | No commit loss while conductor survives; discoverability/ref risk remains until preservation. |
| #3 | **B** | SUPERSEDED/HISTORICAL | NO | OT-34 first-slice core hardening | `codex/ot34-first-slice-core-hardening`<br>`87f9b315c54e32e918912cc100610e2c561b68ac` | `codex/crm-core-v1`<br>`a73458d1884b8fcb4843c4852425009577f59ef7` | Graph to conductor not independently proven; PR #17 records semantic integration, selective port, exclusion, or evidence-only handling. | PARTIAL/REJECTED—alternate hardening lineage excluded; only selected proof was ported. | EV-PR17; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #4 | **B** | SUPERSEDED/HISTORICAL | YES | Add OT-36 sink delivery worker foundation | `codex/ot36-delivery-sink-foundation`<br>`61d4755fe279ca47c37e7adbe8d1e6ce8b258dae` | `codex/crm-core-v1`<br>`a73458d1884b8fcb4843c4852425009577f59ef7` | Graph to conductor not independently proven; PR #17 records semantic integration, selective port, exclusion, or evidence-only handling. | YES—semantic integration recorded by #17; original head/evidence remains unique history. | EV-PR17; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #5 | **B** | SUPERSEDED/HISTORICAL | NO | OT-35 authenticated CRM shell clarity | `codex/ot35-app-shell-crm-clarity`<br>`6ca5e568c328ea116a9413b57ea5920400f8bc14` | `codex/crm-core-v1`<br>`a73458d1884b8fcb4843c4852425009577f59ef7` | Graph to conductor not independently proven; PR #17 records semantic integration, selective port, exclusion, or evidence-only handling. | YES—semantic integration recorded by #17; original head/evidence remains unique history. | EV-PR17; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #6 | **B** | SUPERSEDED/HISTORICAL | YES | OT-37 PostgreSQL assurance harness | `codex/ot37-postgres-assurance`<br>`0ea782d8551c26edd48b08d644b573e19b9835b1` | `codex/crm-core-v1`<br>`4ac288968ba24e30a5c3f8c6924f492eedf4338f` | Graph to conductor not independently proven; PR #17 records semantic integration, selective port, exclusion, or evidence-only handling. | YES—semantic integration recorded by #17; original head/evidence remains unique history. | EV-PR17; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #7 | **B** | SUPERSEDED/HISTORICAL | YES | fix OT-39 CRM privacy and performance evidence | `codex/ot39-crm-privacy-performance-correction`<br>`c1584577780d7b5125bce4fb81d2a454c9e84096` | `codex/ot35-app-shell-crm-clarity`<br>`6ca5e568c328ea116a9413b57ea5920400f8bc14` | Graph to conductor not independently proven; PR #17 records semantic integration, selective port, exclusion, or evidence-only handling. | YES—semantic integration recorded by #17; original head/evidence remains unique history. | EV-PR17; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #8 | **B** | SUPERSEDED/HISTORICAL | YES | OT-40: lock school receipt worker contract | `codex/ot40-school-receipt-worker-correction`<br>`571b18f36cdc645f757cc3be6b0519f1af3225f6` | `codex/ot36-delivery-sink-foundation`<br>`61d4755fe279ca47c37e7adbe8d1e6ce8b258dae` | Graph to conductor not independently proven; PR #17 records semantic integration, selective port, exclusion, or evidence-only handling. | YES—semantic integration recorded by #17; original head/evidence remains unique history. | EV-PR17; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #9 | **B** | SUPERSEDED/HISTORICAL | YES | OT-38 real privileged MFA security correction | `codex/ot38-real-mfa-security-correction`<br>`245649523566a7a0ace493ba70ede2a405ebdcce` | `codex/ot34-first-slice-core-hardening`<br>`87f9b315c54e32e918912cc100610e2c561b68ac` | Graph to conductor not independently proven; PR #17 records semantic integration, selective port, exclusion, or evidence-only handling. | PARTIAL/REJECTED—alternate lineage excluded; a narrow proof was ported. | EV-PR17; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #10 | **B** | SUPERSEDED/HISTORICAL | YES | OT-47 parallel secure content-library foundation | `codex/parallel-ot47-content-library-foundation`<br>`9444176dbc55e0c5af048ec1df2ea75ffa8dde33` | `codex/parallel-base-a73458d`<br>`a73458d1884b8fcb4843c4852425009577f59ef7` | Graph to conductor not independently proven; PR #17 records semantic integration, selective port, exclusion, or evidence-only handling. | NO PRODUCT IMPLEMENTATION—evidence-only lane retained historically. | EV-PR17; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #11 | **B** | SUPERSEDED/HISTORICAL | YES | OT-42 parallel CRM module v1 | `codex/parallel-ot42-crm-module-v1`<br>`b2c159a060d8aa50ec6feb69f1cae003fd633bf3` | `codex/parallel-base-ot39-c158457`<br>`c1584577780d7b5125bce4fb81d2a454c9e84096` | Graph to conductor not independently proven; PR #17 records semantic integration, selective port, exclusion, or evidence-only handling. | YES—semantic integration recorded by #17; original head/evidence remains unique history. | EV-PR17; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #12 | **B** | SUPERSEDED/HISTORICAL | YES | OT-46P isolated Stripe fixture-only foundation | `codex/ot46p-isolated-stripe-foundation`<br>`f4e4fb1dc202f8b17bbf1747c82ae3b0c1c5c899` | `codex/parallel-base-a73458d`<br>`a73458d1884b8fcb4843c4852425009577f59ef7` | Graph to conductor not independently proven; PR #17 records semantic integration, selective port, exclusion, or evidence-only handling. | YES—semantic integration recorded by #17; original head/evidence remains unique history. | EV-PR17; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #13 | **B** | SUPERSEDED/HISTORICAL | YES | OT-51P isolated One Time Telegram bot foundation | `codex/ot51p-isolated-telegram-bot`<br>`e235af05759f0a97496552c6e8aabed7ba3eee18` | `codex/parallel-base-a73458d`<br>`a73458d1884b8fcb4843c4852425009577f59ef7` | Graph to conductor not independently proven; PR #17 records semantic integration, selective port, exclusion, or evidence-only handling. | YES—semantic integration recorded by #17; original head/evidence remains unique history. | EV-PR17; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #14 | **B** | SUPERSEDED/HISTORICAL | YES | OT-44 Communications V1A — truthful local intent read model | `codex/parallel-ot44-communications-v1a`<br>`76cae19be515ee896f22d0da976082a09d1d25d6` | `codex/parallel-base-ot40-571b18f`<br>`571b18f36cdc645f757cc3be6b0519f1af3225f6` | Graph to conductor not independently proven; PR #17 records semantic integration, selective port, exclusion, or evidence-only handling. | YES—semantic integration recorded by #17; original head/evidence remains unique history. | EV-PR17; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #15 | **B** | SUPERSEDED/HISTORICAL | YES | OT-52P isolated Parent and Student Portals V1 | `codex/ot52p-isolated-parent-student-portals`<br>`9594c228b9ac3047f42bb9e8c804384cc45a3e40` | `codex/parallel-base-ot38-2456495`<br>`245649523566a7a0ace493ba70ede2a405ebdcce` | Graph to conductor not independently proven; PR #17 records semantic integration, selective port, exclusion, or evidence-only handling. | YES—semantic integration recorded by #17; original head/evidence remains unique history. | EV-PR17; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #16 | **B** | SUPERSEDED/HISTORICAL | YES | Draft: preserve blocked OT-61-OT-70 run packets | `codex/recovery-blocked-ot61-ot70`<br>`17cfba068660eee489474a18963566dcf55eaffa` | `codex/crm-core-v1`<br>`4ac288968ba24e30a5c3f8c6924f492eedf4338f` | Graph to conductor not independently proven; PR #17 records semantic integration, selective port, exclusion, or evidence-only handling. | EVIDENCE ONLY—blocked run packets are not product source. | EV-PR17; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #17 | **C** | SUPERSEDED/HISTORICAL | YES | OT-60R recovery convergence | `codex/ot60r-recovery-convergence`<br>`dfef7de2035e08f1ee72e0133ccf656fe7a74444` | `codex/crm-core-v1`<br>`4ac288968ba24e30a5c3f8c6924f492eedf4338f` | Exact ancestor via direct compare to #61, then #61→#73→#89→#91→#92→#97. | YES—exact commit reachability from conductor. | EV-PR17; PR metadata | Scan exact head; create non-force remote preservation ref plus local bundle/checksum; re-prove ancestry. | `CT-C` | No commit loss while conductor survives; discoverability/ref risk remains until preservation. |
| #18 | **B** | SUPERSEDED/HISTORICAL | YES | OT-72 provider sandbox adapters | `codex/ot72-provider-sandbox-train`<br>`62ad1d39242f1a8745ad5da5c2a016301eb276c3` | `codex/ot60r-recovery-convergence`<br>`dfef7de2035e08f1ee72e0133ccf656fe7a74444` | Graph to conductor not independently proven; PR #23 records this lane as semantically integrated into the OT80 convergence. | YES—semantic integration recorded by #23; original head/evidence remains unique history. | EV-PR23; EV-GRAPH; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #19 | **B** | SUPERSEDED/HISTORICAL | YES | OT-73 corrected landing addendum | `codex/ot73-landing-intent-reconciliation`<br>`ed2074254863468b4a70a0a3304490486ab2b71e` | `codex/ot60r-recovery-convergence`<br>`dfef7de2035e08f1ee72e0133ccf656fe7a74444` | Graph to conductor not independently proven; PR #23 records this lane as semantically integrated into the OT80 convergence. | YES—semantic integration recorded by #23; original head/evidence remains unique history. | EV-PR23; EV-GRAPH; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #20 | **B** | SUPERSEDED/HISTORICAL | YES | Prepare OT-75 release observability readiness | `codex/ot75-release-observability-readiness`<br>`028a05f3e44a7b37c2395576aa3800f507dd5268` | `codex/ot60r-recovery-convergence`<br>`dfef7de2035e08f1ee72e0133ccf656fe7a74444` | Graph to conductor not independently proven; PR #23 records this lane as semantically integrated into the OT80 convergence. | YES—semantic integration recorded by #23; original head/evidence remains unique history. | EV-PR23; EV-GRAPH; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #21 | **B** | SUPERSEDED/HISTORICAL | YES | OT-76 Day-One certification harness | `codex/ot76-day-one-certification-harness`<br>`b9ece3146d2de6edc9f386712fad146f17b18031` | `codex/ot60r-recovery-convergence`<br>`dfef7de2035e08f1ee72e0133ccf656fe7a74444` | Graph to conductor not independently proven; PR #23 records this lane as semantically integrated into the OT80 convergence. | YES—semantic integration recorded by #23; original head/evidence remains unique history. | EV-PR23; EV-GRAPH; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #22 | **B** | SUPERSEDED/HISTORICAL | YES | OT74: legacy audience reconciliation foundation | `codex/ot74-audience-reconciliation`<br>`51cd99dc4434f0354ba229620ebe89558efeb120` | `codex/ot60r-recovery-convergence`<br>`dfef7de2035e08f1ee72e0133ccf656fe7a74444` | Graph to conductor not independently proven; PR #23 records this lane as semantically integrated into the OT80 convergence. | YES—semantic integration recorded by #23; original head/evidence remains unique history. | EV-PR23; EV-GRAPH; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #23 | **C** | SUPERSEDED/HISTORICAL | YES | OT80 final convergence candidate | `codex/ot80-one-shot-final-convergence`<br>`741af0c08ee1d43be4e220b7c6e4c77a2330adc2` | `codex/ot60r-recovery-convergence`<br>`dfef7de2035e08f1ee72e0133ccf656fe7a74444` | Exact ancestor via direct compare to #61, then #61→#73→#89→#91→#92→#97. | YES—exact commit reachability from conductor. | EV-PR23; EV-GRAPH; PR metadata | Scan exact head; create non-force remote preservation ref plus local bundle/checksum; re-prove ancestry. | `CT-C` | No commit loss while conductor survives; discoverability/ref risk remains until preservation. |
| #24 | **B** | SUPERSEDED/HISTORICAL | YES | OT81 Day-One certification staging candidate | `codex/ot81-dayone-certification-staging`<br>`e04fc61b5d153f7979c7acbe7f2a30e86c735f06` | `codex/ot80-one-shot-final-convergence`<br>`741af0c08ee1d43be4e220b7c6e4c77a2330adc2` | Graph to conductor not independently proven; OT-99 adjudication records this exact head as superseded with behavior/evidence represented downstream. | YES BEHAVIOR / NO EXACT HEAD CLAIM—OT-99 marked exact head superseded and represented downstream. | EV-OT99; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #25 | **E** | SUPERSEDED/HISTORICAL | YES | [OT-81] Day-One certification and isolated staging | `codex/ot81-dayone-certification-and-staging`<br>`809480bb5581c4104f64c4c04a5c92fff8aaa7cf` | `codex/ot80-one-shot-final-convergence`<br>`741af0c08ee1d43be4e220b7c6e4c77a2330adc2` | Competing OT-81 sibling of #24; graph to conductor not independently proven. OT-99 recorded it as the branch not to merge blindly. | NO—unique competing OT-81 delta was deliberately not blindly incorporated. | EV-OT99; PR #25 | Preserve exact competing head in separate ref/bundle; create pairwise semantic conflict ledger; no closure. | `CT-E` | YES—each branch carries unique/conflicting work. |
| #26 | **B** | SUPERSEDED/HISTORICAL | YES | OT82: One Time brand system foundation | `codex/ot82-brand-system-foundation`<br>`ada9543c5eb376a30fea3b4070437abbaf3f8fd9` | `codex/ot81-dayone-certification-staging`<br>`ff23c9af0c3e3de18cd991097eb6e66032b11546` | Graph to conductor not independently proven; OT-99 adjudication records this exact head as superseded with behavior/evidence represented downstream. | YES BEHAVIOR / NO EXACT HEAD CLAIM—brand behavior represented in OT-83R; packet evidence preserved historically. | EV-OT99; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #27 | **C** | SUPERSEDED/HISTORICAL | YES | [OT-83] Household, parent/student identity, and portal foundation | `codex/ot83-household-portals-foundation`<br>`a02d1d254ae0d17804fb657079a7871567260ea2` | `codex/ot82-brand-system-foundation`<br>`a8e4109b0530855bc7a5f56c90104706b9c8cd7c` | Exact ancestor via exact-base chain #27→#33→#39→#40, direct #40→#61, then #61→#73→#89→#91→#92→#97. | YES—exact ancestor. | EV-OT99; EV-GRAPH where stated; PR metadata | Scan exact head; create non-force remote preservation ref plus local bundle/checksum; re-prove ancestry. | `CT-C` | No commit loss while conductor survives; discoverability/ref risk remains until preservation. |
| #28 | **B** | SUPERSEDED/HISTORICAL | YES | [OT-85] WhatsApp lead assistant | `codex/ot85-whatsapp-lead-assistant`<br>`fb6b3266e2bb2689fdfc1f751764fd98ecca8f0a` | `codex/ot83-household-portals-foundation`<br>`a02d1d254ae0d17804fb657079a7871567260ea2` | Graph to conductor not independently proven; OT-99 records this exact head as an integrated lane or supporting evidence. | YES SEMANTICALLY—OT-99 integrated this lane; original head/evidence remains unique history. | EV-OT99; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #29 | **B** | SUPERSEDED/HISTORICAL | YES | OT-84 Telegram action gateway | `codex/ot84-telegram-action-gateway`<br>`310bb5ca8cc8c01e2218051367c5cc2e3414a719` | `codex/ot83-household-portals-foundation`<br>`a02d1d254ae0d17804fb657079a7871567260ea2` | Graph to conductor not independently proven; OT-99 records this exact head as an integrated lane or supporting evidence. | YES SEMANTICALLY—OT-99 integrated this lane; original head/evidence remains unique history. | EV-OT99; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #30 | **B** | SUPERSEDED/HISTORICAL | YES | OT-87 Stripe TEST family subscription and entitlements | `codex/ot87-stripe-test-entitlements`<br>`6ecb680713a2fd5cd7bc03766fe9b8974c9b75df` | `codex/ot83-household-portals-foundation`<br>`a02d1d254ae0d17804fb657079a7871567260ea2` | Graph to conductor not independently proven; OT-99 records this exact head as an integrated lane or supporting evidence. | YES SEMANTICALLY—OT-99 integrated this lane; original head/evidence remains unique history. | EV-OT99; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #31 | **B** | SUPERSEDED/HISTORICAL | YES | [OT-86A] Vimeo content pipeline and approved-content KB | `codex/ot86a-vimeo-content-kb`<br>`ffc38539dcaea351ac001b1a1f45d848f5d69cc9` | `codex/ot83-household-portals-foundation`<br>`a02d1d254ae0d17804fb657079a7871567260ea2` | Graph to conductor not independently proven; OT-99 records this exact head as an integrated lane or supporting evidence. | YES SEMANTICALLY—OT-99 integrated this lane; original head/evidence remains unique history. | EV-OT99; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #32 | **B** | SUPERSEDED/HISTORICAL | YES | [OT-86B] Human-approved Buffer social publishing | `codex/ot86b-buffer-social`<br>`7212a70fed4a197dc991260101ebb7017c2ecf97` | `codex/ot86a-vimeo-content-kb`<br>`87a1bb7ffd6a2fa0d016a1831894d430aa2ee065` | Graph to conductor not independently proven; OT-99 records this exact head as an integrated lane or supporting evidence. | YES SEMANTICALLY—OT-99 integrated this lane; original head/evidence remains unique history. | EV-OT99; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #33 | **C** | SUPERSEDED/HISTORICAL | YES | [OT-83R] Recovery checkpoint for complete portals | `codex/ot83r-complete-portals`<br>`479a9b2a47a6f0cd4ba74558eac8414417883e2c` | `codex/ot83-household-portals-foundation`<br>`a02d1d254ae0d17804fb657079a7871567260ea2` | Exact ancestor via exact-base chain #33→#39→#40, direct #40→#61, then #61→#73→#89→#91→#92→#97. | YES—exact ancestor. | EV-OT99; EV-GRAPH where stated; PR metadata | Scan exact head; create non-force remote preservation ref plus local bundle/checksum; re-prove ancestry. | `CT-C` | No commit loss while conductor survives; discoverability/ref risk remains until preservation. |
| #34 | **B** | SUPERSEDED/HISTORICAL | YES | [OT-88] Implement sink-mode Zoom learner classroom | `codex/ot88-zoom-learner-classroom`<br>`f59f20afb0def3bacc5bf46fe5ca64f0c91c3a35` | `codex/ot84-telegram-action-gateway`<br>`f98103ecc3660dbda871a91485656e17580940a8` | Graph to conductor not independently proven; OT-99 records this exact head as an integrated lane or supporting evidence. | YES SEMANTICALLY—OT-99 integrated this lane; original head/evidence remains unique history. | EV-OT99; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #35 | **B** | SUPERSEDED/HISTORICAL | YES | [OPS-09] Recovery checkpoint for branch-fleet CI repair | `codex/ops09-branch-fleet-ci-repair`<br>`d63db6b55db366ab7c0b1c824b7af7befff25057` | `main`<br>`610b585f3d221addd4e7b824c92a5cc256cffcf9` | Graph to conductor not independently proven; OT-99 records this exact head as an integrated lane or supporting evidence. | EVIDENCE/REPAIR SUPPORT—used by OT-99; not independent runtime authority. | EV-OT99; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #36 | **B** | SUPERSEDED/HISTORICAL | YES | [OT-89A] Recovery checkpoint for subscriber support producer | `codex/ot89a-subscriber-support-producer`<br>`23d89704409ff08ea6e249b69b89875cd9905c30` | `codex/ot84-telegram-action-gateway`<br>`f98103ecc3660dbda871a91485656e17580940a8` | Graph to conductor not independently proven; OT-99 records this exact head as an integrated lane or supporting evidence. | YES SEMANTICALLY—OT-99 integrated this lane; original head/evidence remains unique history. | EV-OT99; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #37 | **B** | SUPERSEDED/HISTORICAL | YES | [OPS-08] Domain, email, and legacy cutover readiness | `codex/ops-08-readiness-checkpoint`<br>`abbb96f62266ba57856af49876745716094df81e` | `main`<br>`610b585f3d221addd4e7b824c92a5cc256cffcf9` | Graph to conductor not independently proven; historical readiness checkpoint with no current Board ownership. | HISTORICAL EVIDENCE—no current runtime authority. | EV-OPS09/OPS08; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #38 | **D** | UNPROVEN | YES | [OPS-04] Legacy audience migration tooling | `codex/ops-04-legacy-audience-migration`<br>`b8777ad02eeee47d375d377817a66cae99f488ea` | `codex/ot85-whatsapp-lead-assistant`<br>`fb6b3266e2bb2689fdfc1f751764fd98ecca8f0a` | Graph and downstream semantic equivalence are unproven; later audience tooling overlaps but no authoritative exact mapping was found. | UNKNOWN—overlap with later audience tooling is insufficient proof. | EV-OT99; EV-GRAPH where stated; PR metadata | Protected bundle first; optional remote ref only after protected scan; semantic-review handoff required; no closure. | `CT-D` | YES/UNKNOWN—unique or drifted work may be lost. |
| #39 | **C** | SUPERSEDED/HISTORICAL | YES | [OT-99] Final semantic convergence | `integration/ot-99-final-semantic-convergence-20260716T122407Z`<br>`96b429053d13a139595ed3bd0ea3c854cc2500e8` | `codex/ot83r-complete-portals`<br>`479a9b2a47a6f0cd4ba74558eac8414417883e2c` | Exact ancestor via exact-base #39→#40, direct #40→#61, then #61→#73→#89→#91→#92→#97. | YES—exact ancestor. | EV-OT99; EV-GRAPH where stated; PR metadata | Scan exact head; create non-force remote preservation ref plus local bundle/checksum; re-prove ancestry. | `CT-C` | No commit loss while conductor survives; discoverability/ref risk remains until preservation. |
| #40 | **C** | SUPERSEDED/HISTORICAL | YES | OPS-03 staging readiness repair | `codex/ops03-staging-readiness-repair`<br>`fb5f5eebc539afc9e93833e9417ee67524d62c36` | `integration/ot-99-final-semantic-convergence-20260716T122407Z`<br>`96b429053d13a139595ed3bd0ea3c854cc2500e8` | Exact ancestor via direct compare to #61, then #61→#73→#89→#91→#92→#97. | YES—exact ancestor. | EV-OT99; EV-GRAPH where stated; PR metadata | Scan exact head; create non-force remote preservation ref plus local bundle/checksum; re-prove ancestry. | `CT-C` | No commit loss while conductor survives; discoverability/ref risk remains until preservation. |
| #41 | **B** | SUPERSEDED/HISTORICAL | YES | OPS-04P: provider readiness inventory | `codex/ops04p-provider-readiness-inventory`<br>`c9e1ec19941d1b286fb5703b820f0331bf16c9e6` | `codex/ops03-staging-readiness-repair`<br>`f7647b9dad7b54e1e31fe38aa7a53c1b3a3b5e0b` | Graph to conductor not independently proven; historical provider-readiness evidence superseded by later control-center/convergence work. | HISTORICAL EVIDENCE—later provider-control work supersedes execution authority. | EV-OPS10; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #42 | **D** | NEW FINDING | YES | OT-103 Zoom classroom fulfillment | `codex/ot103-zoom-classroom-fulfillment`<br>`34606d6aee7a2c6eac695d0826c4bd2ed82029d0` | `codex/ops03-staging-readiness-repair`<br>`fb5f5eebc539afc9e93833e9417ee67524d62c36` | Current head not proven represented: PR #60 integrated an older OT-103 head, while this open PR now points to a later head. | UNKNOWN FOR CURRENT HEAD—older head represented; later open-head delta unadjudicated. | EV-OPS10; EV-GRAPH where stated; PR metadata | Preserve current exact head in protected bundle first; remote ref only after protected scan; create semantic-review diff manifest; no closure. | `CT-D` | YES/UNKNOWN—unique or drifted work may be lost. |
| #43 | **B** | SUPERSEDED/HISTORICAL | YES | OT-100 WhatsApp public provider activation | `codex/ot100-whatsapp-public-provider-activation`<br>`dc05747d55413149743a4c4c6b0223912c29b8eb` | `codex/ops03-staging-readiness-repair`<br>`fb5f5eebc539afc9e93833e9417ee67524d62c36` | Graph to conductor not independently proven; PR #60 records this exact lane as integrated into the OPS-08/OPS-10 line. | YES SEMANTICALLY—recorded by PR #60. | EV-OPS10; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #44 | **D** | NEW FINDING | NO | OT-107 student class helper | `codex/ot107-student-ai-class-helper`<br>`3871c38b75e7fc866f572ec80d3b2ec37cde6b6e` | `codex/ops03-staging-readiness-repair`<br>`94b9b643176241a17f776612ad18df5167fd7424` | Current head not proven represented: prior convergence records an older OT-107 head; current open head differs and is conflicting. | UNKNOWN FOR CURRENT HEAD—older head represented; current conflicting delta unadjudicated. | EV-OPS10; EV-GRAPH where stated; PR metadata | Preserve current exact head in protected bundle first; remote ref only after protected scan; create semantic-review diff manifest; no closure. | `CT-D` | YES/UNKNOWN—unique or drifted work may be lost. |
| #45 | **B** | SUPERSEDED/HISTORICAL | YES | OT-105 Stripe TEST billing canary | `codex/ot105-stripe-test-billing-canary`<br>`10cee196dbb6628edd9bacb6e224646d7bf39e70` | `codex/ops03-staging-readiness-repair`<br>`94b9b643176241a17f776612ad18df5167fd7424` | Graph to conductor not independently proven; OPS-04C/OPS-08/OPS-10 records semantic integration or accepted repair. | YES SEMANTICALLY—recorded in OPS convergence; original head/evidence remains unique history. | EV-OPS10; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #46 | **B** | SUPERSEDED/HISTORICAL | YES | Add OT-106 Buffer publishing runtime | `codex/ot106-buffer-social-publishing-runtime`<br>`4155ee706fce2eabc6db5225b5c8ce41a8c1dfd1` | `codex/ops03-staging-readiness-repair`<br>`94b9b643176241a17f776612ad18df5167fd7424` | Graph to conductor not independently proven; OPS-04C/OPS-08/OPS-10 records semantic integration or accepted repair. | YES SEMANTICALLY—recorded in OPS convergence; original head/evidence remains unique history. | EV-OPS10; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #47 | **B** | SUPERSEDED/HISTORICAL | YES | OT108: Premium landing refresh | `codex/ot108-premium-landing-refresh`<br>`c64a58ae9a72515fc6135cc2be0f72340c30f49c` | `codex/ops03-staging-readiness-repair`<br>`94b9b643176241a17f776612ad18df5167fd7424` | Graph to conductor not independently proven; OPS-04C/OPS-08/OPS-10 records semantic integration or accepted repair. | YES SEMANTICALLY—recorded in OPS convergence; original head/evidence remains unique history. | EV-OPS10; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #48 | **B** | SUPERSEDED/HISTORICAL | YES | OT-109 Rabbi content publisher | `codex/ot109-rabbi-content-publisher`<br>`a62d6a73553e175871f6d3124badb96573cdabe7` | `codex/ops03-staging-readiness-repair`<br>`94b9b643176241a17f776612ad18df5167fd7424` | Graph to conductor not independently proven; OPS-04C/OPS-08/OPS-10 records semantic integration or accepted repair. | YES SEMANTICALLY—recorded in OPS convergence; original head/evidence remains unique history. | EV-OPS10; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #49 | **B** | SUPERSEDED/HISTORICAL | YES | Implement OT-104R Vimeo private runtime | `codex/ot104r-vimeo-private-runtime`<br>`ae01fe70e0cd8954b4d9f5175789cc4af442741a` | `codex/ops03-staging-readiness-repair`<br>`fb5f5eebc539afc9e93833e9417ee67524d62c36` | Graph to conductor not independently proven; OPS-04C/OPS-08/OPS-10 records semantic integration or accepted repair. | YES SEMANTICALLY—recorded in OPS convergence; original head/evidence remains unique history. | EV-OPS10; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #50 | **B** | SUPERSEDED/HISTORICAL | YES | OT-111 legacy activation campaign controls | `codex/ot111-legacy-activation-campaign`<br>`15da6650673c1e58852f0937a02adf9efef78365` | `codex/ops03-staging-readiness-repair`<br>`fb5f5eebc539afc9e93833e9417ee67524d62c36` | Graph to conductor not independently proven; OPS-04C/OPS-08/OPS-10 records semantic integration or accepted repair. | YES SEMANTICALLY—recorded in OPS convergence; original head/evidence remains unique history. | EV-OPS10; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #51 | **B** | SUPERSEDED/HISTORICAL | YES | OT-101R Telegram admin runtime | `codex/ot101r-telegram-admin-runtime`<br>`dbff29bbc2d5434f7eecab61e4f081481e1cccaa` | `codex/ops03-staging-readiness-repair`<br>`fb5f5eebc539afc9e93833e9417ee67524d62c36` | Graph to conductor not independently proven; OPS-04C/OPS-08/OPS-10 records semantic integration or accepted repair. | YES SEMANTICALLY—recorded in OPS convergence; original head/evidence remains unique history. | EV-OPS10; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #52 | **B** | SUPERSEDED/HISTORICAL | YES | [OT-110A] Admin content workspace | `codex/ot110a-admin-content-workspace`<br>`8fdbc7b51008773e1051b717a686b98137a813cb` | `codex/ops03-staging-readiness-repair`<br>`fb5f5eebc539afc9e93833e9417ee67524d62c36` | Graph to conductor not independently proven; OPS-04C/OPS-08/OPS-10 records semantic integration or accepted repair. | YES SEMANTICALLY—recorded in OPS convergence; original head/evidence remains unique history. | EV-OPS10; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #53 | **C** | SUPERSEDED/HISTORICAL | YES | OPS-03B email step-up login without TOTP | `codex/ops03b-email-step-up-login`<br>`25b2a95aa4e3ae82aad20537dc300e9978c15b56` | `codex/ops03-staging-readiness-repair`<br>`fb5f5eebc539afc9e93833e9417ee67524d62c36` | Exact ancestor via exact-base #53→#60, direct #60→#61, then #61→#73→#89→#91→#92→#97. | YES—exact commit reachability from conductor. | EV-OPS10; EV-GRAPH where stated; PR metadata | Scan exact head; create non-force remote preservation ref plus local bundle/checksum; re-prove ancestry. | `CT-C` | No commit loss while conductor survives; discoverability/ref risk remains until preservation. |
| #54 | **B** | SUPERSEDED/HISTORICAL | YES | OPS-04C One Time access/content convergence | `integration/ops04c-one-time-access-content-convergence-20260716T213505Z`<br>`5cc3849c2d0d6909bed038a8e9e8ef666ed5003e` | `codex/ops03-staging-readiness-repair`<br>`fb5f5eebc539afc9e93833e9417ee67524d62c36` | Graph to conductor not independently proven; OPS-04C/OPS-08/OPS-10 records semantic integration or accepted repair. | YES SEMANTICALLY—recorded in OPS convergence; original head/evidence remains unique history. | EV-OPS10; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #55 | **B** | SUPERSEDED/HISTORICAL | YES | OPS-07 Day-One journey gates | `codex/ops07-dayone-journey-gates`<br>`ce831f0e81a919a53934b50e4f843977649379cf` | `codex/ops03-staging-readiness-repair`<br>`fb5f5eebc539afc9e93833e9417ee67524d62c36` | Graph to conductor not independently proven; OPS-04C/OPS-08/OPS-10 records semantic integration or accepted repair. | YES SEMANTICALLY—recorded in OPS convergence; original head/evidence remains unique history. | EV-OPS10; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #56 | **B** | SUPERSEDED/HISTORICAL | YES | OPS-05 provider control center | `codex/ops05-provider-control-center`<br>`c04a9a5cc3020f4c6622e49963f028d469d48800` | `codex/ops03-staging-readiness-repair`<br>`fb5f5eebc539afc9e93833e9417ee67524d62c36` | Graph to conductor not independently proven; OPS-04C/OPS-08/OPS-10 records semantic integration or accepted repair. | YES SEMANTICALLY—recorded in OPS convergence; original head/evidence remains unique history. | EV-OPS10; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #57 | **B** | SUPERSEDED/HISTORICAL | YES | [OT-112] Premium product system contracts | `codex/ot112-premium-product-system`<br>`ae1c7cbc05e2ed6263c9943d64a6a738e5ffb6c7` | `codex/ops03-staging-readiness-repair`<br>`fb5f5eebc539afc9e93833e9417ee67524d62c36` | Graph to conductor not independently proven; OPS-04C/OPS-08/OPS-10 records semantic integration or accepted repair. | YES SEMANTICALLY—recorded in OPS convergence; original head/evidence remains unique history. | EV-OPS10; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #58 | **B** | SUPERSEDED/HISTORICAL | YES | OPS-06 reliability observability foundation | `codex/ops06-reliability-observability`<br>`aa17fed49b936ccc2fbfafad7826af39c1754b12` | `codex/ops03-staging-readiness-repair`<br>`fb5f5eebc539afc9e93833e9417ee67524d62c36` | Graph to conductor not independently proven; OPS-04C/OPS-08/OPS-10 records semantic integration or accepted repair. | YES SEMANTICALLY—recorded in OPS convergence; original head/evidence remains unique history. | EV-OPS10; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #59 | **B** | SUPERSEDED/HISTORICAL | YES | OT-114 CRM communications support | `codex/ot114-crm-communications-support`<br>`096dd614c9493cec1c29851e14f56166863ad26b` | `codex/ops03-staging-readiness-repair`<br>`fb5f5eebc539afc9e93833e9417ee67524d62c36` | Graph to conductor not independently proven; OPS-04C/OPS-08/OPS-10 records semantic integration or accepted repair. | YES SEMANTICALLY—recorded in OPS convergence; original head/evidence remains unique history. | EV-OPS10; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #60 | **C** | SUPERSEDED/HISTORICAL | YES | OPS-08 overnight integration partial checkpoint | `integration/ops08-overnight-final-20260716T230543Z`<br>`4e907992d8c7312a02e75dc879a5b5030f2b5942` | `codex/ops03b-email-step-up-login`<br>`25b2a95aa4e3ae82aad20537dc300e9978c15b56` | Exact ancestor via direct compare to #61, then #61→#73→#89→#91→#92→#97. | YES—exact commit reachability from conductor. | EV-OPS10; EV-GRAPH where stated; PR metadata | Scan exact head; create non-force remote preservation ref plus local bundle/checksum; re-prove ancestry. | `CT-C` | No commit loss while conductor survives; discoverability/ref risk remains until preservation. |
| #61 | **C** | SUPERSEDED/HISTORICAL | YES | OPS-10 full staged production launch candidate | `release/ops10-full-staged-production-launch-20260717T050800Z`<br>`c7d46066517d7a458d189f2c782cc06200f7861c` | `main`<br>`610b585f3d221addd4e7b824c92a5cc256cffcf9` | Exact ancestor via exact-base chain #61→#73→#89, direct #89→#91, then #91→#92→#97. | YES—exact commit reachability from conductor. | EV-OPS10; EV-GRAPH where stated; PR metadata | Scan exact head; create non-force remote preservation ref plus local bundle/checksum; re-prove ancestry. | `CT-C` | No commit loss while conductor survives; discoverability/ref risk remains until preservation. |
| #62 | **B** | SUPERSEDED/HISTORICAL | YES | W12-06 public WhatsApp lead assistant | `codex/w12-06-whatsapp-lead-assistant`<br>`fbc5c2f7304fec23d41e44e3f141f9b6abbade9f` | `release/ops10-full-staged-production-launch-20260717T050800Z`<br>`c7d46066517d7a458d189f2c782cc06200f7861c` | Graph to conductor not independently proven; W12-99 records this lane as integrated into #73. | YES SEMANTICALLY—recorded by W12-99; original head/evidence remains unique history. | EV-W12; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #63 | **B** | SUPERSEDED/HISTORICAL | YES | W12-00 canonical director handoff | `codex/w12-00-canonical-director-handoff`<br>`d22b68381f53686efb0badcce159f966e3167fe2` | `release/ops10-full-staged-production-launch-20260717T050800Z`<br>`c7d46066517d7a458d189f2c782cc06200f7861c` | Graph to conductor not independently proven; W12-99 records this lane as integrated into #73. | YES SEMANTICALLY—recorded by W12-99; original head/evidence remains unique history. | EV-W12; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #64 | **B** | SUPERSEDED/HISTORICAL | YES | W12-04 content Vimeo classroom vertical slice | `codex/w12-04-content-vimeo-classroom`<br>`373f6d55f6a636922d08b994b5dee28ff7bf6aa9` | `release/ops10-full-staged-production-launch-20260717T050800Z`<br>`c7d46066517d7a458d189f2c782cc06200f7861c` | Graph to conductor not independently proven; W12-99 records this lane as integrated into #73. | YES SEMANTICALLY—recorded by W12-99; original head/evidence remains unique history. | EV-W12; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #65 | **B** | SUPERSEDED/HISTORICAL | YES | W12-05 Telegram operations | `codex/w12-05-telegram-operations`<br>`fcdfcd3a93b2174d62298099ebefa39ac2e7c34d` | `release/ops10-full-staged-production-launch-20260717T050800Z`<br>`c7d46066517d7a458d189f2c782cc06200f7861c` | Graph to conductor not independently proven; W12-99 records this lane as integrated into #73. | YES SEMANTICALLY—recorded by W12-99; original head/evidence remains unique history. | EV-W12; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #66 | **B** | SUPERSEDED/HISTORICAL | YES | W12-02 communication history workspace | `codex/w12-02-communication-history`<br>`5c412373b3a317f1197ab50dffcf5352c2f97a2e` | `release/ops10-full-staged-production-launch-20260717T050800Z`<br>`c7d46066517d7a458d189f2c782cc06200f7861c` | Graph to conductor not independently proven; W12-99 records this lane as integrated into #73. | YES SEMANTICALLY—recorded by W12-99; original head/evidence remains unique history. | EV-W12; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #67 | **B** | SUPERSEDED/HISTORICAL | YES | W12-08 admin classroom productization | `codex/w12-08-admin-classroom-productization`<br>`4c29c6c665f9094f1d83f332c40316e0d2bce18f` | `release/ops10-full-staged-production-launch-20260717T050800Z`<br>`c7d46066517d7a458d189f2c782cc06200f7861c` | Graph to conductor not independently proven; W12-99 records this lane as integrated into #73. | YES SEMANTICALLY—recorded by W12-99; original head/evidence remains unique history. | EV-W12; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #68 | **B** | SUPERSEDED/HISTORICAL | YES | W12-01 CRM audience import safety tooling | `codex/w12-01-crm-audience-import`<br>`f31316dcb55a53b3ab4f77e7dc79988f2c988dfe` | `release/ops10-full-staged-production-launch-20260717T050800Z`<br>`c7d46066517d7a458d189f2c782cc06200f7861c` | Graph to conductor not independently proven; W12-99 records this lane as integrated into #73. | YES SEMANTICALLY—recorded by W12-99; original head/evidence remains unique history. | EV-W12; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #69 | **B** | SUPERSEDED/HISTORICAL | YES | W12-07 premium landing correction | `codex/w12-07-premium-landing`<br>`7d1196b03cfdb6828b376486c196a43b7ab9df32` | `release/ops10-full-staged-production-launch-20260717T050800Z`<br>`c7d46066517d7a458d189f2c782cc06200f7861c` | Graph to conductor not independently proven; W12-99 records this lane as integrated into #73. | YES SEMANTICALLY—recorded by W12-99; original head/evidence remains unique history. | EV-W12; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #70 | **B** | SUPERSEDED/HISTORICAL | YES | W12-03 portal test lab | `codex/w12-03-portal-test-lab`<br>`5bed730705f92a07647bd6eb3672952a47a4a075` | `release/ops10-full-staged-production-launch-20260717T050800Z`<br>`c7d46066517d7a458d189f2c782cc06200f7861c` | Graph to conductor not independently proven; W12-99 records this lane as integrated into #73. | YES SEMANTICALLY—recorded by W12-99; original head/evidence remains unique history. | EV-W12; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #71 | **B** | SUPERSEDED/HISTORICAL | YES | W12-09 student gamification vertical slice | `codex/w12-09-student-gamification`<br>`fc075bb688c69d8a03681633df8e6ea32ff685a9` | `release/ops10-full-staged-production-launch-20260717T050800Z`<br>`c7d46066517d7a458d189f2c782cc06200f7861c` | Not integrated into #73 or #89 by design; later W13 convergence contains a semantic gamification counterpart, but exact blob equivalence is unproven. | PARTIAL/LATER SEMANTIC COUNTERPART—original branch was skipped; exact blobs not proven. | EV-W12; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #72 | **B** | SUPERSEDED/HISTORICAL | YES | OPS-13A real-data provider preflight | `codex/ops13a-real-data-provider-preflight`<br>`d4f58801ebbb5fe8a41ef33621c7594f0ff6b2b4` | `release/ops10-full-staged-production-launch-20260717T050800Z`<br>`c7d46066517d7a458d189f2c782cc06200f7861c` | Graph to conductor not independently proven; W12-99 records this lane as integrated into #73. | YES SEMANTICALLY—recorded by W12-99; original head/evidence remains unique history. | EV-W12; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #73 | **C** | SUPERSEDED/HISTORICAL | YES | W12-99 final semantic convergence | `integration/w12-final-convergence-20260717T123715Z`<br>`0d8d7168f066668f035176d777bdaaa4dcc5accd` | `release/ops10-full-staged-production-launch-20260717T050800Z`<br>`c7d46066517d7a458d189f2c782cc06200f7861c` | Exact ancestor via exact-base #73→#89, direct #89→#91, then #91→#92→#97. | YES—exact commit reachability from conductor. | EV-W12; EV-GRAPH where stated; PR metadata | Scan exact head; create non-force remote preservation ref plus local bundle/checksum; re-prove ancestry. | `CT-C` | No commit loss while conductor survives; discoverability/ref risk remains until preservation. |
| #74 | **B** | SUPERSEDED/HISTORICAL | YES | W12-100-00 director and OPS-13A convergence | `codex/w12-100-00-director-and-ops13a-convergence`<br>`cc2db2f6c7cd61d22ac0b1991a18f37e92fbf162` | `integration/w12-final-convergence-20260717T123715Z`<br>`0d8d7168f066668f035176d777bdaaa4dcc5accd` | Graph to conductor not independently proven; W12-100 convergence records this lane as accepted and semantically integrated into #89. | YES SEMANTICALLY—accepted into #89; original head/evidence remains unique history. | EV-W12-100; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #75 | **B** | SUPERSEDED/HISTORICAL | YES | W12-100-13 gamification scope assessment | `codex/w12-100-13-gamification-scope-assessment`<br>`8d4a0e87c37a85d47299dddcddbda6fe1dc76914` | `integration/w12-final-convergence-20260717T123715Z`<br>`0d8d7168f066668f035176d777bdaaa4dcc5accd` | Graph to conductor not independently proven; W12-100 convergence records this lane as accepted and semantically integrated into #89. | YES SEMANTICALLY—accepted into #89; original head/evidence remains unique history. | EV-W12-100; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #76 | **B** | SUPERSEDED/HISTORICAL | YES | W12-100-04 real source dry-run tooling | `codex/w12-100-04-real-source-dry-run-tooling`<br>`3e12373a77b10fc700bfcf34569c4d4611019b67` | `integration/w12-final-convergence-20260717T123715Z`<br>`0d8d7168f066668f035176d777bdaaa4dcc5accd` | Graph to conductor not independently proven; W12-100 convergence records this lane as accepted and semantically integrated into #89. | YES SEMANTICALLY—accepted into #89; original head/evidence remains unique history. | EV-W12-100; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #77 | **B** | SUPERSEDED/HISTORICAL | YES | [W12-100-07] Classroom/content readiness protocol tests | `codex/w12-100-07-classroom-content-readiness`<br>`84852346944c3dfe9a92cafdbc11e58d05da8547` | `integration/w12-final-convergence-20260717T123715Z`<br>`0d8d7168f066668f035176d777bdaaa4dcc5accd` | Graph to conductor not independently proven; W12-100 convergence records this lane as accepted and semantically integrated into #89. | YES SEMANTICALLY—accepted into #89; original head/evidence remains unique history. | EV-W12-100; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #78 | **B** | SUPERSEDED/HISTORICAL | YES | W12-100-09 billing TEST readiness | `codex/w12-100-09-billing-test-readiness`<br>`311d4162701413c9897846fbc13b191fe6cf1f41` | `integration/w12-final-convergence-20260717T123715Z`<br>`0d8d7168f066668f035176d777bdaaa4dcc5accd` | Graph to conductor not independently proven; W12-100 convergence records this lane as accepted and semantically integrated into #89. | YES SEMANTICALLY—accepted into #89; original head/evidence remains unique history. | EV-W12-100; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #79 | **D** | UNPROVEN | YES | W12-100-05 PostgreSQL migration rehearsal | `codex/w12-100-05-postgres-migration-rehearsal`<br>`6f3203444eabbc8fac10a501476b9f355e83210f` | `integration/w12-final-convergence-20260717T123715Z`<br>`0d8d7168f066668f035176d777bdaaa4dcc5accd` | Non-ancestor by design: W12-100 explicitly skipped this environment-blocked rehearsal; downstream semantic disposition is unproven. | NO PROOF—skipped rehearsal has unique commits. | EV-W12-100; EV-GRAPH where stated; PR metadata | Protected bundle first; optional remote ref only after protected scan; semantic-review handoff required; no closure. | `CT-D` | YES/UNKNOWN—unique or drifted work may be lost. |
| #80 | **B** | SUPERSEDED/HISTORICAL | YES | W12-100-02 delivery transport foundation | `codex/w12-100-02-delivery-transport-foundation`<br>`47ebf988f10459e3c53e988c10e466a80fb39317` | `integration/w12-final-convergence-20260717T123715Z`<br>`0d8d7168f066668f035176d777bdaaa4dcc5accd` | Graph to conductor not independently proven; W12-100 convergence records this lane as accepted and semantically integrated into #89. | YES SEMANTICALLY—accepted into #89; original head/evidence remains unique history. | EV-W12-100; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #81 | **B** | SUPERSEDED/HISTORICAL | YES | W12-100-01 security boundary audit | `codex/w12-100-01-security-boundary-audit`<br>`6f799034f7cbae38d490f64dbae52e55ab0c215a` | `integration/w12-final-convergence-20260717T123715Z`<br>`0d8d7168f066668f035176d777bdaaa4dcc5accd` | Graph to conductor not independently proven; W12-100 convergence records this lane as accepted and semantically integrated into #89. | YES SEMANTICALLY—accepted into #89; original head/evidence remains unique history. | EV-W12-100; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #82 | **B** | SUPERSEDED/HISTORICAL | YES | W12-100-08 messaging readiness | `codex/w12-100-08-messaging-readiness`<br>`de2d9fcdb6bd8a945c4e2c9377855429c337d392` | `integration/w12-final-convergence-20260717T123715Z`<br>`0d8d7168f066668f035176d777bdaaa4dcc5accd` | Graph to conductor not independently proven; W12-100 convergence records this lane as accepted and semantically integrated into #89. | YES SEMANTICALLY—accepted into #89; original head/evidence remains unique history. | EV-W12-100; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #83 | **B** | SUPERSEDED/HISTORICAL | YES | W12-100-06 account and portal readiness | `codex/w12-100-06-account-and-portal-readiness`<br>`902b6c503ed39a7a6d887b5e4b1912a88f9f56f5` | `integration/w12-final-convergence-20260717T123715Z`<br>`0d8d7168f066668f035176d777bdaaa4dcc5accd` | Graph to conductor not independently proven; W12-100 convergence records this lane as accepted and semantically integrated into #89. | YES SEMANTICALLY—accepted into #89; original head/evidence remains unique history. | EV-W12-100; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #84 | **B** | SUPERSEDED/HISTORICAL | YES | W12-100-12 supply chain audit | `codex/w12-100-12-supply-chain-audit`<br>`a7f0da10bfa56f776a4b923a5bf56dc420eca5db` | `integration/w12-final-convergence-20260717T123715Z`<br>`0d8d7168f066668f035176d777bdaaa4dcc5accd` | Graph to conductor not independently proven; W12-100 convergence records this lane as accepted and semantically integrated into #89. | YES SEMANTICALLY—accepted into #89; original head/evidence remains unique history. | EV-W12-100; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #85 | **B** | SUPERSEDED/HISTORICAL | YES | W12-100-10 SRE launch runbook | `codex/w12-100-10-sre-launch-runbook`<br>`b81b1c6f41455f3edc5b73b3de1ffc64375b1d47` | `integration/w12-final-convergence-20260717T123715Z`<br>`0d8d7168f066668f035176d777bdaaa4dcc5accd` | Graph to conductor not independently proven; W12-100 convergence records this lane as accepted and semantically integrated into #89. | YES SEMANTICALLY—accepted into #89; original head/evidence remains unique history. | EV-W12-100; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #86 | **B** | SUPERSEDED/HISTORICAL | YES | W12-100-03 public launch truth | `codex/w12-100-03-public-launch-truth`<br>`a3b31d3a3b2053aaa90151419730673620ed0f56` | `integration/w12-final-convergence-20260717T123715Z`<br>`0d8d7168f066668f035176d777bdaaa4dcc5accd` | Graph to conductor not independently proven; W12-100 convergence records this lane as accepted and semantically integrated into #89. | YES SEMANTICALLY—accepted into #89; original head/evidence remains unique history. | EV-W12-100; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #87 | **B** | SUPERSEDED/HISTORICAL | YES | W12-100-11 UX accessibility performance SEO readiness | `codex/w12-100-11-ux-accessibility-performance-seo`<br>`b8e0a09c5e4be09da14b2f0398c2b905a8b83506` | `integration/w12-final-convergence-20260717T123715Z`<br>`0d8d7168f066668f035176d777bdaaa4dcc5accd` | Graph to conductor not independently proven; W12-100 convergence records this lane as accepted and semantically integrated into #89. | YES SEMANTICALLY—accepted into #89; original head/evidence remains unique history. | EV-W12-100; EV-GRAPH where stated; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #88 | **B** | SUPERSEDED/HISTORICAL | YES | W13-10 complete supplemental launch foundations | `codex/w13-10-complete-launch-foundations`<br>`698570f2d6b2701d1345794d16b93affd1ff96ae` | `integration/w12-final-convergence-20260717T123715Z`<br>`0d8d7168f066668f035176d777bdaaa4dcc5accd` | Graph to conductor not independently proven; W13-10 material appears in #91, but exact head inclusion is not proven. | LIKELY SEMANTICALLY—W13 material appears downstream; exact head inclusion unproven. | EV-W13; PR metadata | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #89 | **C** | SUPERSEDED/HISTORICAL | YES | W12-100 launch readiness convergence | `integration/w12-100-launch-readiness-convergence-20260717`<br>`ac02ce9cd4f690d3b305b30ec1eef4e18d48cd5c` | `integration/w12-final-convergence-20260717T123715Z`<br>`0d8d7168f066668f035176d777bdaaa4dcc5accd` | Exact ancestor via direct compare to #91, then exact-base #91→#92→#97. | YES—exact ancestor. | EV-W12-100; EV-GRAPH where stated; PR metadata | Scan exact head; create non-force remote preservation ref plus local bundle/checksum; re-prove ancestry. | `CT-C` | No commit loss while conductor survives; discoverability/ref risk remains until preservation. |
| #90 | **B** | NEW FINDING | YES | W12-100 isolated staging deployment evidence | `codex/w12-100-isolated-staging-deployment-20260717`<br>`9465999305d7e0530f171711c1418c17151fb79f` | `integration/w12-100-launch-readiness-convergence-20260717`<br>`ac02ce9cd4f690d3b305b30ec1eef4e18d48cd5c` | Diverged from #91/conductor line: merge base #89; #90 has 9 unique commits and #91 has 26 unique commits. | NO—9 unique staging-evidence commits are not on conductor lineage. | EV-GRAPH-90; PR metadata | Preserve exact 9-commit evidence branch in reviewed remote ref and protected bundle/checksum before closure. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #91 | **C** | SUPERSEDED/HISTORICAL | YES | W13-100 controlled day-one release convergence | `release/w13-100-controlled-day-one-20260717T182046Z`<br>`e3d3736546f48b3834d6698838befe20884005f1` | `integration/w12-final-convergence-20260717T123715Z`<br>`0d8d7168f066668f035176d777bdaaa4dcc5accd` | Exact ancestor via exact-base chain #91→#92→#97. | YES—exact ancestor. | EV-W13; EV-GRAPH | Scan exact head; create non-force remote preservation ref plus local bundle/checksum; re-prove ancestry. | `CT-C` | No commit loss while conductor survives; discoverability/ref risk remains until preservation. |
| #92 | **C** | SUPERSEDED/HISTORICAL | YES | ONE-TIME-FINISH-NOW release truth checkpoint | `codex/one-time-finish-now-20260719`<br>`5ddd7b604c01744dd562050ae9b51124f7732594` | `release/w13-100-controlled-day-one-20260717T182046Z`<br>`e3d3736546f48b3834d6698838befe20884005f1` | Exact ancestor; #97 base SHA equals #92 head. | YES—exact ancestor. | EV-W13; exact base metadata | Scan exact head; create non-force remote preservation ref plus local bundle/checksum; re-prove ancestry. | `CT-C` | No commit loss while conductor survives; discoverability/ref risk remains until preservation. |
| #97 | **A** | CONFIRMED CURRENT TRUTH | YES | Full app staging live preview | `codex/full-app-staging-live`<br>`53a18e771488c61cf271cb33a0bcacee2c7135f4` | `codex/one-time-finish-now-20260719`<br>`5ddd7b604c01744dd562050ae9b51124f7732594` | CONDUCTOR: current audited head. | N/A—canonical conductor. | EV-BOARD; PR #97; checkpoint compare | Snapshot exact head and Board ownership only; do not close. | `CT-A` | YES if improperly closed; active work/authority. |
| #104 | **B** | SUPERSEDED/HISTORICAL | YES | Video content factory: private intake, review, and protected playback | `codex/vimeo-drive-content-factory`<br>`5c0a5ef81ce10df4e40f135be1e2c648f643996a` | `codex/vimeo-autotrim-transcription-repair`<br>`0e8b903385d0f1717f8f6e051f4a322739e175d7` | Graph to conductor not independently proven; Board records the accepted content-factory semantics as represented in the conductor. | YES SEMANTICALLY—Board records accepted content-factory representation. | EV-BOARD; PR #104 | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #105 | **A** | CONFIRMED CURRENT TRUTH | YES | Activate isolated Zoom real-control host surface | `codex/zoom-real-control-activation`<br>`2d22f46a40364c670d20fa197e78ead2a2f79c8e` | `codex/rabbi-live-console-zoom-obs`<br>`9dfabade8b9cff9dfa3edd6d0677deb4d07b8e18` | Active separate Zoom lane; exact graph relation to conductor not established; closure prohibited. | ACTIVE UNIQUE LANE—must remain open. | EV-BOARD; PR #105 | Snapshot exact head and Board ownership only; do not close. | `CT-A` | YES if improperly closed; active work/authority. |
| #106 | **D** | NEW FINDING | YES | Release Tisha B'Av 2026 event funnel | `release/tisha-bav-2026-live`<br>`0d69de15e3c5e7a5e51f2b9262c992ea153c51fb` | `codex/one-time-finish-now-20260719`<br>`5ddd7b604c01744dd562050ae9b51124f7732594` | Diverged from conductor: merge base #92; PR #106 has 36 unique commits and conductor has 193 unique commits. Board-authorized head also differs from current PR head. | NO—36 release-line commits are not on conductor lineage; current head also exceeds Board-authorized head. | EV-BOARD; EV-GRAPH-106; PR #106 | Preserve current exact head in protected bundle first; remote ref only after protected scan; create semantic-review diff manifest; no closure. | `CT-D` | YES/UNKNOWN—unique or drifted work may be lost. |
| #107 | **B** | SUPERSEDED/HISTORICAL | YES | highlevel: record final organization and activation readback | `codex/highlevel-final-results-20260722`<br>`1e247c70004dffb6247fc1ee407f1153d753bd7d` | `codex/highlevel-sender-registry-v1-1`<br>`a11bfafc8e8098413eb4262270f1718946875a88` | Graph to conductor not independently proven; final GHL organization/readback is historical evidence, not current execution authority. | EVIDENCE ONLY—historical provider readback; preserve exact source. | EV-BOARD/DECISIONS; PR #107 | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #109 | **E** | NEW FINDING | NO | Tisha Bav one-screen funnel staging patch | `codex/tisha-bav-one-screen-staging-patch-20260722`<br>`1779254768dacebb84aeac5d71b56b5abfba2534` | `codex/full-app-staging-live`<br>`6fcf0435cca744dba0e4a3337beac860d9315180` | Diverged from #110 and conductor-era release line; #109/#110 merge base is #92, with 40 commits unique to #109 versus 26 unique to #110. | NO—unique visual branch; conflicts with #110. | EV-TISHA-DIVERGENCE; PR #109 | Preserve exact competing head in separate ref/bundle; create pairwise semantic conflict ledger; no closure. | `CT-E` | YES—each branch carries unique/conflicting work. |
| #110 | **E** | NEW FINDING | NO | Polish Tisha B'Av visual funnel | `codex/tisha-bav-visual-repair`<br>`38358961cff6c6bf44621ab9e3f6b88061586618` | `release/tisha-bav-2026-live`<br>`acddcc8cd012c5cdc5bfc08cbc80550bef8719ba` | Diverged from #109 and conductor-era release line; #109/#110 merge base is #92, with 26 commits unique to #110 versus 40 unique to #109. | NO—unique visual branch; conflicts with #109. | EV-TISHA-DIVERGENCE; PR #110 | Preserve exact competing head in separate ref/bundle; create pairwise semantic conflict ledger; no closure. | `CT-E` | YES—each branch carries unique/conflicting work. |
| #113 | **B** | SUPERSEDED/HISTORICAL | NO | OT-LAUNCH-01: durable occurrence-scoped video classroom delivery | `codex/video-to-classroom-e2e`<br>`45b213a5ddfde97d60f220ae3eb0bdff5cda51ed` | `codex/full-app-staging-live`<br>`69e451184ea2a80d13b12ccaf3da20db0c2684cf` | Graph to conductor not independently proven; Board records the occurrence-scoped delivery result as accepted/represented. | YES SEMANTICALLY—Board records accepted occurrence-scoped delivery. | EV-BOARD/DECISIONS; PR #113 | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #115 | **B** | SUPERSEDED/HISTORICAL | YES | Record GHL UI 14–18 readback and blocked OT-E01 repair | `codex/ghl-ui-14-18-activation-results`<br>`06c14e9b59c5e7c963397fb961634fe711b00e0c` | `codex/full-app-staging-live`<br>`5556c4ab78e01d367666694459eb2ea97f4028ef` | Graph to conductor not independently proven; current-truth GHL readback evidence only, with no implementation authority. | EVIDENCE ONLY—readback remains uniquely valuable. | EV-BOARD/DECISIONS; PR #115 | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #116 | **D** | UNPROVEN | NO | feat(highlevel): add executable governed workflow jobs | `codex/ot-launch-01-ghl-executable-jobs`<br>`e0e86716608a31c3a2e1adc73d4c083f65ae1777` | `codex/full-app-staging-live`<br>`5556c4ab78e01d367666694459eb2ea97f4028ef` | Non-ancestor/conflicting executable GHL branch; current audit evidence requires semantic re-authoring on current conductor source. | NO ACCEPTED REPRESENTATION—must be semantically re-authored/reviewed. | EV-A04; PR #116 | Preserve current exact head in protected bundle first; remote ref only after protected scan; create semantic-review diff manifest; no closure. | `CT-D` | YES/UNKNOWN—unique or drifted work may be lost. |
| #117 | **B** | SUPERSEDED/HISTORICAL | YES | Complete OT-LAUNCH-01 private media external canary | `codex/media-external-canary`<br>`13656a558b44d6af533720697e4e9eb12d22bf9e` | `codex/full-app-staging-live`<br>`7ac546846592266ce1a112c42d7d578276c6ec3d` | Graph to conductor not independently proven; Board records final canary blobs/semantics as represented. | YES SEMANTICALLY/BLOB-EQUIVALENT per Board. | EV-BOARD/DECISIONS; PR #117 | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #121 | **B** | SUPERSEDED/HISTORICAL | YES | Add structured prompts and scoped knowledge helper | `codex/structured-prompt-scoped-knowledge`<br>`7264ee1a247dda12a25042af11594e8dea86d667` | `codex/full-app-staging-live`<br>`98d1735d47a1a73c060a0ef4a9da838128d1bfce` | Graph to conductor not independently proven; Board records the six-commit semantic range as integrated once. | YES SEMANTICALLY per Board. | EV-BOARD; PR #121 | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |
| #122 | **B** | SUPERSEDED/HISTORICAL | YES | Converge event-service email permission | `codex/event-service-email-permission-convergence`<br>`37b83461bb1fed8c0f795234e125b5270d5414c0` | `codex/full-app-staging-live`<br>`9e291e9b77d0c5fe78867183e8154bfc47b53886` | Graph to conductor not independently proven; Board records the event-permission semantic range as integrated once. | YES SEMANTICALLY per Board. | EV-BOARD; PR #122 | Scan exact head; preserve remote ref when review passes, otherwise protected local bundle; record semantic/evidence successor. | `CT-B` | YES until exact head/evidence is preserved; semantic behavior is generally represented. |

## 8. Closure comment templates


### `CT-A` — keep open

No closure comment. Record: `KEEP OPEN — active canonical/assigned lane; preservation snapshot only.`

### `CT-B` — preserved superseded/evidence PR

```text
A05 preservation gate is accepted for this exact PR head.

Preserved head: <HEAD_SHA>
Preservation proof: <REMOTE_REF_OR_PROTECTED_BUNDLE_ID>
Checksum/readback: <CHECKSUM_OR_REMOTE_READBACK_SHA>
Canonical successor/representation: <SUCCESSOR_PR_COMMIT_OR_EVIDENCE_PATH>

This PR is closed as superseded/historical without merging. Its original head and evidence remain preserved. No branch or worktree was deleted; no history was rewritten. Reopen only through an explicit OT-CONTROL Board assignment.
```

### `CT-C` — preserved exact ancestor

```text
A05 preservation gate is accepted for this exact PR head.

Preserved head: <HEAD_SHA>
Frozen conductor: <CONDUCTOR_SHA>
Ancestry proof: `git merge-base --is-ancestor <HEAD_SHA> <CONDUCTOR_SHA>` returned 0.
Preservation proof: <REMOTE_REF_OR_PROTECTED_BUNDLE_ID>
Checksum/readback: <CHECKSUM_OR_REMOTE_READBACK_SHA>

This PR is closed without merging because its exact head is already reachable from the conductor. No branch or worktree was deleted; no history was rewritten. Reopen only through an explicit OT-CONTROL Board assignment.
```

### `CT-D` — semantic-review hold

```text
A05 HOLD — do not close. The current head is non-ancestor, drifted, skipped, or otherwise not proven represented. Preserve the exact head first, then complete a path/blob/migration semantic review under a Board-assigned read-only review task.
```

### `CT-E` — duplicate/conflict hold

```text
A05 HOLD — do not close. This PR conflicts or competes with another preserved head. Preserve both heads independently and obtain a Board-recorded canonical choice plus semantic conflict ledger before either PR becomes closure-eligible.
```

### `CT-F` — unknown/unsafe hold

```text
A05 HOLD — do not close. Repository identity, exact head, ancestry, or preservation safety is unresolved. Protected inventory and classification are required before any GitHub action.
```


## 9. Preservation process


1. **Board gate and freeze.** `OT-CONTROL` assigns exactly one `OT-HYGIENE` preservation task. Freeze the A05 conductor SHA, the 105 PR heads, and the closure categories. No product, GHL, Board, provider, deployment, or BNA product writer shares this task.
2. **Sanitized local census first.** Inspect every clone/worktree using metadata-only commands. Hash local paths and remote URLs before any committed summary. Record dirty/index/unmerged/untracked/submodule states, branch/upstream, refs, stashes by count, object format, and local-only commit SHAs/subjects. Do not print diff bodies, environment variables, credential-helper output, or protected file contents.
3. **Repository identity separation.** Classify each checkout as `one_time`, `bna`, `one_time_legacy_clone`, or `unknown`. Never push a BNA object to One Time or a One Time object to BNA merely because a diff appears useful. Historical manifests naming `webcraft-media/onetimev2` are provenance, not current remote authority.
4. **Do not mutate sources.** No reset, clean, checkout-overwrite, auto-stash, rebase, prune, force-push, broad staging, or worktree deletion. Backups are created from read-only source access into a separate protected root.
5. **Preserve committed objects in an external bare store.** Verify each SHA with `git cat-file -e <sha>^{commit}`. Fetch the exact object into a new protected bare backup repository, create a bundle, run `git bundle verify`, checksum it, and perform a disposable restore/readback.
6. **Protected scan before any new remote ref.** Existing repository secret scans are bounded text/path checks and do not prove binaries, archives, screenshots, untracked files, history, or protected metadata safe. Use a non-echoing protected scanner that reports object/path/class and counts only. If coverage is incomplete or any protected class is found, keep the object in protected local storage and set `remote_ref_eligible=false`.
7. **Remote preservation refs are additive and non-force.** For reviewed One Time PR heads, use `refs/heads/preserve/20260726/onetime/pr-<number>-<shortsha>`. For reviewed BNA commits, use the separate BNA repository and `refs/heads/preserve/20260726/bna/<purpose>-<shortsha>`. If a target ref exists at a different SHA, stop; never update it.
8. **Dirty work is patch-preserved, never auto-committed.** Write binary/full-index tracked and index patches, a NUL-safe status snapshot, and an untracked manifest. Do not blindly archive untracked directories. Any single untracked file over 100 MiB, aggregate over 1 GiB, directory over 10,000 entries, symlink escape, protected class, or uninspected binary is a stop/manifest-only condition.
9. **Known local-only claims are verification targets, not facts.** Check BNA objects `3752ec1`, `a82f6c1`, `306aedab`, `a8d04246` and legacy-clone object `ad4dd809` without printing content. The alleged One Time server diff inside `a82f6c1` is bundle-only and cross-repository-review-only; it must not be pushed automatically to either repository.
10. **Sanitized repository manifest last.** After protected artifacts verify, use a fresh clean clone from checkpoint `e986b5e6502b1168b3eb28e200fd49ac8de46477` and branch `codex/repository-preservation-manifest-20260726`. Commit only counts, safe ref names/SHAs, protected artifact IDs/checksums, coverage states, and unresolved blockers under `ops/preservation/2026-07-26/A05/**`. No local paths, URLs with credentials, stable private identifiers, fingerprints, protected destinations, customer/Student data, raw snippets, or bundle contents enter Git.
11. **Acceptance before closure.** `OT-CONTROL` reviews the sanitized manifest and records an explicit accepted close list. Until that Board row exists, the closure prompt is not runnable.


## 10. P0 preservation hazards


| Hazard | Classification | Why it is P0 for preservation | Mandatory containment |
|---|---|---|---|
| `P0-01` closure before accepted preservation | CONFIRMED CURRENT TRUTH | Category B contains unique historical heads/evidence; category C still has discoverability/ref risk. Closing can accelerate later branch cleanup before objects are independently retained. | Closure prompt remains disabled until Board accepts exact-head refs/bundles/checksums. |
| `P0-02` dirty source mutation | UNPROVEN current local state | The operator reports dozens of dirty One Time/BNA worktrees. Reset, clean, checkout, auto-stash, broad add, or reuse could destroy or mix unique work. | Metadata census first; patch/bundle outside repositories; source status hash unchanged. |
| `P0-03` cross-repository contamination | UNPROVEN | `a82f6c1` allegedly contains an old One Time server diff inside a BNA checkpoint. Blind push/cherry-pick would violate standalone boundaries and may publish protected BNA material. | Bundle-only; separate BNA/One Time semantic review and operator decision. |
| `P0-04` open-head drift | NEW FINDING | #42 and #44 no longer match the heads named by older convergence records; #106 current head differs from the Board-authorized production head and is graph-diverged from the conductor. | Freeze current heads; preserve exact objects; no closure or successor claim until semantic review. |
| `P0-05` incomplete scanner coverage | CONFIRMED CURRENT TRUTH | Existing “secret scan passed” evidence does not prove binary/archive/screenshot/untracked/all-ref safety and must not authorize a new public ref or committed backup summary. | Protected non-echoing scan; incomplete binary/untracked coverage fails closed. |
| `P0-06` unique skipped/diverged evidence | NEW FINDING | #90 has 9 unique staging-evidence commits; #79 was skipped; #38 and #116 lack accepted semantic representation. | Bundle and checksum first; semantic review for D; #90 remote ref only after review. |
| `P0-07` conflicting Tisha visual lineages | NEW FINDING | #109 and #110 are both conflicting and graph-diverged with substantial unique histories. Choosing by title, date, or mergeability can discard accepted copy/assets/evidence. | Preserve both; produce conflict ledger; operator/Board selects canonical lineage. |
| `P0-08` evidence/control commit represented as runtime | CONFIRMED CURRENT TRUTH | Board distinguishes accepted deployed product source from later control/evidence descendants. Preservation/closure artifacts must not rewrite release truth. | Pin product source separately from conductor/control heads in every manifest and comment. |
| `P0-09` historical/current repository identity mismatch | CONFIRMED CURRENT TRUTH | Several historical manifests name `webcraft-media/onetimev2`; current authority is `shloimie-beep/onetimev2`. Automation could push preservation refs to the wrong remote. | Resolve and hash remote identity per checkout; explicit allowlist; stop on mismatch. |
| `P0-10` sole-copy local commits | UNPROVEN | The four BNA SHAs and `ad4dd809` may be unreachable from any remote. Workstation loss or cleanup would remove the only copy. | Verify object existence and reachability; protected bare-store bundle immediately; remote push only after review/decision. |
| `P0-11` massive untracked/high-level registry content | UNPROVEN | Blind archive or commit may include protected destinations, customer data, generated exports, binaries, or huge folders. | Manifest-only until reviewed; no tar/zip of whole worktree; enforce thresholds and field-class exclusions. |
| `P0-12` preservation ref collision or force update | CONFIRMED CURRENT TRUTH | Reusing a ref name at a different SHA silently destroys the preservation guarantee. | Additive immutable naming; accept existing ref only at identical SHA; force count must remain zero. |


## 11. Board-assigned preservation/closure tasks


| Task | Dependency | Owner / writer slot | Exact write scope | Stop condition | Required proof | Board assignment? |
|---|---|---|---|---|---|:---:|
| `A05-T01` sanitized clone/worktree census | Accepted A05 result; no implementation dependency | Operator/local executor under `OT-HYGIENE`; metadata-only | Protected local inventory only; repository identity, path/remote hashes, HEAD/upstream, status counts, worktree/ref/stash counts, local-only SHA/subject list | Any command would print a diff body, environment value, credential helper, protected path/content, or source identity is ambiguous | Timestamped checksummed inventory; 105 remote PR snapshot reconciled; One Time/BNA counts separately stated | YES |
| `A05-T02` committed-object preservation | `A05-T01`; protected non-echoing scanner method; exact A05 PR heads | `OT-HYGIENE` | External bare stores, bundles, checksums, disposable restore proofs; additive reviewed remote preservation refs only | Object missing; scan incomplete/blocked; ref collision at different SHA; cross-repo identity mismatch | `git bundle verify`; SHA-256; restore readback; remote `ls-remote` exact SHA; zero force operations | YES |
| `A05-T03` dirty-worktree backup | `A05-T01`; no overlapping writer | `OT-HYGIENE` local-only backup executor | Binary/full-index tracked/index patches, status snapshots, untracked manifests, reviewed-copy archives only | Unmerged target; protected class; uninspected binary; size/count threshold; symlink escape; source would be changed | Checksums; patch `--check` in disposable clone; reviewed-copy hash match; source status hash unchanged | YES |
| `A05-T04` sanitized preservation-manifest PR | `A05-T02` and `A05-T03` accepted locally | `OT-HYGIENE` | Fresh branch `codex/repository-preservation-manifest-20260726`; only `ops/preservation/2026-07-26/A05/**` | Dirty clone; branch/ref collision; protected metadata would enter Git; validators fail | Exact changed-file list; schema validation; scoped formatting; secret/privacy scan with stated coverage; `git diff --check`; draft PR | YES |
| `A05-T05` D/E semantic adjudication | Accepted preservation manifest | `OT-CONTROL` assigns read-only domain reviewers; no product writer | Sanitized path/blob/migration/evidence comparison for #38, #42, #44, #79, #106, #116, #25, #109, #110 | Any merge/implementation is required; protected content would be rendered; canonical product choice is unclear | Per-PR semantic ledger; exact source/successor SHAs; unique path/blob list; operator decision where needed | YES |
| `A05-T06` B/C PR closure | Accepted preservation manifest; accepted A05 close list; `A05-T05` does not expand scope | `OT-HYGIENE` | GitHub comment + close only for individually authorized category B/C PRs; sanitized closeout artifact | Head drift; active Board owner; missing ref/bundle; unresolved review; unique migration/blob; new comment/check changes meaning | Before/after PR state; exact head; preservation proof; ancestry proof for C; closeout checksum; branch deletion count 0 | YES |
| `A05-T07` legacy/BNA cross-repo decision | `A05-T01`–`T03`; A06/A07 protected findings | Operator decision, then separately assigned repository-specific hygiene writer | Decision only for BNA local-only commits, legacy `OneTimeOneTime` clone, and `a82f6c1` embedded One Time diff | No explicit target repository/retention decision; protected scan incomplete | Dated decision IDs; repo/object mapping; bundle hashes; no automatic cross-repo push | YES |


## 12. Exact Codex preservation prompt

```text
# A05 / OT-HYGIENE — PRESERVE PR, BRANCH, CLONE, AND WORKTREE STATE

MODE: PRESERVATION ONLY. NO PRODUCT IMPLEMENTATION. NO PROVIDER ACTION. NO PR CLOSURE.

## Authority gate

Do not run unless `ops/goals/OT-LAUNCH-01/BOARD.yaml` contains an explicit assignment to writer slot `OT-HYGIENE` for A05 preservation and names this accepted audit result.

Canonical repository: `shloimie-beep/onetimev2`
Control checkpoint: `e986b5e6502b1168b3eb28e200fd49ac8de46477`
Conductor PR: `#97`
Frozen audited conductor head: `53a18e771488c61cf271cb33a0bcacee2c7135f4`

Required operator-provided environment variables:

- `A05_SCAN_ROOT`: directory containing the local clones/worktrees to inventory.
- `A05_PROTECTED_BACKUP_ROOT`: encrypted operator-controlled directory outside every repository, worktree, cloud-sync root, and publicly served directory.

Stop immediately if either variable is missing, resolves inside a Git worktree, or resolves to the same path.

## Immutable PR disposition inputs

- Category A, never close: 97, 105
- Category B, preservation then possible closure: 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 19, 20, 21, 22, 24, 26, 28, 29, 30, 31, 32, 34, 35, 36, 37, 41, 43, 45, 46, 47, 48, 49, 50, 51, 52, 54, 55, 56, 57, 58, 59, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 74, 75, 76, 77, 78, 80, 81, 82, 83, 84, 85, 86, 87, 88, 90, 104, 107, 113, 115, 117, 121, 122
- Category C, exact-ancestor candidates: 1, 2, 17, 23, 27, 33, 39, 40, 53, 60, 61, 73, 89, 91, 92
- Category D, semantic-review hold: 38, 42, 44, 79, 106, 116
- Category E, duplicate/conflict hold: 25, 109, 110
- Category F: none in the remote PR inventory.

Read the complete accepted `ops/audits/2026-07-26/parallel-control-tower/A05-result.md`; its exact per-PR head SHAs override number-only lists. Re-query GitHub before doing anything. If any PR head, state, base, or conductor head changed, record drift and stop that PR. Do not silently refresh the manifest.

## Absolute prohibitions

Never run or emulate:

- `git reset` in any mode;
- `git clean`;
- `git checkout -- <path>` or `git restore` against source worktrees;
- auto-stash or manual stash creation;
- `git fetch --prune`, `git remote prune`, `git gc --prune`, or branch pruning;
- rebase, history rewrite, filter-repo, or force-push;
- broad `git add -A`, `git add .`, or automatic commit of dirty work;
- deletion of branches, tags, clones, worktrees, stashes, files, or provider objects;
- copying One Time objects into BNA or BNA objects into One Time without a later explicit decision;
- printing environment variables, credential-helper output, raw remote URLs, diff bodies, protected matches, customer/Student content, private destinations, provider identifiers, signed/replayable links, or raw media/transcripts.

No provider UI/API, deployment, database, DNS, send, enrollment, payment, or production action is authorized.

## Phase 1 — sanitized metadata census

1. Enumerate Git repositories below `A05_SCAN_ROOT` without following symlinks outside the root.
2. For each repository/worktree, collect into protected local files only:
   - hashed absolute source path;
   - sanitized canonical identity and SHA-256 of each remote URL, never the raw URL in output;
   - object format;
   - `HEAD` SHA, branch/detached state, upstream name, ahead/behind;
   - `git status --porcelain=v2 -z --branch`;
   - `git worktree list --porcelain`;
   - `git show-ref --head`;
   - stash count and stash object IDs only;
   - tracked/index/unmerged/untracked/submodule counts;
   - local commits not reachable from any observed remote ref, SHA and subject only.
3. Classify every checkout as `one_time`, `bna`, `one_time_legacy_clone`, or `unknown`.
4. Do not print or commit local paths. The sanitized summary may contain only `repo_key`, path hash, canonical repository, counts, and SHAs.
5. Reconcile the operator claims, but treat them as unverified until observed:
   - 135 One Time worktrees / 37 dirty;
   - 45 BNA worktrees / 24 tracked-dirty;
   - BNA local-only candidates `3752ec1`, `a82f6c1`, `306aedab`, `a8d04246`;
   - legacy OneTimeOneTime candidate `ad4dd809`;
   - dirty HighLevel-registry and “BNA v2.0” checkouts.

Stop a repository if identity is ambiguous, a command would expose protected content, or an unmerged state makes safe patch capture uncertain.

## Phase 2 — preserve reviewed commit objects without touching sources

For every audited PR head and every observed local-only commit:

1. Verify object existence with `git cat-file -e <SHA>^{commit}`.
2. Record remote reachability without pruning.
3. Inspect changed-file names, modes, sizes, object classes, and migration names in protected output. Do not print file contents.
4. Run:
   - the repository's ordinary scanner with its exact stated coverage;
   - a protected non-echoing field-class scanner that reports repository/ref/path-or-object/class/count only;
   - binary/archive/untracked coverage classification. An uninspected binary is `incomplete`, not `passed`.
5. Create a new bare backup repository below `A05_PROTECTED_BACKUP_ROOT`; fetch the exact commit from the local source into a new internal ref. Do not add or change refs in the source checkout.
6. Create one bundle for the exact object/ref set, run `git bundle verify`, calculate SHA-256, and restore/read back the head in a disposable clone.
7. Set `remote_ref_eligible=true` only when:
   - canonical repository identity is exact;
   - the commit object is reviewed;
   - protected scan is complete and non-echoing;
   - no protected class, raw private content, or uninspected publication-sensitive binary blocks a new ref;
   - the object belongs to that repository.

For reviewed One Time PR heads, the only allowed new remote name pattern is:

`refs/heads/preserve/20260726/onetime/pr-<PR_NUMBER>-<SHORT_SHA>`

For reviewed BNA local-only commits, use only the BNA repository and:

`refs/heads/preserve/20260726/bna/<SANITIZED_PURPOSE>-<SHORT_SHA>`

Before pushing, use `git ls-remote --heads` and compare SHA. If absent, push once without force. If present at the same SHA, record it. If present at a different SHA, stop. Read back the remote SHA.

Do not push `a82f6c1` or any extracted One Time-like diff from BNA in this task. Preserve it in a protected bundle and mark `blocked_cross_repo`.

Do not choose a remote for `ad4dd809` until the legacy clone identity and target-repository decision are explicit.

## Phase 3 — preserve dirty work without committing it

For every dirty worktree:

1. Capture:
   - `git diff --binary --full-index --no-ext-diff`;
   - `git diff --cached --binary --full-index --no-ext-diff`;
   - NUL-safe porcelain status;
   - an untracked manifest containing protected relative path, path hash, mode/type, size, and SHA-256 when safely readable.
2. Never run `git add` or create a commit from the dirty tree.
3. Never blindly archive all untracked content.
4. Manifest only and stop copying when any condition applies:
   - protected/sensitive class;
   - binary not inspected by the protected process;
   - one file over 100 MiB;
   - aggregate untracked size over 1 GiB;
   - a directory over 10,000 entries;
   - symlink escapes repository root;
   - raw media/transcript/customer/Student/provider export;
   - unknown classification.
5. A reviewed untracked copy may be made only into the encrypted backup root and must be individually checksummed.
6. Validate tracked/index patches with `git apply --check` in a disposable clone at the recorded base. Do not apply them to any source worktree.
7. Re-read source status and prove its status hash is unchanged.

## Phase 4 — exact graph and semantic closure prerequisites

1. Re-prove every category C row with:
   `git merge-base --is-ancestor <PR_HEAD> 53a18e771488c61cf271cb33a0bcacee2c7135f4`
   A nonzero result downgrades the PR to hold and stops closure eligibility.
2. For every category B row, record the exact successor/evidence source named by A05 and preserve the original head even when behavior is represented.
3. Preserve #90 as a distinct diverged evidence head.
4. Hold #38, #42, #44, #79, #106, #116, #25, #109, and #110 for later semantic adjudication.
5. Do not infer equivalence from title, date, mergeability, shared base, green CI, or changed-file overlap.

## Phase 5 — sanitized repository manifest

Only after Phases 1–4 pass:

1. Create a fresh clean clone of `shloimie-beep/onetimev2` outside all existing worktrees.
2. Create `codex/repository-preservation-manifest-20260726` from exact checkpoint `e986b5e6502b1168b3eb28e200fd49ac8de46477`. Stop if the remote branch already exists at a different SHA.
3. Write only:
   - `ops/preservation/2026-07-26/A05/manifest.json`
   - `ops/preservation/2026-07-26/A05/SUMMARY.md`
   - `ops/preservation/2026-07-26/A05/REMOTE-REFS.json`
   - `ops/preservation/2026-07-26/A05/UNRESOLVED-BLOCKERS.json`
4. Conform `manifest.json` to `onetime.a05.protected_local_backup.v1`, but include only the sanitized projection. Protected paths, raw scan findings, patches, bundles, and restore clones remain off-repo.
5. State exact counts:
   - source files changed by this task;
   - remote preservation refs created/read back;
   - protected bundles;
   - dirty patches;
   - excluded untracked entries;
   - unresolved repository identities;
   - closure count = 0;
   - branch deletion count = 0;
   - worktree deletion count = 0;
   - reset count = 0;
   - prune count = 0;
   - auto-stash count = 0;
   - force-push count = 0.
6. Stage only those four exact paths. Never use broad add.
7. Run schema validation, scoped formatting, repository scan with coverage stated, and `git diff --check`.
8. Commit, push without force, and open one draft preservation PR.
9. Do not edit `ops/goals/**`, product code, GHL registries, BNA, PR metadata, or any provider.

## Required return

Return:

- preservation manifest commit and draft PR;
- frozen conductor and 105-PR head snapshot checksum;
- per-repository inventory counts;
- remote preservation refs and readback SHAs;
- protected bundle/patch artifact IDs and SHA-256 only;
- restore-test outcomes;
- all scan coverage states and blockers;
- exact status for the five operator-supplied local-only SHAs;
- explicit `PR_CLOSURE_AUTHORIZED=false`;
- all zero destructive-action counts.

Stop without partial closure on any ambiguity.

```

## 13. Exact Codex closure prompt — **NOT RUNNABLE UNTIL PRESERVATION PASSES**

```text
# NOT RUNNABLE UNTIL PRESERVATION PASSES
# A05 / OT-HYGIENE — CLOSE ONLY INDIVIDUALLY APPROVED SUPERSEDED PRS

This prompt is disabled unless all of the following exist:

1. accepted A05 audit result commit;
2. accepted A05 preservation-manifest commit/PR;
3. protected bundles/checksums and remote-ref readbacks for every target;
4. `OT-CONTROL` Board row assigning this exact closure task to `OT-HYGIENE`;
5. an explicit Board `close_authorized` list naming each PR number and exact head SHA;
6. no active preservation, product, GHL, Zoom, release, or control writer overlaps this task.

Canonical repository: `shloimie-beep/onetimev2`
Audited conductor: `53a18e771488c61cf271cb33a0bcacee2c7135f4`

Never close category A, D, E, or F from A05.

- Category A hold: 97, 105
- Category D hold: 38, 42, 44, 79, 106, 116
- Category E hold: 25, 109, 110

Only category B/C PRs may be considered, and only when individually present in the accepted Board close list.

Category B candidates:
3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 19, 20, 21, 22, 24, 26, 28, 29, 30, 31, 32, 34, 35, 36, 37, 41, 43, 45, 46, 47, 48, 49, 50, 51, 52, 54, 55, 56, 57, 58, 59, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 74, 75, 76, 77, 78, 80, 81, 82, 83, 84, 85, 86, 87, 88, 90, 104, 107, 113, 115, 117, 121, 122

Category C candidates:
1, 2, 17, 23, 27, 33, 39, 40, 53, 60, 61, 73, 89, 91, 92

## Absolute prohibitions

Do not merge, rebase, retarget, label, edit a PR body/title/base, delete a branch, delete a worktree, force-push, rewrite history, reset, prune, auto-stash, deploy, open a provider, send, enroll, mutate a database, or alter product/GHL/Board files.

Do not use any command option that deletes a branch after closing.

## Per-PR transaction

Process exactly one PR at a time.

1. Re-read current Board and PR metadata.
2. Verify:
   - PR is open;
   - current head exactly equals the Board-approved preserved head;
   - current base and title have not materially changed;
   - PR is not an active Board owner, dependency, or canonical lane;
   - no unresolved review thread, unique migration, unique protected evidence, or new commit exists;
   - preservation manifest identifies a verified bundle and either a reviewed remote preservation ref or an accepted local-only protected retention decision;
   - closure comment contains no protected metadata.
3. For category C, re-run:
   `git merge-base --is-ancestor <HEAD_SHA> <FROZEN_CURRENT_CONDUCTOR_SHA>`
   Require exit code 0. If the conductor moved, the Board must freeze and approve the new conductor SHA before continuing.
4. For category B, require:
   - exact successor/representation reference;
   - `representation_review=accepted`;
   - original head preserved;
   - evidence-only/diverged branches such as #90 have an accepted retention reason.
5. Recent/current-era category B PRs #90, #104, #107, #113, #115, #117, #121, and #122 require a separate explicit per-PR Board closure decision even when the general close list exists.
6. Render the applicable `CT-B` or `CT-C` template with exact SHA/ref/checksum/successor fields.
7. Post the single sanitized comment.
8. Close without merging and without deleting the branch.
9. Immediately read back PR state and preserved ref SHA.
10. Append one sanitized action record to:
    `ops/preservation/2026-07-26/A05/closeout.jsonl`
    in a fresh hygiene branch/worktree only after the GitHub action succeeds.

Stop the entire run on:

- any head drift;
- any preservation mismatch;
- active Board ownership;
- missing/changed review state;
- unknown migration/blob/evidence;
- new comments or checks that alter disposition;
- repository identity mismatch;
- failed GitHub readback;
- any request to expand beyond the Board close list.

## Closeout commit

Commit only the sanitized closeout ledger and summary on the assigned hygiene branch. Record:

- PR number;
- exact closed head;
- category;
- comment-template ID;
- preservation ref/bundle ID;
- successor/evidence reference;
- pre/post state;
- timestamp;
- branch_deleted=false;
- merged=false;
- force_push=false;
- reset=false;
- prune=false;
- worktree_deleted=false.

Return exact closed, skipped, drifted, and held lists. A skipped/held PR remains open.

```

## 14. Protected-local backup directory schema

```text
<A05_PROTECTED_BACKUP_ROOT>/
  A05-20260726/
    manifest.json
    manifest.schema.json
    SHA256SUMS
    repositories/
      <repo_key>/
        repository-record.json
        status/
          status.porcelain-v2.z
          worktree-list.txt
          refs.txt
        objects/
          protected-object-store.git/
          bundles/
            <artifact_id>.bundle
        patches/
          tracked-worktree.patch
          index.patch
        untracked/
          manifest.jsonl
          reviewed-copy/
        scans/
          protected-scan.json
        restore/
          restore-proof.json
    sanitized/
      SUMMARY.md
      remote-refs.json
      unresolved-blockers.json

```

Rules:

- The backup root is encrypted and outside repositories, worktrees, sync roots, public folders, and the sanitized Git branch.
- Raw paths, raw remote URLs, patches, bundles, scan matches, reviewed untracked files, and restore clones remain protected-local.
- The committed projection contains only opaque IDs, hashes, counts, safe repository/ref names, coverage states, and blockers.
- A hash/fingerprint of a credential, private destination, Student/contact/media ID, or protected match is itself protected unless the schema explicitly requires a non-correlatable artifact checksum.

## 15. Exact protected-local backup manifest JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:onetime:a05:protected-local-backup-manifest:v1",
  "title": "A05 protected local backup manifest",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schema_version",
    "audit_id",
    "created_at_utc",
    "backup_root_policy",
    "repositories",
    "artifacts",
    "remote_preservation_refs",
    "gates"
  ],
  "properties": {
    "schema_version": {
      "const": "onetime.a05.protected_local_backup.v1"
    },
    "audit_id": {
      "const": "A05"
    },
    "created_at_utc": {
      "type": "string",
      "format": "date-time"
    },
    "backup_root_policy": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "outside_all_repositories",
        "outside_sync_roots",
        "at_rest_protection",
        "path_not_committed"
      ],
      "properties": {
        "outside_all_repositories": { "const": true },
        "outside_sync_roots": { "const": true },
        "at_rest_protection": {
          "enum": ["encrypted_volume", "encrypted_archive"]
        },
        "path_not_committed": { "const": true }
      }
    },
    "repositories": {
      "type": "array",
      "items": { "$ref": "#/$defs/repositoryRecord" }
    },
    "artifacts": {
      "type": "array",
      "items": { "$ref": "#/$defs/artifactRecord" }
    },
    "remote_preservation_refs": {
      "type": "array",
      "items": { "$ref": "#/$defs/remoteRefRecord" }
    },
    "gates": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "no_dirty_source_mutation",
        "no_auto_stash",
        "no_reset",
        "no_prune",
        "no_force_push",
        "one_time_bna_separated",
        "protected_scan_complete",
        "bundle_verify_complete",
        "checksum_verify_complete",
        "disposable_restore_check_complete",
        "sanitized_summary_reviewed",
        "board_acceptance"
      ],
      "properties": {
        "no_dirty_source_mutation": { "const": true },
        "no_auto_stash": { "const": true },
        "no_reset": { "const": true },
        "no_prune": { "const": true },
        "no_force_push": { "const": true },
        "one_time_bna_separated": { "const": true },
        "protected_scan_complete": { "type": "boolean" },
        "bundle_verify_complete": { "type": "boolean" },
        "checksum_verify_complete": { "type": "boolean" },
        "disposable_restore_check_complete": { "type": "boolean" },
        "sanitized_summary_reviewed": { "type": "boolean" },
        "board_acceptance": { "type": "boolean" }
      }
    }
  },
  "$defs": {
    "sha1OrSha256": {
      "type": "string",
      "pattern": "^[0-9a-f]{40}([0-9a-f]{24})?$"
    },
    "sha256": {
      "type": "string",
      "pattern": "^[0-9a-f]{64}$"
    },
    "repositoryRecord": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "repo_key",
        "product_scope",
        "source_path_sha256",
        "canonical_repository",
        "remote_identity_state",
        "git_object_format",
        "head_sha",
        "branch_state",
        "upstream_state",
        "status_artifact_id",
        "dirty_state",
        "local_only_commits",
        "untracked_policy",
        "protected_scan"
      ],
      "properties": {
        "repo_key": {
          "type": "string",
          "pattern": "^[a-z0-9][a-z0-9._-]{2,80}$"
        },
        "product_scope": {
          "enum": ["one_time", "bna", "one_time_legacy_clone", "unknown"]
        },
        "source_path_sha256": { "$ref": "#/$defs/sha256" },
        "canonical_repository": {
          "enum": [
            "shloimie-beep/onetimev2",
            "shloimie-beep/bnei-neviim-academy",
            "unresolved"
          ]
        },
        "remote_identity_state": {
          "enum": ["exact", "historical_owner_alias", "mismatch", "missing", "unresolved"]
        },
        "remote_url_sha256": { "$ref": "#/$defs/sha256" },
        "git_object_format": {
          "enum": ["sha1", "sha256"]
        },
        "head_sha": { "$ref": "#/$defs/sha1OrSha256" },
        "branch_state": {
          "enum": ["named", "detached", "unborn", "unresolved"]
        },
        "branch_name": { "type": ["string", "null"], "maxLength": 300 },
        "upstream_state": {
          "enum": ["exact", "ahead", "behind", "diverged", "none", "unresolved"]
        },
        "ahead_count": { "type": ["integer", "null"], "minimum": 0 },
        "behind_count": { "type": ["integer", "null"], "minimum": 0 },
        "status_artifact_id": { "type": "string" },
        "dirty_state": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "tracked_worktree_dirty",
            "index_dirty",
            "unmerged",
            "untracked_count",
            "submodule_dirty"
          ],
          "properties": {
            "tracked_worktree_dirty": { "type": "boolean" },
            "index_dirty": { "type": "boolean" },
            "unmerged": { "type": "boolean" },
            "untracked_count": { "type": "integer", "minimum": 0 },
            "untracked_aggregate_bytes": { "type": ["integer", "null"], "minimum": 0 },
            "submodule_dirty": { "type": "boolean" }
          }
        },
        "local_only_commits": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "sha",
              "object_exists",
              "remote_reachability",
              "content_review_state",
              "remote_ref_eligible",
              "bundle_artifact_id"
            ],
            "properties": {
              "sha": { "$ref": "#/$defs/sha1OrSha256" },
              "object_exists": { "type": "boolean" },
              "remote_reachability": {
                "enum": ["reachable", "local_only", "unresolved"]
              },
              "content_review_state": {
                "enum": ["passed", "blocked_sensitive", "blocked_binary", "blocked_cross_repo", "not_reviewed"]
              },
              "remote_ref_eligible": { "type": "boolean" },
              "bundle_artifact_id": { "type": ["string", "null"] },
              "semantic_notes_id": { "type": ["string", "null"] }
            }
          }
        },
        "untracked_policy": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "manifest_artifact_id",
            "blind_archive_created",
            "reviewed_copy_artifact_ids",
            "excluded_entry_count",
            "stop_reasons"
          ],
          "properties": {
            "manifest_artifact_id": { "type": "string" },
            "blind_archive_created": { "const": false },
            "reviewed_copy_artifact_ids": {
              "type": "array",
              "items": { "type": "string" }
            },
            "excluded_entry_count": { "type": "integer", "minimum": 0 },
            "stop_reasons": {
              "type": "array",
              "items": {
                "enum": [
                  "sensitive_class",
                  "binary_uninspected",
                  "single_file_over_100_mib",
                  "aggregate_over_1_gib",
                  "directory_over_10000_entries",
                  "symlink_escape",
                  "unknown"
                ]
              },
              "uniqueItems": true
            }
          }
        },
        "protected_scan": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "state",
            "scanner_mode",
            "text_coverage",
            "binary_coverage",
            "untracked_coverage",
            "finding_counts_by_class",
            "values_echoed"
          ],
          "properties": {
            "state": {
              "enum": ["passed", "blocked", "incomplete", "not_run"]
            },
            "scanner_mode": { "type": "string", "maxLength": 200 },
            "text_coverage": {
              "enum": ["complete", "partial", "none"]
            },
            "binary_coverage": {
              "enum": ["protected_inspection_complete", "classified_uninspected", "none"]
            },
            "untracked_coverage": {
              "enum": ["manifest_and_review_complete", "manifest_only", "none"]
            },
            "finding_counts_by_class": {
              "type": "object",
              "additionalProperties": {
                "type": "integer",
                "minimum": 0
              }
            },
            "values_echoed": { "const": false },
            "report_artifact_id": { "type": ["string", "null"] }
          }
        }
      }
    },
    "artifactRecord": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "artifact_id",
        "repo_key",
        "artifact_type",
        "relative_path",
        "sha256",
        "size_bytes",
        "at_rest_protected",
        "contains_protected_material",
        "remote_push_eligible",
        "review_state"
      ],
      "properties": {
        "artifact_id": {
          "type": "string",
          "pattern": "^[A-Za-z0-9._-]{3,120}$"
        },
        "repo_key": { "type": "string" },
        "artifact_type": {
          "enum": [
            "git_bundle",
            "working_tree_patch",
            "index_patch",
            "status_porcelain_v2_z",
            "ref_inventory",
            "object_inventory",
            "untracked_manifest_jsonl",
            "reviewed_untracked_archive",
            "protected_scan_report",
            "checksum_manifest",
            "restore_proof",
            "semantic_review"
          ]
        },
        "relative_path": {
          "type": "string",
          "pattern": "^(?!/)(?!.*\\.\\./).+$"
        },
        "sha256": { "$ref": "#/$defs/sha256" },
        "size_bytes": { "type": "integer", "minimum": 0 },
        "at_rest_protected": { "const": true },
        "contains_protected_material": { "type": "boolean" },
        "remote_push_eligible": { "type": "boolean" },
        "review_state": {
          "enum": ["passed", "blocked", "incomplete", "not_applicable"]
        },
        "restore_check": {
          "enum": ["passed", "failed", "not_run", "not_applicable"]
        }
      }
    },
    "remoteRefRecord": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "canonical_repository",
        "ref",
        "sha",
        "review_state",
        "preexisting_ref_state",
        "force_used",
        "readback_sha"
      ],
      "properties": {
        "canonical_repository": {
          "enum": [
            "shloimie-beep/onetimev2",
            "shloimie-beep/bnei-neviim-academy"
          ]
        },
        "ref": {
          "type": "string",
          "pattern": "^refs/heads/preserve/20260726/(onetime|bna)/[A-Za-z0-9._/-]+$"
        },
        "sha": { "$ref": "#/$defs/sha1OrSha256" },
        "review_state": { "const": "passed" },
        "preexisting_ref_state": {
          "enum": ["absent", "same_sha"]
        },
        "force_used": { "const": false },
        "readback_sha": { "$ref": "#/$defs/sha1OrSha256" }
      }
    }
  }
}
```

## 16. Source list

### 16.1 Current control truth

- Repository `shloimie-beep/onetimev2`
- Commit `e986b5e6502b1168b3eb28e200fd49ac8de46477`
- Conductor head `53a18e771488c61cf271cb33a0bcacee2c7135f4`
- PR #97
- `ops/goals/CURRENT.yaml`
- `ops/goals/OT-LAUNCH-01/GOAL.md`
- `ops/goals/OT-LAUNCH-01/SPEC.yaml`
- `ops/goals/OT-LAUNCH-01/ACCEPTANCE.yaml`
- `ops/goals/OT-LAUNCH-01/BOARD.yaml`
- `ops/goals/OT-LAUNCH-01/DECISIONS.yaml`

### 16.2 Historical convergence and evidence

- PRs #1–#92 listed in the manifest, especially #17, #23, #39, #54, #60, #61, #73, #89, #90, #91, and #92
- `artifacts/OT-99/preflight/candidate-adjudication.json`
- `artifacts/OT-99/release-manifest.json`
- `ops/codex-runs/OPS-09/FLEET-REPORT.md`
- `ops/codex-runs/OPS-10/FINAL-REPORT.md`
- `ops/codex-runs/W12-99/FINAL-REPORT.md`
- `ops/codex-runs/W12-100-CONVERGENCE/FINAL-REPORT.md`
- `ops/codex-runs/W12-100-CONVERGENCE/RELEASE-MANIFEST.json`

### 16.3 Current-era PRs

- PRs #104, #105, #106, #107, #109, #110, #113, #115, #116, #117, #121, and #122
- Direct compare snapshots described in `EV-GRAPH-90`, `EV-GRAPH-106`, and `EV-TISHA-DIVERGENCE`

### 16.4 Prior audits and execution contract

- `A01-result.md`
- `A04-result.md`
- `A06-result.md`
- `one-time-bna-parallel-execution-prompt-pack-2026-07-26.md`, including fixed writer slots, E03 preservation, and E08 closure gate

### 16.5 Historical repository-name caveat

Some historical records name `webcraft-media/onetimev2`. A05 treats those names as provenance only. All new remote preservation actions require an exact current-remote identity match to `shloimie-beep/onetimev2`; BNA preservation requires a separate exact match to `shloimie-beep/bnei-neviim-academy`.

## 17. Final determination

**CONFIRMED CURRENT TRUTH.** No PR, branch, worktree, file, provider object, deployment, or database was changed by A05.

**CONFIRMED CURRENT TRUTH.** The only immediate executable repository-hygiene work is Board-assigned preservation. Closure remains unauthorized.

**UNPROVEN.** Local dirty-work and local-only-commit safety remains unresolved until the protected census and backup manifest pass.

```yaml
CONTROL-TOWER-RETURN
audit_id: A05
audit_title: PR, branch, clone, and worktree preservation/closure audit
result_path: ops/audits/2026-07-26/parallel-control-tower/A05-result.md
audit_date: 2026-07-26
mode: read_only
repository: shloimie-beep/onetimev2
control_checkpoint: e986b5e6502b1168b3eb28e200fd49ac8de46477
conductor_pr: 97
audited_conductor_head: 53a18e771488c61cf271cb33a0bcacee2c7135f4
accepted_deployed_product_source: a22009f4dce6bae6b0553ea9007ff40eceaffd25
open_pr_count: 105
category_counts:
  A_keep_open: 2
  B_preserve_then_close: 79
  C_exact_ancestor_candidate: 15
  D_semantic_review: 6
  E_duplicate_conflict: 3
  F_unknown_unsafe: 0
active_keep_open_prs:
  - 97
  - 105
exact_ancestor_candidates: [1, 2, 17, 23, 27, 33, 39, 40, 53, 60, 61, 73, 89, 91, 92]
primary_new_findings:
  - pr_90_diverged_with_9_unique_evidence_commits
  - pr_106_diverged_and_current_head_differs_from_board_authorized_head
  - prs_109_110_diverged_conflicting_visual_lineages
  - prs_42_44_current_heads_exceed_older_integrated_heads
local_inventory_status: UNPROVEN
preservation_writer: OT-HYGIENE
preservation_board_assignment_required: true
closure_board_assignment_required: true
closure_prompt_runnable: false
semantic_review_required_prs: [38, 42, 44, 79, 106, 116]
duplicate_conflict_prs: [25, 109, 110]
remote_preservation_ref_policy: reviewed_objects_only_non_force
dirty_work_policy: protected_patch_bundle_manifest_no_commit
one_time_bna_separation_required: true
history_rewrite_authorized: false
pr_closures_performed: 0
pr_comments_performed: 0
branches_deleted: 0
worktrees_deleted: 0
resets_performed: 0
prunes_performed: 0
auto_stashes_performed: 0
force_pushes_performed: 0
next_safe_action: >
  Board-assign A05-T01 through A05-T04 to the single OT-HYGIENE writer, complete
  protected local inventory and exact-head preservation, then return the
  sanitized preservation manifest for acceptance. Do not run closure before
  that acceptance.
END-CONTROL-TOWER-RETURN
```
