# OT-71R Decisions

## 2026-07-15 Initial Packet

- Use `dfef7de2035e08f1ee72e0133ccf656fe7a74444` as the immutable base because the fetched PR #17 ref resolves exactly to that commit.
- Treat stale OT-60R control values as accepted non-blocking metadata drift, as authorized by the prompt.
- Do not edit `ops/execution/registry.json`, `ops/execution/control/CANONICAL-CANDIDATE.json`, or any OT-60R control packet on the OT-71 branch.
- Use `C:\Users\User\OneTimeOneTime` only as the Git anchor for worktree operations; implement all OT-71 changes in `C:\Users\User\OneTimeOneTime-ot71-product-core-train`.
- Keep all live/provider actions disabled; implement provider-neutral interfaces and deterministic local sinks/mocks where needed.

## 2026-07-15 Phase 1

- Implement class occurrence scheduling as a product-core domain module, not a provider transport module.
- Keep public signup commit-first by running class fulfillment scheduling after the lead transaction commits; if the class scheduling step fails, the public signup remains saved.
- Treat School submissions as lead-only: no class occurrence, fulfillment intent, reminder, access target, or portal entitlement.
- Use `provider_unavailable` protected launch descriptors until OT-72 supplies provider transports; do not expose Zoom/provider URLs or raw class targets.
- Extend existing sink delivery contracts for class reminders instead of introducing a second delivery path.

## 2026-07-15 Phase 2

- Use migration namespace `1400` for OT-71 content-library tables because it was free on the Phase 2 branch state.
- Implement content outcome admission as an authenticated local sink endpoint plus domain service, not as a live Vimeo/provider webhook.
- Store provider event/source references only as SHA-256 digests and recursively redact URL-shaped/provider metadata before persistence or response serialization.
- Model publication and entitlement separately: portal adapters return only items with a published revision and an active entitlement.
- Use app-relative protected action descriptors for content/review access; do not return raw playback URLs or provider launch targets.
- Keep content ingestion deterministic and idempotent: exact replay returns the stored response, changed-byte replay returns an idempotency conflict, older revisions are recorded as stale/superseded without changing the item head.

## 2026-07-15 Phase 3

- Reuse canonical account, password hashing, TOTP MFA, session, security-version, and durable rate-limit primitives instead of introducing a second auth runtime.
- Model lifecycle links separately from learner profiles so a learner profile can be connected to a distinct canonical student login identity.
- Persist only SHA-256 token hashes and safe delivery metadata; proof-mode raw tokens are returned only from the immediate local service response.
- Keep lifecycle delivery default-off and sink-only for OT-71; no emails, provider identity calls, or real credential sends are performed.
- Require privileged owner/admin invitation acceptances to complete through the existing TOTP MFA flow.
- Treat parent management as lifecycle control over student setup/reset/suspend/restore, not as permission to retrieve student secrets or enter a student session.

## 2026-07-15 Phase 4

- Mount the recovered OT-52 portal module through the main web app instead of creating a parallel portal server.
- Resolve portal subjects from durable canonical tables: guardian relationships for parents and learner identity links for students.
- Add a default parent dashboard endpoint for the app shell while keeping household-specific deep links privacy-safe.
- Use Phase 1 class and Phase 2 content adapters directly; portal launch/open actions remain protected descriptors with no raw provider URLs.
- Map portal student access operations to Phase 3 lifecycle functions and return only digest-safe operation references.
- Keep billing disabled by default and keep support/helper behavior local or unavailable until later owner-enabled transports exist.

## 2026-07-15 Phase 5

- Reuse the existing authenticated CRM app bundle for owner/admin dashboard shell routes instead of creating a separate admin frontend runtime.
- Build dashboard status from bounded local APIs/tables and return `Needs setup` or `Unavailable` for missing/non-enabled sources instead of exposing fake reports or fabricated healthy states.
- Include Classes, Content/Library, Communications, CRM, and Products/Billing status because those have real local bounded sources; exclude Studio, agent fleets, BNA internals, Coming Soon controls, tasks, and reports because no working source exists here.
- Treat Products/Billing as read-only readiness/projection status; no checkout, portal activation, payment transport, charges, or provider mutation controls are exposed.
- Make the visible-action registry a server-owned contract so routes/buttons/forms can be checked against role, capability, handler, idempotency, audit, and UI state metadata.
- Keep portal/account setup as dashboard status only until a real owner/admin portal-account management route exists.
