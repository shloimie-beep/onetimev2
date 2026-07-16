# OPS-04 Integration Delta: OT-109 Rabbi Content Publisher

## Exported OT-109 Surface

- `packages/contracts/src/content/publisher.ts`
  - `ot109RegisterSourceInputSchema`
  - `ot109PublisherStateSchema`
  - `ot109DerivativeDraftSchema`
  - `ot109KnowledgeRetrievalResponseSchema`
- `packages/domain/src/content/publisher.ts`
  - `OT109_SCOPE`
  - `registerOt109Source`
  - `runOt109PublisherWorkerOnce`
  - `approveOt109TranscriptAndGenerateDrafts`
  - `reviewOt109Artifact`
  - `publishOt109ApprovedArtifacts`
  - `revokeOt109Publication`
  - `retrieveOt109HelperKnowledge`
  - `createDisabledOt109VimeoPort`
  - `createDisabledOt109TranscriptionPort`

## Shared Wiring For OPS-04

- Web/operator UI can call the domain services above through an owner/admin-only route layer; no route was added in OT-109.
- Worker wiring can call `runOt109PublisherWorkerOnce` with real private Vimeo and transcription adapters. Default factories are disabled sinks.
- Vimeo adapter must preserve the OT-104 boundary: private upload/status/text-track import only; no raw Vimeo URLs or tokens in logs, evidence, or browser payloads.
- Social adapter can consume OT-109 `social_manifest` publications. Payloads conform to the existing `content.approved_for_social` event contract and are not dispatched to Buffer by OT-109.
- Library projection can consume OT-109 `library` publications. Payloads conform to the existing `content.publication_manifest` shape and remain local until a signed handoff route is wired.
- Student Class Helper can call `retrieveOt109HelperKnowledge` with server-derived entitlements. Browser payloads must not choose account, product, provider, or source scope.
- Optional BNA control-plane monitoring must be signed, versioned, replay-protected, minimized, and raw-data-free by default.

## Gated Canaries

- Private Vimeo upload/status canary remains gated on an approved private test project/folder and explicit synthetic upload approval.
- Provider transcription canary remains gated on approved provider credentials and privacy review.
- Protected Drive intake canary remains gated on an approved Drive test file/folder and service account permission proof.
- Social provider canary remains gated through OT-106 and must not be triggered by OT-109 directly.
