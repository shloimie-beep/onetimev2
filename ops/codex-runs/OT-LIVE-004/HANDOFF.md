# OT-LIVE-004.01 source checkpoint

- Task: `019fcc0b-177e-7361-8823-9059dd8a8eb0`
- Claim: `2fd3bc9c-9cfb-48da-85f1-5b62aab07322`
- Writer: `codex-ot-live-004-01-media-source-2fd3bc9c`
- Control commit: `eb085d6e0d1a32039d6514c90c49e0b1b14a83fa`
- Source base: `ffd1c55a50c5b16402f3dcbcbef4cb4464edcfb4`
- Branch: `codex/ot-live-004-media-pipeline-20260804`

## Source outcome

- Direct app upload is explicitly the primary ingest path; Drive is optional and cannot block the primary path.
- Versioned `OT-MANAGED-ORIGINAL-1` evidence can bind the managed-object readback and recovery journal across bucket, object-key digest, object version, byte count, SHA-256, KMS key version, and storage class while preserving compatibility with the accepted P19 seam.
- Direct and Drive confirmations reject incomplete or internally inconsistent versioned durability evidence and invalid journal chronology.
- Processing rejects cross-account/product Admin commands before provider work and can resume an interrupted deterministic operation after its durable backoff. It reconciles the same operation IDs and does not issue another completed receipt.
- A pure one-recording canary readback gate reuses P19/P20/P21 records to require one direct-upload original, approved processing artifacts, reconciled private publication, protected five-minute Student playback, Parent/sibling/revoked/unpublished denial, and exact provider-effect budgets. Optional Drive `provider_off` is nonblocking.

## Verification

- Path census: 17 changed paths, all authorized (2 contracts, 8 domain, 1 database schema contract, 3 worker, and 3 run-record paths).
- Focused Vitest: 13 files, 95 tests passed, including the held web ingest/publication interface tests.
- Scoped ESLint: passed.
- Repository TypeScript typecheck: passed.
- Prettier on every changed TypeScript file: passed.
- `git diff --check`: passed.
- Secret scan: passed across 3,224 repository text files.

No launch, integration, provider, upload, or deployment completion is claimed by this source checkpoint.
