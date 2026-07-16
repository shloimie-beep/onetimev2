# OPS-04 Repository Audit

## Scope

- Repository: `webcraft-media/onetimev2`
- Worktree: `C:/Users/User/.ops04-worktrees/OPS-04`
- Branch: `codex/ops-04-legacy-audience-migration`
- Base: `origin/codex/ot85-whatsapp-lead-assistant`
- Packet: `OPS-04-20260716-fd38cbd7`

## Findings

- Existing OT-74 audience reconciliation was dry-run oriented and useful as a reference, but did not provide OPS-04 requirements for full source-file manifest binding, HMAC row provenance, reversible apply/replay/rollback ledger, stronger conflict quarantine, or explicit no-send side-effect proof.
- Existing public lead capture upsert overwrote canonical fields on same-email conflict. OPS-04 patched this so CRM-owned records keep canonical fields and replacement phones are not accepted for public WhatsApp outbox unless the public-signup path actually owns/accepted the phone.
- No final production source export, row-access authorization, HMAC key, staging marker, or campaign-send authorization exists in this checkout.

## Implemented Controls

- Additive OPS-04 tables only; no destructive migration and no runtime schema creation.
- Dry-run reports expose source row numbers, internal keys, hashes, HMACs, dispositions, tags, action plans, channel snapshots, and totals. They do not expose raw names, emails, or phone numbers.
- Apply/replay/verify/rollback are synthetic/staging rehearsal ledger operations only.
- No contact, outbox, WhatsApp provider, invitation, access grant, or payment mutation is performed by OPS-04 tooling.
- Consent and suppression states are preserved in append-only channel-state projections, with suppression taking precedence.

## Blockers

- Real import remains blocked on final source export and explicit authorization.
- Production sends remain blocked and were not implemented.
- Authenticated CRM/API production surfaces should remain disabled until source/staging authorization exists.
