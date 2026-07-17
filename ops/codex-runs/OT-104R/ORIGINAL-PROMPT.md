# OT-104R Original Prompt

Source packet:
`C:\Users\User\AppData\Local\Temp\codex-one-time-batch-20260716-safe\One-Time-Immediate-Access-and-Content-Batch-2026-07-16\OT-104R-VIMEO-PRIVATE-RUNTIME\CODEX-PROMPT.md`

## User Lane Instruction

Worker OT-104R for the One Time batch. Execute only this lane in the external
repo, not BNA.

- Current date: 2026-07-16.
- External repo: `C:\Users\User\onetimev2`.
- Base branch/ref:
  `origin/codex/ops03-staging-readiness-repair` at
  `fb5f5eebc539afc9e93833e9417ee67524d62c36`.
- Branch: `codex/ot104r-vimeo-private-runtime`.
- Worktree: `C:\Users\User\.batch-20260716-worktrees\OT-104R`.
- Implement the private Vimeo provider runtime for Rabbi Scheller/One Time.
- Missing Vimeo credentials block only the real canary, not implementation,
  sink tests, commit, push, or draft PR.

## Packet Mission

Implement the real, private Vimeo provider boundary for Rabbi Scheller's One
Time content pipeline. This is not Academy content and must never read or write
BNA content. The result must support private source registration/upload,
provider status, text-track/transcript ingestion, webhook reconciliation, and a
tightly allowlisted staging canary while remaining fully testable in
provider-off mode.

## Required Behavior Summary

- Scope every record and provider request to `rabbi_sheller_provider` /
  `one_time_mishnah_class`.
- Support registering an existing approved private Vimeo video or initiating a
  controlled upload flow without exposing bearer tokens or unrestricted upload
  credentials to the browser.
- Persist opaque provider IDs, privacy/processing state, duration/metadata,
  text-track identifiers, revision hashes, and redacted error state.
- Poll/reconcile safely with idempotency, bounded retries/backoff, leases,
  terminal states, and operator retry.
- Verify Vimeo webhook authenticity with shared-secret HMAC, content type,
  timestamp/replay, request size, and event allowlists.
- Record unknown events minimally and acknowledge safely.
- Retrieve approved text tracks server-side, validate size/type/encoding,
  normalize without changing source meaning, and store source revision hashes.
- Do not expose private provider URLs, download URLs, tokens, webhook secrets,
  provider payloads, or raw credentials in HTML/API JSON/logs/evidence.
- Produce protected playback/access projections for a later server-authorized
  route.
- Provider-off and sink modes must be deterministic and complete.
- Real-provider mode is off by default and fails closed when configuration is
  incomplete.
- Run focused/applicable tests, commit, push, and open a draft PR when possible.
