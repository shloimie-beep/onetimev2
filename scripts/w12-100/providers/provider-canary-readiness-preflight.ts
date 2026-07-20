import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const ONE_TIME_PROVIDER_CANARY_READINESS_SCHEMA =
  'onetime.one_time_finish_now.provider_canary_readiness_preflight.v1';
export const ONE_TIME_PROVIDER_CANARY_CONFIRMATION = 'ONE-TIME-PROVIDER-CANARIES-OK';
export const ONE_TIME_PROVIDER_CANARY_KEYS = [
  'whatsapp',
  'telegram',
  'zoom',
  'vimeo',
  'openai_helper',
  'bna_support',
  'stripe_test',
  'buffer',
] as const;

const DEFAULT_PRIVATE_DIR = 'C:/Users/User/.onetime-w13-104-private';
const DEFAULT_PROVIDER_CANARIES_REPORT = 'ops/codex-runs/W13-104/PROVIDER-CANARIES.json';
const DEFAULT_PRIVATE_CANARY_AUTHORIZATION = `${DEFAULT_PRIVATE_DIR}/CANARY-AUTHORIZATION.private.json`;
const DEFAULT_OPERATOR_AUTHORIZATION = `${DEFAULT_PRIVATE_DIR}/ONE-TIME-PROVIDER-CANARIES-OPERATOR-AUTHORIZATION.private.txt`;
const DEFAULT_PRODUCTION_CONFIRMATION = `${DEFAULT_PRIVATE_DIR}/ONE-TIME-PROVIDER-CANARIES-CONFIRMATION.private.txt`;

type TargetEnvironment = 'local' | 'test' | 'staging' | 'production';
type ProviderCanaryKey = (typeof ONE_TIME_PROVIDER_CANARY_KEYS)[number];

export type ProviderCanaryReadinessPreflightOptions = {
  expectedProviderCanariesReportSha256?: string | undefined;
  now?: Date | undefined;
  operatorAuthorizationFile?: string | undefined;
  privateCanaryAuthorizationFile?: string | undefined;
  productionConfirmationFile?: string | undefined;
  providerCanariesReportFile?: string | undefined;
  targetEnvironment?: TargetEnvironment | undefined;
};

export type ProviderCanaryReadinessPreflightReport = {
  schema_version: typeof ONE_TIME_PROVIDER_CANARY_READINESS_SCHEMA;
  generated_at: string;
  status: 'ready' | 'blocked';
  blocked_reasons: string[];
  target_environment: TargetEnvironment;
  approved_scope: {
    provider_canaries_report_path: string;
    provider_canaries_report_sha256: string | null;
    expected_provider_canaries_report_sha256: string | null;
    provider_canaries_report_status: string | null;
    required_provider_keys: ProviderCanaryKey[];
    required_authorization_statement: string | null;
    required_confirmation: typeof ONE_TIME_PROVIDER_CANARY_CONFIRMATION;
  };
  providers: Record<
    ProviderCanaryKey,
    {
      mode: string | null;
      canary: string | null;
      kill_switch: string | null;
      missing_or_blocking_names: string[];
      ready_to_run: boolean;
    }
  >;
  protected_sources: {
    private_canary_authorization_path: string;
    operator_authorization_path: string;
    production_confirmation_path: string;
    raw_values_included: false;
    secrets_printed: false;
    provider_canaries_run: 0;
    external_sends_performed: false;
    provider_writes_performed: false;
    live_charges_performed: false;
    production_database_connected: false;
    production_database_writes: 0;
  };
  inputs: Record<
    string,
    {
      present: boolean;
      nonempty: boolean;
      fingerprint: string | null;
    }
  >;
  checks: Record<string, boolean>;
};

type LoadedTextInput = {
  present: boolean;
  nonempty: boolean;
  value: string | null;
  fingerprint: string | null;
};

type ProviderSourceSummary = {
  canary: string | null;
  killSwitch: string | null;
  missingOrBlockingNames: string[];
  mode: string | null;
};

