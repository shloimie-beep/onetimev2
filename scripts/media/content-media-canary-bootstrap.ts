import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const CONTENT_MEDIA_CANARY_BOOTSTRAP_SCHEMA =
  'onetime.content_media_canary_bootstrap.v1' as const;

const REQUIRED_ENVIRONMENT_NAMES = [
  'ONE_TIME_RUNTIME_ENVIRONMENT',
  'ONE_TIME_VERIFICATION_ENVIRONMENT_ID',
  'ONE_TIME_CONTENT_MEDIA_MODE',
  'ONE_TIME_CONTENT_MEDIA_AUTHORIZATION_ID',
  'ONE_TIME_CONTENT_CANARY_ID',
  'CONTENT_S3_BUCKET',
  'CONTENT_S3_KMS_KEY_ARN',
  'CONTENT_S3_STORAGE_CLASS',
  'AWS_REGION',
  'CONTENT_FFMPEG_PATH',
  'CONTENT_FFPROBE_PATH',
  'OPENAI_API_KEY',
  'OPENAI_PROJECT_ID',
  'VIMEO_ACCESS_TOKEN',
  'VIMEO_ACCOUNT_ID',
  'VIMEO_WEBHOOK_SECRET',
  'CONTENT_S3_PROVIDER_ACCOUNT_REF_HASH',
  'CONTENT_S3_REGISTRY_EVIDENCE_DIGEST',
  'CONTENT_S3_PROVIDER_READBACK_EVIDENCE_DIGEST',
  'CONTENT_S3_REGISTRY_VERSION',
  'CONTENT_S3_REGISTRY_OBSERVED_NOT_BEFORE',
  'CONTENT_OPENAI_PROVIDER_ACCOUNT_REF_HASH',
  'CONTENT_OPENAI_REGISTRY_EVIDENCE_DIGEST',
  'CONTENT_OPENAI_PROVIDER_READBACK_EVIDENCE_DIGEST',
  'CONTENT_OPENAI_REGISTRY_VERSION',
  'CONTENT_OPENAI_REGISTRY_OBSERVED_NOT_BEFORE',
  'CONTENT_VIMEO_PROVIDER_ACCOUNT_REF_HASH',
  'CONTENT_VIMEO_REGISTRY_EVIDENCE_DIGEST',
  'CONTENT_VIMEO_PROVIDER_READBACK_EVIDENCE_DIGEST',
  'CONTENT_VIMEO_REGISTRY_VERSION',
  'CONTENT_VIMEO_REGISTRY_OBSERVED_NOT_BEFORE',
] as const;

const REGISTRY_PLAN = [
  {
    provider: 's3',
    registry_binding_key: 's3_content_original_primary',
    allowed_operation_types: ['multipart_original_write'],
  },
  {
    provider: 'openai',
    registry_binding_key: 'openai_content_processing_primary',
    allowed_operation_types: ['transcribe_and_generate_learning_draft'],
  },
  {
    provider: 'vimeo',
    registry_binding_key: 'vimeo_publication_primary',
    allowed_operation_types: ['publish_private', 'revoke_private'],
  },
] as const;

type ProviderName = (typeof REGISTRY_PLAN)[number]['provider'];
type PresenceMap = Partial<Record<(typeof REQUIRED_ENVIRONMENT_NAMES)[number], boolean>>;

export type ContentMediaCanaryBootstrapInput = {
  schema_version: typeof CONTENT_MEDIA_CANARY_BOOTSTRAP_SCHEMA;
  services: {
    web: {
      content_media_enabled: boolean;
      content_media_worker_enabled: false;
      shared_configuration_digest: string | null;
      env_presence: PresenceMap;
    };
    worker: {
      content_media_enabled: boolean;
      content_media_worker_enabled: false;
      shared_configuration_digest: string | null;
      env_presence: PresenceMap;
    };
  };
  handoff: {
    phase: 'temporary' | 'confirmed';
    temporary_reference_digest: string;
    confirmed_source_key?: string | null;
    durable_source_receipt?: {
      source_sha256: string;
      object_version_id_present: boolean;
      checksum_readback_receipt_id_present: boolean;
    } | null;
    dec_160_standalone_source_confirmed: boolean;
  };
  registry_receipts?: Partial<
    Record<
      ProviderName,
      {
        provider_account_ref_hash: string;
        registry_evidence_digest: string;
        provider_readback_evidence_digest: string;
        observed_at: string;
        version: number;
      }
    >
  >;
};

