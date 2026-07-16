# OT-86B Contract Validation

Packet id: OT-86B<br>
Branch: codex/ot86b-buffer-social<br>
Base SHA: 87a1bb7ffd6a2fa0d016a1831894d430aa2ee065<br>
Current head SHA: pending until final commit/push<br>
Generated UTC: 2026-07-15T17:50:30Z

## Contract Bundle

- Source bundle copied to `contracts/social-publishing/v1/`.
- Runtime schemas implemented in `packages/contracts/src/social/publishing.ts`.
- `ot86bApprovedForSocialEventSchema` reuses OT86A `ot86ApprovedForSocialEventSchema` to preserve event compatibility.

## Fixture Matrix

- `content-approved-for-social.valid.json`: accepted after recomputing payload checksum in test.
- `content-approved-for-social.learner-question.invalid.json`: rejected by schema/privacy.
- `social-draft.valid.json`: accepted by `ot86bSocialDraftRevisionSchema`.
- `social-draft.privacy-failed.invalid.json`: rejected.
- `buffer-publish-command.valid.json`: accepted by `ot86bBufferPublishCommandSchema`.
- `buffer-publish-command.revision-mismatch.domain-invalid.json`: schema-valid shape but rejected by domain validation with `REVISION_APPROVAL_MISMATCH`.

## Runtime Paths

- Event route: `receiveOt86bSocialEvent`.
- Draft revision checksum: `validateOt86bDraftRevisionChecksum`.
- Publish command validation: `validateOt86bPublishCommand`.
- Readiness response: `ot86bReadinessResponseSchema`.
- Draft list response: `ot86bSocialDraftListResponseSchema`.

## Result

Contract fixture validation passed in `tests/integration/social/ot86b-social-publishing.test.ts`; command exit 0, 7 tests passed.
