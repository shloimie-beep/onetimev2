# Zoom embedded canary — operator handoff

Date: 2026-08-09
Result branch: `codex/ot-p2-zoom-canary-result-20260809`
Status: failed closed at Zoom registration readback; full cleanup complete with zero active effects

## Preserved facts

- Existing S2S app: **One Time One Timev4**.
- Existing General / Meeting SDK app: **One Time Zoom Stage Host**.
- S2S credentials were previously matched to protected key-holder material.
- Meeting SDK is enabled.
- Canonical production origin: `https://app.onetimeonetime.com`.

## Operator-changed facts

- Railway production service `one-time-web` now has canonical Zoom provider flags, the existing S2S mapping, the existing Meeting SDK mapping, the allowed origin, the host user mapping, and the exact operator-owned canary learner mapping.
- Learner mapping before correction (names only): `ZOOM_CLASSROOM_CANARY_LEARNER_KEY` was sourced from the legacy acceptance field `learnerRef`.
- Learner mapping after correction (names only): `ZOOM_CLASSROOM_CANARY_LEARNER_KEY` is sourced from `identity-authorization.private.json -> recipients.student.learner_key`.
- Production operator-canary configuration is permitted only for the exact allowlisted learner in the dedicated verification environment; broad or missing learner configuration remains fail-closed.
- The canonical operator Admin credential and password hash were not changed. This was verified after the Railway mapping update.

## Runtime source identity

- Railway project: `one-time-production` (`ce55ef20-1418-4ad3-aafa-f877fb992dc8`).
- Railway environment: `production` (`f911acfc-e206-44df-a569-9d69d709b94b`).
- Railway service: `one-time-web` (`d175ad94-5e3c-41c2-8cbc-daa1a299077d`).
- Deployment: `f2d0401e-4936-448b-bd4d-5e7753136a35` — `SUCCESS`.
- Deployment source: `railway up` from the local working tree on `codex/ot-p2-zoom-canary-20260809`, based on integration SHA `5154a5764bc778fec9db0f3ebc98ab5901809c24`.
- Runtime probes: `/health` **200**, `/ready` **200**, `/version` **200**.

## Effect ledger

- Zoom meetings created: **2**; deleted: **2**; remaining: **0**.
- Zoom registrants created: **0**.
- Attendance records created: **0**.
- GHL Student contacts created or modified: **0**.
- Customer notifications sent: **0**.
- Secrets recorded in this handoff: **0**.

## Merge/deploy readiness

- PR #143 was finally rebased without conflicts from integration head `9acd6903af359352a5057129493316d0ebf99e43` onto owner-login-green integration head `9c54591ce11b133eb773ccbd9c5e7003c515f782`.
- The final integration delta did not modify any of PR #143's three files, so no conflict-resolution judgment or scope expansion was required.
- The only newly derived fixture was `tests/integration/accounts/v21-owner-admin-session.postgres.test.ts`, matching the integrated live-console/Zoom-host shell resolver change. It collected as one test and safely skipped locally because no isolated PostgreSQL harness was enabled; exact-head hosted PostgreSQL and CI validation is required.
- Focused local validation after the final rebase passed: **13 unit files / 195 tests**, **4 Zoom integration files / 25 tests**, TypeScript type checking, and Git diff whitespace validation.
- PR #143 was merged and deployed at exact integration SHA `6a51b08cfe36e5fdf08b520f253ed4b76808c63b`. Controller-owned web deployment `8968720b-5c44-438f-83c4-8a4fdc169e76` and delivery deployment `098c2077-a9d9-4977-a068-84e168d4afd8` were `SUCCESS` before the bounded canary attempt.
- Admin/account, access projection, enrollment, Student credential, Zoom provider, and customer-notification mutations performed by this rebase: **0**.
- The owner-login journey is green. PR #143 remains draft until the controller authorizes merge/deploy and a separate bounded canary path.

## Live canary execution ledger

- `2026-08-09T14:02:03.797Z` — A short-lived canonical `free_pilot` projection was applied only to the operator household. Readback was `active`, access version was **1**, revoked-session count was **0**, and payment-history writes were **false**.
- `2026-08-09T14:02:32.323Z` — A random temporary credential was installed only for the selected operator Student using an exact compare-and-swap. Password and security versions each advanced by **1**; pre-login session revocations were **0**. The original 26-field Student access-state row remains held for exact restoration.
- `2026-08-09T14:03:34.026Z` — `ZOOM_CLASSROOM_CANARY_ENABLED` was set to **true** only on the production web service after exact learner-key readback. Same-image deployment `e4b5f640-ff7e-411a-8f82-ecb6e66bd6a7` was created; no worker flag or provider mapping changed.
- A single operator-test disposable class series and one occurrence were created through the authenticated Admin API. No learner was enrolled and no Zoom meeting existed at this checkpoint.
- Enrollment failed closed with `NOT_FOUND` before any enrollment write because the exact allowlisted learner is active in a different product scope and no learner row exists for that learner in the deployed classroom product. The learner mapping and provider configuration were not changed.
- The disposable occurrence cancellation API exposed a persisted-state spelling mismatch (`cancelled` API value versus `canceled` database constraint) and returned `500` without changing the occurrence. Reconciliation proved the occurrence was still scheduled and provider state was still `not_requested`; the exact operator-test occurrence, its single audit row, and its now-empty archived series were then removed directly and transactionally.
- `2026-08-09T14:18:41.132Z` — Cleanup completed: canonical `free_pilot` access is inactive (`paused`, version **2**), the exact original 26-field Student access-state row was restored, active portal and live-class Student sessions are **0**, and the temporary credential no longer exists.
- `ZOOM_CLASSROOM_CANARY_ENABLED` was restored to **false** only on the web service. Same-image rollback deployment `2556ecba-2db0-4780-9969-c7117396fddf` is `SUCCESS`; `/health`, `/ready`, and `/version` each returned **200**.
- Final effects: Zoom meetings **0**, Zoom registrants **0**, active class enrollments **0**, attendance records **0**, active access projections **0**, GHL Student-contact changes **0**, and customer notifications **0**.
- The Admin credential and password hash remain unchanged.

