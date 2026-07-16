# OT-109 — Rabbi Vimeo, Transcript and Knowledge Publisher

## Mission

Build the standalone One Time content-publishing workflow for Rabbi Scheller. This is not an Academy content pipeline.

An authorized One Time operator supplies a class source. The pipeline privately ingests/uploads it, tracks Vimeo processing, obtains or creates a transcript, produces review/knowledge/social derivatives, requires human approval, then publishes approved artifacts into the Rabbi’s One Time content library and Student Class Helper knowledge base.

BNA may later monitor or configure this workflow through a signed control-plane seam, but One Time must not depend on the Academy runtime for ordinary pages and no Academy content/data may enter this pipeline.

## Source

- Repository: `webcraft-media/onetimev2`
- Exact base SHA: `fb3c397ce8ece100cf7873fdddcd940a1552ea9b`
- Branch: `codex/ot109-rabbi-content-publisher`
- Draft PR base: `codex/ops03-staging-readiness-repair`
- Additive migration reservation: `2190_ot109_rabbi_content_publisher.sql` if canonical pipeline state is insufficient.
- Clean isolated worktree only.

Persist `ops/codex-runs/OT-109/{ORIGINAL-PROMPT.md,STATE.json,SCOPE.json,LOG.jsonl,DECISIONS.md,RESUME.md,FINAL-REPORT.md}`. Missing Drive/Vimeo/transcription credentials block only their canaries.

## Ownership and dependencies

Own content-publisher contracts/domain/state/repository/feature-local worker/operator tooling/tests/evidence. Consume existing signed content lifecycle and define a narrow interface compatible with OT-104’s Vimeo provider boundary and OT-106’s social-publication manifest; do not copy their implementations or edit their branches.

Do not edit shared app/config/worker main/env/root manifests, auth/landing/portals, other providers, Railway or BNA. Export factories and record shared wiring in `OPS04-INTEGRATION-DELTA.md`.

## Workflow

Implement a durable, resumable and idempotent state machine:

1. Source registered and provenance verified.
2. Awaiting/performing private media intake.
3. Vimeo upload/reference accepted.
4. Transcoding.
5. Awaiting/processing transcript.
6. Transcript ready but unapproved.
7. Derivatives generated as drafts.
8. Human review required.
9. Approved for library/helper/social independently.
10. Published/projected.
11. Retryable failure, blocked or dead-lettered with safe reason.

Input sources may be an authorized uploaded file, a protected Drive file reference, or an existing private Vimeo video reference. Caller cannot choose account/product/provider scope. Never process a public arbitrary URL.

## Media/transcript behavior

- Use OT-104-compatible private Vimeo port for upload/status/privacy/text tracks; no public exposure.
- If an approved Vimeo text track exists, import with checksum/provenance.
- Otherwise use a provider-neutral transcription port in disabled/sink mode by default. Live mode requires protected credentials and later explicit canary authorization.
- Chunk large media safely and resume after restart without duplicating source/transcript/artifacts.
- Normalize timestamps, speakers only when reliable/approved, lesson/class metadata and source checksums.
- Never place raw media, private Vimeo URLs, tokens or complete unapproved transcript into logs/evidence.

## Draft derivatives and approval

Generate drafts only from the transcript/source:

- searchable lesson/transcript chunks with timestamps;
- concise lesson summary;
- review-sheet draft and key questions/concepts;
- approved-content chunks for OT-107 retrieval;
- social caption/clip proposals and provenance manifest for OT-106;
- classroom resource linkage.

AI output is draft/untrusted. It cannot publish itself, create religious/source claims beyond the Rabbi’s content, or appear in the student helper before explicit authorized approval. Provide owner/admin review states and per-artifact approve/reject/regenerate controls through task-owned service contracts; shared UI wiring belongs to OPS-04.

Publication must be atomic/idempotent per artifact/version. Revoking/unpublishing content removes it from new student-helper retrieval and protected library listings without deleting audit/provenance.

## Isolation and control plane

- Fixed One Time/Rabbi account and product scope server-side.
- No Academy learner, transcript, class, CRM, Drive folder or Vimeo asset access.
- No ordinary runtime calls from One Time landing/CRM/library pages to BNA.
- Optional BNA control-plane seam is signed, versioned, replay-protected and limited to minimized commands/status; BNA never receives raw student data or private transcript bodies by default.
- Rabbi sees content/pipeline outcomes appropriate to his role, not provider credentials/integration internals.

## Tests and canary

Test duplicate source/restart/resume, malformed/oversized input, wrong account/product, unauthorized Drive/Vimeo reference, transcode/transcript timeout/failure, provider 401/403/429/5xx, conflicting transcript version, prompt injection in transcript, unapproved publication denial, artifact approval independence, revoke/unpublish retrieval removal, social manifest privacy and secret/PII redaction.

Prove with synthetic Rabbi-class media/text: source → private provider fake → transcript → draft derivatives → approval → One Time library projection → OT-107-compatible knowledge retrieval → OT-106-compatible social draft manifest. Prove public/CRM routes make no provider/pipeline calls.

Provider canaries are separately gated: at most one tiny synthetic fixture, never real class/customer media and never Academy data. Missing provider configuration must not stop code/tests/PR.

Run scoped verification, push and open a draft PR. Final report includes branch/SHA/PR, state machine, migration/checksum, isolation proof, derivative/approval tests, provider truth, OPS-04 seam, rollback and blockers.

