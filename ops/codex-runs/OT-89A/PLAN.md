# OT-89A Plan

| Step                                                                                                                                                                       | Status      | Acceptance                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------- |
| Validate packet integrity, copied contract, schema example, base branch, and GitHub auth.                                                                                  | Done        | CONTRACT-01, BASE-01                          |
| Discover existing auth, account, entitlement, CSRF, rate limit, routes, migrations, worker, storage, logging, feature flags, public WhatsApp path, and OT84 HMAC patterns. | In progress | TASK-01, SCOPE-01                             |
| Add support contract/types, redaction, normalization, HMAC signing, event serialization, retry policy, and config loading.                                                 | Pending     | CONTRACT-01, PRIV-01, OUTBOX-03               |
| Add database migration and repository/service layer for submissions, attachments, outbox, attempts, status projection, and audit.                                          | Pending     | MIG-01, OUTBOX-01                             |
| Add authenticated support route/action/status/attachment endpoints and UI.                                                                                                 | Pending     | AUTH-01 through AUTH-05, UI-01, STATUS-01     |
| Add worker/reconciler delivery and status refresh.                                                                                                                         | Pending     | ASYNC-01, OUTBOX-02, OUTBOX-03, STATUS-01     |
| Add focused unit/integration/accessibility/security tests and run required checks.                                                                                         | Pending     | All OT89A rows                                |
| Update run records, commit, push, and open draft PR.                                                                                                                       | Pending     | TASK-01, GIT-01, MUT-01, DEPLOY-01, RESUME-01 |
