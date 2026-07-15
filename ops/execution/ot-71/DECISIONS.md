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
