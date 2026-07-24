# OT-LAUNCH-01 Video-to-Student Classroom Handoff

## Current external-canary checkpoint

- Task: `OT-LAUNCH-01-MEDIA-EXTERNAL-CANARY-01`
- Acceptance: `CONTENT-002`
- Governed base: `bc14fa0be3f6420b048e7ba2cc1667bfbcd413a0`
- Branch: `codex/media-external-canary`
- Draft PR: `#117`
- Result: `accepted_and_cleaned_up`
- Runtime source: `089d724bdd901a2a009770fecf58c6d9e68df494`
- Runtime version: `full-app-staging-live-089d724`
- Production changed: no
- OpenAI transcription requests: 1
- Private Vimeo uploads: 1
- Vimeo caption tracks activated: 1
- Provider or media-processing retries: 0
- Content-factory imports: 1
- Accepted occurrence-scoped publications: 1
- Final canary state: approved and unpublished
- Customer communications: zero

The durable occurrence-scoped pipeline remains accepted in deployed product source
`089d724bdd901a2a009770fecf58c6d9e68df494`. This checkpoint does not rebuild or
reseed that pipeline.

### Sanitized provider result

- The exact operator-approved 1.82 GB, 42:18, 1280 x 720 private MP4 was selected
  by its previously verified safe metadata. The small Drive smoke fixture and all
  other local videos remained excluded.
- Conservative opening/closing trim accepted 2,483,900 ms of prepared media from
  a 2,570,167 ms derived-edge-silence canary source. No middle cut was made and the
  operator's original file was not modified.
- One OpenAI `whisper-1` request produced 434 timestamped segments and WebVTT.
- One private Vimeo asset completed transcoding with one active caption track.
  Provider privacy and playback readback passed without committing or displaying
  a provider ID, raw Vimeo URL, private source locator, credential, or transcript.
- The exact item persisted once as `needs_review`; no import, transcription, upload,
  caption, or provider retry occurred.

### Admin, Student, and cleanup acceptance

- The existing private conductor handoff supplied only the established fictional
  Admin and Student sessions. No credential, cookie, login code, account, or data
  was created or rendered.
- The exact existing fictional occurrence was temporarily narrowed to one entitled
  learner for the bounded publication proof. The accepted publication created one
  active content entitlement and zero sibling entitlements.
- The first fictional-Student readback caught a malformed AI-generated title. That
  publication was immediately revoked. The title, description, topics, questions,
  and takeaways were replaced with neutral human-reviewed staging metadata before
  the accepted publication.
- The entitled fictional Student opened the approved description, five questions,
  active captions, progress state, and first-party protected player. The ordinary
  document contained no raw Vimeo URL.
- The fictional sibling's Library omitted the canary, and its direct lesson request
  returned metadata-safe unavailability without the title, description, transcript,
  or provider URL.
- Final unpublish removed the lesson from a fresh entitled-Student Library and
  revoked the prior route. Zero active canary content entitlements remain, and the
  original three-learner fictional occurrence roster was restored.
- Web and content-factory provider gates were returned to synthetic/provider-off.
  The standalone worker has no real content-provider mode configured.

### Exact blocker

None. The private Vimeo asset and active caption track remain private as the
accepted provider canary; first-party publication is approved but unpublished.
Persistent staging contains only that reviewed canary record and its revoked
first-party publication projection. Production and customer systems were not
changed.

### Current verification

- Focused media/content unit, including migration safety: 26/26 pass.
- Focused durable content/portal integration: 7/7 pass, including lease fencing,
  occurrence-scoped publication, sibling denial, and unpublish revocation.
- Local Chromium Admin upload/review/publish step: pass.
- Exact deployed staging browser: entitled Student playback, first-party embed,
  captions, approved summary/questions, sibling Library omission, metadata-safe
  direct denial, and fresh-session unpublish revocation all pass.
- The remaining local multi-step Chromium cases cannot enter the Student portal
  because the repository's in-memory `pg-mem` harness rejects the existing
  production portal query with `lookups on joins`; this is a test-double limit, not
  a live-runtime failure. Exact staging browser and real-PostgreSQL integration
  evidence are terminal for this canary.
- Typecheck, build, lint, scoped format, secret scan across 2,079 repository text
  files, goal validation, generated launch-status check, and diff check: pass.
- Draft PR #117 GitHub checks: 4/4 pass.

## Integration identity

