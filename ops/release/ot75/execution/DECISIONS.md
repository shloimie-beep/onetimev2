# OT-75 Decisions

- Keep OT-75 in `ops/release/ot75`, `ops/observability/ot75`,
  `scripts/ot75`, `tests/unit/ot75`, and the unique OT-75 workflow only.
- Do not use root package scripts for OT-75 commands.
- Treat missing Railway credentials, staging domain, and staging database as
  activation-only blockers, not local preparation blockers.
- Keep `join.onetimeonetime.com` as the transitional domain. Root-domain
  cutover requires a later explicit packet.
- Use count/status-only observability. Raw private data and secret values are
  forbidden in evidence.
