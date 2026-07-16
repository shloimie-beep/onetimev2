import { z } from 'zod';

const booleanFromString = z
  .union([z.boolean(), z.string()])
  .optional()
  .default(false)
  .transform((value) => value === true || value === 'true' || value === '1');

const numberFromString = z
  .union([z.number(), z.string()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === '') return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new Error('Expected number-like value');
    return parsed;
  });

const OT89_LOCAL_ONETIME_KEY_ID = 'ot89-onetime-local';
const OT89_LOCAL_ONETIME_SECRET = 'ot89-test-secret-do-not-use-local-producer';
const OT89_LOCAL_BNA_KEY_ID = 'ot89-bna-local';
const OT89_LOCAL_BNA_SECRET = 'ot89-test-secret-do-not-use-local-consumer';
const OT89_KNOWN_TEST_VALUES = new Set([
  OT89_LOCAL_ONETIME_KEY_ID,
  OT89_LOCAL_ONETIME_SECRET,
  OT89_LOCAL_BNA_KEY_ID,
  OT89_LOCAL_BNA_SECRET,
  'ot89-test-secret-do-not-use',
  'ot89-test-secret-do-not-use-reverse',
]);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: numberFromString.default(3000),
  PUBLIC_BASE_URL: z.url().default('https://join.onetimeonetime.com'),
  APP_VERSION: z.string().min(1).default('local'),
  COMMIT_SHA: z.string().min(1).default('local'),
  DATABASE_URL: z.string().optional(),
  DATABASE_SSL: booleanFromString,
  RUN_MIGRATIONS_ON_STARTUP: booleanFromString,
  TRUSTED_PROXY_HOPS: numberFromString.default(0),
  ONE_TIME_ACCOUNT_KEY: z.string().min(1).default('one_time'),
  ONE_TIME_PRODUCT_KEY: z.string().min(1).default('one_time_mishnah_class'),
  ONE_TIME_OWNER_INTERNAL_LABEL: z.string().min(1).default('Rabbi'),
  ONE_TIME_ADMIN_CUSTOMER_LABEL: z.string().min(1).default('Admin'),
  LEAD_RATE_LIMIT_WINDOW_MS: numberFromString.default(60_000),
  LEAD_RATE_LIMIT_MAX: numberFromString.default(5),
  LEAD_IDENTIFIER_RATE_LIMIT_MAX: numberFromString.default(3),
  LEAD_ACCOUNT_RATE_LIMIT_MAX: numberFromString.default(120),
  LEAD_GLOBAL_RATE_LIMIT_MAX: numberFromString.default(600),
  LOGIN_RATE_LIMIT_WINDOW_MS: numberFromString.default(15 * 60_000),
  LOGIN_IDENTIFIER_RATE_LIMIT_MAX: numberFromString.default(5),
  LOGIN_IP_RATE_LIMIT_MAX: numberFromString.default(30),
  LOGIN_ACCOUNT_RATE_LIMIT_MAX: numberFromString.default(120),
  LOGIN_GLOBAL_RATE_LIMIT_MAX: numberFromString.default(600),
  SESSION_LAST_SEEN_WRITE_INTERVAL_MS: numberFromString.default(5 * 60_000),
  AUTH_CSRF_SECRET: z.string().min(32).optional(),
  MFA_SECRET_ENCRYPTION_KEY: z.string().optional(),
  ONE_TIME_LIFECYCLE_DELIVERY_KEY_ID: z.string().min(1).max(120).default('local-lifecycle-v1'),
  ONE_TIME_LIFECYCLE_DELIVERY_KEY: z.string().min(32).optional(),
  OUTBOX_TRANSPORT_MODE: z.enum(['sink', 'mock']).default('sink'),
  ONE_TIME_EMAIL_FROM: z.string().optional(),
  ONE_TIME_EMAIL_REPLY_TO: z.string().optional(),
  ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED: booleanFromString,
  ONE_TIME_RESEND_TRANSPORT_ENABLED: booleanFromString,
  ONE_TIME_DELIVERY_TEST_CANARY_EMAIL: z.string().email().optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  ONE_TIME_OWNER_TEST_WHATSAPP: z.string().optional(),
  ONE_TIME_OWNER_TEST_EMAIL: z.string().optional(),
  ONE_TIME_PARENT_TEST_EMAIL: z.string().optional(),
  ONE_TIME_WHATSAPP_PROVIDER_ACCOUNT_KEY: z.string().min(1).default('one_time_meta_cloud_staging'),
  ONE_TIME_WHATSAPP_PROVIDER_ENV: z.enum(['UNKNOWN', 'STAGING', 'PRODUCTION']).default('UNKNOWN'),
  ONE_TIME_WHATSAPP_STAGING_ISOLATED: booleanFromString,
  ONE_TIME_WHATSAPP_WEBHOOK_SECRET: z.string().min(16).optional(),
  ONE_TIME_WHATSAPP_VERIFY_TOKEN: z.string().min(8).optional(),
  ONETIME_CANARY_WHATSAPP_RECIPIENT_E164: z.string().optional(),
  ONETIME_WHATSAPP_CANARY_AUTHORIZED: booleanFromString,
  OT86_PUBLISH_SIGNING_KEY_ID: z.string().optional(),
  OT86_PUBLISH_SIGNING_SECRET: z.string().optional(),
  OT86_PREVIOUS_PUBLISH_SIGNING_KEY_ID: z.string().optional(),
  OT86_PREVIOUS_PUBLISH_SIGNING_SECRET: z.string().optional(),
  BUFFER_ACCESS_TOKEN: z.string().optional(),
  BUFFER_ORGANIZATION_ID: z.string().optional(),
  BUFFER_DESTINATION_IDS: z.string().optional(),
  ENABLE_REAL_EMAIL_TRANSPORT: booleanFromString,
  ENABLE_REAL_WHATSAPP_TRANSPORT: booleanFromString,
  ENABLE_REAL_TELEGRAM_TRANSPORT: booleanFromString,
  ENABLE_PAYMENT_TRANSPORT: booleanFromString,
  ONE_TIME_TELEGRAM_WEBHOOK_ENABLED: booleanFromString,
  ONE_TIME_TELEGRAM_WEBHOOK_SECRET: z.string().min(16).optional(),
  ONE_TIME_TELEGRAM_BOT_KEY: z.string().min(1).default('one_time_internal_ops'),
  ONE_TIME_TELEGRAM_ENVIRONMENT: z.enum(['local', 'staging', 'production']).default('staging'),
  ZOOM_CLASSROOM_ENABLED: booleanFromString,
  ZOOM_CLASSROOM_PROVIDER_MODE: z.enum(['sink', 'real']).default('sink'),
  ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED: booleanFromString,
  ZOOM_CLASSROOM_COMPONENT_VIEW_ENABLED: booleanFromString.default(true),
  ZOOM_CLASSROOM_MUTE_ON_JOIN: booleanFromString.default(true),
  ZOOM_CLASSROOM_CANARY_ENABLED: booleanFromString,
  ZOOM_CLASSROOM_JOIN_GRANT_TTL_SECONDS: numberFromString.default(90),
  ZOOM_CLASSROOM_CLASS_DURATION_MINUTES: numberFromString.default(60),
  ZOOM_CLASSROOM_JOIN_OPEN_OFFSET_MINUTES: numberFromString.default(15),
  ZOOM_CLASSROOM_JOIN_CLOSE_OFFSET_MINUTES: numberFromString.default(15),
  ZOOM_MEETING_SDK_KEY: z.string().optional(),
  ZOOM_MEETING_SDK_SECRET: z.string().optional(),
  ZOOM_ACCOUNT_ID: z.string().optional(),
  SUPPORT_RATE_LIMIT_WINDOW_MS: numberFromString.default(60_000),
  SUPPORT_RATE_LIMIT_MAX: numberFromString.default(6),
  SUPPORT_ACCOUNT_RATE_LIMIT_MAX: numberFromString.default(120),
  OT89_SUPPORT_ENABLED: booleanFromString,
  OT89_SUPPORT_DELIVERY_MODE: z.enum(['disabled', 'mock']).default('disabled'),
  OT89_SUPPORT_BNA_BASE_URL: z.url().optional(),
  OT89_SUPPORT_HMAC_KEY_ID: z.string().min(1).max(80).optional(),
  OT89_SUPPORT_HMAC_SECRET: z.string().min(16).optional(),
  OT89_BNA_TO_ONETIME_HMAC_KEY_ID: z.string().min(1).max(80).optional(),
  OT89_BNA_TO_ONETIME_HMAC_SECRET: z.string().min(16).optional(),
  OT89_MOCK_BNA_ENABLED: booleanFromString,
  OT89_MOCK_BNA_OUTAGE: booleanFromString,
  OT89_SUPPORT_DEPLOYMENT_ID: z.string().min(1).max(64).default('local-ot89a'),
  LIVE_STRIPE_CHARGES_AUTHORIZED: z.string().optional(),
});

