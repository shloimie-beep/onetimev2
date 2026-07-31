# F02 Lease B Compatibility-Semantic Correction Release

- Claim parent: `24c327eaf06fc502d167d2d5863c5fbb05db5a2c`
- Containing continuation control: `5644d38395e86ea114197eb12415106994bbf3ea`
- Sole control acquisition parent: `fe0d60fa2807b02882390df960f3e75517672d11`
- Claim: `6b1e1632-e3d9-4f87-92b3-8b150a6715d2`
- Shared MIGRATION_AUTHORITY/SCHEMA_CONTRACT lease: `31e905c8-d5c2-4e3c-9e98-c2e8f78989ce`
- Released: `2026-07-30T00:37:21Z`, before expiry `2026-07-30T01:23:18Z`
- Effects: `0/0/0`

Migration 2239 now selects exactly one canonical series per account/product
scope without changing the selected series lifecycle. A sole paused series
remains paused; a sole archived series remains archived; an active series is
preferred when a scope contains multiple lifecycle states. Canonical schedule,
teacher, classroom, and recording fields are still normalized.

Direct native probes passed sole paused, sole archived, sole active, mixed-row
active preference, canonical normalization, and singleton fencing. Complete
disposable PGlite PostgreSQL and repository-runner pg-mem inventories passed
75/75.

Only migration 2239, its allocation checksum metadata, and the F02 runtime
triplet changed. Migrations 2234 through 2238 and 2240 through 2244 remain
byte-identical. Typecheck, lint, production build, format, YAML, secret, diff,
five-path scope, 200/200 package Git bytes, protected blobs, checksum pairs,
next ordinal 2245, lease release, and effects `0/0/0` passed.

Stop for independent and C00 audit. Do not merge, register, inspect providers,
deploy, send, or perform external effects.

# F02 Migration Lease C Atomic Claim

- Claim parent: `cd2d7c2fe3bfeb250c320bc02c9bfebb3bd04911`
- Containing control: `85100180449bf234a93f107eb66a1f7bc635b4f0`
- READY parent control: `fe95eacb2a958ba043cc9f89c1c27e09e20b9324`
- Claim: `0e98de00-4873-41cb-a06f-bd0ace918b89`
- MIGRATION_AUTHORITY lease: `7a7c792d-fe4b-4a83-bbd9-7c6448bf1c95`
- SCHEMA_CONTRACT lease: `b7ddd6c3-8a8e-4c9a-a304-5b4c15390fe1`
- READY digest: `5ab53779afff1e0a2a7ae4759818f9a98c259970298449ae767cee788a12b936`
- Effects: `0/0/0`

This atomic claim binds only P19, P20, P28, P08, and P09 migration requests to
ordinals 2245 through 2249. P17, P18, and P21 remain withheld. Only the F02
runtime triplet changed. Stop for C00 reconciliation before reading requester
bodies, editing the allocation proposal, authoring SQL, or performing effects.

# F02 Migration Lease C Release

- Sole parent: `ff35555611e7261d1b7b96fc2233eaf82a9f9fdf`
- Reconciliation control: `1b5e5dd662390dd5affc159990a59b3b8d99c127`
- Sole reconciliation parent: `85100180449bf234a93f107eb66a1f7bc635b4f0`
- Claim: `0e98de00-4873-41cb-a06f-bd0ace918b89`
- MIGRATION_AUTHORITY lease: `7a7c792d-fe4b-4a83-bbd9-7c6448bf1c95`
- SCHEMA_CONTRACT lease: `b7ddd6c3-8a8e-4c9a-a304-5b4c15390fe1`
- Released: `2026-07-30T04:45:00Z`, before expiry `2026-07-30T06:01:19Z`
- Effects: `0/0/0`

Implemented only the authorized P19, P20, P28, P08, and P09 requests as
forward-only migrations 2245 through 2249. The result provides bounded,
checksum-deduplicated content ingest; immutable versioned content processing;
adult-only communication preferences and governed reminder evidence; global
family-signup idempotency with fixed free access and separate consents; and
email-deduplicated school inquiries with explicit zero access before approval.
P17, P18, and P21 remained withheld from implementation.

