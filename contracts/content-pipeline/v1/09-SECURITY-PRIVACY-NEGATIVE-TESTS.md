# Required security, privacy, isolation, and failure tests

Each id below must map to an automated test or a documented repository-level static assertion. Record test names and results in `SECURITY-PRIVACY.md`.

| ID        | Required negative case and expected result                                                                        |
| --------- | ----------------------------------------------------------------------------------------------------------------- |
| A-NEG-001 | Unauthenticated publish request is rejected before inbox application.                                             |
| A-NEG-002 | Valid body with invalid HMAC is `401`; no projection/index mutation occurs.                                       |
| A-NEG-003 | Signature timestamp outside 300 seconds is rejected.                                                              |
| A-NEG-004 | Same delivery id with different bytes is `409`, audited, and never overwrites.                                    |
| A-NEG-005 | Duplicate identical delivery is idempotent and creates no duplicate section/index rows.                           |
| A-NEG-006 | Out-of-order publication sequence does not expose the future or stale version incorrectly.                        |
| A-NEG-007 | Manifest checksum or artifact checksum mismatch blocks publication.                                               |
| A-NEG-008 | Unapproved, review-needed, failed, corrected, revoked, or retired content is excluded from KB.                    |
| A-NEG-009 | Cross-tenant principal receives no result and no content-existence oracle.                                        |
| A-NEG-010 | Same-tenant but unentitled principal receives no result.                                                          |
| A-NEG-011 | Sibling/private ticket or unrelated BNA record cannot be selected by retrieval.                                   |
| A-NEG-012 | Arbitrary web URL/text cannot be added to the KB through the content endpoint.                                    |
| A-NEG-013 | Learner name flag blocks approval, publication, social event, and index insertion.                                |
| A-NEG-014 | Learner voice, face, question, or private-data flag independently blocks the same paths.                          |
| A-NEG-015 | Prompt-injection text in an approved section cannot change authz, tools, citation, or corpus rules.               |
| A-NEG-016 | Unsupported question abstains and has no fabricated citation.                                                     |
| A-NEG-017 | Non-abstained answer without a valid active section citation is rejected by response validation.                  |
| A-NEG-018 | Revocation/correction removes active index entries, invalidates cache, and blocks an in-flight stale answer.      |
| A-NEG-019 | Approved version update-in-place is rejected; correction requires a new version id.                               |
| A-NEG-020 | Duplicate provider webhook/poll event creates one state transition and one processing job.                        |
| A-NEG-021 | Provider webhook with invalid signature, account mismatch, or changed replay bytes is rejected.                   |
| A-NEG-022 | Vimeo token/secret embedded in an exception never appears in logs, reports, snapshots, or UI.                     |
| A-NEG-023 | Missing Vimeo configuration yields a readiness state/manual fallback, not a success toast or enabled dead action. |
| A-NEG-024 | One Time classroom/library/search/helper routes work with BNA network blocked after publication.                  |
| A-NEG-025 | One Time client and server delivery bundles contain no BNA UI/operations runtime import.                          |
| A-NEG-026 | Raw learner question is absent from durable memory/audit storage under default configuration.                     |
| A-NEG-027 | Authorization failure is recorded without storing raw question text.                                              |
| A-NEG-028 | Migration rerun is safe or refused by the migration framework without duplicate schema objects.                   |
| A-NEG-029 | OT-86A publication completes when no OT-86B consumer is deployed.                                                 |
| A-NEG-030 | `content.approved_for_social` is not emitted before immutable approval and privacy attestation.                   |