## Authorized target-product correction

- Controller authorized only the smallest reversible projection of the exact same allowlisted operator Student into the deployed `ONE_TIME_PRODUCT_KEY`; the learner binding was not changed and no alternate learner was created.
- Pre-state: one active operator learner and its exact 26-field Student access row existed in the prior portal product scope; the deployed classroom product contained **0** rows for that exact learner.
- The prior learner row, exact Student access row, and **3** access-operation rows are held in memory for byte-for-byte field restoration. No other learner exists in the operator household.
- Post-projection readback: exactly **1** active learner, **1** active parent-managed Student access row, **1** active Student user/link, and **1** active primary-guardian ownership relationship exist in the deployed classroom product for the same allowlisted learner key.
- The correction is isolated to temporary operator-owned portal projection rows. Billing, GHL, customer households, customer learners, notifications, the learner binding, and the Admin credential remain unchanged. `ZOOM_CLASSROOM_CANARY_ENABLED` remains **false** at this gate.
- A bounded canonical `free_pilot` projection was applied only to the temporary operator household in the deployed product: readback `active`, access version **1**, sessions revoked **0**, and payment-history writes **false**.
- One new operator-test disposable series and occurrence were created and exactly one enrollment was applied for the allowlisted learner. Database readback showed **1** active entitlement and **0** other learners. At that checkpoint, provider inventory remained zero and the canary guard remained **false**.
- Guard deployment `72e02a74-452e-458e-9b8a-6a578fcaacff` is `SUCCESS`; the exact learner guard read back enabled and `/health`, `/ready`, and `/version` returned **200**.
- The synthetic-acceptance API and then the production REST adapter each failed closed before a provider call: production synthetic resources are restricted to isolated staging, and the OT-103 adapter hard-blocks production. Reconciliation proved **0** meetings and **0** registrants after both gates.
- Under the controller's explicit one-meeting production authorization, the same protected S2S mapping was used for one direct bounded provider call. Exactly **1** disposable scheduled Zoom meeting was created and its private material was immediately encrypted into the canonical occurrence resource; raw start/join URLs were not retained or recorded.
- Zoom normalized the new meeting to registration-disabled. One accepted registration-settings update did not change that provider readback, and two Student registrant requests failed with a known `400` before creating a registrant. The exact non-joinable meeting was then deleted successfully (`204`), its encrypted material was cleared, and the canonical resource was marked `deleted`; meetings remaining **0**, registrants created **0**.
- The exact-learner canary guard was returned to **false** at the hold checkpoint, with provider inventory back at zero.
- Controller authorized exactly one replacement creation, with registration enabled in the initial payload. Immediate provider `GET` again returned `approval_type=2`, no registration type, and no registration URL. Per the fail-closed gate, no registrant request was made for the replacement and no embedded host/Student launch was attempted.
- The replacement was deleted successfully and both created meeting references now return provider `404`. Total provider inventory at cleanup: meetings **0**, registrants **0**.
- Full cleanup restored the exact zero-effect baseline: the temporary entitlement, occurrence, series, Zoom resource, access projection, Student user/link, guardian relationship, learner projection, and household were removed. The original learner row, original 26-field Student access row, and all **3** original access-operation rows match their pre-canary snapshots exactly.
- Active portal Student sessions **0**, live classroom sessions **0**, attendance events **0**, attendance projections **0**, GHL Student-contact changes **0**, and customer notifications **0**. The learner binding, billing, customer records, and Admin credential/hash were not changed.
- Final guard-off deployment `8c2743a4-7a76-406f-a7ea-c55150a8d8c9` is `SUCCESS`; exact flag readback is **false** and `/health`, `/ready`, and `/version` are **200**.

## Remaining delta

- Enable a production-operator-canary provision/delete path in application code, or run the disposable proof in an actual isolated-staging runtime; the deployed OT-103 REST adapter currently hard-blocks production provider calls and the synthetic create/delete APIs are isolated-staging-only.
- Prove the configured Zoom host/account supports meeting registration at initial creation. Both authorized production meetings were normalized by Zoom to registration-disabled despite explicit `approval_type: 1` and `registration_type: 1` on the replacement.
- Fix the separate occurrence-state spelling defect (`cancelled` API contract versus `canceled` database constraint).
- Only after those prerequisites are green, rerun the single embedded host/Student join, same-device reconnect, second-device denial, and one attendance reconciliation proof.

All credentials, account identifiers, learner keys, meeting identifiers, and join material are intentionally redacted.