Complete disposable PGlite PostgreSQL and repository-runner pg-mem inventories
passed 80/80. Focused probes passed ingest size/checksum bounds, processing
immutability, communication preference scope, family idempotency/access/consent,
school dedupe/zero-access separation, optimistic concurrency, append-only
enforcement, and IANA timezone validation.

The exact result is nine paths: five SQL files, the allocation proposal, and the
F02 runtime triplet. Typecheck, lint, focused unit contracts, YAML, checksum,
scope, diff, lease-release, and zero-effect gates passed. Focused integration
suites reached the pre-existing migration 2235 and stopped because their pg-mem
setup omits `btrim(text)`; the complete registered pg-mem and native inventories
passed all Lease C migrations.

Stop for independent and C00 audit. Do not merge, allocate ordinal 2250,
register, inspect providers, deploy, send, or perform external effects.

# F02 Migration Lease D1 Release

- Pushed split control: `4ea98556cd03ccc0df1a5286d61ee3cfdbfb82b4`
- Sole control parent/controller: `4b22c4704edc8bd21b0e0242ad00debfba67f5c2`
- Authorized start: `6d16d6eb2c901c58cc4d0c2bb3298b5543af3d9f`
- Implementation checkpoint: `7a828767e68807a5b16c0b71a65218553a121856`
- Claim: `3469667a-69e2-4c35-afac-5b1dfbbf417d`
- MIGRATION_AUTHORITY lease: `7f2ab8d1-a53f-41da-8143-28da4b62b200`
- SCHEMA_CONTRACT lease: `9a3469a3-87c6-45b6-824f-c3b886a01b46`
- Lease expiry: `2026-07-30T13:34:41Z`
- Released: `2026-07-30T12:58:26Z`
- Effects: `0/0/0`

Implemented only the authorized corrected P17 and P18 migration requests as
forward-only ordinals 2250 and 2251. P17 owns exactly five Zoom preparation
tables and P18 owns exactly four disjoint embedded-classroom tables. The
migrations reuse the existing `job_outbox` and `provider_operation_binding`
authority and do not create `provider_operations`. The draft P21 migration 2252
is preserved untracked and excluded from every commit.

Pinned control and the immutable P17 request both bind
`P17-MIGRATION-002` to canonical digest
`e4aed5ae31c5143deb230aa3a9e76f6bca0fd6857d22a4bec7e815f3b78624ca`.
The conflicting `e4aed5d9...` value in the delegated task text was confirmed as
a transcription error and was not propagated.

Complete disposable PGlite PostgreSQL and repository-runner pg-mem inventories
passed 82/82. P17 missing-key/optional-reference probes passed 26/26. Focused
native D1 semantic probes passed 35/35 for immutable confirmation/scope,
state/quarantine fencing, one-use grants, monotonic live-session leases,
nonempty audit evidence, correction interval structure, and lowercase-hex
digests.

The exact committed batch is six paths: migrations 2250 and 2251, the
allocation proposal, and the F02 runtime triplet. Typecheck, lint, YAML,
repository Prettier, checksum, secret, diff, exact scope, release, and zero
effects passed.

Both writer leases were released before expiry. Stop for independent and C00
audit. Do not commit draft 2252, merge, allocate ordinal 2252, register,
inspect providers, deploy, send, or perform external effects.

# F02 Content-Publication Projection-v2 Migration Release

