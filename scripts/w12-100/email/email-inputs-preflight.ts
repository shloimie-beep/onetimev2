import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const RABBI_DAY_ONE_EMAIL_PREFLIGHT_SCHEMA =
  'onetime.rabbi_day_one_email_inputs_preflight.v1';
export const RABBI_DAY_ONE_EMAIL_PRIVATE_MANIFEST_SCHEMA =
  'onetime.rabbi_day_one_email_inputs.private.v1';

const APPROVED_SENDER = 'info@onetimeonetime.com';
const APPROVED_REPLY_TO = 'info@onetimeonetime.com';
const APPROVED_DOMAIN = 'onetimeonetime.com';

const KEYHOLDER_FILES = {
  resendApiKey: 'resend-api-key.txt',
  resendWebhookSecret: 'resend-webhook-secret.txt',
  resendDomain: 'resend-domain.txt',
  resendFromEmail: 'resend-from-email.txt',
  resendReplyTo: 'resend-reply-to.txt',
  resendFromName: 'resend-from-name.txt',
} as const;

export type EmailInputsPreflightOptions = {
  keyholderDir: string;
  privateManifestOut?: string | undefined;
  canaryEmailFile?: string | undefined;
  authorizationId?: string | undefined;
  now?: Date | undefined;
};

export type EmailInputsPreflightReport = {
  schema_version: typeof RABBI_DAY_ONE_EMAIL_PREFLIGHT_SCHEMA;
  generated_at: string;
  status: 'ready' | 'blocked';
  blocked_reasons: string[];
  approved_policy: {
    provider: 'resend';
    domain: typeof APPROVED_DOMAIN;
    sender: typeof APPROVED_SENDER;
    reply_to: typeof APPROVED_REPLY_TO;
    transactional_mode: 'transactional';
  };
  protected_sources: {
    keyholder_dir_available: boolean;
    private_manifest_written: boolean;
    raw_values_included: false;
    secrets_printed: false;
  };
  inputs: Record<
    string,
    {
      file_name: string;
      present: boolean;
      nonempty: boolean;
      fingerprint: string | null;
    }
  >;
  checks: Record<string, boolean>;
  private_manifest: {
    path: string | null;
    schema_version: typeof RABBI_DAY_ONE_EMAIL_PRIVATE_MANIFEST_SCHEMA;
    contains_secret_values: boolean;
    contains_canary_destination: boolean;
    railway_variables_ready: boolean;
    variable_names: string[];
  };
};

type LoadedInput = {
  key: keyof typeof KEYHOLDER_FILES | 'canaryEmail';
  fileName: string;
  value: string | null;
};

