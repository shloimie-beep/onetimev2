# OT-LIVE-004.01 provider runtime source evidence

- Claim: `3e512376-32bd-46dd-8be5-7ccea6292345`
- Exact base: `c07975edf5d7f8f8bb75d0a648c3ef55de910f92`
- Control head read back: `8049998af04791a73b0abf79e846cfdc6959baf5`
- Runtime gates remain default-off. Both web and worker factories return before constructing clients or reading the database when `contentMediaProviderCanary` is false.
- Direct app upload remains primary. Google Drive is optional, read-only, exact-folder scoped, and omitted entirely when unconfigured.
- S3 multipart initialization reconciles the exact opaque object key first. Zero open uploads may create one; one is recovered; duplicates return only provider-ID digests and fail closed. No normal path selects, aborts, or collapses duplicates.
- Direct `upload_<32hex>` and Drive `drive_transfer_<32hex>` identities are explicitly accepted while the object key remains restricted to `source_<32hex>`.
- Multipart part checksums remain a separate integrity layer. Completion never submits or treats the S3 multipart composite checksum as the whole-object SHA-256. It binds Head/Get to the exact completion VersionId and streams all bytes with an exact byte-count check to calculate the canonical full SHA-256.
- Completion timeout/restart recovery uses the exact durable key, version history, session metadata digest, declared byte count, KMS binding, exact VersionId, and full streamed SHA. Zero or multiple matching versions fail closed.
- Browser PUT CORS readback requires the exact origin, PUT method, `content-length` and `x-amz-checksum-sha256` AllowedHeaders, and ETag exposure.
- ffmpeg/ffprobe execution uses argument arrays with `shell: false`, bounded timeouts, bounded output, per-operation temporary directories, and cleanup in `finally`. Derivative claims are measured from ffprobe, MP4 atom order, metadata tags, and a bounded decode-to-null pass.
- Existing derivative recovery requires exactly one S3 object VersionId, downloads and hashes that exact version, and reruns the same measured derivative proof. Forged metadata, delete markers, or multiple versions fail closed. Vimeo pull URLs bind that verified VersionId.
- Original-source download requires the version-pinned GetObject response to echo the exact durable VersionId before opening the destination file; mismatched-version bytes fail closed even when their length and SHA-256 match.
- Source probe `readable` and `decodeFailure` claims also require a bounded decode-to-null pass after ffprobe structure succeeds.
- OpenAI requests use protected credentials only at request time, stable operation idempotency, timeouts, strict structured output, and fail closed on incomplete or refused Responses output.
- Vimeo dispatch reconciles before mutation, uses stable operation markers, requires private (`privacy.view = nobody`) matches for acceptance/reconciliation, and leaves availability to later readback. Web playback performs GET-only readback.
- Publication dispatch claiming, acceptance-unknown selection, and finalization selection are SQL-fenced to the exact canary ID plus the Vimeo pending-publication fingerprint and exact `vimeo_publication_primary`/`mutation` binding before any lease or state transition.
- Provider registry evidence and live identity are read before possible mutation. No credential, raw provider upload ID, private pull URL, or access token is returned or persisted by these seams.
- Tests use injected fakes and local byte/process fixtures only.

## Zero-effect ledger

- Provider API calls: 0
- Database connections, queries, writes, or migrations: 0
- Media uploads, Drive reads, transcodes, OpenAI calls, or Vimeo calls: 0
- Deployment, DNS, messaging, billing, Customer, or Student effects: 0
- Feature flags enabled: 0
- Bulk or 33GB operations: 0
