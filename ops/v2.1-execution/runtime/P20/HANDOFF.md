# P20 Handoff

## Identity

- Branch: `codex/v21-p20-media-processing`
- Start SHA: `ebf88c8e422a6ad40202fc2b0249810d312edc30`
- Prior atomic claim head: `6f894038117ee19d405e528670eb8bf86e8682b2`
- Implementation head: `e366ef926d6b2ee3be888eaae9fe2cad08b8a57f`
- Collision-correction atomic claim: `0d58c8e4d6ca0263273d540bfd722586d8a1b5d3`
- Corrected implementation head: `3cf5543b7fe2dde3118d35ce655e105dbd771a60`
- Final metadata head: derive with `git rev-parse HEAD`; C00 records the pushed head
- Reconciled containing control: `a5851edf70f3c60cc25ece3faf124bedf1629f21`
- READY state base: `9d343f5b5990e0d5c38b2dc53f660b7377e2d64b`
- READY payload: `ba07246d1f3ed1d91828512ed588feca1f0b647928b2afb8b0e132aef3ae86ea`
- Claim: `e8c768e8-f603-4d0c-a45b-34b5cd7ea92c`
- Released CONTENT_PROCESSING lease: `24d0fa6f-30ac-4fc0-af2a-2b495d826063`
  at `2026-07-30T07:19:30Z`, before its `2026-07-30T07:30:12Z` expiry

## Correction boundary

The corrected implementation changes only these five authorized source paths:

- `packages/contracts/src/content/processing/index.ts`
- `packages/db/src/content/processing/repository.test.ts`
- `packages/db/src/content/processing/repository.ts`
- `packages/domain/src/content/processing/content-processing.acceptance.test.ts`
- `packages/domain/src/content/processing/index.ts`

The five-path inventory digest is
`9a70f8864d7807d5ea26728a5835e10d489f91ed77f28f76f3458629cc3492ef`;
its integration-base manifest is
`eb01ac38bce07dd88f77b1e91d1899878d77edc6c2520a9769eec88ba3d900e8`.
The exact corrected Git-blob digest is
`ac8a6038c4a97a3b9347fd9a29cd9977ba24b3a0bddd294b862ccce65b9efe9c`.
The final checkpoint additionally changes only the P20 runtime triplet.
Migration 2246, steward requests, acceptance matrix, runner, service, registry,
configuration, manifests, lockfiles, providers, and every P21 path are unchanged.

`P20-MIGRATION-001` is already applied and acknowledged in integration release
`3cf787409decb5beb84561ef7e37924111d398b6`, with canonical result digest
`0f4260f833f65dab0a093f254585e9647bc98e231d540ae803cd5b60512d8363`.
Migration 2246 and every P20 steward request remain byte-identical.

P21 remains withheld pending corrected P20 finalization, independent audit, and
integration. No P21 path is authorized here.

## Completed behavior

P20 implements a bounded, checksum-bound processing vertical from confirmed P19
source through `needs_review`. It validates the preserved versioned
`eu-central-1` S3/SSE-KMS readback; records OBS-only consent/notice/device/upload
evidence and the safe local-deletion gate; applies Admin begin/end trim; builds
shell-free, orientation-aware, no-upscale `OT-VIDEO-1` ffmpeg argv; validates
exact derivative readback; plans bounded checksum-addressed English
transcription segments; rejects missing, overlapping, malformed, refused,
truncated, uncertain, ungrounded, or wrong-version output; generates traceable
captions and strict review/worksheet/knowledge drafts; supports immutable Admin
edits and exact-version privacy approval; and persists restart-safe
retry/dead-letter and idempotent receipt state.

Every trim, video, transcript, caption, review, worksheet, and knowledge artifact
is a draft on creation. P20 contains no publication or Student-visibility
operation.

The collision correction adds a read-only
`ApprovedForPublicationProjection` keyed by exact `accountKey`, `productKey`,
and `contentVersionId`. It binds the approved source identity, SHA-256, object
version, controlled participant snapshot, approving Admin and time, and a
deterministic digest of exactly one latest approved revision for each of the
seven required artifact kinds. The repository uses typed composite parameters
and positional SQL parameters only; no request body selects scope. Domain
validation fails closed on nonapproved, missing, duplicate, stale, cross-scope,
source, artifact, or participant mismatches.

