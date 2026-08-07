# Wave 1 Vimeo first-recording canary result

## Outcome

`BLOCKED_EXACT_PROVIDER_PREFLIGHT_NO_EFFECTS`

The current-candidate direct-upload canary did not start. The release controller first deployed
the exact PR #131 candidate, and the provider lane then repeated its read-only preflight against
that immutable deployment. The required S3/KMS, OpenAI, Vimeo, runtime-tool, registry, and source
bindings were still absent or contradictory. Starting a multipart upload would therefore have
violated the fail-closed provider controls.

No upload session, managed object, processing request, Vimeo mutation, publication, Student
entitlement, customer-visible item, or webhook was created.

## Exact deployed candidate gate

- Repository: `shloimie-beep/onetimev2`
- Integration PR: `#131`
- Candidate SHA: `43968d4b6163f97799e14289c2424c1001ab5c37`
- Production project/environment: exact registered `one-time-production` / `production`
- Web deployment: `35de7372-d367-4cec-84f8-f6758058e759`, successful
- Worker deployment: `6e2e806f-319f-403f-83a0-7b5b202236a2`, successful
- Controller readback: matching protected source identity on web and worker, fresh ready worker
  heartbeat, zero queue work, and no deployment diagnostic blockers
- Migration readback: head `2271_ot16_f05_dispatch_context`, `102/102` ledger verification
- Post-gate variable readback: `APP_VERSION` and `COMMIT_SHA` both equal the candidate SHA on
  both services
- Controller scope confirmation: code deployment only; no Vimeo/media provider variables changed

The provider lane did not rely on deployment metadata alone and did not cross the mutation gate
before the controller supplied this readback.

## Provider and runtime blockers

### S3/KMS

`BLOCKED_S3_KMS_ACCOUNT_BINDING_UNAVAILABLE`

- Neither deployed service has a content bucket, KMS key, AWS region, AWS credential, or S3
  registry-proof tuple configured.
- No local AWS profile, AWS CLI identity, registered account, bucket, key prefix, or KMS key was
  available for readback.
- Production `onetime.provider_registry_binding_v21` contains zero S3 rows.
- The direct-upload runtime therefore cannot create or reconcile its mandatory private,
  versioned, SSE-KMS multipart original in `eu-central-1`.

### Processing runtime and OpenAI

`BLOCKED_PROCESSING_RUNTIME_AND_OPENAI_PROJECT_BINDING_UNAVAILABLE`

- The exact deployed image is based on `node:24-alpine` and does not install FFmpeg or ffprobe.
- Neither service has FFmpeg/ffprobe paths, an OpenAI credential, an exact OpenAI project ID, or
  an OpenAI registry-proof tuple configured.
- A protected operator credential passed read-only authentication, and both locked models were
  readable, but the credential did not expose an exact project ID; the organization-project
  inventory endpoint rejected that credential. This is usable-token evidence, not a canonical
  project binding.
- Production `onetime.provider_registry_binding_v21` contains zero OpenAI rows.

### Vimeo

`BLOCKED_VIMEO_CANONICAL_ACCOUNT_AND_LEAST_PRIVILEGE_BINDING`

- Neither service has a Vimeo token, expected account ID, webhook secret, or Vimeo
  registry-proof tuple configured.
- Production `onetime.provider_registry_binding_v21` contains zero Vimeo rows.
- The protected keyholder token is accepted by Vimeo and its account matches the protected
  project URI. The account-reference hash is
  `e697abd1320b4d4a044724244251f784fb7aa59e0683e771311de9cf7906c416`.
- The older signed-in UI preflight recorded a different account-reference hash,
  `1b4a1f015496e304da84f3aa2e12eddbd1a17e0f5fce547c5079cf8ada44a8e0`.
  No canonical registry decision resolves that contradiction.
- The token includes the canary-capable scopes plus unrelated `interact`, `purchased`, `stats`,
  and `promo_codes` access. It does not satisfy the required least-privilege check.
- No Vimeo webhook is configured or claimed. Polling would be the safe first-proof
  reconciliation method once the other blockers are closed; webhook completion is not faked.

### Eligible direct-upload source

`BLOCKED_ELIGIBLE_OPERATOR_RECORDING_UNAVAILABLE`

- The prior 1.82 GB recording has a known completed provider outcome and is excluded from replay.
- The current organized class videos are copies of already-existing Vimeo/website-archive assets;
  re-uploading one would duplicate a known provider outcome.
- The remaining loose local videos do not have unambiguous One Time recording provenance and
  include material that must not be assumed to be an operator-owned Student canary.
- Consequently no exact recording/canary ID, participant snapshot, consent version, recording
  notice, or bounded processing/publication idempotency key was allocated.

### Current Admin-to-worker path

`BLOCKED_CONFIRMED_UPLOAD_OCCURRENCE_BINDING_PATH`

- Direct application upload confirms a source with `matchConfidence=none`.
- The deployed Admin router/UI does not invoke the existing `matchSourceToOccurrence` domain
  operation.
- The provider-canary worker selects only the exact source whose `occurrenceId` equals the
  configured canary ID, so a source uploaded through the current Admin path is not processable.
- This focused implementation gap was handed to the separate Wave 1 media-code lane together
  with the missing FFmpeg image dependency. No overlapping fix is committed from this provider
  result lane.

## Reconciliation and cleanup

Post-deployment production readback remained:

- provider registry rows for Vimeo/OpenAI/S3: `0`
- content sources: `0`
- upload sessions: `0`
- processing versions: `0`
- publications: `0`
- content entitlements: `0`
- Vimeo provider readback rows: `0`
- Vimeo project asset count: unchanged at `5`
- operation-marker matches: `0`
- media mode on web and worker: absent/default-off

The provider lane made only read-only account/configuration/API/database queries. There is no
provider effect to retry, revoke, unpublish, or delete, and no entitlement or mode restoration is
needed. Temporary local checkout/dependency setup created by this lane was removed.

## Verification

- Current PR #131 head and successful checks read back from GitHub.
- Exact controller deployment and worker heartbeat read back before the post-gate decision.
- Focused media configuration tests: `5/5` passed.
- Focused direct-upload, S3, processing, publication, and Vimeo tests: `44/44` passed.
- Production database reconciliation: all new-media and Vimeo-effect counts remained zero.
- Vimeo read-only reconciliation: credential accepted, protected project count unchanged, zero
  operation markers.

## Safe next action

Do not upload or enable `provider_canary` yet. A controller-owned follow-up must first provide and
read back all of the following on the same deployed candidate:

1. exact AWS account, private versioned bucket, key prefix, KMS key, `eu-central-1` identity, and
   active S3 registry row/proof tuple;
2. FFmpeg/ffprobe in the production image and exact executable paths;
3. exact OpenAI project ID plus active registry row/proof tuple;
4. canonical Vimeo account decision, a least-privilege token, and active Vimeo registry row/proof
   tuple; polling may precede webhook activation;
5. one newly authorized operator-owned recording with unambiguous provenance, consent/capture
   evidence, and no prior provider outcome; and
6. the deployed Admin occurrence-binding fix.

After those readbacks, allocate exactly one canary ID and one processing/publication effect budget,
then run the direct-upload journey once. Unknown external effects remain reconciliation-only.
