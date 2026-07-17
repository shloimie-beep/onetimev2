# OT-85 Test Results

- Packet SHA-256 verification: passed for all files listed in `SHA256SUMS.txt`.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run secret:scan`: passed.
- `npx prettier --check` on touched parser-supported files: passed.
- `node --import tsx -e "... runMigrations(...)"`: passed; latest migration `2000_ot85_whatsapp_assistant`.
- `npm run unit -- --run tests/unit/whatsapp/ot85-intent-contract.test.ts`: passed, 5 tests.
- `npm run integration -- --run tests/integration/whatsapp/ot85-assistant.test.ts tests/integration/whatsapp/ot85-webhook-route.test.ts`: passed, 9 tests.
- `npm run integration -- --run tests/integration/lead-capture.test.ts tests/integration/telegram-db-foundation.test.ts`: passed after updating expectations for the new latest migration and due class-reminder sink count.
- `npm run test`: passed; 21 unit files / 127 tests and 20 integration files / 95 tests.
- `npm run build`: passed. Vite emitted an existing unresolved font runtime warning for `/assets/fonts/dm-serif-display-latin.woff2`.
- `npx tsx scripts/ot85/canary-readiness.ts`: returned `WAITING_FOR_WHATSAPP_CANARY_SECRET` with `recipient_value_printed: false`.

Known non-blocking validation notes:

- `npm run db:verify` cannot run without `DATABASE_URL`; pg-mem migration verification passed.
- Repository-wide `npm run format` reports pre-existing formatting warnings across hundreds of files on the OT83 base. Touched parser-supported files pass Prettier check.
