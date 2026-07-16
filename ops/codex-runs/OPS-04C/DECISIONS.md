# OPS-04C Decisions

## 2026-07-16T21:35Z - Use OPS-03B as integration base

- Decision: Created the isolated worktree at `C:\Users\User\.batch-20260716-worktrees\OPS-04C` from `origin/codex/ops03b-email-step-up-login` at `25b2a95aa4e3ae82aad20537dc300e9978c15b56`.
- Reason: The batch prompt named final green OPS-03B as the preferred base, and the email step-up login policy supersedes the earlier authenticator flow.

## 2026-07-16T22:00Z - Preserve no-authenticator policy

- Decision: Kept owner/admin login on password plus email step-up/trusted device, left parent/student as password-only, and retained retired MFA endpoints as generic `410 AUTH_METHOD_RETIRED` responses.
- Reason: OPS-03B explicitly replaced the prior TOTP path. During lint cleanup, the unused `createMfaChallengeForUser` helper was removed because no live route calls it anymore.

## 2026-07-16T22:20Z - Renumber leaf migrations instead of coalescing them

- Decision: Preserved `2010_ops03b_email_step_up_login.sql`, then renumbered branch-colliding leaf migrations to `2011` through `2014`; kept later `2160` and `2190` migrations unchanged.
- Reason: This keeps each worker's migration content auditable while restoring deterministic migration order.

## 2026-07-16T22:45Z - Wire provider readiness into Content workspace without provider mutation

- Decision: Replaced OT-110A provider-off-only status ports in the web app with `createOt110aIntegratedProviderPorts(config)`.
- Reason: OPS-04C must converge the completed provider runtimes. The statuses expose readiness for Vimeo, Buffer, Telegram, and helper knowledge while `can_mutate_provider` remains false.

## 2026-07-16T23:10Z - Bridge OT-109 publisher records into Content admin source listing

- Decision: Added an OT-109 fixed-scope read bridge into the OT-110A source overview. Bridge-only OT-109 rows are visible as admin source summaries but excluded from OT-110A generation eligibility unless they also have an OT-110A content revision.
- Reason: PR #48/OT-109 owns its own publisher pipeline and fixed `rabbi_sheller_provider` scope. Surfacing its records in Content admin is required, but OT-110A deterministic generation expects the older content revision shape.

## 2026-07-16T23:35Z - Repair browser gates with UI-label alignment

- Decision: Changed the login step-up field label from `Email code` to `Verification code` so existing `Email` locators resolve only to the username field. Updated the OT-83R student e2e question flow to the current private-question preview/send UI.
- Reason: The convergence introduced accessible-name overlap, and the old OT-83R e2e assertion targeted labels that the current UI no longer renders.

## 2026-07-17T00:15Z - Do not deploy staging without linked isolated project

- Decision: Did not run Railway deployment.
- Reason: `railway status` reports no linked project in this isolated worktree, and required protected runtime variables are absent or unproven. Deployment would not be safely attributable to an isolated One Time staging boundary.
