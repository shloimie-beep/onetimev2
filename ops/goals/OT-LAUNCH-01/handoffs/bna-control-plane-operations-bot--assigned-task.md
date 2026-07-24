# OT-LAUNCH-01 — BNA Control-Plane Operations Bot

## Assignment and decision guard

- Task: `BNA-CONTROL-PLANE-OPERATIONS-BOT-01`
- Repository: `shloimie-beep/bnei-neviim-academy`
- Start with an architecture decision and threat model, not a broad mutation.
- This packet never changes the One Time status model.

The operator wants a personal operations bot with broader visibility than the
One Time Rabbi bot. Existing BNA policy currently limits the control-plane bot
to non-PII alerts/links and forbids mutations, Codex, deployment, and provider
writes. Do not silently override that boundary.

First produce one replacement ADR defining:

- distinct bot identity/token/allowlist/lease;
- redacted data classification and allowed status reads;
- exact mutation allowlist, if any;
- re-authentication and two-step confirmation;
- idempotency, audit, rate limits, kill switch, and emergency revoke;
- explicit prohibition on raw secrets, shell access, arbitrary Codex prompts,
  product sessions/cookies, customer transcripts, and direct One Time DB writes.

Safe initial acceptance is a notifier/read-only status bot using opaque case
references, counts, and HTTPS links. Forbidden callbacks are rejected/audited;
missing ownership/allowlist keeps delivery off; BNA outage cannot affect One
Time. Any later mutation or Codex control requires separate acceptance of the
ADR and one bounded capability at a time.