- Containing control: `f2b4a9faefdb5f780c9b620fedb413d408d27a19`
- Controller authorization: `f0ccbdc81e6962add93d0900dd159e24df7cf05f`
- Authorized integration parent: `c0a1e04b8f3ffcaa65b8c6c2a1ec64edf7c1346a`
- Prior F02 head: `39cacd4aeef63ba247902b1fc7051b6bd6ca0f23`
- READY digest: `3145d5b3fe237f0b9f62ae6ff6f5443a7f4f402c4322cc00f0c9d2183a59015f`
- Claim: `88a902de-af91-412f-9e38-6e82dac1d3d2`
- MIGRATION_AUTHORITY lease: `7de57120-0ed6-4e9d-8dcd-53cdbdf471b4`
- SCHEMA_CONTRACT lease: `e0a6dd90-820f-4625-9979-e057d0bdad1c`
- Lease expiry: `2026-07-30T19:03:38Z`
- Released: `2026-07-30T17:44:04Z`
- Effects: `0/0/0`

Implemented only immutable `P21-MIGRATION-003` as forward-only migration 2253.
The replacement validator requires the exact 27-field projection, exact
eight-field ordered artifact provenance, digest parity, explicit null metadata,
persisted P20 source/version/capture/participant/artifact evidence, current
artifact revisions, matching account/product/content/version scope, and public
seed parity. All five inherited publication guards now pass the exact content
identifier.

Migration 2252 and P21-MIGRATION-002 remain byte-identical historical evidence.
The allocation proposal now reconciles through immutable 2252, allocates exact
ordinal 2253, records native/repository-runner checksum pairs, and advances the
next available ordinal to 2254.

A fresh native PostgreSQL 16.14 database applied all 84 migrations, replayed
2253 cleanly, and passed the complete accept/replay plus malformed, missing,
extra, reordered, tampered, cross-scope, seed-mismatch, stale-revision,
persisted-evidence-mismatch, and five-guard rejection probe batch. The complete
repository pg-mem inventory also applied and verified 84/84 with zero pending
migrations using the repository harness registrations.

The exact result is five paths: migration 2253, the allocation proposal, and
the F02 runtime triplet. Typecheck, lint, focused migration verification, YAML,
runtime-document formatting, secret scan, checksum, exact scope, diff, remote
fencing, lease release, and zero-effect gates passed. Both bounded writer slots
were released at `2026-07-30T17:44:04Z`, before expiry.

Stop for independent and C00 audit. Do not merge, allocate ordinal 2254,
backfill, inspect providers, deploy, send, charge, or perform external effects.

# F02 Migration 2250–2252 Steward Acknowledgment Checkpoint

- Canonical control: `c44656d40769b28f2d55e6e1041d716175129f4a`
- Controller authorization: `98e7b05c7d256d55fd8a4dbd829230e42303e67e`
- Authorized integration start: `8634b2ab15df624576a88b31182ebdc68553ff74`
- Expected prior F02 remote: `26234c47e5bc92f4d3392d77d98bc3a758d25189`
- READY digest: `d8303358cef529777a0ced6ef7463261d0c622fca1ecb12dcd39b552dddf3841`
- Claim: `c6e15ead-7f47-46f0-aaea-6fe00cd4338b`
- MIGRATION_AUTHORITY lease: `203f8836-7958-4791-afb0-764a289a9ac0`
- Lease expiry: `2026-07-30T21:30:53Z`
- Released: `2026-07-30T19:55:00Z`
- Effects: `0/0/0`

The exact prior F02 remote was clean and fast-forwarded to the exact integration
start before editing. This checkpoint changes only the F02 runtime triplet. It
does not edit a migration, allocation proposal, product file, immutable request,
provider record, deployment, send, or central control result.

F02 separately acknowledges these immutable bindings:

1. `P17-MIGRATION-002`, canonical digest `e4aed5ae31c5143deb230aa3a9e76f6bca0fd6857d22a4bec7e815f3b78624ca`,
   producer source `7f8a41bc09c81c53a276a32bbb667aeb1f0ee69c`, migration
   `packages/db/migrations/2250_v21_zoom_preparation.sql`, control checksum
   `e63ae53369575b77a8f9f86564bd06e9e5fe72cf19b2ad15bfcd177ddbe93b38`.