export async function runEmailInputsPreflight(
  options: EmailInputsPreflightOptions,
): Promise<EmailInputsPreflightReport> {
  const generatedAt = (options.now ?? new Date()).toISOString();
  const keyholderAvailable = await directoryExists(options.keyholderDir);
  const loaded = await loadInputs(options);
  const inputMap = Object.fromEntries(
    loaded.map((entry) => [
      entry.key,
      {
        file_name: entry.fileName,
        present: entry.value !== null,
        nonempty: Boolean(entry.value),
        fingerprint: entry.value ? fingerprintValue(entry.key, entry.value) : null,
      },
    ]),
  ) as EmailInputsPreflightReport['inputs'];
  const byKey = Object.fromEntries(loaded.map((entry) => [entry.key, entry.value])) as Partial<
    Record<LoadedInput['key'], string | null>
  >;
  const resendApiKey = byKey.resendApiKey ?? null;
  const resendWebhookSecret = byKey.resendWebhookSecret ?? null;
  const resendFromEmail = byKey.resendFromEmail ?? null;
  const resendReplyTo = byKey.resendReplyTo ?? null;
  const sender = normalizeEmailAddress(resendFromEmail);
  const replyTo = normalizeEmailAddress(resendReplyTo);
  const domain = byKey.resendDomain?.trim().toLowerCase() ?? null;
  const authorizationId =
    options.authorizationId?.trim() ||
    authorizationIdFromInputs(resendApiKey, resendWebhookSecret, resendFromEmail, resendReplyTo);
  const checks = {
    keyholder_dir_available: keyholderAvailable,
    resend_api_key_present: Boolean(resendApiKey),
    resend_webhook_secret_present: Boolean(resendWebhookSecret),
    approved_domain_matches: domain === APPROVED_DOMAIN,
    approved_sender_matches: sender === APPROVED_SENDER,
    approved_reply_to_matches: replyTo === APPROVED_REPLY_TO,
    canary_destination_present: Boolean(byKey.canaryEmail),
    authorization_id_present: Boolean(authorizationId),
    lifecycle_delivery_key_generated_for_manifest: Boolean(options.privateManifestOut),
    no_raw_values_in_report: true,
  };
  const blockedReasons = blockedEmailReasons(checks);
  const report: EmailInputsPreflightReport = {
    schema_version: RABBI_DAY_ONE_EMAIL_PREFLIGHT_SCHEMA,
    generated_at: generatedAt,
    status: blockedReasons.length ? 'blocked' : 'ready',
    blocked_reasons: blockedReasons,
    approved_policy: {
      provider: 'resend',
      domain: APPROVED_DOMAIN,
      sender: APPROVED_SENDER,
      reply_to: APPROVED_REPLY_TO,
      transactional_mode: 'transactional',
    },
    protected_sources: {
      keyholder_dir_available: keyholderAvailable,
      private_manifest_written: false,
      raw_values_included: false,
      secrets_printed: false,
    },
    inputs: inputMap,
    checks,
    private_manifest: {
      path: options.privateManifestOut ?? null,
      schema_version: RABBI_DAY_ONE_EMAIL_PRIVATE_MANIFEST_SCHEMA,
      contains_secret_values: Boolean(options.privateManifestOut && !blockedReasons.length),
      contains_canary_destination: Boolean(options.privateManifestOut && byKey.canaryEmail),
      railway_variables_ready: blockedReasons.length === 0,
      variable_names: [
        'DELIVERY_PROVIDER_AUTHORIZATION_ID',
        'DELIVERY_PROVIDER_PER_PROVIDER_BUDGET',
        'DELIVERY_PROVIDER_PER_RUN_BUDGET',
        'ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED',
        'ONE_TIME_EMAIL_FROM',
        'ONE_TIME_EMAIL_REPLY_TO',
        'ONE_TIME_LIFECYCLE_DELIVERY_KEY',
        'ONE_TIME_LIFECYCLE_EMAIL_MODE',
        'ONE_TIME_RESEND_TRANSPORT_ENABLED',
        'ONE_TIME_RESEND_WEBHOOK_ENABLED',
        'RESEND_API_KEY',
        'RESEND_WEBHOOK_SECRET',
      ],
    },
  };

  if (options.privateManifestOut && !blockedReasons.length) {
    await writePrivateManifest(options.privateManifestOut, {
      authorizationId: authorizationId as string,
      canaryEmail: byKey.canaryEmail as string,
      generatedAt,
      resendApiKey: resendApiKey as string,
      resendFromEmail: resendFromEmail as string,
      resendReplyTo: resendReplyTo as string,
      resendWebhookSecret: resendWebhookSecret as string,
    });
    report.protected_sources.private_manifest_written = true;
  }

  return report;
}

async function loadInputs(options: EmailInputsPreflightOptions): Promise<LoadedInput[]> {
  const entries: LoadedInput[] = [];
  for (const [key, fileName] of Object.entries(KEYHOLDER_FILES) as Array<
    [keyof typeof KEYHOLDER_FILES, string]
  >) {
    entries.push({
      key,
      fileName,
      value: await readTrimmed(path.join(options.keyholderDir, fileName)),
    });
  }
  entries.push({
    key: 'canaryEmail',
    fileName: options.canaryEmailFile ? path.basename(options.canaryEmailFile) : '',
    value: options.canaryEmailFile ? await readTrimmed(options.canaryEmailFile) : null,
  });
  return entries;
}

function blockedEmailReasons(checks: EmailInputsPreflightReport['checks']) {
  const reasons: string[] = [];
  if (!checks.keyholder_dir_available) reasons.push('BLOCKED_KEYHOLDER_DIR_NOT_FOUND');
  if (!checks.resend_api_key_present) reasons.push('BLOCKED_RESEND_API_KEY_MISSING');
  if (!checks.resend_webhook_secret_present) reasons.push('BLOCKED_RESEND_WEBHOOK_SECRET_MISSING');
  if (!checks.approved_domain_matches) reasons.push('BLOCKED_RESEND_DOMAIN_MISMATCH');
  if (!checks.approved_sender_matches) reasons.push('BLOCKED_APPROVED_SENDER_MISMATCH');
  if (!checks.approved_reply_to_matches) reasons.push('BLOCKED_APPROVED_REPLY_TO_MISMATCH');
  if (!checks.canary_destination_present) {
    reasons.push('BLOCKED_CANARY_DESTINATION_FILE_NOT_PROVIDED');
  }
  if (!checks.authorization_id_present) reasons.push('BLOCKED_AUTHORIZATION_ID_MISSING');
  return reasons.sort();
}

