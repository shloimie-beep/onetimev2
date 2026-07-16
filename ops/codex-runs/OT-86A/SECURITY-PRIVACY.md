# OT-86A Security And Privacy

Packet id: OT-86A  
Branch: codex/ot86a-vimeo-content-kb  
Base SHA: a02d1d254ae0d17804fb657079a7871567260ea2  
Head SHA: pending until commit/push  
Generated UTC: 2026-07-15T17:15:21.808Z

## Summary

- Internal publication endpoint authenticates server-to-server HMAC, not browser/user session.
- Durable receipt is written before `202`; invalid signatures do not project content.
- Retrieval authorizes tenant/principal entitlements before search.
- Learner/private-data flags block approval, KB eligibility, and social handoff.
- Raw learner questions are not stored in retrieval audit rows.
- Secret scan passed and provider error redaction is tested.

## Negative Matrix

| ID        | Evidence                                                                                                                           |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| A-NEG-001 | App route requires valid HMAC headers; invalid/missing signature path returns `401` before projection in OT-86A HTTP/domain tests. |
| A-NEG-002 | `authenticates raw bytes...` test covers invalid HMAC `401` and unchanged projection.                                              |
| A-NEG-003 | `receiveOt86PublicationManifest` enforces 300-second timestamp freshness; covered by HMAC validation test path.                    |
| A-NEG-004 | Same delivery/idempotency with changed bytes returns conflict; covered by replay/conflict test.                                    |
| A-NEG-005 | Duplicate identical delivery returns duplicate acknowledgement without duplicate projection rows.                                  |
| A-NEG-006 | `applyNextOt86Publication` waits on sequence gaps; stale/future version is not exposed.                                            |
| A-NEG-007 | Manifest checksum validation rejects mismatches; runtime helper and tests cover checksum recomputation.                            |
| A-NEG-008 | Retrieval query filters active published KB documents only; revoke test removes active retrieval results.                          |
| A-NEG-009 | Cross-tenant retrieval returns denied/abstained without content details.                                                           |
| A-NEG-010 | Same-tenant unentitled retrieval returns denied/abstained.                                                                         |
| A-NEG-011 | Retrieval corpus is supplied only from published OT-86A documents and entitlement content ids.                                     |
| A-NEG-012 | Publication endpoint accepts only signed manifests matching schemas; arbitrary web/text cannot enter KB.                           |
| A-NEG-013 | Learner-name/private flags block approval in schemas/domain approval gate.                                                         |
| A-NEG-014 | Learner voice, face, question, and private-data flags are rejected by approval/social schemas and tests.                           |
| A-NEG-015 | Retrieval ignores prompt-injection text as instructions; authorization/citation rules are enforced outside document body.          |
| A-NEG-016 | Unsupported/no-match query abstains and returns no fabricated citation.                                                            |
| A-NEG-017 | Retrieval response schema requires citations for non-abstained responses.                                                          |
| A-NEG-018 | Revoke/correct projection marks prior rows inactive; retrieval after revoke is blocked.                                            |
| A-NEG-019 | Immutable approval blocks update-in-place; correction requires new version.                                                        |
| A-NEG-020 | Provider event receipt dedupes duplicate normalized events.                                                                        |
| A-NEG-021 | Changed provider replay bytes create conflict; invalid provider auth is sanitized and rejected at boundary.                        |
| A-NEG-022 | Provider error redaction test plus `npm run secret:scan` passed.                                                                   |
| A-NEG-023 | Missing Vimeo config yields `status=unconfigured`, manual reference capability, and `READY_FOR_VIMEO_CANARY`.                      |
| A-NEG-024 | Published retrieval and local projection tests run with no BNA network dependency.                                                 |
| A-NEG-025 | No BNA Operations/runtime imports were added; server-only provider/canary code is not client-bundled.                              |
| A-NEG-026 | Retrieval audit stores metadata only, not raw question text.                                                                       |
| A-NEG-027 | Authorization failure audit stores safe reason/outcome without raw question.                                                       |
| A-NEG-028 | Migration foundation test covers migration-chain behavior and pg-mem rerun limitation without duplicate schema objects.            |
| A-NEG-029 | OT-86A publication/projection tests pass without any OT-86B consumer.                                                              |
| A-NEG-030 | Approved-for-social event emits only after immutable approval and privacy attestation.                                             |

## Secret Handling

`npm run secret:scan` passed. The canary prints only missing capability labels or a shortened account fingerprint; it never prints token values.
