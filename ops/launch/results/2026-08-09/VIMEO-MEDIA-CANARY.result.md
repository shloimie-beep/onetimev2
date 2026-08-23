# Vimeo media canary result

## Outcome

`BLOCKED_EXACT_PROVIDER_ACCOUNT_ACTION_REQUIRED_ZERO_EFFECTS`

The direct-upload production canary did not start. Read-only preflight proved that the merged
media architecture and its focused safety tests are present, but production still has no governed
S3, OpenAI, or Vimeo binding. Crossing the upload boundary would therefore violate the fail-closed
provider controls.

No upload session, S3 object, processing request, transcript, generated draft, approval,
publication, Vimeo asset, entitlement, playback authorization, customer-visible item, webhook,
or unpublish effect was created.

## Delta-only basis

The canonical prior proof is PR #136 and
`ops/launch/results/2026-08-07/wave-1/VIMEO-FIRST-RECORDING-CANARY.result.md`.

Preserved facts from that proof are: the earlier canary stopped before the mutation boundary and
reconciled to zero effects; the protected OpenAI and Vimeo credentials were accepted read-only;
and no governed AWS/S3/KMS tuple, exact OpenAI project binding, least-privilege Vimeo binding, or
eligible new operator recording was available. Unknown provider acceptance remains
reconciliation-only, and polling remains the safe first Vimeo readback path.

Operator-changed facts since PR #136: **none that satisfy an S3, OpenAI, Vimeo, or recording
gate**. The merged FFmpeg/ffprobe and explicit occurrence-selection changes resolve the previously
identified code delta, but do not establish provider ownership, protected bindings, or recording
provenance.

The unresolved delta is therefore limited to the four protected operator actions listed below:
bind the exact AWS storage tuple, prove the exact OpenAI project, issue and bind the
least-privilege Vimeo credential, and supply one eligible new operator recording. Only after those
readbacks may the single direct-upload canary begin.

## Candidate and production readback

- Repository branch under test: `codex/ot-p5-vimeo-media-20260809`
- Integration target: `codex/one-time-complete-production-launch-20260805`
- Integration head inspected: `5154a5764bc778fec9db0f3ebc98ab5901809c24`
- Production web and worker source readback: `f804980081cb2197689f3b4f3f77e58308b915af`
- Both services report the production runtime and `production_operator_canary` verification
  environment.
- Media mode is absent/default-off on both services. No authorization ID or canary ID is set.
- FFmpeg and ffprobe are executable at the configured production image paths on both services.
- Production media state remains empty: zero upload sessions, sources, processing versions,
  publications, Student publication-eligibility rows, and provider-operation bindings.
- The governed provider registry contains zero rows, including zero active S3, OpenAI, or Vimeo
  rows.

The production source already contains the merged direct-upload occurrence-selection and bounded
production-media changes. The later integration-head difference is operational closeout evidence;
no media provider gate is satisfied by deploying it.

## Existing implementation verified

The current code was verified rather than rebuilt. Focused coverage exercises:

- fail-closed provider configuration and the isolated one-ID `provider_canary` tuple;
- bounded S3 multipart upload, SSE-KMS requirements, part ordering, size/checksum validation, and
  duplicate-source convergence;
- direct-upload confirmation followed by explicit Admin occurrence selection;
- FFmpeg/OpenAI processing, pinned operation identity, draft-only generated artifacts, and
  duplicate-processing prevention;
- private Vimeo publication, polling/readback, provider uncertainty quarantine, reconciliation,
  retry/dead-letter boundaries, and unpublish behavior;
- five-minute renewable protected playback authorization, entitled access, generic unentitled
  denial, and denial metadata non-disclosure;
- bounded `production_broad` selection and concurrency defaults.

Focused test result: **143 passed, 1 safely skipped across 29 files**. The skipped test is the
native-PostgreSQL broad-claim test because no explicitly disposable loopback database named for
that test is configured; production was not substituted. The live production database was used
only for read-only aggregate reconciliation.

## Protected provider inventory

Only presence, capability, and consistency were recorded. No credential, provider account
identifier, provider URL, or provider resource identifier is included here.

### AWS/S3

`BLOCKED_AWS_ACCOUNT_BUCKET_KMS_AND_WORKER_BINDING_ABSENT`

- No protected AWS account credential or local AWS profile is available.
- No exact private versioned bucket, KMS key, or least-privilege worker identity is bound.
- Neither production service has the required S3/KMS configuration or governed evidence tuple.
- The required `eu-central-1`, public-access-blocked, bucket-owner-enforced, SSE-KMS posture cannot
  be read back.

### OpenAI

`BLOCKED_OPENAI_EXACT_PROJECT_BINDING_ABSENT`

- The intended protected credential is accepted read-only.
- The repository-pinned transcription and draft model versions are visible to that credential.
- The exact project identity is not available from the protected inventory and is not bound in
  production or the provider registry.

### Vimeo

`BLOCKED_VIMEO_LEAST_PRIVILEGE_TOKEN_AND_REGISTRY_BINDING_ABSENT`

- The intended protected credential is accepted read-only.
- The protected private project is readable, and its owner is internally consistent with the
  authenticated protected account.
- The credential includes the required private-upload management capabilities but also includes
  unrelated capabilities, so it is not the required least-privilege token.
- No exact account binding, production secret binding, or governed registry row exists.
- Polling is sufficient for the first proof; webhook activation remains optional afterward.

## Local source property check

A new 130-second synthetic MP4 was generated locally with a generated test pattern and synthetic
tone. It contains no people, Student data, narration, or third-party content. Readback proved H.264
video, AAC audio, 640x360 dimensions, a bounded 11,826,377-byte size, and SHA-256
`98d54848cef465cf04974c295064ac5b83cdb654d126890f16b87db3ccb557a7`.

This file remains outside the repository and was not uploaded. It is only a non-production
fixture/property check: it is not operator-recording provenance and is not canary evidence.

## Exact operator actions required

Before a single canary effect is authorized, the operator must place these values or resources in
the approved protected stores and identify their intended ownership without pasting them into
source, chat, logs, screenshots, or result files:

1. Authorize the exact intended AWS account and bind or provision one private, versioned,
   public-access-blocked, bucket-owner-enforced S3 bucket in `eu-central-1`, its exact SSE-KMS key,
   and one least-privilege worker identity that supports bounded multipart upload and readback.
2. Supply the exact OpenAI project identity for the already accepted credential, or provide a
   credential whose project binding can be independently proven.
3. Issue a Vimeo token for the confirmed intended owner with only the required private
   upload/read/manage capabilities, and supply the exact protected account binding. Do not enable
   a webhook for the first proof.
4. Make one new two-to-three-minute operator-owned OBS recording available with clear speech,
   simple video, no children, no third-party material, and no prior provider result.

After those actions, register and independently read back the three active production provider
bindings before setting any media mode.

## Safe continuation

The next run must allocate one exact canary occurrence/ID and one bounded processing/publication
budget, deploy the exact candidate, set only `provider_canary` plus
`production_operator_canary`, and perform the journey once. Any uncertain provider acceptance must
be reconciled before retry. Generated material stays Draft until Admin review and approval. The
proof must include one entitled operator-owned Student, one generic unentitled denial, private
Vimeo readiness, protected renewable playback, unpublish/revoke, complete reconciliation, and a
return to media mode `off`.

`production_broad` was not enabled. It remains blocked until the one-item proof succeeds; its
eventual initial limits remain batch 2 and concurrency 1, with explicit Admin occurrence selection
and no Drive binding.