type ProviderCanaryReportSummary = {
  externalEffectsSafe: boolean;
  present: boolean;
  providers: Record<ProviderCanaryKey, ProviderSourceSummary | null>;
  readableJson: boolean;
  status: string | null;
};

export async function runProviderCanaryReadinessPreflight(
  options: ProviderCanaryReadinessPreflightOptions = {},
): Promise<ProviderCanaryReadinessPreflightReport> {
  const generatedAt = (options.now ?? new Date()).toISOString();
  const targetEnvironment = options.targetEnvironment ?? 'production';
  const providerCanariesReportFile =
    options.providerCanariesReportFile ?? DEFAULT_PROVIDER_CANARIES_REPORT;
  const privateCanaryAuthorizationFile =
    options.privateCanaryAuthorizationFile ?? DEFAULT_PRIVATE_CANARY_AUTHORIZATION;
  const operatorAuthorizationFile =
    options.operatorAuthorizationFile ?? DEFAULT_OPERATOR_AUTHORIZATION;
  const productionConfirmationFile =
    options.productionConfirmationFile ?? DEFAULT_PRODUCTION_CONFIRMATION;

  const [providerCanariesReport, privateAuthorization, operatorAuthorization, confirmation] =
    await Promise.all([
      loadProviderCanaryReport(providerCanariesReportFile),
      textInputStatus('privateCanaryAuthorization', privateCanaryAuthorizationFile),
      textInputStatus('operatorAuthorization', operatorAuthorizationFile),
      textInputStatus('productionConfirmation', productionConfirmationFile),
    ]);
  const providerCanariesReportSha256 = providerCanariesReport.present
    ? await sha256File(providerCanariesReportFile)
    : null;
  const expectedProviderCanariesReportSha256 =
    normalizeOptionalSha(options.expectedProviderCanariesReportSha256) ??
    providerCanariesReportSha256;
  const requiredAuthorizationStatement = providerCanariesReportSha256
    ? exactOneTimeProviderCanaryAuthorizationStatement({
        providerCanariesReportSha256,
        providerKeys: ONE_TIME_PROVIDER_CANARY_KEYS,
        targetEnvironment,
      })
    : null;
  const privateAuthorizationJson = parseJsonObject(privateAuthorization.value);
  const providers = providerReadiness(providerCanariesReport);

  const checks = {
    provider_canaries_report_available: providerCanariesReport.present,
    provider_canaries_report_readable_json: providerCanariesReport.readableJson,
    provider_canaries_report_sha_matches_expected:
      Boolean(providerCanariesReportSha256) &&
      providerCanariesReportSha256 === expectedProviderCanariesReportSha256,
    provider_canaries_report_status_ready_to_run: isReadyReportStatus(
      providerCanariesReport.status,
    ),
    provider_canaries_external_effects_safe: providerCanariesReport.externalEffectsSafe,
    all_required_providers_present: ONE_TIME_PROVIDER_CANARY_KEYS.every(
      (key) => providerCanariesReport.providers[key],
    ),
    all_required_providers_ready_to_run: ONE_TIME_PROVIDER_CANARY_KEYS.every(
      (key) => providers[key].ready_to_run,
    ),
    private_authorization_manifest_present: privateAuthorization.present,
    private_authorization_manifest_readable_json: Boolean(privateAuthorizationJson),
    private_authorization_manifest_target_environment_matches:
      privateAuthorizationJson?.target_environment === targetEnvironment,
    private_authorization_manifest_raw_values_excluded:
      privateAuthorizationJson?.raw_values_included === false,
    private_authorization_manifest_provider_canaries_authorized:
      readBoolean(privateAuthorizationJson, 'provider_canaries_authorized') === true,
    private_authorization_manifest_report_sha_matches:
      privateAuthorizationJson?.provider_canaries_report_sha256 === providerCanariesReportSha256,
    private_authorization_manifest_required_providers_authorized:
      authorizedProvidersCoverRequired(privateAuthorizationJson),
    operator_authorization_present: operatorAuthorization.nonempty,
    operator_authorization_matches_required:
      Boolean(requiredAuthorizationStatement) &&
      operatorAuthorization.value === requiredAuthorizationStatement,
    production_confirmation_present: confirmation.nonempty,
    production_confirmation_matches_required:
      confirmation.value === ONE_TIME_PROVIDER_CANARY_CONFIRMATION,
    no_raw_values_in_report: true,
    no_provider_side_effects: true,
  };
  const blockedReasons = blockedReadinessReasons(checks, providers);

  return {
    schema_version: ONE_TIME_PROVIDER_CANARY_READINESS_SCHEMA,
    generated_at: generatedAt,
    status: blockedReasons.length ? 'blocked' : 'ready',
    blocked_reasons: blockedReasons,
    target_environment: targetEnvironment,
    approved_scope: {
      provider_canaries_report_path: providerCanariesReportFile,
      provider_canaries_report_sha256: providerCanariesReportSha256,
      expected_provider_canaries_report_sha256: expectedProviderCanariesReportSha256,
      provider_canaries_report_status: providerCanariesReport.status,
      required_provider_keys: [...ONE_TIME_PROVIDER_CANARY_KEYS],
      required_authorization_statement: requiredAuthorizationStatement,
      required_confirmation: ONE_TIME_PROVIDER_CANARY_CONFIRMATION,
    },
    providers,
    protected_sources: {
      private_canary_authorization_path: privateCanaryAuthorizationFile,
      operator_authorization_path: operatorAuthorizationFile,
      production_confirmation_path: productionConfirmationFile,
      raw_values_included: false,
      secrets_printed: false,
      provider_canaries_run: 0,
      external_sends_performed: false,
      provider_writes_performed: false,
      live_charges_performed: false,
      production_database_connected: false,
      production_database_writes: 0,
    },
    inputs: {
      privateCanaryAuthorization: summarizeInput(privateAuthorization),
      operatorAuthorization: summarizeInput(operatorAuthorization),
      productionConfirmation: summarizeInput(confirmation),
    },
    checks,
  };
}