- Repository: `shloimie-beep/onetimev2`
- Branch: `codex/vimeo-drive-content-factory`
- Draft PR: `#104`
- Base branch: `codex/vimeo-autotrim-transcription-repair`
- Base SHA: `0e8b903385d0f1717f8f6e051f4a322739e175d7`
- Prior checkpoint head: `d19743b0611f3df70e4844fe781cd6dc7a20eed8`
- Isolated Railway environment: `onetimev2-pr-104` (`9dab756f-eac1-4abd-95c7-73f8579552eb`)
- Persistent staging and production mutations: forbidden for this lane

## Unique commits beyond PR #101

| Commit                                       | Purpose                                                                                  |
| -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `89907a90e81a3829c87d622c16f1c5610000d0c0`   | Private Drive/local intake, transcript-grounded drafts, Admin review, protected playback |
| `a8633b83cf58e929d4cc2c6692f168100b5963ca`   | Restart-safe PR #101 autotrim migration constraint                                       |
| `d19743b0611f3df70e4844fe781cd6dc7a20eed8`   | Admin and Student content-factory browser smokes                                         |
| `a79332ea8339f1409981e889a8f10455de2e2def`   | Operator intake UI, synthetic demo contract, `2214` collision repair, and handoff        |
| `7c349e997147f466e80d49670b5fe9ba6d3279c5`   | Railway runtime proof reports the deployed source commit                                 |
| PR exact head reported in the final response | OT-LAUNCH-01 operator intake, demo seed, `2214` collision repair, and handoff            |

The authoritative changed-path set is `git diff --name-only 0e8b903385d0f1717f8f6e051f4a322739e175d7...HEAD`. The shared hotspots in this lane are:

- `apps/web/src/server/app.ts`
- `apps/web/src/client/app/content-workspace/ContentWorkspace.tsx`
- `apps/web/src/client/app/content-workspace/content-workspace.css`
- `apps/web/src/client/features/portals/PortalFeatures.tsx`
- `packages/contracts/src/content/content-factory.ts`
- `packages/contracts/src/portals/index.ts`
- `packages/domain/src/content/content-factory.ts`
- `packages/domain/src/content/learning-delivery-inputs.ts`
- `packages/domain/src/content/service.ts`
- `packages/domain/src/portals/services.ts`
- `packages/domain/src/index.ts`
- `packages/db/migrations/2209_learning_delivery_autotrim_transcripts.sql`
- `packages/db/migrations/2214_learning_delivery_content_factory.sql`
- `tests/support/test-server.ts`

## Semantic patch boundary

- Before: PR #101 base `0e8b903385d0f1717f8f6e051f4a322739e175d7`.
- After: the exact PR #104 head reported in the final response and independently exposed by the isolated preview's `/version` response.
- Included: protected Drive/local-drop intake, edge-only conservative trim orchestration, timestamped transcription and WebVTT persistence, editable draft metadata/questions, private Vimeo projection, Admin review controls, published-only Student playback, isolated synthetic preview seed, focused tests, and this conductor handoff.
- Excluded: changes to persistent staging or production, provider resources created before explicit operator approval, and changes to the accepted PR #101 media semantics outside the retry-safe migration guard.

## Migration ledger

- Read-only persistent-staging readiness check on 2026-07-22: `latest=2213_learning_delivery_autotrim_transcripts`.
- Applied prefixes supplied by the launch ledger: `2210` and `2211` Tisha, `2212` Rabbi, `2213` Vimeo autotrim.
- PR #104 content-factory migration: `2214_learning_delivery_content_factory.sql`.
- Canonical-LF SHA-256 at handoff authoring: `7c5a8ad21cc4610dc32c2378b72e2024eafc45445a9658a1ae1e9783fcf8068c`.
- The prior colliding `2210_learning_delivery_content_factory.sql` path is absent from this branch.
- `2214` uses restart-safe table/index creation so the existing isolated PR environment can converge without rewriting any applied persistent-staging migration.
- Control-tower reservation: `2214_learning_delivery_content_factory` is already applied in the PR #104 preview and must not be renamed during convergence. Any uncommitted downstream collision must move to the next free prefix.

## Configuration contract

Names only; values stay in protected configuration:

