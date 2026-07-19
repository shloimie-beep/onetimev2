import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadConfig } from '../../../../packages/config/src/index.ts';
import { buildProviderControlCenter } from '../../../../packages/domain/src/providers/control-center.ts';
import type {
  OpsProviderKey,
  ProviderControlCenterItem,
} from '../../../../packages/contracts/src/providers/control-center.ts';

type Args = {
  runtimeEnvJson: string;
  out: string;
  now: Date;
};

type RuntimeEnvFile = {
  env?: Record<string, unknown>;
};

const w13ProviderMap: Record<string, OpsProviderKey> = {
  transactional_email: 'resend_email',
  whatsapp: 'whatsapp_meta',
  bna_support: 'bna_support_bridge',
  stripe_test: 'stripe_test',
  zoom: 'zoom_classroom',
  vimeo: 'vimeo_private_content',
  telegram: 'telegram_one_time',
  openai_student_helper: 'openai_helper',
  buffer: 'buffer_social',
};

const safeValueKeys = new Set([
  'NODE_ENV',
  'DELIVERY_ENVIRONMENT',
  'ONE_TIME_RUNTIME_ENVIRONMENT',
  'ONE_TIME_ACCOUNT_KEY',
  'ONE_TIME_PRODUCT_KEY',
  'PUBLIC_BASE_URL',
  'APP_VERSION',
  'COMMIT_SHA',
  'OUTBOX_TRANSPORT_MODE',
  'DELIVERY_TRANSPORT_MODE',
  'DELIVERY_PROVIDER_MODE',
]);