2. `P18-migration-003`, canonical digest `a7fea38033ff31b691fb065d124bf4d71e0900ea3dd2fbc0bd481cefd00b1960`,
   producer source `3be7bf4930a02ea5559db057ceedd6bb11a1b543`, migration
   `packages/db/migrations/2251_v21_embedded_classroom.sql`, control checksum
   `3fdeedcb1f4be0b606644a742ed44fadb792aab551ca0d7359af3f758ad174f9`.
3. `P21-MIGRATION-002`, canonical digest `aeb2db007026e9ad6286c4daa10a8b1970df6869b4d9eb821e3fe29c6eefc792`,
   producer source `705030f2d5163f95340a19dc42efd0f167259869`, migration
   `packages/db/migrations/2252_v21_content_publication.sql`, control checksum
   `7981b9cf9805ec9bfba7005e7688034bacb90f5e730d0e593c43202c68afeafc`.

All three bind the corrected native proof
`39cacd4aeef63ba247902b1fc7051b6bd6ca0f23`, evaluated integration target
`dd944eee39c314c562171c89c7350a6900ea2e6f`, and merge/release
`526f038412d7652451e519fae0f8ef857625029a`. The control proof records that
fresh PostgreSQL 18.3/PGlite probes reject all eleven reproduced bypasses,
exact positive rows pass, the provider-readback ledger is append-only, 54/54
focused tests pass, migrations 2250–2252 replay, and no live database or
external effect occurred.

This is only the previously missing producer acknowledgment. C00 has not been
claimed to have applied any of the three steward results. C00 must independently
audit the pushed sole-parent checkpoint, compute its exact `TASK-STATE.yaml` +
`HANDOFF.md` digest, and disposition each central result.

Stop. Do not mark steward results applied, edit migration or proposal bytes,
merge, inspect providers, deploy, backfill, send, charge, or perform external
effects.

# F02 Migration 2251 pg-mem Checksum Metadata Correction

- Authorization-containing control:
  `4be94c1697b86d0fab8066590be5e62a926798f7`
- Subsequent control-only runtime-digest correction:
  `fbc5d54093f34a823b8ee9f8a7906f65053c25db`
- Controller authorization:
  `c44656d40769b28f2d55e6e1041d716175129f4a`
- Authorized/expected F02 start:
  `bd17fd6fc11cc122ea452b131e1107dd0bb88fcc`
- READY:
  `d2e9a20bb40a9df079193425dbbcd3d8ab1acc6b3b66e21a9d41e1d001013c82`
- Claim: `07870f1c-ed37-4637-a92f-708f80fb36df`
- MIGRATION_AUTHORITY lease:
  `35b6ed2e-7863-493c-8d5e-dee6850f5110`
- Lease expiry: `2026-07-30T21:40:49Z`
- Released: `2026-07-30T20:48:17Z`
- Effects: `0/0/0`

Independent review held `bd17fd6f` only because the prior C00 READY
transcribed `P17-MIGRATION-002` as the malformed 62-hex value
`e4aed5ae31c5143deb230aa3a9e76f6bca0fd6857d22a4bec7e815f3b78624`
and F02 recorded migration 2251's repository-runner pg-mem checksum from a
superseded pre-hardening blob.

This correction changes exactly the allocation proposal plus the F02 runtime
triplet. The three current migration-2251 metadata occurrences now bind:

- immutable Git blob `4bd4afdc152dd47977d7ab0aaeee246d5f75a16f`;
- normalized-LF checksum
  `525172d9072c930e0178e35ec8a7ddc6b1217b70f17b5e1f1c970228dee43dec`;
- control checksum
  `3fdeedcb1f4be0b606644a742ed44fadb792aab551ca0d7359af3f758ad174f9`;
- exact repository-runner pg-mem checksum
  `ee0f961687e25ccd60e700d8a58cd9e11e71de1187e68fe517d684992eccdf36`.

