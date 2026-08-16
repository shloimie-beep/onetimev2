# Parent welcome video one-shot binding

Status: **BUILT — not deployed and not applied**.

This is the bounded post-deploy operation for the single approved Parent welcome media set. It
verifies three privately prepared files, stores exact versioned objects in the protected content
bucket, and atomically binds the reviewed Drive source, approved processing evidence, published
content record, current Parent welcome slot, and the three media/captions/poster assets. It does not
call Vimeo, HighLevel, an email provider, or a customer-messaging path.

## Preconditions

- Deploy the reviewed application release and the exact migration inventory through `2287`, including
  `2285_parent_welcome_video_framework.sql`, `2286_parent_first_learning_participant.sql`, and
  `2287_existing_reviewed_content_source_capture_method.sql`.
- Run only in the exact account, product, runtime tier, verification environment, AWS region, private
  bucket, KMS key, storage class, and deployed commit named by the private manifest.
- Confirm runtime verification writes are explicitly enabled. Dry-run remains read-only even when
  they are disabled.
- The content bucket must have versioning enabled, all four bucket-level public-access blocks enabled,
  bucket-owner-enforced ownership, and the exact KMS default encryption rule.
- Keep the manifest, exact private Drive-source file, media, captions, poster, authorization phrase,
  Drive identities, and all hashes outside the repository and ordinary terminal/chat output.
- Install `ffprobe` and `ffmpeg` on the controller. Apply decodes the complete MP4, and the built-in
  image decoder fully decodes the poster, before any database or storage effect.
- Run from a POSIX controller that can create an owner-only `0600` result file. The operation rejects
  Windows because that permission guarantee is not available through this controller.

## Private manifest contract

Supply one absolute `*.private.json` manifest path at invocation time. Do not commit the manifest or
copy its values into a fixture. Its strict top-level fields are:

- `schema_version`, a generated `operation_id` matching exactly `pwb_` plus 32 lowercase hex
  characters, `expires_at`, `expected_runtime_source_sha`, `authorization_phrase_sha256`, and
  `authorization_binding_sha256`;
- `scope`: exact account, product, runtime tier, and verification environment;
- `storage`: exact region, private bucket reference, KMS key ARN, and storage class;
- `drive_source`: exact private file identity, revision identity, private source-relative path,
  payload hash, byte count, and its own media declaration: MP4, H.264/yuv420p, AAC-LC stereo at
  44,100 Hz, zero rotation, square pixels, exact duration/frame rate, and exact source dimensions;
- `review`: exact Admin identity, rights/review/approval/publication instants, and reviewed child-data
  disposition;
- `presentation`: approved title and Parent-orientation topic;
- `private_asset_root` and exactly one `media`, `captions`, and `poster` declaration, each with a
  relative path, payload hash, byte count, content type, and its required media dimensions/timing;
  this approved media declaration requires `audio_sample_rate_hz: 44100`.

The authorization binding is an HMAC-SHA-256 signature over the domain-separated canonical manifest
digest (excluding only the binding field), keyed by the authorization phrase. Use the operation's exported
`parentWelcomeAuthorizationBindingSha256` helper inside the private manifest-preparation controller;
never print either input or digest. For apply, `expires_at` must be no more than 30 minutes after
execution and the phrase must be injected as `PARENT_WELCOME_BIND_AUTHORIZATION` by the protected
runtime. Do not place the phrase on the command line or in shell history.

The operation first hashes the local private source and requires exact equality with the declared
Drive source bytes. It independently fully probes/decodes the approved source against its own
manifest-bound facts. The approved source is 832x464; it is not subjected to the derivative's aspect
ratio predicate. The protected derivative and poster remain exactly 832x468 and 16:9. Both source and
derivative require MP4, one H.264/yuv420p video stream, one AAC-LC 44.1-kHz stereo audio stream,
complete decode, exact declared duration/frame rate, zero rotation, and square pixels. The operation
also rejects privacy-bearing derivative/container tags; only a narrow set of generated MP4 structural
tags is accepted, and `sourceMetadataRemoved` is taken from that probe evidence rather than asserted.
It fully decodes the poster and rejects EXIF, IPTC, XMP, Photoshop, ICC, comments, or orientation
metadata. Before parsing, the normalized raw WebVTT bytes—including cue identifiers and markup—are
checked against every manifest-private identity/value, including the operation ID. Every cue is then
parsed, rejecting overlaps or a cue past the decoded derivative duration. The manifest-bound evidence digest cryptographically
joins the private Drive file/revision digests, exact source bytes, all three derivative hashes, and
both decoded media evidence records.

