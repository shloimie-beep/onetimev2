# OT-LIVE-004 shared registration requests

These actions remain held for the integration owner after OT-LIVE-001 release/integration:

1. Mount the existing direct-upload service and Admin client workflow through `apps/web/src/server/app.ts` and the shared web router/client composition.
2. Register the ingest and processing workers in the shared worker registry/composition with default-off dependencies. The existing publication worker remains authority-gated and disabled when dependencies are absent.
3. Register protected configuration for the private S3 original/derivative store, optional Drive incoming folder, ffmpeg/ffprobe execution, pinned OpenAI operations, and private Vimeo authority/binding. The future direct/Drive storage adapters must emit matching `OT-MANAGED-ORIGINAL-1` managed-object and recovery-journal evidence. No provider adapter or credential is supplied by this checkpoint.
4. Add any desired exports to shared contracts/domain/database barrels. All checkpoint modules remain directly importable without those barrel changes.
5. Integrate and verify the already-present migration chain `2245`, `2246`, `2252`, and `2253`. This checkpoint requests no migration change because the new durability evidence is versioned inside existing record JSON.
6. Issue separate exact canary authority before one operator-controlled recording is uploaded or any Drive, S3, OpenAI, or Vimeo effect is attempted.

Package manifests, config schemas, global registries, shared barrels, migrations, and web/worker composition were not changed here.