export type AppConfig = ReturnType<typeof loadConfig>;

export function loadConfig(source: NodeJS.ProcessEnv) {
  const parsed = envSchema.parse(source);
  const guardedStripeTestTransport =
    parsed.ENABLE_PAYMENT_TRANSPORT && parsed.LIVE_STRIPE_CHARGES_AUTHORIZED === 'NO';
  const realTransportsEnabled =
    parsed.ENABLE_REAL_EMAIL_TRANSPORT ||
    parsed.ENABLE_REAL_WHATSAPP_TRANSPORT ||
    parsed.ENABLE_REAL_TELEGRAM_TRANSPORT ||
    (parsed.ENABLE_PAYMENT_TRANSPORT && !guardedStripeTestTransport);

  if (parsed.NODE_ENV !== 'test' && realTransportsEnabled) {
    throw new Error('Real transports are outside this task and must remain disabled.');
  }

  if (parsed.ZOOM_CLASSROOM_CANARY_ENABLED && parsed.NODE_ENV !== 'test') {
    throw new Error('Zoom canary execution is outside this local task and must remain disabled.');
  }

  if (parsed.NODE_ENV === 'production' && parsed.RUN_MIGRATIONS_ON_STARTUP) {
    throw new Error('Production web startup cannot run migrations automatically.');
  }

  if (parsed.NODE_ENV === 'production' && parsed.OT89_SUPPORT_DELIVERY_MODE !== 'disabled') {
    throw new Error('OT89 support delivery must remain disabled in production.');
  }

  if (parsed.NODE_ENV === 'production' && parsed.OT89_MOCK_BNA_ENABLED) {
    throw new Error('OT89 mock BNA endpoint is forbidden in production.');
  }

  const ot89ProvidedSecrets = [
    parsed.OT89_SUPPORT_HMAC_KEY_ID,
    parsed.OT89_SUPPORT_HMAC_SECRET,
    parsed.OT89_BNA_TO_ONETIME_HMAC_KEY_ID,
    parsed.OT89_BNA_TO_ONETIME_HMAC_SECRET,
  ].filter((value): value is string => Boolean(value));

  if (
    parsed.NODE_ENV === 'production' &&
    ot89ProvidedSecrets.some((value) => OT89_KNOWN_TEST_VALUES.has(value))
  ) {
    throw new Error('Known OT89 test HMAC defaults are forbidden in production.');
  }

  if (parsed.OT89_SUPPORT_DELIVERY_MODE === 'mock' && !parsed.OT89_SUPPORT_BNA_BASE_URL) {
    throw new Error('OT89_SUPPORT_BNA_BASE_URL is required for mock support delivery.');
  }

  if (parsed.OT89_SUPPORT_ENABLED && parsed.OT89_SUPPORT_DELIVERY_MODE === 'disabled') {
    throw new Error('OT89 support cannot be enabled without a configured delivery mode.');
  }

  if (
    (parsed.OT89_SUPPORT_ENABLED ||
      parsed.OT89_SUPPORT_DELIVERY_MODE !== 'disabled' ||
      parsed.OT89_MOCK_BNA_ENABLED) &&
    (!parsed.OT89_SUPPORT_HMAC_KEY_ID ||
      !parsed.OT89_SUPPORT_HMAC_SECRET ||
      !parsed.OT89_BNA_TO_ONETIME_HMAC_KEY_ID ||
      !parsed.OT89_BNA_TO_ONETIME_HMAC_SECRET)
  ) {
    throw new Error('OT89 support HMAC key IDs and secrets are required when support is enabled.');
  }

  if (parsed.NODE_ENV === 'production' && !parsed.AUTH_CSRF_SECRET) {
    throw new Error('AUTH_CSRF_SECRET is required in production.');
  }

  if (parsed.NODE_ENV === 'production' && parsed.ONE_TIME_TELEGRAM_WEBHOOK_ENABLED) {
    if (!parsed.ONE_TIME_TELEGRAM_WEBHOOK_SECRET) {
      throw new Error(
        'ONE_TIME_TELEGRAM_WEBHOOK_SECRET is required when Telegram webhook is enabled.',
      );
    }
    if (parsed.ONE_TIME_TELEGRAM_ENVIRONMENT !== 'production') {
      throw new Error('Production Telegram webhook must use production Telegram environment.');
    }
  }

  if (
    parsed.NODE_ENV === 'production' &&
    ['owner', 'admin'].some(Boolean) &&
    !parsed.MFA_SECRET_ENCRYPTION_KEY
  ) {
    throw new Error('MFA_SECRET_ENCRYPTION_KEY is required in production.');
  }

  return {
    nodeEnv: parsed.NODE_ENV,
    isProduction: parsed.NODE_ENV === 'production',
    port: parsed.PORT,
    publicBaseUrl: parsed.PUBLIC_BASE_URL,
    appVersion: parsed.APP_VERSION,
    commitSha: parsed.COMMIT_SHA,
    databaseUrl: parsed.DATABASE_URL,
    databaseSsl: parsed.DATABASE_SSL,
    runMigrationsOnStartup: parsed.RUN_MIGRATIONS_ON_STARTUP,
    trustedProxyHops: parsed.TRUSTED_PROXY_HOPS,
    accountKey: parsed.ONE_TIME_ACCOUNT_KEY,
    productKey: parsed.ONE_TIME_PRODUCT_KEY,
    ownerInternalLabel: parsed.ONE_TIME_OWNER_INTERNAL_LABEL,
    adminCustomerLabel: parsed.ONE_TIME_ADMIN_CUSTOMER_LABEL,
    leadRateLimitWindowMs: parsed.LEAD_RATE_LIMIT_WINDOW_MS,
    leadRateLimitMax: parsed.LEAD_RATE_LIMIT_MAX,
    leadIdentifierRateLimitMax: parsed.LEAD_IDENTIFIER_RATE_LIMIT_MAX,
    leadAccountRateLimitMax: parsed.LEAD_ACCOUNT_RATE_LIMIT_MAX,
    leadGlobalRateLimitMax: parsed.LEAD_GLOBAL_RATE_LIMIT_MAX,
    loginRateLimitWindowMs: parsed.LOGIN_RATE_LIMIT_WINDOW_MS,
    loginIdentifierRateLimitMax: parsed.LOGIN_IDENTIFIER_RATE_LIMIT_MAX,
    loginIpRateLimitMax: parsed.LOGIN_IP_RATE_LIMIT_MAX,
    loginAccountRateLimitMax: parsed.LOGIN_ACCOUNT_RATE_LIMIT_MAX,
    loginGlobalRateLimitMax: parsed.LOGIN_GLOBAL_RATE_LIMIT_MAX,
    sessionLastSeenWriteIntervalMs: parsed.SESSION_LAST_SEEN_WRITE_INTERVAL_MS,
    authCsrfSecret:
      parsed.AUTH_CSRF_SECRET ?? 'local-only-auth-csrf-secret-for-tests-and-development',
    mfaSecretEncryptionKey:
      parsed.MFA_SECRET_ENCRYPTION_KEY ?? 'test-only-32-byte-mfa-key-do-not-use',
    lifecycleDeliveryKeyId: parsed.ONE_TIME_LIFECYCLE_DELIVERY_KEY_ID,
    lifecycleDeliveryKey:
      parsed.ONE_TIME_LIFECYCLE_DELIVERY_KEY ??
      (parsed.NODE_ENV === 'production'
        ? undefined
        : 'test-only-lifecycle-delivery-key-do-not-use'),
    lifecycleDeliveryKeyConfigured: Boolean(parsed.ONE_TIME_LIFECYCLE_DELIVERY_KEY),
    outboxTransportMode: parsed.OUTBOX_TRANSPORT_MODE,
    emailFrom: parsed.ONE_TIME_EMAIL_FROM,
    emailReplyTo: parsed.ONE_TIME_EMAIL_REPLY_TO,
    deliveryProviderTransportEnabled: parsed.ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED,
    resendTransportEnabled: parsed.ONE_TIME_RESEND_TRANSPORT_ENABLED,
    deliveryTestCanaryEmail: parsed.ONE_TIME_DELIVERY_TEST_CANARY_EMAIL?.trim().toLowerCase(),
    resendApiKey: parsed.RESEND_API_KEY,
    ownerTestWhatsapp: parsed.ONE_TIME_OWNER_TEST_WHATSAPP,
    ownerTestEmail: parsed.ONE_TIME_OWNER_TEST_EMAIL,
    parentTestEmail: parsed.ONE_TIME_PARENT_TEST_EMAIL,
    whatsappProviderAccountKey: parsed.ONE_TIME_WHATSAPP_PROVIDER_ACCOUNT_KEY,
    whatsappProviderEnv: parsed.ONE_TIME_WHATSAPP_PROVIDER_ENV,
    whatsappStagingIsolated: parsed.ONE_TIME_WHATSAPP_STAGING_ISOLATED,
    whatsappWebhookSecret: parsed.ONE_TIME_WHATSAPP_WEBHOOK_SECRET,
    whatsappVerifyToken: parsed.ONE_TIME_WHATSAPP_VERIFY_TOKEN,
    whatsappCanaryRecipientE164: parsed.ONETIME_CANARY_WHATSAPP_RECIPIENT_E164,
    whatsappCanaryAuthorized: parsed.ONETIME_WHATSAPP_CANARY_AUTHORIZED,
    oneTimeTelegramWebhookEnabled: parsed.ONE_TIME_TELEGRAM_WEBHOOK_ENABLED,
    oneTimeTelegramWebhookSecret: parsed.ONE_TIME_TELEGRAM_WEBHOOK_SECRET,
    oneTimeTelegramBotKey: parsed.ONE_TIME_TELEGRAM_BOT_KEY,
    oneTimeTelegramEnvironment: parsed.ONE_TIME_TELEGRAM_ENVIRONMENT,
    zoomClassroomEnabled: parsed.ZOOM_CLASSROOM_ENABLED,
    zoomClassroomProviderMode: parsed.ZOOM_CLASSROOM_PROVIDER_MODE,
    zoomClassroomRealProviderEnabled: parsed.ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED,
    zoomClassroomComponentViewEnabled: parsed.ZOOM_CLASSROOM_COMPONENT_VIEW_ENABLED,
    zoomClassroomMuteOnJoin: parsed.ZOOM_CLASSROOM_MUTE_ON_JOIN,
    zoomClassroomCanaryEnabled: parsed.ZOOM_CLASSROOM_CANARY_ENABLED,
    zoomClassroomJoinGrantTtlSeconds: parsed.ZOOM_CLASSROOM_JOIN_GRANT_TTL_SECONDS,
    zoomClassroomClassDurationMinutes: parsed.ZOOM_CLASSROOM_CLASS_DURATION_MINUTES,
    zoomClassroomJoinOpenOffsetMinutes: parsed.ZOOM_CLASSROOM_JOIN_OPEN_OFFSET_MINUTES,
    zoomClassroomJoinCloseOffsetMinutes: parsed.ZOOM_CLASSROOM_JOIN_CLOSE_OFFSET_MINUTES,
    zoomMeetingSdkKeyConfigured: Boolean(parsed.ZOOM_MEETING_SDK_KEY),
    zoomMeetingSdkSecretConfigured: Boolean(parsed.ZOOM_MEETING_SDK_SECRET),
    zoomAccountIdConfigured: Boolean(parsed.ZOOM_ACCOUNT_ID),
    supportRateLimitWindowMs: parsed.SUPPORT_RATE_LIMIT_WINDOW_MS,
    supportRateLimitMax: parsed.SUPPORT_RATE_LIMIT_MAX,
    supportAccountRateLimitMax: parsed.SUPPORT_ACCOUNT_RATE_LIMIT_MAX,
    ot89SupportEnabled: parsed.OT89_SUPPORT_ENABLED,
    ot89SupportDeliveryMode: parsed.OT89_SUPPORT_DELIVERY_MODE,
    ot89SupportBnaBaseUrl: parsed.OT89_SUPPORT_BNA_BASE_URL,
    ot89SupportHmacKeyId:
      parsed.OT89_SUPPORT_HMAC_KEY_ID ??
      (parsed.NODE_ENV === 'production' ? '' : OT89_LOCAL_ONETIME_KEY_ID),
    ot89SupportHmacSecret:
      parsed.OT89_SUPPORT_HMAC_SECRET ??
      (parsed.NODE_ENV === 'production' ? '' : OT89_LOCAL_ONETIME_SECRET),
    ot89BnaToOnetimeHmacKeyId:
      parsed.OT89_BNA_TO_ONETIME_HMAC_KEY_ID ??
      (parsed.NODE_ENV === 'production' ? '' : OT89_LOCAL_BNA_KEY_ID),
    ot89BnaToOnetimeHmacSecret:
      parsed.OT89_BNA_TO_ONETIME_HMAC_SECRET ??
      (parsed.NODE_ENV === 'production' ? '' : OT89_LOCAL_BNA_SECRET),
    ot89MockBnaEnabled: parsed.OT89_MOCK_BNA_ENABLED,
    ot89MockBnaOutage: parsed.OT89_MOCK_BNA_OUTAGE,
    ot89SupportDeploymentId: parsed.OT89_SUPPORT_DEPLOYMENT_ID,
    ot86PublishSigningKeyId: parsed.OT86_PUBLISH_SIGNING_KEY_ID,
    ot86PublishSigningSecret: parsed.OT86_PUBLISH_SIGNING_SECRET,
    ot86PreviousPublishSigningKeyId: parsed.OT86_PREVIOUS_PUBLISH_SIGNING_KEY_ID,
    ot86PreviousPublishSigningSecret: parsed.OT86_PREVIOUS_PUBLISH_SIGNING_SECRET,
    bufferAccessToken: parsed.BUFFER_ACCESS_TOKEN,
    bufferOrganizationId: parsed.BUFFER_ORGANIZATION_ID,
    bufferDestinationIds: parsed.BUFFER_DESTINATION_IDS,
  };
}