async function writePrivateManifest(
  outputPath: string,
  input: {
    authorizationId: string;
    canaryEmail: string;
    generatedAt: string;
    resendApiKey: string;
    resendFromEmail: string;
    resendReplyTo: string;
    resendWebhookSecret: string;
  },
) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const manifest = {
    schema_version: RABBI_DAY_ONE_EMAIL_PRIVATE_MANIFEST_SCHEMA,
    generated_at: input.generatedAt,
    provider: 'resend',
    ownership_scope: 'standalone_one_time',
    approved_domain: APPROVED_DOMAIN,
    sender: input.resendFromEmail,
    reply_to: input.resendReplyTo,
    canary_destination: input.canaryEmail,
    railway_variables: {
      DELIVERY_PROVIDER_AUTHORIZATION_ID: input.authorizationId,
      DELIVERY_PROVIDER_PER_PROVIDER_BUDGET: '1',
      DELIVERY_PROVIDER_PER_RUN_BUDGET: '1',
      ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED: 'true',
      ONE_TIME_EMAIL_FROM: input.resendFromEmail,
      ONE_TIME_EMAIL_REPLY_TO: input.resendReplyTo,
      ONE_TIME_LIFECYCLE_DELIVERY_KEY: randomBytes(32).toString('base64url'),
      ONE_TIME_LIFECYCLE_EMAIL_MODE: 'transactional',
      ONE_TIME_RESEND_TRANSPORT_ENABLED: 'true',
      ONE_TIME_RESEND_WEBHOOK_ENABLED: 'true',
      RESEND_API_KEY: input.resendApiKey,
      RESEND_WEBHOOK_SECRET: input.resendWebhookSecret,
    },
    external_send_authorization: {
      allowed_recipients: [input.canaryEmail],
      max_transactional_test_sends: 1,
      broad_campaign_sends_allowed: false,
    },
  };
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

async function directoryExists(directory: string) {
  try {
    return (await stat(directory)).isDirectory();
  } catch {
    return false;
  }
}

async function readTrimmed(filePath: string) {
  try {
    return (await readFile(filePath, 'utf8')).trim() || null;
  } catch {
    return null;
  }
}

function normalizeEmailAddress(value: string | null) {
  const trimmed = value?.trim().toLowerCase() ?? '';
  return (trimmed.match(/<([^<>]+)>/)?.[1]?.trim() ?? trimmed) || null;
}

function authorizationIdFromInputs(...values: Array<string | null>) {
  if (values.some((value) => !value)) return null;
  return `auth_rabbi_day_one_email_${createHash('sha256')
    .update(values.join('\0'))
    .digest('hex')
    .slice(0, 16)}`;
}

function fingerprintValue(kind: string, value: string) {
  return createHash('sha256').update(`rabbi-day-one-email:${kind}\0${value}`).digest('hex');
}

function parseArgs(argv: string[]) {
  const values = new Map<string, string>();
  let createPrivateManifest = false;
  for (const arg of argv) {
    if (arg === '--create-private-manifest') {
      createPrivateManifest = true;
      continue;
    }
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) values.set(match[1] as string, match[2] as string);
  }
  return {
    authorizationId: values.get('authorization-id'),
    canaryEmailFile: values.get('canary-email-file'),
    createPrivateManifest,
    keyholderDir: values.get('keyholder-dir') ?? 'C:/Users/User/BNA-Keyholder',
    out: values.get('out'),
    privateManifestOut: values.get('private-manifest-out'),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = await runEmailInputsPreflight({
    keyholderDir: args.keyholderDir,
    canaryEmailFile: args.canaryEmailFile,
    authorizationId: args.authorizationId,
    privateManifestOut: args.createPrivateManifest ? args.privateManifestOut : undefined,
  });
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (args.out) {
    await mkdir(path.dirname(args.out), { recursive: true });
    await writeFile(args.out, output, 'utf8');
  } else {
    process.stdout.write(output);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