export function exactOneTimeProviderCanaryAuthorizationStatement(input: {
  providerCanariesReportSha256: string;
  providerKeys: readonly ProviderCanaryKey[];
  targetEnvironment: TargetEnvironment;
}) {
  return [
    'APPROVE_ONE_TIME_PROVIDER_CANARIES',
    input.providerCanariesReportSha256,
    input.providerKeys.join(','),
    input.targetEnvironment,
  ].join(':');
}

function providerReadiness(summary: ProviderCanaryReportSummary) {
  return Object.fromEntries(
    ONE_TIME_PROVIDER_CANARY_KEYS.map((key) => {
      const provider = summary.providers[key];
      const missingOrBlockingNames = provider?.missingOrBlockingNames ?? [];
      const mode = provider?.mode ?? null;
      const canary = provider?.canary ?? null;
      return [
        key,
        {
          mode,
          canary,
          kill_switch: provider?.killSwitch ?? null,
          missing_or_blocking_names: missingOrBlockingNames,
          ready_to_run:
            Boolean(provider) &&
            missingOrBlockingNames.length === 0 &&
            isReadyProviderMode(mode) &&
            isReadyCanaryState(canary),
        },
      ];
    }),
  ) as ProviderCanaryReadinessPreflightReport['providers'];
}