## Realized contracts and digests

- `CONTENT_PROCESSING_CONTRACT_VERSION`: `2.1.0`
- `OT_VIDEO_1_PROFILE`: `OT-VIDEO-1`
- Transcription: `OT-TRANSCRIBE-1` / `gpt-4o-transcribe` / language `en`
- Learning drafts: `OT-LEARNING-DRAFT-1` /
  `gpt-4.1-mini-2025-04-14` / strict `OT-LEARNING-DRAFT-SCHEMA-1`
- Schema contract: `P20-CONTENT-PROCESSING-SCHEMA-001`
- Contract file digest:
  `cb557d145186ca9a1b32f19f0dac8410a9fb18bde9cbd4da094f8997cad27159`
- Schema contract digest:
  `7486ba836282a8f8caf453033286f5e8f8f57d65c95ae9aa914f644774e53fb9`
- Twelve-artifact implementation digest:
  `d58ec3c6e3b3acb0b956525fcf7aeed4ddcafa22b392e5e707c98e079efe6249`
- Five-artifact collision-correction digest:
  `ac8a6038c4a97a3b9347fd9a29cd9977ba24b3a0bddd294b862ccce65b9efe9c`
- Steward-request digest:
  `821607d4c16a4627650ff1bf44ef435fb817d90a07ddf5e94f916269a988e01a`

Primary exported symbols include `ApprovedForPublicationProjection`,
`buildApprovedForPublicationProjection`, `OT_VIDEO_1_PROFILE`,
`OT_TRANSCRIBE_1_OPERATION`, `OT_LEARNING_DRAFT_1_OPERATION`,
`OT_LEARNING_DRAFT_JSON_SCHEMA`, `ContentProcessingRepository`,
`validateProcessingInput`, `validateControlledCapture`,
`localCaptureDeletionDecision`, `selectTrim`, `buildTranscodePlan`,
`verifyDerivative`, `buildAudioSegmentPlan`, `validateTranscriptDraft`,
`validateLearningDraft`, `createDraftArtifacts`, `editDraftArtifact`,
`approveProcessingVersion`, `createContentProcessingRepository`,
`ContentProcessingRunner`, `digestBoundedMediaStream`,
`buildFfprobeReadbackPlan`, and `parseFfprobeReadbackJson`.

## Verification

- Full workspace typecheck: passed.
- Focused correction suite: 2 files, 13 tests, all passed.
- Correction cases cover success, exact replay, nonapproved, missing, duplicate,
  stale, cross-account/product/version, source, artifact, participant, and
  parameterized composite SQL.
- Seven named acceptance cases: implementation ready.
- Focused ESLint and Prettier: passed.
- Secret scan: passed across 2687 repository text files.
- YAML parse, diff hygiene, exact five-source/runtime-triplet inventory, and
  correction digest derivation: passed.

## Steward work

Existing `STEWARD-REQUESTS.yaml` remains byte-identical and proposes:

- `P20-MIGRATION-001`
- `P20-WORKER-REGISTRATION-001`
- `P20-RUNTIME-CONFIG-001`
- `P20-PINNED-MEDIA-RUNTIME-001`

No migration, central composer/barrel, package manifest, lockfile, provider
registry, or deployment configuration was edited by P20.

## External effects and recovery

Authority: none. Attempted: 0; succeeded: 0; reconciled: 0. No media, provider
payload, learner data, credential, upload, transcode, model request, publication,
local deletion, or deployment was accessed or performed. Recovery base is the
exact corrected implementation head
`3cf5543b7fe2dde3118d35ce655e105dbd771a60`.

## Next action

C00 independently audits the exact corrected ancestry, five-source delta,
runtime triplet, correction digest, verification evidence, released lease, and
zero external effects before integration. P21 remains withheld until corrected
P20 is final, independently audited, and integrated.
