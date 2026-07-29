# P20 Handoff

## Identity

- Branch: `codex/v21-p20-media-processing`
- Start SHA: `ebf88c8e422a6ad40202fc2b0249810d312edc30`
- Atomic claim head: `6f894038117ee19d405e528670eb8bf86e8682b2`
- Implementation head: `e366ef926d6b2ee3be888eaae9fe2cad08b8a57f`
- Current terminal metadata commit: derive with `git rev-parse HEAD`; C00 records the pushed head
- Resume control: `bd24429251acff6393c0311a223e0e723335d7cd`
- Claim: `1cd7bf99-21a7-4231-8418-b9cdfaf958c4`
- Released CONTENT_PROCESSING lease: `447a28a6-1675-4fbb-b52f-a77f75f8d356`

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

C00/I36 should validate the implementation/artifact digests and disposition the
four steward requests. Any provider sandbox or production-operator canary
requires a new explicit authority after those integrations.