export type ContentMediaCanaryBootstrapReport = {
  schema_version: typeof CONTENT_MEDIA_CANARY_BOOTSTRAP_SCHEMA;
  status: 'ready_for_separately_authorized_apply' | 'blocked';
  blocked_reasons: string[];
  effects: {
    external_provider_calls: 0;
    database_reads: 0;
    database_writes: 0;
    environment_writes: 0;
    deployments: 0;
  };
  service_check: {
    web_enabled: boolean;
    worker_enabled: boolean;
    worker_media_runner_enabled: boolean;
    required_names_missing: { web: string[]; worker: string[] };
    shared_configuration_parity: boolean;
  };
  handoff_check: {
    phase: 'temporary' | 'confirmed';
    temporary_reference_digest_present: boolean;
    confirmed_source_key_present: boolean;
    durable_source_receipt_complete: boolean;
    dec_160_standalone_source_confirmed: boolean;
    processing_or_publication_permitted: false;
  };
  redacted_registry_plan: Array<{
    provider: ProviderName;
    registry_binding_key: string;
    allowed_operation_types: readonly string[];
    receipt_present: boolean;
    receipt_shape_valid: boolean;
    sql_apply_template: string;
  }>;
  next_effectful_steps: readonly [
    'separate_provider_account_authorization',
    'separate_registry_database_apply',
    'separate_protected_environment_apply',
    'separate_deployment_and_readback',
  ];
};