## Dry run — required first

Use a new absolute result path that does not exist:

```text
npm exec -- tsx scripts/operations/parent-welcome-video-binding.ts --manifest <absolute-private-manifest.private.json> --out <absolute-private-dry-run-result.private.json>
```

Before any runtime, database, or S3 readback, the command reserves the exact output path as a new
owner-only result containing a pessimistic `acceptance_unknown` state. Proceed only when the private
result is `dry_run_planned`, the required asset count is three, every
reported blocker is empty, and all effect counters are zero. A dry run verifies local bytes, exact
runtime scope, database inventory, bucket policy, and existing object versions; it never uploads or
commits.

## One-shot apply

After privately injecting the one-use authorization, use another new absolute result path:

```text
npm exec -- tsx scripts/operations/parent-welcome-video-binding.ts --manifest <absolute-private-manifest.private.json> --out <absolute-private-apply-result.private.json> --apply
```

Before database preflight or S3 inventory, apply holds one PostgreSQL operation-wide advisory lock;
if it is busy or cannot be acquired, that invocation performs no upload or binding. Immediately
before the first upload, apply atomically inserts the authorization/manifest claim. The
phrase digest is unique, so concurrent or later use for any other operation is rejected. An apply may
issue at most one conditional upload for each absent exact object. Every successful
upload must return a version ID and pass version-specific header, metadata, checksum, and full-byte
readback before the database transaction begins. The transaction takes a second transaction-scoped
advisory lock and performs exact readback before commit.

Accepted terminal states are:

- `applied`: exact storage versions and one exact database binding were committed;
- `already_applied`: the same operation ID and manifest have an exact committed operation-result row,
  storage versions, and database binding; no duplicate object or row was created.

## Stop and reconcile

- On `blocked`, any known-created object versions are removed only when failure occurred before a
  database COMMIT attempt and rollback was positively confirmed. The one-use authorization may
  already be consumed; do not rerun it.
- On `blocked_cleanup_required`, stop. A known-created exact version could not be proven removed.
- On `acceptance_unknown`, stop. An authorization claim, storage upload, database commit, or final
  result replacement could not be classified safely. The pre-reserved result remains pessimistically
  unknown if final replacement fails. The controller performs only one read-only committed-operation
  reconciliation and never reruns an effect. After any ambiguous COMMIT attempt, uploaded versions
  are preserved even when one immediate database reconcile reports absent or conflict.
- Never retry an unknown or cleanup-required result. Reconcile the exact private manifest, S3 version
  inventory, and database binding through a separately authorized read-only inspection first.
- Never delete a pre-existing version or a version whose ownership is unknown.

The result contains only sanitized status, blocker codes, counts, and invariant flags. It never
contains the Drive locator, storage locator, KMS reference, source hash, asset hashes, transcript, or
authorization phrase. It also omits the operation ID. Finalization completes all fallible file and
directory checks before the atomic terminal rename and then fsyncs the parent directory again. An
ambiguous rename is accepted only after exact owner-only readback. If the post-rename directory fsync
fails, the command returns `acceptance_unknown`, performs only the read-only committed-operation
reconciliation, and must not be rerun even if the exact terminal payload is readable at the result
path, because its directory-entry durability was not proven.

## Native PostgreSQL matrix

The repository-native proof is gated and does not touch production. It is wired into both hosted
PostgreSQL assurance jobs; their actual PR runs remain required acceptance evidence:

- PostgreSQL 16: `.github/workflows/ot37-postgres-assurance.yml` creates the blank disposable database
  `onetime_parent_welcome_digest_ci_16`, sets
  `PARENT_WELCOME_NATIVE_POSTGRES_DISPOSABLE=true`, points
  `PARENT_WELCOME_NATIVE_DATABASE_URL` to its loopback URL, and runs
  `npx vitest run --config vitest.integration.config.ts tests/integration/content/parent-welcome-existing-reviewed-digest.postgres.test.ts`.
- PostgreSQL 18: `.github/workflows/ops11-postgres-18-assurance.yml` runs the same proof against blank
  disposable database `onetime_parent_welcome_digest_ci_18` and its loopback URL.

The native suite executes the SQL digest/OBS delegation, one-use authorization race, and the real
repository plan/apply/exact-replay readback (including `drive_state='processed'`) with synthetic local
files and an in-memory object store. Each job must drop only its named disposable database in its exit
trap. A skipped native test is not acceptance evidence for either matrix version.
