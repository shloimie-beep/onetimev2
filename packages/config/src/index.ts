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

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: numberFromString.default(3000),
  PUBLIC_BASE_URL: z.url().default('https://join.onetimeonetime.com'),
  APP_VERSION: z.string().min(1).default('local'),
  COMMIT_SHA: z.string().min(1).default('local'),
  DATABASE_URL: z.string().optional(),
  DATABASE_SSL: booleanFromString,
  RUN_MIGRATIONS_ON_STARTUP: booleanFromString,
  ONE_TIME_ACCOUNT_KEY: z.string().min(1).default('one_time'),
  ONE_TIME_PRODUCT_KEY: z.string().min(1).default('one_time_mishnah_class'),
  ONE_TIME_OWNER_INTERNAL_LABEL: z.string().min(1).default('Rabbi'),
  ONE_TIME_ADMIN_CUSTOMER_LABEL: z.string().min(1).default('Admin'),
  LEAD_RATE_LIMIT_WINDOW_MS: numberFromString.default(60_000),
  LEAD_RATE_LIMIT_MAX: numberFromString.default(5),
  OUTBOX_TRANSPORT_MODE: z.enum(['sink', 'mock']).default('sink'),
  ONE_TIME_EMAIL_FROM: z.string().optional(),
  ONE_TIME_EMAIL_REPLY_TO: z.string().optional(),
  ONE_TIME_OWNER_TEST_WHATSAPP: z.string().optional(),
  ONE_TIME_OWNER_TEST_EMAIL: z.string().optional(),
  CRM_CURSOR_SECRET: z.string().min(32).optional(),
  AUTH_REQUIRE_VERIFIED_MFA: booleanFromString,
  ENABLE_REAL_EMAIL_TRANSPORT: booleanFromString,
  ENABLE_REAL_WHATSAPP_TRANSPORT: booleanFromString,
  ENABLE_REAL_TELEGRAM_TRANSPORT: booleanFromString,
  ENABLE_PAYMENT_TRANSPORT: booleanFromString,
});

export type AppConfig = ReturnType<typeof loadConfig>;

export function loadConfig(source: NodeJS.ProcessEnv) {
  const parsed = envSchema.parse(source);
  const realTransportsEnabled =
    parsed.ENABLE_REAL_EMAIL_TRANSPORT ||
    parsed.ENABLE_REAL_WHATSAPP_TRANSPORT ||
    parsed.ENABLE_REAL_TELEGRAM_TRANSPORT ||
    parsed.ENABLE_PAYMENT_TRANSPORT;

  if (parsed.NODE_ENV !== 'test' && realTransportsEnabled) {
    throw new Error('Real transports are outside this task and must remain disabled.');
  }

  if (parsed.NODE_ENV === 'production' && parsed.RUN_MIGRATIONS_ON_STARTUP) {
    throw new Error('Production web startup cannot run migrations automatically.');
  }

  if (parsed.NODE_ENV === 'production' && !parsed.CRM_CURSOR_SECRET) {
    throw new Error('CRM_CURSOR_SECRET is required in production.');
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
    accountKey: parsed.ONE_TIME_ACCOUNT_KEY,
    productKey: parsed.ONE_TIME_PRODUCT_KEY,
    ownerInternalLabel: parsed.ONE_TIME_OWNER_INTERNAL_LABEL,
    adminCustomerLabel: parsed.ONE_TIME_ADMIN_CUSTOMER_LABEL,
    leadRateLimitWindowMs: parsed.LEAD_RATE_LIMIT_WINDOW_MS,
    leadRateLimitMax: parsed.LEAD_RATE_LIMIT_MAX,
    outboxTransportMode: parsed.OUTBOX_TRANSPORT_MODE,
    emailFrom: parsed.ONE_TIME_EMAIL_FROM,
    emailReplyTo: parsed.ONE_TIME_EMAIL_REPLY_TO,
    ownerTestWhatsapp: parsed.ONE_TIME_OWNER_TEST_WHATSAPP,
    ownerTestEmail: parsed.ONE_TIME_OWNER_TEST_EMAIL,
    crmCursorSecret:
      parsed.CRM_CURSOR_SECRET ?? 'local-only-crm-cursor-secret-for-tests-and-development',
    requireVerifiedMfa: parsed.AUTH_REQUIRE_VERIFIED_MFA,
  };
}
