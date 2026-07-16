import { loadConfig } from '../../packages/config/src/index.ts';
import { evaluateWhatsAppCanaryReadiness } from '../../packages/domain/src/index.ts';

const config = loadConfig(process.env);
const readiness = evaluateWhatsAppCanaryReadiness(config);

process.stdout.write(
  JSON.stringify(
    {
      checkpoint: readiness.checkpoint,
      canary_recipient_secret_configured: Boolean(config.whatsappCanaryRecipientE164),
      provider_env: config.whatsappProviderEnv,
      staging_isolated: config.whatsappStagingIsolated,
      canary_authorized: config.whatsappCanaryAuthorized,
      recipient_value_printed: false,
    },
    null,
    2,
  ),
);
process.stdout.write('\n');
