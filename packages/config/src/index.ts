import { z } from 'zod';

const booleanFromString = z
  .union([z.boolean(), z.string()])
  .optional()
  .default(false)
  .transform((value) => value === true || value === 'true' || value === '1');

const optionalBooleanFromString = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === '') return undefined;
    return value === true || value === 'true' || value === '1';
  });

const numberFromString = z
  .union([z.number(), z.string()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === '') return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new Error('Expected number-like value');
    return parsed;
  });

const boundedIntegerFromString = (minimum: number, maximum: number, defaultValue: number) =>
  z
    .union([z.number(), z.string()])
    .optional()
    .default(defaultValue)
    .transform((value) => Number(value))
    .pipe(z.number().int().min(minimum).max(maximum));

const optionalTrimmedString = (minimum: number, maximum: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().min(minimum).max(maximum).optional(),
  );

const optionalNonblankString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().min(1).optional(),
);

function parseUniqueCsv(value: string | undefined) {
  if (!value) return [];
  return [
    ...new Set(
      value
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ];
}

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

const deliveryEnvironmentSchema = z.enum(['local', 'test', 'isolated_staging', 'production']);

export type OneTimeRuntimeEnvironment = z.infer<typeof deliveryEnvironmentSchema>;

export const ONE_TIME_VERIFICATION_ENVIRONMENTS = [
  'ci',
  'provider_sandbox',
  'persistent_staging',
  'production_read_only',
  'production_operator_canary',
  'production_broad',
] as const;

const oneTimeVerificationEnvironmentSchema = z.enum(ONE_TIME_VERIFICATION_ENVIRONMENTS);

export type OneTimeVerificationEnvironment = z.infer<typeof oneTimeVerificationEnvironmentSchema>;
export type OneTimeRuntimeTier = 'isolated_staging' | 'production';

export const ONE_TIME_VERIFICATION_RUNTIME_TIER: Readonly<
  Record<OneTimeVerificationEnvironment, OneTimeRuntimeTier>
> = {
  ci: 'isolated_staging',
  provider_sandbox: 'isolated_staging',
  persistent_staging: 'isolated_staging',
  production_read_only: 'production',
  production_operator_canary: 'production',
  production_broad: 'production',
};

export const CURRENT_APPLICATION_ROLES = ['admin', 'parent', 'student'] as const;
export type CurrentApplicationRole = (typeof CURRENT_APPLICATION_ROLES)[number];

export const RETIRED_PRODUCTION_SURFACE_IDS = [
  'preview',
  'experience-demo',
  'fictional-customer',
  'class-helper',
  'buffer-social-publishing',
  'whatsapp-assistant',
  'test-lane',
  'parent-created-goal',
  'editable-badge-rule',
  'favorites',
  'background-pwa-push',
  'mfa',
  'school-administration',
] as const;
export type RetiredProductionSurfaceId = (typeof RETIRED_PRODUCTION_SURFACE_IDS)[number];

export function isCurrentApplicationRole(role: string): role is CurrentApplicationRole {
  return (CURRENT_APPLICATION_ROLES as readonly string[]).includes(role);
}

export type RuntimeClassification = {
  environment: OneTimeRuntimeEnvironment;
  isProductionRuntime: boolean;
  requiresSecureCookies: boolean;
  allowsMockOrDemo: boolean;
  allowsProviderActions: boolean;
  allowsStartupMigrations: boolean;
};

function defaultDeliveryEnvironment(
  nodeEnv: 'development' | 'test' | 'production',
): 'local' | 'test' | 'production' {
  if (nodeEnv === 'test') return 'test';
  if (nodeEnv === 'production') return 'production';
  return 'local';
}

export function classifyRuntime(input: {
  nodeEnv: 'development' | 'test' | 'production';
  deliveryEnvironment?: OneTimeRuntimeEnvironment | undefined;
  oneTimeRuntimeEnvironment?: OneTimeRuntimeEnvironment | undefined;
}): RuntimeClassification {
  const { nodeEnv, deliveryEnvironment, oneTimeRuntimeEnvironment } = input;
  if (
    deliveryEnvironment &&
    oneTimeRuntimeEnvironment &&
    deliveryEnvironment !== oneTimeRuntimeEnvironment
  ) {
    throw new Error(
      'DELIVERY_ENVIRONMENT and ONE_TIME_RUNTIME_ENVIRONMENT must name the same runtime.',
    );
  }

  const environment =
    oneTimeRuntimeEnvironment ?? deliveryEnvironment ?? defaultDeliveryEnvironment(nodeEnv);
  const allowedByNodeEnv: Record<typeof nodeEnv, readonly OneTimeRuntimeEnvironment[]> = {
    development: ['local', 'isolated_staging'],
    test: ['test', 'isolated_staging'],
    production: ['isolated_staging', 'production'],
  };
  if (!allowedByNodeEnv[nodeEnv].includes(environment)) {
    throw new Error(
      `Invalid runtime tuple: NODE_ENV=${nodeEnv} cannot run ${environment}; use one of ${allowedByNodeEnv[nodeEnv].join(', ')}.`,
    );
  }

  return {
    environment,
    isProductionRuntime: environment === 'production',
    requiresSecureCookies: nodeEnv === 'production' || environment === 'production',
    allowsMockOrDemo: environment !== 'production',
    allowsProviderActions: environment === 'test' || environment === 'isolated_staging',
    allowsStartupMigrations: environment === 'test',
  };
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DELIVERY_ENVIRONMENT: deliveryEnvironmentSchema.optional(),
  PORT: numberFromString.default(3000),
  PUBLIC_BASE_URL: z.url().default('https://join.onetimeonetime.com'),
  APP_VERSION: z.string().min(1).default('local'),
  COMMIT_SHA: z.string().min(1).default('local'),
  RAILWAY_DEPLOYMENT_ID: optionalTrimmedString(1, 160),
  RAILWAY_SNAPSHOT_ID: optionalTrimmedString(1, 160),
  RAILWAY_PROJECT_ID: optionalTrimmedString(1, 160),
  RAILWAY_ENVIRONMENT_ID: optionalTrimmedString(1, 160),
  RAILWAY_SERVICE_ID: optionalTrimmedString(1, 160),
  RAILWAY_SERVICE_NAME: optionalTrimmedString(1, 160),
  RAILWAY_GIT_COMMIT_SHA: optionalTrimmedString(1, 80),
  DATABASE_URL: z.string().optional(),
  DATABASE_SSL: booleanFromString,
  RUN_MIGRATIONS_ON_STARTUP: booleanFromString,
  TRUSTED_PROXY_HOPS: numberFromString.default(0),
  OPERATIONS_PROBE_TOKEN: z.string().min(24).optional(),
  OPERATIONS_WORKER_HEARTBEAT_TTL_MS: numberFromString.default(90_000),
  ONE_TIME_ACCOUNT_KEY: z.string().min(1).default('one_time'),
  ONE_TIME_PRODUCT_KEY: z.string().min(1).default('one_time_mishnayos'),
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
  PROTECTED_PAYLOAD_ENCRYPTION_KEY: z.string().optional(),
  ONE_TIME_LIFECYCLE_DELIVERY_KEY_ID: z.string().min(1).max(120).default('local-lifecycle-v1'),
  ONE_TIME_LIFECYCLE_DELIVERY_KEY: z.string().min(32).optional(),
  OUTBOX_TRANSPORT_MODE: z.enum(['sink', 'mock', 'provider']).default('sink'),
  ONE_TIME_RUNTIME_ENVIRONMENT: z
    .enum(['local', 'test', 'isolated_staging', 'production'])
    .optional(),
  ONE_TIME_VERIFICATION_ENVIRONMENT_ID: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    oneTimeVerificationEnvironmentSchema.optional(),
  ),
  ONE_TIME_CONTENT_MEDIA_MODE: z
    .enum(['off', 'synthetic_canary', 'provider_canary', 'production_broad'])
    .default('off'),
  ONE_TIME_CONTENT_MEDIA_AUTHORIZATION_ID: optionalTrimmedString(8, 160),
  ONE_TIME_CONTENT_CANARY_ID: optionalTrimmedString(8, 160),
  ONE_TIME_CONTENT_MEDIA_BATCH_SIZE: boundedIntegerFromString(1, 10, 2),
  ONE_TIME_CONTENT_MEDIA_CONCURRENCY: boundedIntegerFromString(1, 4, 1),
  CONTENT_S3_BUCKET: optionalTrimmedString(3, 255),
  CONTENT_S3_KMS_KEY_ARN: optionalTrimmedString(20, 500),
  CONTENT_S3_STORAGE_CLASS: z.enum(['STANDARD', 'INTELLIGENT_TIERING']).default('STANDARD'),
  AWS_REGION: optionalTrimmedString(3, 80),
  GOOGLE_DRIVE_FOLDER_ID: optionalTrimmedString(1, 300),
  GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON: optionalTrimmedString(2, 20_000),
  CONTENT_FFMPEG_PATH: optionalTrimmedString(1, 500),
  CONTENT_FFPROBE_PATH: optionalTrimmedString(1, 500),
  OPENAI_API_KEY: optionalTrimmedString(8, 500),
  OPENAI_PROJECT_ID: optionalTrimmedString(3, 200),
  OPENAI_ORGANIZATION_ID: optionalTrimmedString(3, 200),
  VIMEO_ACCESS_TOKEN: optionalTrimmedString(8, 500),
  VIMEO_ACCOUNT_ID: optionalTrimmedString(1, 200),
  VIMEO_WEBHOOK_SECRET: optionalTrimmedString(16, 500),
  ONE_TIME_FIRST_CLASS_AT: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.iso.datetime({ offset: true }).optional(),
  ),
  ONE_TIME_FREE_ACCESS_EXPIRES_AT: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.iso.datetime({ offset: true }).optional(),
  ),
  LEARNING_ALIAS_HMAC_KEY: optionalNonblankString,
  PARENT_STUDENT_SERVICE_ACCOUNT_VERSION: optionalNonblankString,
  PARENT_STUDENT_SERVICE_ACCOUNT_EVIDENCE_REFERENCE: optionalNonblankString,
  DELIVERY_PROVIDER_MODE: z.enum(['sink', 'mock', 'provider']).default('sink'),
  DELIVERY_PROVIDER_AUTHORIZATION_ID: optionalTrimmedString(8, 160),
  DELIVERY_STAGING_CANARY_PROOF: optionalTrimmedString(8, 160),
  DELIVERY_PROVIDER_PER_RUN_BUDGET: numberFromString.default(0),
  DELIVERY_PROVIDER_PER_PROVIDER_BUDGET: numberFromString.default(0),
  DELIVERY_PROVIDER_TIMEOUT_MS: numberFromString.default(15_000),
  DELIVERY_PROVIDER_TIMEOUT_LEASE_SAFETY_MS: numberFromString.default(5_000),
  ONE_TIME_EMAIL_FROM: z.string().optional(),
  ONE_TIME_EMAIL_REPLY_TO: z.string().optional(),
  ONE_TIME_LIFECYCLE_EMAIL_MODE: z
    .enum(['disabled', 'canary', 'transactional'])
    .default('disabled'),
  ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED: booleanFromString,
  ONE_TIME_RESEND_TRANSPORT_ENABLED: booleanFromString,
  ONE_TIME_RESEND_WEBHOOK_ENABLED: booleanFromString,
  ONE_TIME_DELIVERY_TEST_CANARY_EMAIL: z.string().email().optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_WEBHOOK_SECRET: z.string().min(16).optional(),
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
  ONE_TIME_PUBLIC_WHATSAPP_DEEP_LINK: z.url().optional(),
  ONE_TIME_PUBLIC_WHATSAPP_PREFILL_TEXT: z.string().trim().max(240).optional(),
  OT86_PUBLISH_SIGNING_KEY_ID: z.string().optional(),
  OT86_PUBLISH_SIGNING_SECRET: z.string().optional(),
  OT86_PREVIOUS_PUBLISH_SIGNING_KEY_ID: z.string().optional(),
  OT86_PREVIOUS_PUBLISH_SIGNING_SECRET: z.string().optional(),
  ENABLE_REAL_EMAIL_TRANSPORT: booleanFromString,
  ENABLE_REAL_WHATSAPP_TRANSPORT: booleanFromString,
  ENABLE_REAL_TELEGRAM_TRANSPORT: booleanFromString,
  ENABLE_PAYMENT_TRANSPORT: booleanFromString,
  ONE_TIME_GHL_PAYMENT_LINK: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.url().optional(),
  ),
  ONE_TIME_TELEGRAM_WEBHOOK_ENABLED: booleanFromString,
  ONE_TIME_TELEGRAM_WEBHOOK_SECRET: z.string().min(16).optional(),
  ONE_TIME_TELEGRAM_WEBHOOK_SECRET_CONFIGURED: booleanFromString,
  ONE_TIME_TELEGRAM_TOKEN_CONFIGURED: booleanFromString,
  ONE_TIME_TELEGRAM_OWNER_MAPPING_CONFIGURED: booleanFromString,
  ONE_TIME_TELEGRAM_SINGLE_CONSUMER_GATE: booleanFromString,
  ONE_TIME_TELEGRAM_CANARY_CHAT_CONFIGURED: booleanFromString,
  ONE_TIME_TELEGRAM_LOCAL_POLLING_ENABLED: booleanFromString,
  ONE_TIME_TELEGRAM_PRODUCTION_POLLING_ENABLED: booleanFromString,
  ONE_TIME_TELEGRAM_BOT_KEY: z.string().min(1).default('one_time_internal_ops'),
  ONE_TIME_TELEGRAM_ENVIRONMENT: z.enum(['local', 'staging', 'production']).default('staging'),
  ONE_TIME_RABBI_TELEGRAM_ENABLED: booleanFromString,
  ONE_TIME_RABBI_TELEGRAM_TOKEN_CONFIGURED: booleanFromString,
  ONE_TIME_RABBI_TELEGRAM_OWNER_MAPPING_CONFIGURED: booleanFromString,
  ONE_TIME_RABBI_TELEGRAM_SINGLE_CONSUMER_GATE: booleanFromString,
  ONE_TIME_RABBI_TELEGRAM_BOT_KEY: z
    .literal('one_time_rabbi_torah_console')
    .default('one_time_rabbi_torah_console'),
  ONE_TIME_RABBI_TELEGRAM_TOKEN_FINGERPRINT_HASH: optionalTrimmedString(32, 128),
  ONE_TIME_RABBI_TELEGRAM_PAYLOAD_KEY: optionalTrimmedString(32, 400),
  ONE_TIME_RABBI_GHL_REPLY_MODE: z.enum(['disabled', 'synthetic']).default('disabled'),
  ZOOM_CLASSROOM_ENABLED: booleanFromString,
  ZOOM_CLASSROOM_PROVIDER_MODE: z.enum(['sink', 'real']).default('sink'),
  ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED: booleanFromString,
  ZOOM_CLASSROOM_COMPONENT_VIEW_ENABLED: booleanFromString.default(true),
  ZOOM_CLASSROOM_MUTE_ON_JOIN: booleanFromString.default(true),
  ZOOM_CLASSROOM_CANARY_ENABLED: booleanFromString,
  ZOOM_CLASSROOM_CANARY_LEARNER_KEY: optionalTrimmedString(1, 160),
  ZOOM_CLASSROOM_JOIN_GRANT_TTL_SECONDS: numberFromString.default(90),
  ZOOM_CLASSROOM_CLASS_DURATION_MINUTES: numberFromString.default(60),
  ZOOM_CLASSROOM_JOIN_OPEN_OFFSET_MINUTES: numberFromString.default(15),
  ZOOM_CLASSROOM_JOIN_CLOSE_OFFSET_MINUTES: numberFromString.default(15),
  ZOOM_MEETING_SDK_CLIENT_ID: z.string().optional(),
  ZOOM_MEETING_SDK_CLIENT_SECRET: z.string().optional(),
  ZOOM_MEETING_SDK_ALLOWED_ORIGIN: z.url().optional(),
  ZOOM_MEETING_SDK_WEB_VERSION: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .default('6.2.0'),
  ZOOM_MEETING_SDK_KEY: z.string().optional(),
  ZOOM_MEETING_SDK_SECRET: z.string().optional(),
  ZOOM_S2S_ACCOUNT_ID: z.string().optional(),
  ZOOM_S2S_CLIENT_ID: z.string().optional(),
  ZOOM_S2S_CLIENT_SECRET: z.string().optional(),
  ZOOM_ACCOUNT_ID: z.string().optional(),
  ZOOM_HOST_USER_ID: z.string().optional(),
  ZOOM_REAL_CONTROL_MEETING_ID: z.string().optional(),
  ZOOM_REAL_CONTROL_MEETING_PASSCODE: z.string().optional(),
  HIGHLEVEL_EVENT_SYNC_MODE: z.enum(['disabled', 'mock', 'provider']).default('disabled'),
  HIGHLEVEL_API_BASE_URL: z.url().default('https://services.leadconnectorhq.com'),
  HIGHLEVEL_API_VERSION: z.string().min(1).max(80).default('2021-07-28'),
  HIGHLEVEL_PRIVATE_INTEGRATION_TOKEN: optionalTrimmedString(8, 400),
  HIGHLEVEL_LOCATION_ID: z.string().min(1).max(160).default('pBSnOK2nkdxp6gf9Rg3o'),
  HIGHLEVEL_CANARY_RUN_ID: optionalTrimmedString(8, 160),
  HIGHLEVEL_CANARY_DELIVERY_KEYS: optionalTrimmedString(8, 4000),
  HIGHLEVEL_CANARY_BUDGET: numberFromString.default(0),
  HIGHLEVEL_PROVIDER_TIMEOUT_MS: numberFromString.default(15_000),
  HIGHLEVEL_ROW_LEASE_MS: numberFromString.default(120_000),
  FAMILY_SIGNUP_GHL_MODE: z.enum(['disabled', 'provider_canary']).default('disabled'),
  FAMILY_SIGNUP_GHL_OT01_PROOF_ID: optionalTrimmedString(8, 160),
  FAMILY_SIGNUP_GHL_CANARY_RUN_ID: optionalTrimmedString(8, 160),
  FAMILY_SIGNUP_GHL_CANARY_INTENT_IDS: optionalTrimmedString(8, 4_000),
  FAMILY_SIGNUP_GHL_CANARY_BUDGET: numberFromString.default(0),
  FAMILY_SIGNUP_GHL_BATCH_SIZE: numberFromString.default(1),
  ONE_TIME_OT16_TRANSPORT_MODE: z.enum(['disabled', 'canary', 'broad']).default('disabled'),
  ONE_TIME_OT16_AUTHORIZATION_ID: optionalTrimmedString(8, 160),
  ONE_TIME_OT16_CANARY_OPERATION_IDS: optionalTrimmedString(1, 4_000),
  ONE_TIME_OT16_PER_RUN_BUDGET: numberFromString.default(0),
  HIGHLEVEL_ACTIONS_MODE: z.enum(['disabled', 'enabled']).default('disabled'),
  HIGHLEVEL_ACTION_KEY_ID: optionalTrimmedString(1, 120),
  HIGHLEVEL_ACTION_SECRET: optionalTrimmedString(24, 400),
  HIGHLEVEL_ACCESS_ACTION_KEY_ID: optionalTrimmedString(1, 120),
  HIGHLEVEL_ACCESS_ACTION_SECRET: optionalTrimmedString(24, 400),
  HIGHLEVEL_ACTION_SIGNATURE_TOLERANCE_MS: numberFromString.default(300_000),
  HIGHLEVEL_ACTION_RATE_LIMIT_WINDOW_MS: numberFromString.default(60_000),
  HIGHLEVEL_ACTION_RATE_LIMIT_MAX: numberFromString.default(8),
  LIVE_CLASS_FAKE_ADAPTER_ENABLED: optionalBooleanFromString,
  LIVE_CLASS_OBS_BRIDGE_TOKEN: optionalTrimmedString(12, 160),
  LIVE_CLASS_TELEGRAM_ENABLED: booleanFromString,
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
  const parentStudentServiceAccountPolicyConfigured = Boolean(
    parsed.PARENT_STUDENT_SERVICE_ACCOUNT_VERSION &&
    parsed.PARENT_STUDENT_SERVICE_ACCOUNT_EVIDENCE_REFERENCE,
  );
  if (
    Boolean(parsed.PARENT_STUDENT_SERVICE_ACCOUNT_VERSION) !==
    Boolean(parsed.PARENT_STUDENT_SERVICE_ACCOUNT_EVIDENCE_REFERENCE)
  ) {
    throw new Error(
      'PARENT_STUDENT_SERVICE_ACCOUNT_VERSION and PARENT_STUDENT_SERVICE_ACCOUNT_EVIDENCE_REFERENCE must be configured together.',
    );
  }
  const runtime = classifyRuntime({
    nodeEnv: parsed.NODE_ENV,
    deliveryEnvironment: parsed.DELIVERY_ENVIRONMENT,
    oneTimeRuntimeEnvironment: parsed.ONE_TIME_RUNTIME_ENVIRONMENT,
  });
  const deliveryEnvironment = runtime.environment;
  const canonicalZoomS2sAccountId = parsed.ZOOM_S2S_ACCOUNT_ID?.trim() || undefined;
  const legacyZoomS2sAccountId = parsed.ZOOM_ACCOUNT_ID?.trim() || undefined;
  const zoomS2sAccountId = canonicalZoomS2sAccountId ?? legacyZoomS2sAccountId;
  const guardedStripeTestTransport =
    parsed.ENABLE_PAYMENT_TRANSPORT && parsed.LIVE_STRIPE_CHARGES_AUTHORIZED === 'NO';
  const realTransportsEnabled =
    parsed.ENABLE_REAL_EMAIL_TRANSPORT ||
    parsed.ENABLE_REAL_WHATSAPP_TRANSPORT ||
    parsed.ENABLE_REAL_TELEGRAM_TRANSPORT ||
    (parsed.ENABLE_PAYMENT_TRANSPORT && !guardedStripeTestTransport);

  if (realTransportsEnabled && !runtime.allowsProviderActions) {
    throw new Error('Real transports are outside this task and must remain disabled.');
  }

  const oneTimeRuntimeEnvironment = runtime.environment;
  const oneTimeVerificationEnvironmentId =
    parsed.ONE_TIME_VERIFICATION_ENVIRONMENT_ID ??
    (oneTimeRuntimeEnvironment === 'production'
      ? 'production_read_only'
      : oneTimeRuntimeEnvironment === 'isolated_staging'
        ? 'persistent_staging'
        : 'ci');
  const oneTimeRuntimeTier = ONE_TIME_VERIFICATION_RUNTIME_TIER[oneTimeVerificationEnvironmentId];
  const expectedOneTimeRuntimeTier: OneTimeRuntimeTier = runtime.isProductionRuntime
    ? 'production'
    : 'isolated_staging';
  if (oneTimeRuntimeTier !== expectedOneTimeRuntimeTier) {
    throw new Error(
      `ONE_TIME_VERIFICATION_ENVIRONMENT_ID=${oneTimeVerificationEnvironmentId} does not match runtime ${oneTimeRuntimeEnvironment}.`,
    );
  }
  const oneTimeVerificationWritesAllowed =
    oneTimeVerificationEnvironmentId !== 'production_read_only';
  const contentMediaMode = parsed.ONE_TIME_CONTENT_MEDIA_MODE;
  const contentMediaEnabled = contentMediaMode !== 'off';
  const contentMediaProviderCanary = contentMediaMode === 'provider_canary';
  const contentMediaProductionBroad = contentMediaMode === 'production_broad';
  if (
    ['synthetic_canary', 'provider_canary'].includes(contentMediaMode) &&
    (!parsed.ONE_TIME_CONTENT_MEDIA_AUTHORIZATION_ID || !parsed.ONE_TIME_CONTENT_CANARY_ID)
  ) {
    throw new Error(
      'Content media execution requires an exact authorization ID and one-recording canary ID.',
    );
  }
  if (contentMediaProductionBroad && !parsed.ONE_TIME_CONTENT_MEDIA_AUTHORIZATION_ID) {
    throw new Error('Content media production broad execution requires an exact authorization ID.');
  }
  if (
    contentMediaMode === 'synthetic_canary' &&
    !['test', 'isolated_staging'].includes(oneTimeRuntimeEnvironment)
  ) {
    throw new Error('Synthetic content media canary is limited to test or isolated_staging.');
  }
  if (
    contentMediaProviderCanary &&
    (oneTimeRuntimeEnvironment !== 'production' ||
      oneTimeVerificationEnvironmentId !== 'production_operator_canary')
  ) {
    throw new Error(
      'Content media provider canary requires the production_operator_canary environment.',
    );
  }
  if (
    contentMediaProductionBroad &&
    (oneTimeRuntimeEnvironment !== 'production' ||
      oneTimeVerificationEnvironmentId !== 'production_broad')
  ) {
    throw new Error('Content media production broad requires the production_broad environment.');
  }
  const contentMediaProvidersReady = Boolean(
    parsed.CONTENT_S3_BUCKET &&
    /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/u.test(parsed.CONTENT_S3_BUCKET) &&
    parsed.CONTENT_S3_KMS_KEY_ARN &&
    parsed.AWS_REGION === 'eu-central-1' &&
    parsed.CONTENT_FFMPEG_PATH &&
    parsed.CONTENT_FFPROBE_PATH &&
    parsed.OPENAI_API_KEY &&
    parsed.OPENAI_PROJECT_ID &&
    parsed.VIMEO_ACCESS_TOKEN &&
    parsed.VIMEO_ACCOUNT_ID &&
    parsed.VIMEO_WEBHOOK_SECRET,
  );
  if (contentMediaProviderCanary && !contentMediaProvidersReady) {
    throw new Error(
      'Content media provider canary requires exact S3, processing, OpenAI, and Vimeo configuration.',
    );
  }
  if (
    ['production_operator_canary', 'production_broad'].includes(oneTimeVerificationEnvironmentId) &&
    !parsed.ONE_TIME_FREE_ACCESS_EXPIRES_AT
  ) {
    throw new Error(
      'ONE_TIME_FREE_ACCESS_EXPIRES_AT is required for production operator-canary or broad promotion.',
    );
  }
  if (
    parsed.ONE_TIME_RABBI_GHL_REPLY_MODE === 'synthetic' &&
    !['test', 'isolated_staging'].includes(oneTimeRuntimeEnvironment)
  ) {
    throw new Error('Rabbi synthetic HighLevel replies are limited to test or isolated_staging.');
  }
  if (
    parsed.ONE_TIME_RABBI_TELEGRAM_ENABLED &&
    (!parsed.ONE_TIME_RABBI_TELEGRAM_TOKEN_CONFIGURED ||
      !parsed.ONE_TIME_RABBI_TELEGRAM_OWNER_MAPPING_CONFIGURED ||
      !parsed.ONE_TIME_RABBI_TELEGRAM_SINGLE_CONSUMER_GATE ||
      !parsed.ONE_TIME_RABBI_TELEGRAM_TOKEN_FINGERPRINT_HASH ||
      !parsed.ONE_TIME_RABBI_TELEGRAM_PAYLOAD_KEY)
  ) {
    throw new Error(
      'Rabbi Telegram runtime requires its distinct token, owner mapping, token fingerprint, and single-consumer gate.',
    );
  }

  if (oneTimeRuntimeEnvironment === 'production' && parsed.DELIVERY_PROVIDER_MODE !== 'sink') {
    throw new Error('Production delivery provider mode requires a separate exact authorization.');
  }

  if (parsed.DELIVERY_PROVIDER_MODE === 'provider' && !runtime.allowsProviderActions) {
    throw new Error('Delivery provider mode is limited to test or isolated_staging.');
  }

  const zoomProductionOperatorCanary =
    oneTimeRuntimeEnvironment === 'production' &&
    oneTimeVerificationEnvironmentId === 'production_operator_canary' &&
    Boolean(parsed.ZOOM_CLASSROOM_CANARY_LEARNER_KEY);
  if (
    parsed.ZOOM_CLASSROOM_CANARY_ENABLED &&
    !runtime.allowsProviderActions &&
    !zoomProductionOperatorCanary
  ) {
    throw new Error(
      'Zoom canary execution requires test, isolated_staging, or an exact production operator learner.',
    );
  }

  if (
    parsed.HIGHLEVEL_EVENT_SYNC_MODE === 'provider' &&
    !parsed.HIGHLEVEL_PRIVATE_INTEGRATION_TOKEN
  ) {
    throw new Error('HIGHLEVEL_PRIVATE_INTEGRATION_TOKEN is required for provider event sync.');
  }

  const highLevelCanaryDeliveryKeys = parseUniqueCsv(parsed.HIGHLEVEL_CANARY_DELIVERY_KEYS);
  if (
    parsed.HIGHLEVEL_EVENT_SYNC_MODE === 'provider' &&
    (!parsed.HIGHLEVEL_CANARY_RUN_ID ||
      highLevelCanaryDeliveryKeys.length < 1 ||
      parsed.HIGHLEVEL_CANARY_BUDGET < 1 ||
      !Number.isInteger(parsed.HIGHLEVEL_CANARY_BUDGET) ||
      parsed.HIGHLEVEL_CANARY_BUDGET > 2 ||
      highLevelCanaryDeliveryKeys.length > parsed.HIGHLEVEL_CANARY_BUDGET)
  ) {
    throw new Error(
      'HighLevel event sync requires an exact canary run ID, delivery-key allowlist, and sufficient positive budget.',
    );
  }
  const familySignupGhlCanaryIntentIds = parseUniqueCsv(parsed.FAMILY_SIGNUP_GHL_CANARY_INTENT_IDS);
  if (parsed.FAMILY_SIGNUP_GHL_MODE === 'provider_canary') {
    if (
      oneTimeRuntimeEnvironment !== 'production' ||
      oneTimeVerificationEnvironmentId !== 'production_operator_canary'
    ) {
      throw new Error(
        'Family-signup HighLevel provider canary requires production_operator_canary.',
      );
    }
    if (
      !parsed.HIGHLEVEL_PRIVATE_INTEGRATION_TOKEN ||
      !parsed.FAMILY_SIGNUP_GHL_OT01_PROOF_ID ||
      !parsed.FAMILY_SIGNUP_GHL_CANARY_RUN_ID ||
      familySignupGhlCanaryIntentIds.length !== 1 ||
      parsed.FAMILY_SIGNUP_GHL_CANARY_BUDGET !== 1 ||
      parsed.FAMILY_SIGNUP_GHL_BATCH_SIZE !== 1
    ) {
      throw new Error(
        'Family-signup HighLevel provider canary requires OT-01 proof, one exact intent, and a one-effect batch budget.',
      );
    }
  }
  const oneTimeOt16CanaryOperationIds = parseUniqueCsv(parsed.ONE_TIME_OT16_CANARY_OPERATION_IDS);
  if (parsed.ONE_TIME_OT16_TRANSPORT_MODE !== 'disabled') {
    if (
      !parsed.ONE_TIME_OT16_AUTHORIZATION_ID ||
      !parsed.HIGHLEVEL_PRIVATE_INTEGRATION_TOKEN ||
      !Number.isInteger(parsed.ONE_TIME_OT16_PER_RUN_BUDGET) ||
      parsed.ONE_TIME_OT16_PER_RUN_BUDGET < 1 ||
      parsed.ONE_TIME_OT16_PER_RUN_BUDGET > 100
    ) {
      throw new Error(
        'OT-16 transport requires an exact authorization ID, HighLevel token, and a positive bounded per-run budget.',
      );
    }
    if (
      parsed.ONE_TIME_OT16_TRANSPORT_MODE === 'canary' &&
      (oneTimeOt16CanaryOperationIds.length < 1 ||
        oneTimeOt16CanaryOperationIds.length > 2 ||
        oneTimeOt16CanaryOperationIds.length > parsed.ONE_TIME_OT16_PER_RUN_BUDGET ||
        oneTimeOt16CanaryOperationIds.some((operationId) => !/^[a-f0-9]{64}$/u.test(operationId)))
    ) {
      throw new Error(
        'OT-16 canary transport requires one or two exact SHA-256 operation IDs within its per-run budget.',
      );
    }
    if (
      parsed.ONE_TIME_OT16_TRANSPORT_MODE === 'broad' &&
      oneTimeOt16CanaryOperationIds.length > 0
    ) {
      throw new Error('OT-16 broad transport cannot retain a canary operation allowlist.');
    }
  } else if (oneTimeOt16CanaryOperationIds.length > 0) {
    throw new Error('OT-16 canary operation IDs require canary transport mode.');
  }

  if (parsed.HIGHLEVEL_ROW_LEASE_MS <= parsed.HIGHLEVEL_PROVIDER_TIMEOUT_MS * 2 + 5_000) {
    throw new Error(
      'HIGHLEVEL_ROW_LEASE_MS must fence both provider operations and their safety margin.',
    );
  }

  if (
    parsed.HIGHLEVEL_ACTIONS_MODE === 'enabled' &&
    (!parsed.HIGHLEVEL_ACTION_KEY_ID || !parsed.HIGHLEVEL_ACTION_SECRET)
  ) {
    throw new Error('HighLevel action key ID and secret are required when actions are enabled.');
  }
  if (
    Boolean(parsed.HIGHLEVEL_ACCESS_ACTION_KEY_ID) !==
    Boolean(parsed.HIGHLEVEL_ACCESS_ACTION_SECRET)
  ) {
    throw new Error('HighLevel access-action key ID and secret must be configured together.');
  }
  if (
    parsed.HIGHLEVEL_ACCESS_ACTION_KEY_ID &&
    parsed.HIGHLEVEL_ACCESS_ACTION_SECRET &&
    (parsed.HIGHLEVEL_ACCESS_ACTION_KEY_ID === parsed.HIGHLEVEL_ACTION_KEY_ID ||
      parsed.HIGHLEVEL_ACCESS_ACTION_SECRET === parsed.HIGHLEVEL_ACTION_SECRET)
  ) {
    throw new Error(
      'HighLevel access-action credentials must be cryptographically separate from bot-action credentials.',
    );
  }

  if (parsed.RUN_MIGRATIONS_ON_STARTUP && !runtime.allowsStartupMigrations) {
    throw new Error('Web startup migrations are limited to the test runtime.');
  }

  if (
    runtime.isProductionRuntime &&
    parsed.ONE_TIME_RESEND_WEBHOOK_ENABLED &&
    !parsed.RESEND_WEBHOOK_SECRET
  ) {
    throw new Error('RESEND_WEBHOOK_SECRET is required when Resend webhooks are enabled.');
  }

  if (deliveryEnvironment === 'production' && parsed.OUTBOX_TRANSPORT_MODE === 'provider') {
    throw new Error('Production delivery provider mode is disabled pending a reviewed release.');
  }

  if (runtime.isProductionRuntime && parsed.OT89_SUPPORT_DELIVERY_MODE !== 'disabled') {
    throw new Error('OT89 support delivery must remain disabled in production.');
  }

  if (runtime.isProductionRuntime && parsed.OT89_MOCK_BNA_ENABLED) {
    throw new Error('OT89 mock BNA endpoint is forbidden in production.');
  }

  if (parsed.LIVE_CLASS_FAKE_ADAPTER_ENABLED && !runtime.allowsMockOrDemo) {
    throw new Error('Live class fake adapter is forbidden in production.');
  }

  const ot89ProvidedSecrets = [
    parsed.OT89_SUPPORT_HMAC_KEY_ID,
    parsed.OT89_SUPPORT_HMAC_SECRET,
    parsed.OT89_BNA_TO_ONETIME_HMAC_KEY_ID,
    parsed.OT89_BNA_TO_ONETIME_HMAC_SECRET,
  ].filter((value): value is string => Boolean(value));

  if (
    runtime.isProductionRuntime &&
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

  if (runtime.isProductionRuntime && !parsed.AUTH_CSRF_SECRET) {
    throw new Error('AUTH_CSRF_SECRET is required in production.');
  }

  if (runtime.isProductionRuntime && parsed.ONE_TIME_TELEGRAM_WEBHOOK_ENABLED) {
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
    parsed.ONE_TIME_TELEGRAM_WEBHOOK_ENABLED &&
    (parsed.ONE_TIME_TELEGRAM_LOCAL_POLLING_ENABLED ||
      parsed.ONE_TIME_TELEGRAM_PRODUCTION_POLLING_ENABLED)
  ) {
    throw new Error('Telegram webhook and polling consumers are mutually exclusive.');
  }

  if (parsed.ONE_TIME_TELEGRAM_PRODUCTION_POLLING_ENABLED) {
    throw new Error(
      'Production Telegram polling is not implemented; use the protected webhook lane.',
    );
  }

  if (runtime.isProductionRuntime && !parsed.PROTECTED_PAYLOAD_ENCRYPTION_KEY) {
    throw new Error('PROTECTED_PAYLOAD_ENCRYPTION_KEY is required in production.');
  }

  return {
    nodeEnv: parsed.NODE_ENV,
    runtime,
    deliveryEnvironment,
    isProduction: runtime.isProductionRuntime,
    port: parsed.PORT,
    publicBaseUrl: parsed.PUBLIC_BASE_URL,
    appVersion: parsed.APP_VERSION,
    commitSha: parsed.COMMIT_SHA,
    railwayDeploymentId: parsed.RAILWAY_DEPLOYMENT_ID,
    railwaySnapshotId: parsed.RAILWAY_SNAPSHOT_ID,
    railwayProjectId: parsed.RAILWAY_PROJECT_ID,
    railwayEnvironmentId: parsed.RAILWAY_ENVIRONMENT_ID,
    railwayServiceId: parsed.RAILWAY_SERVICE_ID,
    railwayServiceName: parsed.RAILWAY_SERVICE_NAME,
    railwayGitCommitSha: parsed.RAILWAY_GIT_COMMIT_SHA,
    databaseUrl: parsed.DATABASE_URL,
    databaseSsl: parsed.DATABASE_SSL,
    runMigrationsOnStartup: parsed.RUN_MIGRATIONS_ON_STARTUP,
    trustedProxyHops: parsed.TRUSTED_PROXY_HOPS,
    operationsProbeToken: parsed.OPERATIONS_PROBE_TOKEN,
    operationsProbeTokenConfigured: Boolean(parsed.OPERATIONS_PROBE_TOKEN),
    operationsWorkerHeartbeatTtlMs: parsed.OPERATIONS_WORKER_HEARTBEAT_TTL_MS,
    accountKey: parsed.ONE_TIME_ACCOUNT_KEY,
    productKey: parsed.ONE_TIME_PRODUCT_KEY,
    paymentHistorySystemOfRecord: 'highlevel' as const,
    oneTimeGhlPaymentLink: parsed.ONE_TIME_GHL_PAYMENT_LINK,
    legacyBillingRuntimeEnabled: false,
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
    protectedPayloadEncryptionKey:
      parsed.PROTECTED_PAYLOAD_ENCRYPTION_KEY ??
      'test-only-32-byte-protected-payload-key-do-not-use',
    mfaSecretEncryptionKey:
      parsed.PROTECTED_PAYLOAD_ENCRYPTION_KEY ??
      'test-only-32-byte-protected-payload-key-do-not-use',
    lifecycleDeliveryKeyId: parsed.ONE_TIME_LIFECYCLE_DELIVERY_KEY_ID,
    lifecycleDeliveryKey:
      parsed.ONE_TIME_LIFECYCLE_DELIVERY_KEY ??
      (runtime.isProductionRuntime ? undefined : 'test-only-lifecycle-delivery-key-do-not-use'),
    lifecycleDeliveryKeyConfigured: Boolean(parsed.ONE_TIME_LIFECYCLE_DELIVERY_KEY),
    outboxTransportMode: parsed.OUTBOX_TRANSPORT_MODE,
    oneTimeRuntimeEnvironment,
    oneTimeRuntimeTier,
    oneTimeVerificationEnvironmentId,
    oneTimeVerificationWritesAllowed,
    contentMediaMode,
    contentMediaEnabled,
    contentMediaProviderCanary,
    contentMediaProductionBroad,
    contentMediaProvidersReady,
    contentMediaAuthorizationId: parsed.ONE_TIME_CONTENT_MEDIA_AUTHORIZATION_ID,
    contentMediaCanaryId: parsed.ONE_TIME_CONTENT_CANARY_ID,
    contentMediaBatchSize: parsed.ONE_TIME_CONTENT_MEDIA_BATCH_SIZE,
    contentMediaConcurrency: parsed.ONE_TIME_CONTENT_MEDIA_CONCURRENCY,
    contentS3Bucket: parsed.CONTENT_S3_BUCKET,
    contentS3KmsKeyArn: parsed.CONTENT_S3_KMS_KEY_ARN,
    contentS3StorageClass: parsed.CONTENT_S3_STORAGE_CLASS,
    contentAwsRegion: parsed.AWS_REGION,
    contentDriveFolderId: parsed.GOOGLE_DRIVE_FOLDER_ID,
    contentDriveServiceAccountJson: parsed.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON,
    contentDriveConfigured: Boolean(
      parsed.GOOGLE_DRIVE_FOLDER_ID && parsed.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON,
    ),
    contentFfmpegPath: parsed.CONTENT_FFMPEG_PATH,
    contentFfprobePath: parsed.CONTENT_FFPROBE_PATH,
    contentOpenAiApiKey: parsed.OPENAI_API_KEY,
    contentOpenAiProjectId: parsed.OPENAI_PROJECT_ID,
    contentOpenAiOrganizationId: parsed.OPENAI_ORGANIZATION_ID,
    contentVimeoAccessToken: parsed.VIMEO_ACCESS_TOKEN,
    contentVimeoAccountId: parsed.VIMEO_ACCOUNT_ID,
    contentVimeoWebhookSecret: parsed.VIMEO_WEBHOOK_SECRET,
    oneTimeFirstClassAt: parsed.ONE_TIME_FIRST_CLASS_AT,
    oneTimeFreeAccessExpiresAt: parsed.ONE_TIME_FREE_ACCESS_EXPIRES_AT,
    learningAliasHmacKey: parsed.LEARNING_ALIAS_HMAC_KEY,
    learningAliasHmacKeyConfigured: Boolean(parsed.LEARNING_ALIAS_HMAC_KEY),
    parentStudentServiceAccountVersion: parsed.PARENT_STUDENT_SERVICE_ACCOUNT_VERSION,
    parentStudentServiceAccountEvidenceReference:
      parsed.PARENT_STUDENT_SERVICE_ACCOUNT_EVIDENCE_REFERENCE,
    parentStudentServiceAccountPolicyConfigured,
    deliveryProviderMode: parsed.DELIVERY_PROVIDER_MODE,
    deliveryProviderAuthorizationId: parsed.DELIVERY_PROVIDER_AUTHORIZATION_ID,
    deliveryStagingCanaryProof: parsed.DELIVERY_STAGING_CANARY_PROOF,
    deliveryProviderPerRunBudget: parsed.DELIVERY_PROVIDER_PER_RUN_BUDGET,
    deliveryProviderPerProviderBudget: parsed.DELIVERY_PROVIDER_PER_PROVIDER_BUDGET,
    deliveryProviderTimeoutMs: parsed.DELIVERY_PROVIDER_TIMEOUT_MS,
    deliveryProviderTimeoutLeaseSafetyMs: parsed.DELIVERY_PROVIDER_TIMEOUT_LEASE_SAFETY_MS,
    emailFrom: parsed.ONE_TIME_EMAIL_FROM,
    emailReplyTo: parsed.ONE_TIME_EMAIL_REPLY_TO,
    lifecycleEmailMode: parsed.ONE_TIME_LIFECYCLE_EMAIL_MODE,
    deliveryProviderTransportEnabled: parsed.ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED,
    resendTransportEnabled: parsed.ONE_TIME_RESEND_TRANSPORT_ENABLED,
    resendWebhookEnabled: parsed.ONE_TIME_RESEND_WEBHOOK_ENABLED,
    resendWebhookSecret: parsed.RESEND_WEBHOOK_SECRET,
    resendWebhookSecretConfigured: Boolean(parsed.RESEND_WEBHOOK_SECRET),
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
    whatsappPublicDeepLink: parsed.ONE_TIME_PUBLIC_WHATSAPP_DEEP_LINK,
    whatsappPublicPrefillText: parsed.ONE_TIME_PUBLIC_WHATSAPP_PREFILL_TEXT,
    whatsappAssistantCopyVersion: 'retired',
    whatsappAssistantRateLimitWindowMs: 0,
    whatsappAssistantSenderRateLimitMax: 0,
    whatsappAssistantAccountRateLimitMax: 0,
    oneTimeTelegramWebhookEnabled: parsed.ONE_TIME_TELEGRAM_WEBHOOK_ENABLED,
    oneTimeTelegramWebhookSecret: parsed.ONE_TIME_TELEGRAM_WEBHOOK_SECRET,
    oneTimeTelegramWebhookSecretConfigured:
      parsed.ONE_TIME_TELEGRAM_WEBHOOK_SECRET_CONFIGURED ||
      Boolean(parsed.ONE_TIME_TELEGRAM_WEBHOOK_SECRET),
    oneTimeTelegramTokenConfigured: parsed.ONE_TIME_TELEGRAM_TOKEN_CONFIGURED,
    oneTimeTelegramOwnerMappingConfigured: parsed.ONE_TIME_TELEGRAM_OWNER_MAPPING_CONFIGURED,
    oneTimeTelegramSingleConsumerGate: parsed.ONE_TIME_TELEGRAM_SINGLE_CONSUMER_GATE,
    oneTimeTelegramCanaryChatConfigured: parsed.ONE_TIME_TELEGRAM_CANARY_CHAT_CONFIGURED,
    oneTimeTelegramLocalPollingEnabled: parsed.ONE_TIME_TELEGRAM_LOCAL_POLLING_ENABLED,
    oneTimeTelegramProductionPollingEnabled: parsed.ONE_TIME_TELEGRAM_PRODUCTION_POLLING_ENABLED,
    oneTimeTelegramBotKey: parsed.ONE_TIME_TELEGRAM_BOT_KEY,
    oneTimeTelegramEnvironment: parsed.ONE_TIME_TELEGRAM_ENVIRONMENT,
    oneTimeRabbiTelegramEnabled: parsed.ONE_TIME_RABBI_TELEGRAM_ENABLED,
    oneTimeRabbiTelegramTokenConfigured: parsed.ONE_TIME_RABBI_TELEGRAM_TOKEN_CONFIGURED,
    oneTimeRabbiTelegramOwnerMappingConfigured:
      parsed.ONE_TIME_RABBI_TELEGRAM_OWNER_MAPPING_CONFIGURED,
    oneTimeRabbiTelegramSingleConsumerGate: parsed.ONE_TIME_RABBI_TELEGRAM_SINGLE_CONSUMER_GATE,
    oneTimeRabbiTelegramBotKey: parsed.ONE_TIME_RABBI_TELEGRAM_BOT_KEY,
    oneTimeRabbiTelegramTokenFingerprintHash: parsed.ONE_TIME_RABBI_TELEGRAM_TOKEN_FINGERPRINT_HASH,
    oneTimeRabbiTelegramPayloadKey: parsed.ONE_TIME_RABBI_TELEGRAM_PAYLOAD_KEY,
    oneTimeRabbiGhlReplyMode: parsed.ONE_TIME_RABBI_GHL_REPLY_MODE,
    zoomClassroomEnabled: parsed.ZOOM_CLASSROOM_ENABLED,
    zoomClassroomProviderMode: parsed.ZOOM_CLASSROOM_PROVIDER_MODE,
    zoomClassroomRealProviderEnabled: parsed.ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED,
    zoomClassroomComponentViewEnabled: parsed.ZOOM_CLASSROOM_COMPONENT_VIEW_ENABLED,
    zoomClassroomMuteOnJoin: parsed.ZOOM_CLASSROOM_MUTE_ON_JOIN,
    zoomClassroomCanaryEnabled: parsed.ZOOM_CLASSROOM_CANARY_ENABLED,
    zoomClassroomCanaryLearnerKey: parsed.ZOOM_CLASSROOM_CANARY_LEARNER_KEY,
    zoomClassroomJoinGrantTtlSeconds: parsed.ZOOM_CLASSROOM_JOIN_GRANT_TTL_SECONDS,
    zoomClassroomClassDurationMinutes: parsed.ZOOM_CLASSROOM_CLASS_DURATION_MINUTES,
    zoomClassroomJoinOpenOffsetMinutes: parsed.ZOOM_CLASSROOM_JOIN_OPEN_OFFSET_MINUTES,
    zoomClassroomJoinCloseOffsetMinutes: parsed.ZOOM_CLASSROOM_JOIN_CLOSE_OFFSET_MINUTES,
    zoomMeetingSdkClientId: parsed.ZOOM_MEETING_SDK_CLIENT_ID ?? parsed.ZOOM_MEETING_SDK_KEY,
    zoomMeetingSdkClientSecret:
      parsed.ZOOM_MEETING_SDK_CLIENT_SECRET ?? parsed.ZOOM_MEETING_SDK_SECRET,
    zoomMeetingSdkAllowedOrigin: parsed.ZOOM_MEETING_SDK_ALLOWED_ORIGIN,
    zoomMeetingSdkWebVersion: parsed.ZOOM_MEETING_SDK_WEB_VERSION,
    zoomMeetingSdkClientIdConfigured: Boolean(
      parsed.ZOOM_MEETING_SDK_CLIENT_ID ?? parsed.ZOOM_MEETING_SDK_KEY,
    ),
    zoomMeetingSdkClientSecretConfigured: Boolean(
      parsed.ZOOM_MEETING_SDK_CLIENT_SECRET ?? parsed.ZOOM_MEETING_SDK_SECRET,
    ),
    zoomMeetingSdkLegacyAliasUsed: Boolean(
      (!parsed.ZOOM_MEETING_SDK_CLIENT_ID && parsed.ZOOM_MEETING_SDK_KEY) ||
      (!parsed.ZOOM_MEETING_SDK_CLIENT_SECRET && parsed.ZOOM_MEETING_SDK_SECRET),
    ),
    zoomMeetingSdkCanonicalClientIdConfigured: Boolean(parsed.ZOOM_MEETING_SDK_CLIENT_ID?.trim()),
    zoomMeetingSdkCanonicalClientSecretConfigured: Boolean(
      parsed.ZOOM_MEETING_SDK_CLIENT_SECRET?.trim(),
    ),
    zoomMeetingSdkWebVersionConfigured: Boolean(source.ZOOM_MEETING_SDK_WEB_VERSION?.trim()),
    zoomMeetingSdkKeyConfigured: Boolean(
      parsed.ZOOM_MEETING_SDK_CLIENT_ID ?? parsed.ZOOM_MEETING_SDK_KEY,
    ),
    zoomMeetingSdkSecretConfigured: Boolean(
      parsed.ZOOM_MEETING_SDK_CLIENT_SECRET ?? parsed.ZOOM_MEETING_SDK_SECRET,
    ),
    zoomAccountId: zoomS2sAccountId,
    zoomAccountIdConfigured: Boolean(zoomS2sAccountId),
    zoomServerToServerClientId: parsed.ZOOM_S2S_CLIENT_ID,
    zoomServerToServerClientSecret: parsed.ZOOM_S2S_CLIENT_SECRET,
    zoomHostUserId: parsed.ZOOM_HOST_USER_ID,
    zoomRealControlMeetingId: parsed.ZOOM_REAL_CONTROL_MEETING_ID,
    zoomRealControlMeetingPasscode: parsed.ZOOM_REAL_CONTROL_MEETING_PASSCODE,
    zoomS2sAccountIdConfigured: Boolean(canonicalZoomS2sAccountId),
    zoomS2sClientIdConfigured: Boolean(parsed.ZOOM_S2S_CLIENT_ID),
    zoomS2sClientSecretConfigured: Boolean(parsed.ZOOM_S2S_CLIENT_SECRET),
    oneTimeEventEmailFallback: 'disabled' as 'disabled' | 'resend',
    tishaBavZoomJoinUrl: undefined as string | undefined,
    tishaBavZoomMeetingRefConfigured: false,
    highLevelEventSyncMode: parsed.HIGHLEVEL_EVENT_SYNC_MODE,
    highLevelApiBaseUrl: parsed.HIGHLEVEL_API_BASE_URL,
    highLevelApiVersion: parsed.HIGHLEVEL_API_VERSION,
    highLevelPrivateIntegrationsToken: parsed.HIGHLEVEL_PRIVATE_INTEGRATION_TOKEN,
    highLevelLocationId: parsed.HIGHLEVEL_LOCATION_ID,
    highLevelTishaBavWorkflowId: undefined as string | undefined,
    highLevelCanaryRunId: parsed.HIGHLEVEL_CANARY_RUN_ID,
    highLevelCanaryDeliveryKeys,
    highLevelCanaryBudget: parsed.HIGHLEVEL_CANARY_BUDGET,
    highLevelProviderTimeoutMs: parsed.HIGHLEVEL_PROVIDER_TIMEOUT_MS,
    highLevelRowLeaseMs: parsed.HIGHLEVEL_ROW_LEASE_MS,
    familySignupGhlMode: parsed.FAMILY_SIGNUP_GHL_MODE,
    familySignupGhlOt01ProofId: parsed.FAMILY_SIGNUP_GHL_OT01_PROOF_ID,
    familySignupGhlCanaryRunId: parsed.FAMILY_SIGNUP_GHL_CANARY_RUN_ID,
    familySignupGhlCanaryIntentIds,
    familySignupGhlCanaryBudget: parsed.FAMILY_SIGNUP_GHL_CANARY_BUDGET,
    familySignupGhlBatchSize: parsed.FAMILY_SIGNUP_GHL_BATCH_SIZE,
    oneTimeOt16TransportMode: parsed.ONE_TIME_OT16_TRANSPORT_MODE,
    oneTimeOt16AuthorizationId: parsed.ONE_TIME_OT16_AUTHORIZATION_ID,
    oneTimeOt16CanaryOperationIds,
    oneTimeOt16PerRunBudget: parsed.ONE_TIME_OT16_PER_RUN_BUDGET,
    highLevelActionsMode: parsed.HIGHLEVEL_ACTIONS_MODE,
    highLevelActionKeyId: parsed.HIGHLEVEL_ACTION_KEY_ID,
    highLevelActionSecret: parsed.HIGHLEVEL_ACTION_SECRET,
    highLevelAccessActionKeyId: parsed.HIGHLEVEL_ACCESS_ACTION_KEY_ID,
    highLevelAccessActionSecret: parsed.HIGHLEVEL_ACCESS_ACTION_SECRET,
    highLevelActionSignatureToleranceMs: parsed.HIGHLEVEL_ACTION_SIGNATURE_TOLERANCE_MS,
    highLevelActionRateLimitWindowMs: parsed.HIGHLEVEL_ACTION_RATE_LIMIT_WINDOW_MS,
    highLevelActionRateLimitMax: parsed.HIGHLEVEL_ACTION_RATE_LIMIT_MAX,
    liveClassFakeAdapterEnabled:
      parsed.LIVE_CLASS_FAKE_ADAPTER_ENABLED ?? oneTimeRuntimeEnvironment !== 'production',
    liveClassObsBridgeToken:
      parsed.LIVE_CLASS_OBS_BRIDGE_TOKEN ??
      (runtime.isProductionRuntime ? undefined : 'local-live-class-obs-bridge'),
    liveClassObsBridgeTokenConfigured: Boolean(parsed.LIVE_CLASS_OBS_BRIDGE_TOKEN),
    liveClassTelegramEnabled: parsed.LIVE_CLASS_TELEGRAM_ENABLED,
    supportRateLimitWindowMs: parsed.SUPPORT_RATE_LIMIT_WINDOW_MS,
    supportRateLimitMax: parsed.SUPPORT_RATE_LIMIT_MAX,
    supportAccountRateLimitMax: parsed.SUPPORT_ACCOUNT_RATE_LIMIT_MAX,
    ot89SupportEnabled: parsed.OT89_SUPPORT_ENABLED,
    ot89SupportDeliveryMode: parsed.OT89_SUPPORT_DELIVERY_MODE,
    ot89SupportBnaBaseUrl: parsed.OT89_SUPPORT_BNA_BASE_URL,
    ot89SupportHmacKeyId:
      parsed.OT89_SUPPORT_HMAC_KEY_ID ??
      (runtime.isProductionRuntime ? '' : OT89_LOCAL_ONETIME_KEY_ID),
    ot89SupportHmacSecret:
      parsed.OT89_SUPPORT_HMAC_SECRET ??
      (runtime.isProductionRuntime ? '' : OT89_LOCAL_ONETIME_SECRET),
    ot89BnaToOnetimeHmacKeyId:
      parsed.OT89_BNA_TO_ONETIME_HMAC_KEY_ID ??
      (runtime.isProductionRuntime ? '' : OT89_LOCAL_BNA_KEY_ID),
    ot89BnaToOnetimeHmacSecret:
      parsed.OT89_BNA_TO_ONETIME_HMAC_SECRET ??
      (runtime.isProductionRuntime ? '' : OT89_LOCAL_BNA_SECRET),
    ot89MockBnaEnabled: parsed.OT89_MOCK_BNA_ENABLED,
    ot89MockBnaOutage: parsed.OT89_MOCK_BNA_OUTAGE,
    ot89SupportDeploymentId: parsed.OT89_SUPPORT_DEPLOYMENT_ID,
    ot86PublishSigningKeyId: parsed.OT86_PUBLISH_SIGNING_KEY_ID,
    ot86PublishSigningSecret: parsed.OT86_PUBLISH_SIGNING_SECRET,
    ot86PreviousPublishSigningKeyId: parsed.OT86_PREVIOUS_PUBLISH_SIGNING_KEY_ID,
    ot86PreviousPublishSigningSecret: parsed.OT86_PREVIOUS_PUBLISH_SIGNING_SECRET,
    bufferAccessToken: undefined,
    bufferOrganizationId: undefined,
    bufferDestinationIds: undefined,
    portalTestLabEnabled: false,
    learningDeliveryDemoEnabled: false,
    experiencePreviewEnabled: false,
  };
}