The authoritative immutable P17 request digest remains
`e4aed5ae31c5143deb230aa3a9e76f6bca0fd6857d22a4bec7e815f3b78624ca`.
The separate 2250-2252 acknowledgments, native proof `39cacd4a...`,
merge/release `526f0384...`, and
`central_steward_results_applied: false` are preserved. No migration,
request, product, provider, deployment, live database, send, charge, or other
external-effect byte changed.

C00 must independently rederive the current checksum, verify the exact
four-path terminal and released lease, and admit it before any integration or
central steward-result disposition.

# F02 Migration 2251 Proposal-Authority Metadata Correction

- Authorization-containing control:
  `a7978fb1f0d1d9914c3e2b8bd698290226087455`
- READY parent and controller authorization:
  `fbc5d54093f34a823b8ee9f8a7906f65053c25db`
- Authorized/expected F02 start:
  `edacab1ded9498e3ac6156942d0a3ae9fc268aea`
- READY:
  `2f554b14dffc14b4128dfef22d162c42248c7b5a2afd9cd290d79068b6a3eaf2`
- Claim: `68f6e27a-caa2-4988-842c-7fd8eb0eb9ef`
- Sole MIGRATION_AUTHORITY lease:
  `defa457c-32f6-4618-a237-cde17d3c439a`
- Writer: `codex-f02-proposal-authority-68f6e27a`
- Lease expiry: `2026-07-30T22:25:05Z`
- Released: `2026-07-30T21:10:33Z`
- Corrected proposal raw SHA-256:
  `f1c23180b49e21149e173a812b561813d0bc9e36adc5ea411721027b753ca643`
- Effects: `0/0/0`

Independent review held `edacab1d...` only because the proposal's live
`authority` block still named historical projection-v2 claim
`88a902de-af91-412f-9e38-6e82dac1d3d2`, MIGRATION_AUTHORITY lease
`7de57120-0ed6-4e9d-8dcd-53cdbdf471b4`, SCHEMA_CONTRACT lease
`e0a6dd90-820f-4625-9979-e057d0bdad1c`, writer
`codex-f02-projection-v2-88a902de`, control `f2b4a9fa...`, start
`c0a1e04b...`, expiry `2026-07-30T19:03:38Z`, and release
`2026-07-30T17:44:04Z`.

This correction rebinds only that live block to the fresh sole
MIGRATION_AUTHORITY authority above, adds exact READY-parent provenance, and
removes the stale live schema lease. The old values remain only as explicitly
labeled historical evidence in the F02 runtime triplet.

Every allocation, checksum, authoritative P17 digest, separate 2250-2252
acknowledgment, native proof `39cacd4a...`, merge/release `526f0384...`, and
`central_steward_results_applied: false` remains exact. No migration, request,
product, central steward result, integration, candidate, provider, deployment,
live database, send, charge, or external-effect byte changed.

C00 must independently verify the exact four-path scope, proposal-authority
parity, immutable allocation/request/migration/checksum bytes, released sole
lease, clean local/tracking/live equality, and effects `0/0/0` before
integration. Do not apply a central steward result from this checkpoint.

# F02 Migration 2254 P22 Learning-Engagement Atomic Claim

- Claim parent: `9754f2ae0736ace4bbf7d2a88c73f1d28b0b5a20`
- Containing control: `fdcba89094f6b8f9460db3d41f3602be2d476990`
- READY parent/controller: `ce71f41af1c70f689db9b3346ae5dfc643a1344f`
- Authorized integration start: `d89a0f38dfe695c323f56a28e7c2b0bd890d4ef9`
- READY digest: `d227353928ba2c492ad7b0e21468bf6198634e9e800f96da507369c48ea640ce`
- Claim: `8041cc43-6a31-443b-87be-ef663f767c80`
- Writer: `codex-f02-migration-2254-8041cc43`
- MIGRATION_AUTHORITY lease: `55139366-ce78-4536-8cd3-33c08a1aba38`
- SCHEMA_CONTRACT lease: `0669b0a0-ef3e-44cd-a9d9-2cb61b9b5e49`
- Lease expiry: `2026-07-31T05:48:00Z`
- Prior state/handoff digest:
  `e0b2ede55c202a8701905fbf7468f1a33ff09ae3a9f4fec5f5926a018f107616`