export function inspectContentMediaCanaryBootstrap(
  input: ContentMediaCanaryBootstrapInput,
): ContentMediaCanaryBootstrapReport {
  const webMissing = missingNames(input.services.web.env_presence);
  const workerMissing = missingNames(input.services.worker.env_presence);
  const registryPlan = REGISTRY_PLAN.map((plan) => {
    const receipt = input.registry_receipts?.[plan.provider];
    return {
      ...plan,
      receipt_present: Boolean(receipt),
      receipt_shape_valid: receiptValid(receipt),
      sql_apply_template:
        'INSERT/UPDATE onetime.provider_registry_binding_v21 only under a separately authorized DB apply; use supplied redacted receipt digests, never generated values.',
    };
  });
  const durableSourceReceiptComplete =
    input.handoff.durable_source_receipt !== null &&
    input.handoff.durable_source_receipt !== undefined &&
    sha(input.handoff.durable_source_receipt.source_sha256) &&
    input.handoff.durable_source_receipt.object_version_id_present &&
    input.handoff.durable_source_receipt.checksum_readback_receipt_id_present;
  const confirmedSourceKeyPresent =
    typeof input.handoff.confirmed_source_key === 'string' &&
    /^source_[a-f0-9]{32}$/u.test(input.handoff.confirmed_source_key);
  const parity =
    sha(input.services.web.shared_configuration_digest) &&
    input.services.web.shared_configuration_digest === input.services.worker.shared_configuration_digest;
  const reasons: string[] = [];

  if (input.schema_version !== CONTENT_MEDIA_CANARY_BOOTSTRAP_SCHEMA) {
    reasons.push('BLOCKED_BOOTSTRAP_SCHEMA_MISMATCH');
  }
  if (!input.services.web.content_media_enabled) reasons.push('BLOCKED_WEB_MEDIA_NOT_ENABLED');
  if (input.services.worker.content_media_enabled) reasons.push('BLOCKED_WORKER_MUST_REMAIN_OFF_FOR_HANDOFF');
  if (input.services.web.content_media_worker_enabled || input.services.worker.content_media_worker_enabled) {
    reasons.push('BLOCKED_MEDIA_WORKER_MUST_REMAIN_OFF_FOR_HANDOFF');
  }
  if (webMissing.length > 0) reasons.push('BLOCKED_WEB_REQUIRED_ENVIRONMENT_NAMES_MISSING');
  if (workerMissing.length > 0) reasons.push('BLOCKED_WORKER_REQUIRED_ENVIRONMENT_NAMES_MISSING');
  if (!parity) reasons.push('BLOCKED_WEB_WORKER_SHARED_CONFIGURATION_PARITY_UNPROVEN');
  if (!sha(input.handoff.temporary_reference_digest)) {
    reasons.push('BLOCKED_TEMPORARY_HANDOFF_REFERENCE_MISSING');
  }
  if (!input.handoff.dec_160_standalone_source_confirmed) {
    reasons.push('BLOCKED_DEC_160_STANDALONE_SOURCE_INVARIANT_UNCONFIRMED');
  }
  if (input.handoff.phase === 'temporary') {
    if (input.handoff.confirmed_source_key || input.handoff.durable_source_receipt) {
      reasons.push('BLOCKED_TEMPORARY_HANDOFF_MUST_NOT_ASSERT_CONFIRMED_SOURCE');
    }
  } else {
    if (!confirmedSourceKeyPresent) reasons.push('BLOCKED_CONFIRMED_SOURCE_KEY_INVALID');
    if (!durableSourceReceiptComplete) reasons.push('BLOCKED_CONFIRMED_SOURCE_RECEIPT_INCOMPLETE');
  }
  if (registryPlan.some((plan) => !plan.receipt_shape_valid)) {
    reasons.push('BLOCKED_PROVIDER_REGISTRY_RECEIPT_INCOMPLETE');
  }

  return {
    schema_version: CONTENT_MEDIA_CANARY_BOOTSTRAP_SCHEMA,
    status: reasons.length === 0 ? 'ready_for_separately_authorized_apply' : 'blocked',
    blocked_reasons: [...new Set(reasons)].sort(),
    effects: {
      external_provider_calls: 0,
      database_reads: 0,
      database_writes: 0,
      environment_writes: 0,
      deployments: 0,
    },
    service_check: {
      web_enabled: input.services.web.content_media_enabled,
      worker_enabled: input.services.worker.content_media_enabled,
      worker_media_runner_enabled:
        input.services.web.content_media_worker_enabled ||
        input.services.worker.content_media_worker_enabled,
      required_names_missing: { web: webMissing, worker: workerMissing },
      shared_configuration_parity: parity,
    },
    handoff_check: {
      phase: input.handoff.phase,
      temporary_reference_digest_present: sha(input.handoff.temporary_reference_digest),
      confirmed_source_key_present: confirmedSourceKeyPresent,
      durable_source_receipt_complete: durableSourceReceiptComplete,
      dec_160_standalone_source_confirmed: input.handoff.dec_160_standalone_source_confirmed,
      processing_or_publication_permitted: false,
    },
    redacted_registry_plan: registryPlan,
    next_effectful_steps: [
      'separate_provider_account_authorization',
      'separate_registry_database_apply',
      'separate_protected_environment_apply',
      'separate_deployment_and_readback',
    ],
  };
}

function missingNames(presence: PresenceMap) {
  return REQUIRED_ENVIRONMENT_NAMES.filter((name) => presence[name] !== true);
}

function receiptValid(
  receipt:
    | {
        provider_account_ref_hash: string;
        registry_evidence_digest: string;
        provider_readback_evidence_digest: string;
        observed_at: string;
        version: number;
      }
    | undefined,
) {
  return Boolean(
    receipt &&
      sha(receipt.provider_account_ref_hash) &&
      sha(receipt.registry_evidence_digest) &&
      sha(receipt.provider_readback_evidence_digest) &&
      Number.isSafeInteger(receipt.version) &&
      receipt.version > 0 &&
      Number.isFinite(Date.parse(receipt.observed_at)),
  );
}

function sha(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
}

function parseArgs(argv: readonly string[]) {
  const values = new Map<string, string>();
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/u);
    if (match) values.set(match[1], match[2]);
  }
  return { input: values.get('input'), out: values.get('out') };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) throw new Error('content_media_canary_bootstrap_input_required');
  const input = JSON.parse(await readFile(path.resolve(args.input), 'utf8')) as ContentMediaCanaryBootstrapInput;
  const output = \`\${JSON.stringify(inspectContentMediaCanaryBootstrap(input), null, 2)}\n\`;
  if (args.out) {
    await mkdir(path.dirname(path.resolve(args.out)), { recursive: true });
    await writeFile(path.resolve(args.out), output, { encoding: 'utf8', flag: 'wx' });
  } else {
    process.stdout.write(output);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
