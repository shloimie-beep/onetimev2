# W12-03 Decisions

- Use PR #61 head `release/ops10-full-staged-production-launch-20260717T050800Z` at `c7d46066517d7a458d189f2c782cc06200f7861c` as the current accepted release source.
- Keep the feature in the isolated worktree `C:\Users\User\OneTimeOneTime-w12-03-portal-test-lab` on branch `codex/w12-03-portal-test-lab`.
- Make the Portal Test Lab test-only by default and guard it from production runtime exposure.
- Use owner/admin sessions only for the lab status/reseed surface. Do not provide any role impersonation or "view as" affordance.
- Use separate fictional parent and student accounts for journey proof. Do not reveal current passwords or token secrets in the visible lab page, screenshots, registry, or run artifacts.
- Do not deploy, send messages, charge cards, mutate production users, or access production databases.
