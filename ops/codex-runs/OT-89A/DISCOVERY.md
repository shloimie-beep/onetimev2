# OT-89A Discovery

Initial base evidence:

- Remote base branch exists: `refs/heads/codex/ot84-telegram-action-gateway`
- Resolved remote base commit: `f98103ecc3660dbda871a91485656e17580940a8`
- Local OT-89A worktree: `C:/Users/User/.onetime-worktrees/OT-89A`
- Local branch: `codex/ot89a-subscriber-support-producer`
- Initial HEAD: `f98103ecc3660dbda871a91485656e17580940a8`

Packet evidence:

- Packet zip: `C:/Users/User/Downloads/OT89-support-bridge-codex-packets.zip`
- Packet zip SHA-256: `249d3a3e9db51ace2ab58d22db049753777c962474d323f0c30d477fdd967f1a`
- Contract SHA-256: `cfcd0ac55cbf9e59d7fefc7779af1aa5112fb410ee510882cb843492a556e512`
- `SHA256SUMS.txt` matched every required packet file.
- Contract example validates against the JSON Schema and negative cases reject unknown field, unknown category, wrong event type, and wrong contract version.

Repository architecture notes will be filled during discovery before product code edits.

Required discovery checklist:

- Auth/session/account ownership:
- CSRF and API conventions:
- Entitlement model and transaction semantics:
- Account navigation and branded UI:
- Public WhatsApp lead path:
- Existing support/help/contact routes and indexing:
- Database migrations and repository conventions:
- Worker, queue, retry, dead-letter, health:
- Private storage and upload validation:
- Logging, audit, redaction, metrics:
- OT84 action-gateway/HMAC patterns:
- Feature flags/staged rollout:
- Test framework, fakes, time controls, concurrency:
