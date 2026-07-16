# OT-86A Contract Validation

Packet id: OT-86A  
Branch: codex/ot86a-vimeo-content-kb  
Base SHA: a02d1d254ae0d17804fb657079a7871567260ea2  
Head SHA: pending until commit/push  
Generated UTC: 2026-07-15T17:15:21.808Z

## Runtime Schemas

- `packages/contracts/src/content/pipeline.ts`
- `ot86ContentPublishManifestSchema`
- `ot86ApprovedForSocialEventSchema`
- `ot86RetrievalResponseSchema`
- `ot86PublishHeadersSchema`
- `ot86ProviderReadinessSchema`

## Fixture Matrix

| Fixture                                                 | Expected | Evidence                                   |
| ------------------------------------------------------- | -------- | ------------------------------------------ |
| `content-publish-manifest.valid.json`                   | Valid    | `OT-86A contract schemas` test passed.     |
| `content-publish-manifest.revoke.valid.json`            | Valid    | `OT-86A contract schemas` test passed.     |
| `content-publish-manifest.learner-data.invalid.json`    | Invalid  | Schema rejects learner/private-data flags. |
| `content-approved-for-social.valid.json`                | Valid    | `OT-86A contract schemas` test passed.     |
| `content-approved-for-social.learner-face.invalid.json` | Invalid  | Schema rejects learner face/privacy flag.  |

## Integrity

- `signOt86Manifest` signs raw canonical JSON bytes with HMAC-SHA256.
- `receiveOt86PublicationManifest` validates delivery id, timestamp freshness, key id, raw-body signature, JSON schema, and manifest checksum before durable receipt.
- `validateOt86ManifestChecksum` recomputes checksum from manifest content without `manifest_sha256`.
- Duplicate identical deliveries return idempotent acknowledgement; changed bytes for same delivery/idempotency key return conflict.

## Compatibility

Contracts are versioned under `contracts/content-pipeline/v1/`. Runtime schemas keep unknown extension out of critical validation paths and require explicit version/id/action fields for publication and social events.
