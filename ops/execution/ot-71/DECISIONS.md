# OT-71R Decisions

## 2026-07-15 Initial Packet

- Use `dfef7de2035e08f1ee72e0133ccf656fe7a74444` as the immutable base because the fetched PR #17 ref resolves exactly to that commit.
- Treat stale OT-60R control values as accepted non-blocking metadata drift, as authorized by the prompt.
- Do not edit `ops/execution/registry.json`, `ops/execution/control/CANONICAL-CANDIDATE.json`, or any OT-60R control packet on the OT-71 branch.
- Use `C:\Users\User\OneTimeOneTime` only as the Git anchor for worktree operations; implement all OT-71 changes in `C:\Users\User\OneTimeOneTime-ot71-product-core-train`.
- Keep all live/provider actions disabled; implement provider-neutral interfaces and deterministic local sinks/mocks where needed.