- `DATABASE_URL`
- `DATABASE_SSL`
- `RUN_MIGRATIONS_ON_STARTUP`
- `ONE_TIME_ACCOUNT_KEY`
- `ONE_TIME_PRODUCT_KEY`
- `CONTENT_FACTORY_LOCAL_DROP_DIR`
- `CONTENT_FACTORY_MAX_UPLOAD_BYTES`
- `CONTENT_FACTORY_DEMO_PASSWORD` (isolated synthetic-preview seed only)
- `GOOGLE_DRIVE_FOLDER_ID`
- `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON`
- `OPENAI_API_KEY`
- `VIMEO_ACCESS_TOKEN`
- `VIMEO_TEST_PROJECT_URI`
- `LEARNING_DELIVERY_SOURCE_PATH`
- `LEARNING_DELIVERY_CANARY_OUT_DIR`
- `LEARNING_DELIVERY_ALLOW_DERIVED_EDGE_SILENCE`
- `LEARNING_DELIVERY_ALLOW_VIMEO_UPLOAD`

## Route registrations

- `GET /api/v1/admin/content/factory` — Admin-only safe workspace projection.
- `POST /api/v1/admin/content/factory/intake` — Admin-only, CSRF-protected streaming upload into protected local staging.
- `PATCH /api/v1/admin/content/factory/:sourceKey` — editable transcript and lesson drafts.
- `POST /api/v1/admin/content/factory/:sourceKey/:action` — approve, publish, unpublish, or retry.
- `GET /app/learning/items/:sourceKey` — authenticated Parent/Student/Admin playback page.
- `GET /api/v1/content/factory/:sourceKey/embed` — authenticated first-party playback authorization seam.

Normal browser payloads expose no raw Drive path, Vimeo URL, provider ID, upload ticket, or token.

## OT-LAUNCH-01 seed contract

- Account/product scope: configured One Time account and Mishnayos product.
- Class label: `OT-LAUNCH-01 Mishnayos`.
- Class date: `2026-07-22`.
- Household key: `ot_launch_01_household`.
- Learner key: `ot_launch_01_student`.
- Class series key: `ot_launch_01_class`.
- Class occurrence key: `ot_launch_01_class_2026_07_22`.
- Demo source key: `ot_launch_01_demo_hashavas_aveidah`.
- Demo title: `[Demo] Hashavas Aveidah: Signs and Announcements`.
- Content basis: approved synthetic transcript, captions, five review questions, and three takeaways; no provider call and no authoritative Torah interpretation.
- Audience: the idempotently seeded OT-LAUNCH-01 active household/student identity through the `all_active_learners` entitlement created at publish.
- Preview identities: the seed creates one synthetic owner and one synthetic Student under reserved `example.test` addresses; the password is supplied only at runtime through `CONTENT_FACTORY_DEMO_PASSWORD` and is never committed.
- Demo command: `npm run content-factory:seed-demo`.
- Safety: the command exits when `DELIVERY_ENVIRONMENT=production`; run it only against the existing isolated PR database.
- Student projection: only `status=published` content-factory lessons are rendered; unapproved and unrelated dead fixtures are filtered from the Student library.

## Focused verification

- `tests/unit/content/content-factory.test.ts`
- `tests/unit/content/content-factory-migration.test.ts`
- `tests/unit/content/learning-delivery.test.ts`
- `tests/integration/content/content-factory.test.ts`
- `tests/integration/content/learning-delivery-demo-route.test.ts`
- `tests/integration/runtime-version-proof.test.ts`
- `tests/e2e/content-factory.spec.ts`
- `npm run typecheck`
- `npm run build`
- `npm run lint`
- `npm run format`
- `npm run brand:check`
- `npm run secret:scan`
- `git diff --check`

## Exact external canary gate

Do not read, transcribe, upload, or publish the identified operator-owned sample through an external provider until the operator replies exactly:

`I approve sending one operator-owned sample to OpenAI and private Vimeo`

After that approval, this same task may resolve the already identified protected local sample and run:

1. `npm run learning-delivery:real-canary -- --source=<protected-operator-path> --allow-derived-edge-silence=1 --allow-vimeo-upload=1 --out-dir=<protected-output-directory>`
2. Verify edge-only trim, timestamp segments, private Vimeo privacy, active captions, safe duration, and no raw provider URL in normal UI/evidence.
3. `npm run content-factory:import -- --path=<protected-output-directory>/content-factory-import.private.json` against only the existing isolated PR database.
4. Review and accept the operator-owned canary in the Admin UI before approve/publish.
5. Confirm the published lesson appears for the fictional Student through the first-party protected player.

The prepared asset, private import manifest, transcript, provider IDs, provider URLs, and tokens remain outside committed evidence.
