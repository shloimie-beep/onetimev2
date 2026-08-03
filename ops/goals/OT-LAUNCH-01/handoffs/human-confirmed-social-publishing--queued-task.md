# OT-LAUNCH-01 — Human-Confirmed Social Publishing

## Queue

- Task: `OT-LAUNCH-01-SOCIAL-PUBLISHING-01`
- Repository: `shloimie-beep/onetimev2`
- Planned branch: `codex/human-confirmed-social-publishing`
- Start after the communication and structured-prompt contracts converge.

## Contract

Converge the two existing social draft/provider ledgers into one canonical
provider-neutral draft, immutable revision, approval, schedule, delivery, and
readback model. Do not create a third ledger.

Add authenticated UI/API actions for edit, preview, approve, schedule, cancel,
and retract. Approval binds the exact revision, channels, assets, and scheduled
time; any edit invalidates it. A leased idempotent worker owns provider calls,
retry/backoff, and readback.

Telegram may show the exact post and ask for confirmation. Confirming records
or queues the approved job; Telegram never calls the provider directly.

Near-term channel is Facebook text/image. Verify whether the connected GHL
Social Planner supports the exact provider/account/channel operation before
building an adapter. If it does not, report unsupported rather than pretending
Buffer and GHL are equivalent. YouTube remains a separate verified-provider
decision and may not be claimed from an enum or mock.

## Acceptance

- Zero provider calls before exact human confirmation.
- Revision/time/channel/asset edits invalidate approval.
- Replay delivers once; cross-scope access is denied.
- Provider failure retries safely and reads back a sanitized result.
- Unsupported YouTube is truthful.
- UI buttons write the real canonical ledger, not an audit-only `sink_queued`
  placeholder.
- No auto-posting, broad campaign, account creation, Studio generation, or
  production publish canary in this packet.
