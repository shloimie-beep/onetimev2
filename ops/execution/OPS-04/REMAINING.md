# OPS-04 Remaining Work

1. Done: repository audit written to `ops/evidence/OPS-04/REPOSITORY-AUDIT.md` and `.json`.
2. Done: additive OPS-04 migration, contracts, domain model, normalization, matching, consent/suppression, dry-run, apply, rollback, replay, reconciliation totals, and no-send guard tooling implemented.
3. Done: CLI surfaces expose aggregate and synthetic evidence only. Authenticated CRM/API production surfaces remain intentionally blocked until real source/staging authorization exists.
4. Done: deterministic synthetic fixtures and focused tests cover acceptance rows.
5. Done: source-independent verification passed and final state is `waiting_for_source_export`.

## Blocked For Real Import

- Final integrated CRM schema/source export is unavailable in the repository.
- Production import authorization is absent.
- Campaign send authorization is absent and no send tooling was implemented.
- Real row access authorization path and `OPS04_FINGERPRINT_HMAC_KEY` are absent.
- Staging database marker/fingerprint is absent; only synthetic in-memory rehearsal was executed.
