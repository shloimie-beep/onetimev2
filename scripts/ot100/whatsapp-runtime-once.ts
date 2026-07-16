import 'dotenv/config';
import { loadConfig } from '../../packages/config/src/index.ts';
import { createPgPool } from '../../packages/db/src/index.ts';
import {
  createMetaWhatsAppCloudAdapterFromEnv,
  inspectMetaWhatsAppCloudReadiness,
  loadMetaWhatsAppCloudAdapterOptions,
  processQueuedWhatsAppOutbox,
} from '../../packages/domain/src/index.ts';

const options = loadMetaWhatsAppCloudAdapterOptions(process.env);
const readiness = inspectMetaWhatsAppCloudReadiness(options);

if (!readiness.ready) {
  process.stdout.write(
    `${JSON.stringify(
      {
        checkpoint: 'WAITING_FOR_OT100_WHATSAPP_STAGING_CANARY_CONFIG',
        readiness,
        external_send_performed: false,
      },
      null,
      2,
    )}\n`,
  );
  process.exit(0);
}

const config = loadConfig(process.env);
const pool = createPgPool(config);

try {
  const summary = await processQueuedWhatsAppOutbox({
    pool,
    config,
    adapter: createMetaWhatsAppCloudAdapterFromEnv(process.env),
    limit: Math.min(1, readiness.canary_budget),
    leaseOwner: 'ot100-whatsapp-runtime-once',
    leaseMs: 120_000,
    maxAttempts: 3,
    canaryOnly: true,
  });
  process.stdout.write(
    `${JSON.stringify(
      {
        checkpoint: 'OT100_WHATSAPP_RUNTIME_ONCE_COMPLETE',
        readiness: {
          ...readiness,
          access_token_configured: readiness.access_token_configured,
          canary_recipient_configured: readiness.canary_recipient_configured,
        },
        summary,
        canary_send_attempted: summary.claimed > 0,
        canary_send_count: summary.sent,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await pool.end();
}