- Prior runtime-triplet digest:
  `4059e319ef6bf2fc82f0a7243c20b461060e63d0b16525777b5cc81fa38075b9`
- Effects: `0/0/0`

The live F02, control, integration, proposal, and immutable
`P22-migration-001` source bindings all matched the pushed READY. The protected
pre-existing untracked `.codex-lane1-pglite.mjs` remains excluded at exactly
1597 bytes and SHA-256
`11117a9144f8d2838466619ba0f3255ab18d0c164793c340fe3badb453206f17`.

This first checkpoint changes only the F02 runtime triplet. It does not read
the request body for implementation, edit the allocation proposal, author SQL,
or change product, shared control, provider, deployment, send, charge, or
external-effect bytes.

Stop for independent C00 reconciliation. No migration-2254 or proposal
authority is latent; a separate later C00 control commit is mandatory.

# F02 Migration 2254 P22 Learning-Engagement Held Not Admissible

- Held checkpoint parent:
  `4007334f36c0a87b3289cb99f4a9d2f25eeda2a9`
- Current containing control:
  `cc90f922663405d883a798db8d4278ef803bb7cb`
- Control state basis:
  `fdcba89094f6b8f9460db3d41f3602be2d476990`
- Current READY queue: empty
- Claim: `8041cc43-6a31-443b-87be-ef663f767c80`
- Writer: `codex-f02-migration-2254-8041cc43`
- MIGRATION_AUTHORITY lease:
  `55139366-ce78-4536-8cd3-33c08a1aba38`
- SCHEMA_CONTRACT lease:
  `0669b0a0-ef3e-44cd-a9d9-2cb61b9b5e49`
- Lease expiry: `2026-07-31T05:48:00Z`
- Both leases released: `2026-07-31T04:48:40Z`
- Disposition: `held_not_admissible`
- Effects: `0/0/0`

The immutable `P22-migration-001` cannot safely authorize migration 2254.
Its current contract and repository write an `onetime.learning_attendance`
aggregate keyed without runtime tier or verification environment. That would
compete with canonical migration 2251's append-only attendance events and
versioned, evidence-bound projection. The P22 write cannot preserve 2251
source, digest, lineage, idempotency, version, or correction-event semantics,
and `learning_attendance_segments` is not written by the integrated repository.

The same P22 contract scopes every learning query and write only by account and
product, despite mandatory runtime-tier and verification-environment
isolation. Its leaderboard projection also expects distinct first and last
names that the current identity schema does not provide; `display_name` must
not be parsed or treated as those unavailable semantics. Finally, mutable
question `transitions_json` and a current recognition-consent row are not
immutable transition and consent audit authorities.

P22 must publish a new immutable successor request before F02 may allocate
ordinal 2254. The successor must:

1. preserve migration 2251 as the sole attendance write authority and make any
   P22 attendance compatibility projection read-only;
2. add runtime-tier and verification-environment scope to every learning
   contract, query, write, key, and index;
3. bind leaderboard names only to canonical actual/display-name semantics that
   exist at the successor's admitted dependency head; and
4. require append-only question-transition and recognition-consent audit
   events, with current rows treated only as projections.

This checkpoint changes only the F02 runtime triplet and releases both bounded
writer leases before expiry. It does not edit the allocation proposal, author
SQL, change product or immutable request bytes, submit a steward result, merge,
register shared state, freeze a candidate, touch a provider, or perform an
external effect. The protected untracked `.codex-lane1-pglite.mjs` remains
excluded at exactly 1597 bytes and SHA-256
`11117a9144f8d2838466619ba0f3255ab18d0c164793c340fe3badb453206f17`.

Stop for C00 reconciliation. No migration-2254, proposal, successor-request,
integration, provider, candidate, or effect authority is latent.
