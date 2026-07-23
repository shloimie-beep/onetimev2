# Tisha B'Av 2026 Narrow Production Release

## Scope

- Canonical repository: `shloimie-beep/onetimev2`
- Release branch: `release/tisha-bav-2026-live`
- Base target: `codex/one-time-finish-now-20260719`
- Live runtime base: `ed77a04dd24391d5b79be7f839d7f5752a57e0f9`
- Runtime scope: Tisha landing, registration, protected live access, event email catalog, and event-scoped HighLevel delivery
- Database scope: additive migrations `2210_tisha_bav_event_funnel` and `2211_tisha_bav_provider_event_scope`
- Full application production deployment: excluded

## Preflight

- Fresh PostgreSQL 18 production backup and restore proof deployment: `2d24a95d-9b84-4040-9e22-cde1932e9d47`
- Backup run ID: `tisha-bav-prod-pg18-20260722T073452Z`
- Backup service and live web service resolve to the same protected database
- Build and typecheck: passed
- Tisha unit tests: 4 passed
- Tisha integration tests: 10 passed
- Scoped lint: passed
- Secret scan: passed
- Repository-wide Windows formatting check: pre-existing baseline backlog; the Tisha source packet was formatted on its source branch

## Provider Boundary

- HighLevel workflow `a34ea513-4612-4f53-8bd8-49e89e6610f9` is published
- One operator-owned confirmation was executed in the PR preview
- OT-C01 remains draft with zero recipients and zero messages sent
- No second production registration is authorized or required
- No broad message, live charge, real student mutation, or unrelated provider mutation is part of this release

## Rollback

Runtime rollback is an exact-source rebuild to `ed77a04dd24391d5b79be7f839d7f5752a57e0f9`. The two event migrations are additive; database restore is a separately authorized last resort.