function blockedReadinessReasons(
  checks: ProviderCanaryReadinessPreflightReport['checks'],
  providers: ProviderCanaryReadinessPreflightReport['providers'],
) {
  const reasons: string[] = [];
  if (!checks.provider_canaries_report_available) {
    reasons.push('BLOCKED_PROVIDER_CANARIES_REPORT_NOT_FOUND');
  } else if (!checks.provider_canaries_report_readable_json) {
    reasons.push('BLOCKED_PROVIDER_CANARIES_REPORT_UNREADABLE');
  } else {
    if (!checks.provider_canaries_report_sha_matches_expected) {
      reasons.push('BLOCKED_PROVIDER_CANARIES_REPORT_SHA_MISMATCH');
    }
    if (!checks.provider_canaries_report_status_ready_to_run) {
      reasons.push('BLOCKED_PROVIDER_CANARIES_REPORT_NOT_READY_TO_RUN');
    }
    if (!checks.provider_canaries_external_effects_safe) {
      reasons.push('BLOCKED_PROVIDER_CANARIES_REPORT_EXTERNAL_EFFECTS_UNSAFE');
    }
    if (!checks.all_required_providers_present) {
      reasons.push('BLOCKED_REQUIRED_PROVIDER_MISSING_FROM_REPORT');
    }
    for (const key of ONE_TIME_PROVIDER_CANARY_KEYS) {
      if (!providers[key].ready_to_run) {
        reasons.push(`BLOCKED_PROVIDER_${key.toUpperCase()}_NOT_READY_TO_RUN`);
      }
    }
  }
  if (!checks.private_authorization_manifest_present) {
    reasons.push('BLOCKED_PRIVATE_CANARY_AUTHORIZATION_NOT_PROVIDED');
  } else if (!checks.private_authorization_manifest_readable_json) {
    reasons.push('BLOCKED_PRIVATE_CANARY_AUTHORIZATION_UNREADABLE');
  } else {
    if (!checks.private_authorization_manifest_target_environment_matches) {
      reasons.push('BLOCKED_PRIVATE_CANARY_AUTHORIZATION_TARGET_ENVIRONMENT_MISMATCH');
    }
    if (!checks.private_authorization_manifest_raw_values_excluded) {
      reasons.push('BLOCKED_PRIVATE_CANARY_AUTHORIZATION_RAW_VALUES_NOT_EXCLUDED');
    }
    if (!checks.private_authorization_manifest_provider_canaries_authorized) {
      reasons.push('BLOCKED_PRIVATE_CANARY_AUTHORIZATION_NOT_ENABLED');
    }
    if (!checks.private_authorization_manifest_report_sha_matches) {
      reasons.push('BLOCKED_PRIVATE_CANARY_AUTHORIZATION_REPORT_SHA_MISMATCH');
    }
    if (!checks.private_authorization_manifest_required_providers_authorized) {
      reasons.push('BLOCKED_PRIVATE_CANARY_AUTHORIZATION_REQUIRED_PROVIDERS_MISSING');
    }
  }
  if (!checks.operator_authorization_present) {
    reasons.push('BLOCKED_OPERATOR_AUTHORIZATION_NOT_PROVIDED');
  } else if (!checks.operator_authorization_matches_required) {
    reasons.push('BLOCKED_EXACT_OPERATOR_AUTHORIZATION_MISMATCH');
  }
  if (!checks.production_confirmation_present) {
    reasons.push('BLOCKED_PROVIDER_CANARY_CONFIRMATION_NOT_PROVIDED');
  } else if (!checks.production_confirmation_matches_required) {
    reasons.push('BLOCKED_PROVIDER_CANARY_CONFIRMATION_MISMATCH');
  }
  return Array.from(new Set(reasons)).sort();
}

async function loadProviderCanaryReport(filePath: string): Promise<ProviderCanaryReportSummary> {
  try {
    const parsed = JSON.parse(await readFile(filePath, 'utf8')) as {
      external_effects?: unknown;
      providers?: unknown;
      status?: unknown;
    };
    const providersObject = objectOrNull(parsed.providers);
    const externalEffects = objectOrNull(parsed.external_effects);
    return {
      externalEffectsSafe:
        externalEffects?.provider_canaries_run === 0 &&
        externalEffects?.external_sends === 0 &&
        externalEffects?.provider_writes === 0 &&
        externalEffects?.live_charges === 0,
      present: true,
      providers: Object.fromEntries(
        ONE_TIME_PROVIDER_CANARY_KEYS.map((key) => [
          key,
          providersObject ? providerSummary(objectOrNull(providersObject[key])) : null,
        ]),
      ) as ProviderCanaryReportSummary['providers'],
      readableJson: true,
      status: textOrNull(parsed.status),
    };
  } catch {
    return {
      externalEffectsSafe: false,
      present: false,
      providers: Object.fromEntries(
        ONE_TIME_PROVIDER_CANARY_KEYS.map((key) => [key, null]),
      ) as ProviderCanaryReportSummary['providers'],
      readableJson: false,
      status: null,
    };
  }
}