export async function createProviderReadinessSnapshot(args: Args) {
  const env = await loadRuntimeEnv(args.runtimeEnvJson);
  const configResult = safeLoadConfig(env);
  const providers = configResult.config
    ? buildProviderControlCenter({ config: configResult.config, env, now: args.now })
    : null;
  const byProvider = new Map(
    (providers?.providers ?? []).map((provider) => [provider.provider, provider]),
  );
  const report = {
    schema: 'onetime.w13_102.provider_readiness_snapshot.v1',
    generated_at: args.now.toISOString(),
    runtime_source_sha: configResult.config?.commitSha ?? env.COMMIT_SHA ?? null,
    production_url: configResult.config?.publicBaseUrl ?? env.PUBLIC_BASE_URL ?? null,
    source: {
      runtime_env_json_loaded: true,
      private_values_printed: false,
      env_key_count: Object.keys(env).length,
    },
    config_load: configResult.ok
      ? { status: 'passed' as const }
      : { status: 'blocked' as const, reason: configResult.reason },
    provider_control_center: providers
      ? {
          guardrail_proof: providers.guardrail_proof,
          email_readiness: providers.email_readiness,
          webhook_endpoints: providers.webhook_endpoints,
          providers: providers.providers.map(providerSummary),
        }
      : null,
    w13_provider_lanes: Object.fromEntries(
      Object.entries(w13ProviderMap).map(([lane, provider]) => {
        const item = byProvider.get(provider);
        return [lane, laneSummary(lane, item, configResult.reason)];
      }),
    ),
    external_effects: {
      external_sends: 0,
      provider_writes: 0,
      live_charges: 0,
      source_rows_printed: false,
    },
    safety: {
      no_secret_values_included: true,
      no_pii_included: true,
      no_provider_mutation: true,
      no_real_send: true,
      no_live_charge: true,
    },
  };
  assertNoSensitiveEnvValues(JSON.stringify(report), env);
  await mkdir(path.dirname(path.resolve(args.out)), { recursive: true });
  await writeFile(args.out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return report;
}

function providerSummary(item: ProviderControlCenterItem) {
  return {
    provider: item.provider,
    status: item.status,
    required_variable_names: item.required_variable_names,
    configured_variable_names: item.configured_variable_names,
    missing_variable_names: item.missing_variable_names,
    webhook_endpoint: item.webhook_endpoint,
    queue_worker_dependency: item.queue_worker_dependency,
    last_allowlisted_canary: item.last_allowlisted_canary,
    rollback_disable_action: item.rollback_disable_action,
  };
}

function laneSummary(
  lane: string,
  item: ProviderControlCenterItem | undefined,
  configLoadReason: string | null,
) {
  const shared = {
    mode: item?.status ?? 'not_configured',
    canary_result: 'blocked_before_send',
    budget_consumed: 0,
    kill_switch: killSwitchForLane(lane),
    required_variable_names: item?.required_variable_names ?? [],
    missing_variable_names: item?.missing_variable_names ?? [],
    configured_variable_names: item?.configured_variable_names ?? [],
    raw_values_printed: false,
  };
  const blockers = [
    ...(configLoadReason ? [`config_load:${configLoadReason}`] : []),
    ...(item
      ? item.missing_variable_names.map((name) => `missing:${name}`)
      : ['provider_item_missing']),
    ...(item?.webhook_endpoint.handler_mounted === false
      ? [`webhook_not_mounted:${item.webhook_endpoint.provider}`]
      : []),
    ...(item?.status === 'canary_ready' ? [] : [`status:${item?.status ?? 'not_configured'}`]),
  ];
  return {
    ...shared,
    blockers: [...new Set(blockers)],
  };
}

function killSwitchForLane(lane: string) {
  if (lane === 'transactional_email') {
    return 'ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED / ONE_TIME_RESEND_TRANSPORT_ENABLED';
  }
  if (lane === 'whatsapp') {
    return 'ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED / ONE_TIME_WAPI_TRANSPORT_ENABLED / ONETIME_WHATSAPP_CANARY_AUTHORIZED';
  }
  if (lane === 'bna_support') return 'OT89_SUPPORT_ENABLED / OT89_SUPPORT_DELIVERY_MODE';
  if (lane === 'stripe_test') return 'ENABLE_PAYMENT_TRANSPORT / LIVE_STRIPE_CHARGES_AUTHORIZED';
  if (lane === 'zoom') return 'ZOOM_CLASSROOM_ENABLED / ZOOM_CLASSROOM_PROVIDER_MODE';
  if (lane === 'vimeo') return 'VIMEO_PRIVATE_PROVIDER_ENABLED / OT86_ALLOW_VIMEO_CANARY_UPLOAD';
  if (lane === 'telegram') return 'ONE_TIME_TELEGRAM_WEBHOOK_ENABLED';
  if (lane === 'openai_student_helper') return 'ONE_TIME_HELPER_RUNTIME_ENABLED';
  if (lane === 'buffer') return 'OT106_BUFFER_PROVIDER_MODE / BUFFER_DESTINATION_IDS';
  return 'provider-specific runtime flags';
}

function safeLoadConfig(env: NodeJS.ProcessEnv) {
  try {
    return { ok: true as const, config: loadConfig(env), reason: null };
  } catch (error) {
    return {
      ok: false as const,
      config: null,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

async function loadRuntimeEnv(filePath: string): Promise<NodeJS.ProcessEnv> {
  const parsed = JSON.parse(
    (await readFile(filePath, 'utf8')).replace(/^\uFEFF/, ''),
  ) as RuntimeEnvFile;
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(parsed.env ?? {})) {
    if (value !== null && value !== undefined) env[key] = String(value);
  }
  return env;
}

function assertNoSensitiveEnvValues(serializedReport: string, env: NodeJS.ProcessEnv) {
  for (const [key, value] of Object.entries(env)) {
    if (!value || safeValueKeys.has(key) || !isSensitiveKey(key) || value.length < 6) continue;
    if (serializedReport.includes(value)) {
      throw new Error(`Report would expose a protected value for ${key}.`);
    }
  }
}

function isSensitiveKey(key: string) {
  return /EMAIL|PHONE|WHATSAPP|TELEGRAM|TOKEN|SECRET|PASSWORD|KEY|URL|STRIPE|ZOOM|VIMEO|BUFFER|OPENAI|BNA|HMAC|WEBHOOK|DESTINATION|RECIPIENT/i.test(
    key,
  );
}

function parseArgs(argv: string[]): Args {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg?.startsWith('--')) continue;
    const key = arg.slice(2);
    const value = argv[index + 1];
    if (!value) throw new Error(`Missing value for --${key}`);
    values.set(key, value);
    index += 1;
  }
  const runtimeEnvJson = values.get('runtime-env-json');
  const out = values.get('out');
  if (!runtimeEnvJson) throw new Error('Missing --runtime-env-json');
  if (!out) throw new Error('Missing --out');
  return {
    runtimeEnvJson,
    out,
    now: values.get('now') ? new Date(String(values.get('now'))) : new Date(),
  };
}

function isCliEntrypoint() {
  return process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
}

if (isCliEntrypoint()) {
  const report = await createProviderReadinessSnapshot(parseArgs(process.argv.slice(2)));
  process.stdout.write(
    `${JSON.stringify(
      {
        status: 'written',
        runtime_source_sha: report.runtime_source_sha,
        provider_lanes: report.w13_provider_lanes,
        external_effects: report.external_effects,
      },
      null,
      2,
    )}\n`,
  );
}
