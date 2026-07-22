# OT-LAUNCH-01 Video-to-Student Classroom Handoff

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

## Migration ledger

- Read-only persistent-staging readiness check on 2026-07-22: `latest=2213_learning_delivery_autotrim_transcripts`.
- Applied prefixes supplied by the launch ledger: `2210` and `2211` Tisha, `2212` Rabbi, `2213` Vimeo autotrim.
- PR #104 content-factory migration: `2214_learning_delivery_content_factory.sql`.
- Canonical-LF SHA-256 at handoff authoring: `7c5a8ad21cc4610dc32c2378b72e2024eafc45445a9658a1ae1e9783fcf8068c`.
- The prior colliding `2210_learning_delivery_content_factory.sql` path is absent from this branch.
- `2214` uses restart-safe table/index creation so the existing isolated PR environment can converge without rewriting any applied persistent-staging migration.

## Configuration contract

Names only; values stay in protected configuration:

- `DATABASE_URL`
- `DATABASE_SSL`
- `RUN_MIGRATIONS_ON_STARTUP`
- `ONE_TIME_ACCOUNT_KEY`
- `ONE_TIME_PRODUCT_KEY`
- `CONTENT_FACTORY_LOCAL_DROP_DIR`
- `CONTENT_FACTORY_MAX_UPLOAD_BYTES`
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
- Demo source key: `ot_launch_01_demo_hashavas_aveidah`.
- Demo title: `[Demo] Hashavas Aveidah: Signs and Announcements`.
- Content basis: approved synthetic transcript, captions, five review questions, and three takeaways; no provider call and no authoritative Torah interpretation.
- Audience: the existing OT-LAUNCH-01 active household/student fixture through the `all_active_learners` entitlement created at publish.
- Demo command: `npm run content-factory:seed-demo`.
- Safety: the command exits when `DELIVERY_ENVIRONMENT=production`; run it only against the existing isolated PR database.
- Student projection: only `status=published` content-factory lessons are rendered; unapproved and unrelated dead fixtures are filtered from the Student library.

## Focused verification

- `tests/unit/content/content-factory.test.ts`
- `tests/unit/content/content-factory-migration.test.ts`
- `tests/unit/content/learning-delivery.test.ts`
- `tests/integration/content/content-factory.test.ts`
- `tests/integration/content/learning-delivery-demo-route.test.ts`
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