function providerSummary(value: Record<string, unknown> | null): ProviderSourceSummary | null {
  if (!value) return null;
  return {
    canary: textOrNull(value.canary),
    killSwitch: textOrNull(value.kill_switch),
    missingOrBlockingNames: stringArray(value.missing_or_blocking_names),
    mode: textOrNull(value.mode),
  };
}

async function textInputStatus(kind: string, filePath: string): Promise<LoadedTextInput> {
  try {
    const stats = await stat(filePath);
    if (!stats.isFile()) return { present: false, nonempty: false, value: null, fingerprint: null };
    const value = (await readFile(filePath, 'utf8')).trim();
    return {
      present: true,
      nonempty: Boolean(value),
      value: value || null,
      fingerprint: value ? fingerprintValue(kind, value) : null,
    };
  } catch {
    return { present: false, nonempty: false, value: null, fingerprint: null };
  }
}

function parseJsonObject(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function summarizeInput(input: LoadedTextInput) {
  return {
    present: input.present,
    nonempty: input.nonempty,
    fingerprint: input.fingerprint,
  };
}

function authorizedProvidersCoverRequired(object: Record<string, unknown> | null) {
  const providers = object?.authorized_providers;
  if (providers === 'all') return true;
  if (!Array.isArray(providers)) return false;
  const providerSet = new Set(providers.filter((provider) => typeof provider === 'string'));
  return ONE_TIME_PROVIDER_CANARY_KEYS.every((key) => providerSet.has(key));
}

function isReadyProviderMode(value: string | null) {
  return value !== null && /^(configured|ready|canary_ready|enabled_for_canary)$/i.test(value);
}

function isReadyCanaryState(value: string | null) {
  return value !== null && /^(ready|ready_to_run|canary_ready|passed)$/i.test(value);
}

function isReadyReportStatus(value: string | null) {
  return value !== null && /^(ready|ready_to_run|canary_ready|accepted)$/i.test(value);
}

function objectOrNull(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readBoolean(object: Record<string, unknown> | null, key: string) {
  return typeof object?.[key] === 'boolean' ? object[key] : null;
}

function textOrNull(value: unknown) {
  return typeof value === 'string' && value ? value : null;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function normalizeOptionalSha(value?: string) {
  const trimmed = value?.trim().toLowerCase();
  return trimmed && /^[a-f0-9]{64}$/.test(trimmed) ? trimmed : null;
}

async function sha256File(filePath: string) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

function fingerprintValue(kind: string, value: string) {
  return createHash('sha256').update(`one-time-provider-canary:${kind}\0${value}`).digest('hex');
}

function parseArgs(argv: string[]) {
  const values = new Map<string, string>();
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) values.set(match[1] as string, match[2] as string);
  }
  return {
    expectedProviderCanariesReportSha256: values.get('expected-provider-canaries-report-sha256'),
    operatorAuthorizationFile: values.get('operator-authorization-file'),
    out: values.get('out'),
    privateCanaryAuthorizationFile: values.get('private-canary-authorization-file'),
    productionConfirmationFile: values.get('production-confirmation-file'),
    providerCanariesReportFile: values.get('provider-canaries-report-file'),
    targetEnvironment: values.get('target-environment') as TargetEnvironment | undefined,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = await runProviderCanaryReadinessPreflight(args);
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
