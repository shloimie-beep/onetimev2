# P20 Handoff

## Identity

- Branch: `codex/v21-p20-media-processing`
- Start SHA: `ebf88c8e422a6ad40202fc2b0249810d312edc30`
- Prior atomic claim head: `6f894038117ee19d405e528670eb8bf86e8682b2`
- Implementation head: `e366ef926d6b2ee3be888eaae9fe2cad08b8a57f`
- Collision-correction claim parent: `3d75b57e91c12ab3e0cad78b1a6a63497838f46f`
- Current atomic claim head: derive with `git rev-parse HEAD`; C00 records the pushed head
- Containing control: `2cb1cb46f37c3178217745876e0f09d694bbebf9`
- READY state base: `9d343f5b5990e0d5c38b2dc53f660b7377e2d64b`
- READY payload: `ba07246d1f3ed1d91828512ed588feca1f0b647928b2afb8b0e132aef3ae86ea`
- Claim: `e8c768e8-f603-4d0c-a45b-34b5cd7ea92c`
- Active CONTENT_PROCESSING lease: `24d0fa6f-30ac-4fc0-af2a-2b495d826063`
  through `2026-07-30T07:30:12Z`

## Atomic claim boundary

This checkpoint changes only `TASK-STATE.yaml`, `HANDOFF.md`, and
`NEXT-PROMPT.md` under `runtime/P20`. Source, migration, steward-request,
acceptance-matrix, runner, service, registry, configuration, manifest, lockfile,
and provider bytes are unchanged.

After C00 reconciles this claim, P20 may implement the
`ApprovedForPublicationProjection` correction only in these five source paths:

- `packages/contracts/src/content/processing/index.ts`
- `packages/db/src/content/processing/repository.test.ts`
- `packages/db/src/content/processing/repository.ts`
- `packages/domain/src/content/processing/content-processing.acceptance.test.ts`
- `packages/domain/src/content/processing/index.ts`

The five-path inventory digest is
`9a70f8864d7807d5ea26728a5835e10d489f91ed77f28f76f3458629cc3492ef`;
its integration-base manifest is
`eb01ac38bce07dd88f77b1e91d1899878d77edc6c2520a9769eec88ba3d900e8`.
No source change is authorized by this atomic claim.

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
- Steward-request digest:
  `821607d4c16a4627650ff1bf44ef435fb817d90a07ddf5e94f916269a988e01a`

Primary exported symbols are `OT_VIDEO_1_PROFILE`,
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
- Focused P20 suite: 4 files, 15 tests, all passed.
- Seven named acceptance cases: implementation ready.
- Focused ESLint and Prettier: passed.
- Secret scan: passed across 2686 repository text files.
- Diff hygiene and exact owned-path inventory: passed.

## Steward work

`STEWARD-REQUESTS.yaml` proposes:

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
exact pushed implementation head
`e366ef926d6b2ee3be888eaae9fe2cad08b8a57f`.

## Next action

C00 must reconcile the exact runtime-triplet claim before P20 changes any
source file. P20 stops after the normal claim push and remote verification.
External effects remain attempted `0`, succeeded `0`, reconciled `0`.
