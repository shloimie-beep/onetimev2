# W12-100-04 Apply / Rollback Schema Proposal

This is a non-executable proposal for a later reviewed lane. W12-100-04 does
not implement apply mode and does not write to any database.

## Proposed Inputs

- `approved_preflight_report_sha256`: hash of the counts-only W12-100 source
  preflight report.
- `approved_source_group_fingerprint`: fingerprint from the preflight report.
- `expected_counts`: exact row, identity, disposition, manual-review, and
  suppression counts approved by the operator.
- `operator_authorization_statement`: explicit statement binding the report
  hash, counts, target environment, rollback plan, and allowed mutation budget.
- `target_environment`: `local`, `test`, `staging`, or `production`; production
  must require a separate explicit lane and fresh backup proof.
- `idempotency_key`: stable key for replay safety.

## Proposed Apply Batch Record

```json
{
  "apply_batch_key": "legacy_apply_batch_<fingerprint>",
  "source_preflight_report_sha256": "<sha256>",
  "approved_source_group_fingerprint": "<fingerprint>",
  "target_environment": "staging",
  "mode": "apply",
  "status": "planned | authorized | applied | blocked | rolled_back",
  "expected_counts": {
    "total_rows": 0,
    "unique_identity_count": 0,
    "matched_existing_contact": 0,
    "stage_new_contact": 0,
    "duplicate_input": 0,
    "no_op": 0,
    "manual_review": 0,
    "do_not_contact": 0
  },
  "manual_review_terminal_statuses": {
    "missing_email_and_missing_phone": "done | already_satisfied | blocked | needs_operator_decision"
  },
  "mutation_budget": {
    "contacts_created": 0,
    "contacts_updated": 0,
    "facts_inserted": 0,
    "suppression_records_inserted": 0,
    "sends_queued": 0,
    "provider_mutations": 0
  },
  "raw_values_included": false,
  "production_side_effects": false
}
```

## Proposed Rollback Ledger

- Record only affected internal IDs or irreversible fingerprints, never source
  row values or destinations.
- Store reversible operations per approved batch: contact creates, contact
  field updates, fact inserts, suppression inserts, tag changes, and audit
  events.
- Rollback must be forward-only and scoped to the exact apply batch key.
- Suppression and opt-out precedence may not be weakened by rollback.

## Hard Stops For The Future Lane

- Preflight report hash mismatch.
- Count mismatch.
- Any unresolved manual-review category.
- Missing protected backup proof.
- Production target without explicit production authorization.
- Any request to emit source row values, private destinations, message bodies,
  raw links, tokens, or provider payloads.
- Any external send or provider mutation outside a separately approved canary
  budget.
