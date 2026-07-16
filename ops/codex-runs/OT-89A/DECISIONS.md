# OT-89A Decisions

## DEC-OT89A-001 - Use the packet contract as frozen authority

Decision: copy `SUPPORT-EVENT-CONTRACT.json` byte-for-byte and treat it as immutable. Any application types or fixtures must be checked against this committed file rather than regenerating it.

Evidence: `ops/codex-runs/OT-89A/SUPPORT-EVENT-CONTRACT.json`, `ops/codex-runs/OT-89A/CONTRACT-SHA256.txt`.

## DEC-OT89A-002 - Work from isolated worktree

Decision: implement in `C:/Users/User/.onetime-worktrees/OT-89A` on `codex/ot89a-subscriber-support-producer`, based on the exact remote OT84 commit.

Evidence: `git ls-remote` and `git rev-parse HEAD` both resolved `f98103ecc3660dbda871a91485656e17580940a8`.

## DEC-OT89A-003 - No production mutation

Decision: OT-89A may create a branch, push commits, and open a draft PR. It may not deploy or mutate production secrets/configuration. Delivery tests must use local fake or mock BNA endpoints.

Evidence: packet deployment/canary rule and `EXTERNAL-MUTATIONS.md`.

## DEC-OT89A-004 - Entitlement gate source

Decision: One Time support submission requires an authenticated session plus a scoped `billing_entitlement_projections` row with `principal_type = 'account_user'` and `status = 'active'`. The transaction also checks the latest subscription projection and rejects when `current_period_end` is in the past. The existing `grants_access` column is intentionally not used because the billing migration constrains it to `false`.

Evidence: `packages/domain/src/support/service.ts`, `tests/integration/support/ot89a-subscriber-support.test.ts`.

## DEC-OT89A-005 - Real BNA delivery fail-closed

Decision: OT-89A implements only `disabled` and deterministic `mock` support delivery modes. Production rejects non-disabled support delivery configuration. Subscriber submission never waits for BNA; only the worker sends the signed event asynchronously.

Evidence: `packages/config/src/index.ts`, `packages/domain/src/support/worker.ts`, `tests/integration/support/ot89a-subscriber-support.test.ts`.

## DEC-OT89A-006 - Attachment storage seam

Decision: Attachments are normalized and stored as private local blobs in `support_attachments`; the signed event contains only opaque `onetime-private-blob://ota_...` locators. BNA mock retrieval requires the separate reverse-HMAC key and only succeeds after the signed event is delivered.

Evidence: `packages/domain/src/support/attachments.ts`, `packages/domain/src/support/service.ts`, `tests/integration/support/ot89a-subscriber-support.test.ts`.
