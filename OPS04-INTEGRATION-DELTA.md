# OPS-04 Integration Deltas

This integration branch combines multiple leaf handoff notes. Each section
keeps its original provider boundary and does not imply live provider success.

## OT-109 Rabbi Content Publisher

### Exported OT-109 Surface

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

### Shared Wiring For OT-109

- Web/operator UI can call the domain services above through an owner/admin-only route layer.
- Worker wiring can call `runOt109PublisherWorkerOnce` with real private Vimeo and transcription adapters. Default factories are disabled sinks.
- Vimeo adapter must preserve the OT-104 boundary: private upload/status/text-track import only; no raw Vimeo URLs or tokens in logs, evidence, or browser payloads.
- Social adapter can consume OT-109 `social_manifest` publications. Payloads conform to the existing `content.approved_for_social` event contract and are not dispatched to Buffer by OT-109.
- Library projection can consume OT-109 `library` publications. Payloads conform to the existing `content.publication_manifest` shape and remain local until a signed handoff route is wired.
- Student Class Helper can call `retrieveOt109HelperKnowledge` with server-derived entitlements. Browser payloads must not choose account, product, provider, or source scope.
- Optional BNA control-plane monitoring must be signed, versioned, replay-protected, minimized, and raw-data-free by default.

### Gated OT-109 Canaries

- Private Vimeo upload/status canary remains gated on an approved private test project/folder and explicit synthetic private upload approval.
- Provider transcription canary remains gated on approved provider credentials and privacy review.
- Protected Drive intake canary remains gated on an approved Drive test file/folder and service account permission proof.
- Social provider canary remains gated through OT-106 and must not be triggered by OT-109 directly.

## OT-103 Zoom Classroom

OT-103 intentionally leaves shared app/config/deployment wiring out of scope.

Required follow-up wiring:

- Add protected staging Zoom configuration names for server-to-server OAuth, Meeting SDK credentials, webhook secret token, host user ID, and explicit `OT103_STAGING_CANARY_AUTHORIZED`.
- Register `createZoomWebhookRouter` under the approved internal classroom webhook path using `express.raw` before global JSON parsing.
- Inject the real/staging `createZoomRestClient` based ports into `createClassroomService` only when staging credentials and canary authorization are present.
- Wire `createClassroomReminderJob` into the worker scheduler without changing sink/off defaults.
- Add the actual Zoom Meeting SDK package and switch `apps/web/src/client/classroom/zoom-sdk-adapter.ts` from the deterministic panel to a lazy SDK import only on the classroom route.
- Keep learner role `0`; owner/host start with ZAK remains a separate protected owner capability and must not share the student launch path.
- Keep raw `start_url`, reusable passcodes, access tokens, SDK secret, ZAK, private provider URLs, and raw join URLs out of logs, audits, dashboards, and non-classroom responses.
