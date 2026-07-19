import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { exactW12100CrmImportAuthorizationStatement } from './real-source-preflight.ts';

export const RABBI_DAY_ONE_CRM_APPLY_READINESS_SCHEMA =
  'onetime.rabbi_day_one_crm_apply_readiness_preflight.v1';
export const RABBI_DAY_ONE_CRM_PRODUCTION_CONFIRMATION = 'RABBI-DAY-ONE-CRM-PRODUCTION-APPLY-OK';

const DEFAULT_PRIVATE_DIR = 'C:/Users/User/.onetime-w13-104-private';
const DEFAULT_RUN_DIR = 'ops/codex-runs/RABBI-DAY-ONE-CRM';
const DEFAULT_SOURCE_PACKET = `${DEFAULT_PRIVATE_DIR}/crm-approved-source-packet`;
const DEFAULT_PRIVATE_AUTHORIZATION = `${DEFAULT_PRIVATE_DIR}/CRM-IMPORT-AUTHORIZATION.private.json`;
const DEFAULT_BACKUP_PROOF = `${DEFAULT_PRIVATE_DIR}/RABBI-DAY-ONE-CRM-BACKUP-PROOF.private.json`;
const DEFAULT_OPERATOR_AUTHORIZATION = `${DEFAULT_PRIVATE_DIR}/RABBI-DAY-ONE-CRM-OPERATOR-AUTHORIZATION.private.txt`;
const DEFAULT_IDEMPOTENCY_KEY = `${DEFAULT_PRIVATE_DIR}/RABBI-DAY-ONE-CRM-IDEMPOTENCY.private.txt`;
const DEFAULT_CREATED_BY_USER_KEY = `${DEFAULT_PRIVATE_DIR}/RABBI-DAY-ONE-CRM-CREATED-BY-USER.private.txt`;
const DEFAULT_PRODUCTION_CONFIRMATION = `${DEFAULT_PRIVATE_DIR}/RABBI-DAY-ONE-CRM-PRODUCTION-CONFIRMATION.private.txt`;
const DEFAULT_MANUAL_REVIEW_HANDLING = `${DEFAULT_PRIVATE_DIR}/RABBI-DAY-ONE-CRM-MANUAL-REVIEW-HANDLING.private.json`;

type TargetEnvironment = 'local' | 'test' | 'staging' | 'production';

export type CrmApplyReadinessPreflightOptions = {
  backupProofFile?: string | undefined;
  createdByUserKeyFile?: string | undefined;
  databaseUrlEnvName?: string | undefined;
  dryRunReportFile?: string | undefined;
  env?: NodeJS.ProcessEnv | undefined;
  expectedDryRunSha256?: string | undefined;
  idempotencyKeyFile?: string | undefined;
  manualReviewHandlingFile?: string | undefined;
  now?: Date | undefined;
  operatorAuthorizationFile?: string | undefined;
  privateAuthorizationFile?: string | undefined;
  productionConfirmationFile?: string | undefined;
  sourcePacketDir?: string | undefined;
  targetEnvironment?: TargetEnvironment | undefined;
};

export type CrmApplyReadinessPreflightReport = {
  schema_version: typeof RABBI_DAY_ONE_CRM_APPLY_READINESS_SCHEMA;
  generated_at: string;
  status: 'ready' | 'blocked';
  blocked_reasons: string[];
  target_environment: TargetEnvironment;
  approved_scope: {
    dry_run_report_path: string;
    dry_run_report_sha256: string | null;
    expected_dry_run_report_sha256: string | null;
    approved_source_group_fingerprint: string | null;
    total_rows: number | null;
    crm_importable: number | null;
    manual_review_rows: number | null;
    required_authorization_statement: string | null;
    required_production_confirmation: typeof RABBI_DAY_ONE_CRM_PRODUCTION_CONFIRMATION;
  };
  protected_sources: {
    source_packet_path: string;
    private_authorization_path: string;
    backup_proof_path: string;
    operator_authorization_path: string;
    idempotency_key_path: string;
    created_by_user_key_path: string;
    production_confirmation_path: string;
    manual_review_handling_path: string;
    raw_values_included: false;
    secrets_printed: false;
    production_database_connected: false;
    production_database_read: false;
    database_writes_performed: false;
    external_sends_performed: false;
    provider_mutation_count: 0;
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

type DryRunSummary = {
  approvedSourceGroupFingerprint: string | null;
  crmImportable: number | null;
  manualReviewRows: number | null;
  statusDone: boolean;
  totalRows: number | null;
};

type BackupProof = {
  approved_source_group_fingerprint?: unknown;
  crm_importable?: unknown;
  dry_run_report_sha256?: unknown;
  raw_values_included?: unknown;
  target_environment?: unknown;
  total_rows?: unknown;
};

type ManualReviewHandling = {
  excluded_from_apply?: unknown;
  manual_review_rows?: unknown;
  raw_values_included?: unknown;
  terminal_decisions_recorded?: unknown;
};

export async function runCrmApplyReadinessPreflight(
  options: CrmApplyReadinessPreflightOptions = {},
): Promise<CrmApplyReadinessPreflightReport> {
  const generatedAt = (options.now ?? new Date()).toISOString();
  const targetEnvironment = options.targetEnvironment ?? 'production';
  const dryRunReportFile =
    options.dryRunReportFile ?? `${DEFAULT_RUN_DIR}/crm-corrected-dry-run.json`;
  const sourcePacketDir = options.sourcePacketDir ?? DEFAULT_SOURCE_PACKET;
  const privateAuthorizationFile =
    options.privateAuthorizationFile ?? DEFAULT_PRIVATE_AUTHORIZATION;
  const backupProofFile = options.backupProofFile ?? DEFAULT_BACKUP_PROOF;
  const operatorAuthorizationFile =
    options.operatorAuthorizationFile ?? DEFAULT_OPERATOR_AUTHORIZATION;
  const idempotencyKeyFile = options.idempotencyKeyFile ?? DEFAULT_IDEMPOTENCY_KEY;
  const createdByUserKeyFile = options.createdByUserKeyFile ?? DEFAULT_CREATED_BY_USER_KEY;
  const productionConfirmationFile =
    options.productionConfirmationFile ?? DEFAULT_PRODUCTION_CONFIRMATION;
  const manualReviewHandlingFile =
    options.manualReviewHandlingFile ?? DEFAULT_MANUAL_REVIEW_HANDLING;
  const databaseUrlEnvName = options.databaseUrlEnvName ?? 'DATABASE_URL';
  const env = options.env ?? process.env;

  const [sourcePacket, privateAuthorization, backupProofInput, operatorAuthorization] =
    await Promise.all([
      directoryInputStatus('sourcePacket', sourcePacketDir),
      textInputStatus('privateAuthorization', privateAuthorizationFile),
      textInputStatus('backupProof', backupProofFile),
      textInputStatus('operatorAuthorization', operatorAuthorizationFile),
    ]);
  const [idempotencyKey, createdByUserKey, productionConfirmation, manualReviewHandling] =
    await Promise.all([
      textInputStatus('idempotencyKey', idempotencyKeyFile),
      textInputStatus('createdByUserKey', createdByUserKeyFile),
      textInputStatus('productionConfirmation', productionConfirmationFile),
      textInputStatus('manualReviewHandling', manualReviewHandlingFile),
    ]);
  const dryRun = await loadDryRunSummary(dryRunReportFile);
  const dryRunReportSha256 = dryRun.present ? await sha256File(dryRunReportFile) : null;
  const expectedDryRunSha256 =
    normalizeOptionalSha(options.expectedDryRunSha256) ?? dryRunReportSha256;
  const requiredAuthorizationStatement =
    dryRunReportSha256 && dryRun.crmImportable !== null
      ? exactW12100CrmImportAuthorizationStatement({
          dryRunReportSha256,
          crmImportable: dryRun.crmImportable,
          targetEnvironment,
        })
      : null;
  const privateAuthorizationJson = parseJsonObject(privateAuthorization.value);
  const backupProof = parseJsonObject(backupProofInput.value) as BackupProof | null;
  const manualHandling = parseJsonObject(manualReviewHandling.value) as ManualReviewHandling | null;
  const databaseUrl = env[databaseUrlEnvName]?.trim() || null;

  const checks = {
    source_packet_available: sourcePacket.present,
    dry_run_report_available: dryRun.present,
    dry_run_report_status_done: dryRun.statusDone,
    dry_run_report_sha_matches_expected:
      Boolean(dryRunReportSha256) && dryRunReportSha256 === expectedDryRunSha256,
    private_authorization_manifest_present: privateAuthorization.present,
    private_authorization_manifest_readable_json: Boolean(privateAuthorizationJson),
    private_authorization_manifest_production_apply_authorized:
      readBoolean(privateAuthorizationJson, 'production_apply_authorized') === true,
    backup_proof_present: backupProofInput.present,
    backup_proof_readable_json: Boolean(backupProof),
    backup_proof_target_environment_matches: backupProof?.target_environment === targetEnvironment,
    backup_proof_dry_run_sha_matches: backupProof?.dry_run_report_sha256 === dryRunReportSha256,
    backup_proof_source_group_matches:
      backupProof?.approved_source_group_fingerprint === dryRun.approvedSourceGroupFingerprint,
    backup_proof_total_rows_matches: backupProof?.total_rows === dryRun.totalRows,
    backup_proof_crm_importable_matches: backupProof?.crm_importable === dryRun.crmImportable,
    backup_proof_raw_values_excluded: backupProof?.raw_values_included === false,
    operator_authorization_present: operatorAuthorization.nonempty,
    operator_authorization_matches_required:
      Boolean(requiredAuthorizationStatement) &&
      operatorAuthorization.value === requiredAuthorizationStatement,
    idempotency_key_present: idempotencyKey.nonempty,
    created_by_user_key_present: createdByUserKey.nonempty,
    production_confirmation_present: productionConfirmation.nonempty,
    production_confirmation_matches_required:
      productionConfirmation.value === RABBI_DAY_ONE_CRM_PRODUCTION_CONFIRMATION,
    manual_review_handling_present: manualReviewHandling.present,
    manual_review_handling_readable_json: Boolean(manualHandling),
    manual_review_rows_match: manualHandling?.manual_review_rows === dryRun.manualReviewRows,
    manual_review_rows_excluded_or_terminal:
      manualHandling?.excluded_from_apply === true ||
      manualHandling?.terminal_decisions_recorded === true,
    manual_review_raw_values_excluded: manualHandling?.raw_values_included === false,
    database_url_configured: Boolean(databaseUrl),
    no_raw_values_in_report: true,
    no_production_side_effects: true,
  };
  const blockedReasons = blockedReadinessReasons(checks);

  return {
    schema_version: RABBI_DAY_ONE_CRM_APPLY_READINESS_SCHEMA,
    generated_at: generatedAt,
    status: blockedReasons.length ? 'blocked' : 'ready',
    blocked_reasons: blockedReasons,
    target_environment: targetEnvironment,
    approved_scope: {
      dry_run_report_path: dryRunReportFile,
      dry_run_report_sha256: dryRunReportSha256,
      expected_dry_run_report_sha256: expectedDryRunSha256,
      approved_source_group_fingerprint: dryRun.approvedSourceGroupFingerprint,
      total_rows: dryRun.totalRows,
      crm_importable: dryRun.crmImportable,
      manual_review_rows: dryRun.manualReviewRows,
      required_authorization_statement: requiredAuthorizationStatement,
      required_production_confirmation: RABBI_DAY_ONE_CRM_PRODUCTION_CONFIRMATION,
    },
    protected_sources: {
      source_packet_path: sourcePacketDir,
      private_authorization_path: privateAuthorizationFile,
      backup_proof_path: backupProofFile,
      operator_authorization_path: operatorAuthorizationFile,
      idempotency_key_path: idempotencyKeyFile,
      created_by_user_key_path: createdByUserKeyFile,
      production_confirmation_path: productionConfirmationFile,
      manual_review_handling_path: manualReviewHandlingFile,
      raw_values_included: false,
      secrets_printed: false,
      production_database_connected: false,
      production_database_read: false,
      database_writes_performed: false,
      external_sends_performed: false,
      provider_mutation_count: 0,
    },
    inputs: {
      sourcePacket,
      privateAuthorization: summarizeInput(privateAuthorization),
      backupProof: summarizeInput(backupProofInput),
      operatorAuthorization: summarizeInput(operatorAuthorization),
      idempotencyKey: summarizeInput(idempotencyKey),
      createdByUserKey: summarizeInput(createdByUserKey),
      productionConfirmation: summarizeInput(productionConfirmation),
      manualReviewHandling: summarizeInput(manualReviewHandling),
      databaseUrl: {
        present: Boolean(databaseUrl),
        nonempty: Boolean(databaseUrl),
        fingerprint: databaseUrl ? fingerprintValue('databaseUrl', databaseUrl) : null,
      },
    },
    checks,
  };
}

async function loadDryRunSummary(filePath: string): Promise<DryRunSummary & { present: boolean }> {
  try {
    const parsed = JSON.parse(await readFile(filePath, 'utf8')) as {
      status?: unknown;
      approved_scope?: { approved_source_group_fingerprint?: unknown };
      summary?: {
        crm_importable?: unknown;
        manual_review_rows?: unknown;
        total_rows?: unknown;
      };
    };
    return {
      present: true,
      approvedSourceGroupFingerprint: textOrNull(
        parsed.approved_scope?.approved_source_group_fingerprint,
      ),
      crmImportable: numberOrNull(parsed.summary?.crm_importable),
      manualReviewRows: numberOrNull(parsed.summary?.manual_review_rows),
      statusDone: parsed.status === 'done',
      totalRows: numberOrNull(parsed.summary?.total_rows),
    };
  } catch {
    return {
      present: false,
      approvedSourceGroupFingerprint: null,
      crmImportable: null,
      manualReviewRows: null,
      statusDone: false,
      totalRows: null,
    };
  }
}

function blockedReadinessReasons(checks: CrmApplyReadinessPreflightReport['checks']) {
  const reasons: string[] = [];
  if (!checks.source_packet_available) reasons.push('BLOCKED_SOURCE_PACKET_NOT_FOUND');
  if (!checks.dry_run_report_available) {
    reasons.push('BLOCKED_DRY_RUN_REPORT_NOT_FOUND');
  } else {
    if (!checks.dry_run_report_status_done) reasons.push('BLOCKED_DRY_RUN_REPORT_NOT_DONE');
    if (!checks.dry_run_report_sha_matches_expected) reasons.push('BLOCKED_DRY_RUN_SHA_MISMATCH');
  }
  if (!checks.private_authorization_manifest_present) {
    reasons.push('BLOCKED_PRIVATE_AUTHORIZATION_MANIFEST_NOT_FOUND');
  } else if (!checks.private_authorization_manifest_readable_json) {
    reasons.push('BLOCKED_PRIVATE_AUTHORIZATION_MANIFEST_UNREADABLE');
  } else if (!checks.private_authorization_manifest_production_apply_authorized) {
    reasons.push('BLOCKED_PRIVATE_MANIFEST_PRODUCTION_APPLY_NOT_AUTHORIZED');
  }
  if (!checks.backup_proof_present) {
    reasons.push('BLOCKED_BACKUP_PROOF_NOT_PROVIDED');
  } else if (!checks.backup_proof_readable_json) {
    reasons.push('BLOCKED_BACKUP_PROOF_UNREADABLE');
  } else {
    if (!checks.backup_proof_target_environment_matches) {
      reasons.push('BLOCKED_BACKUP_PROOF_TARGET_ENVIRONMENT_MISMATCH');
    }
    if (!checks.backup_proof_dry_run_sha_matches) {
      reasons.push('BLOCKED_BACKUP_PROOF_DRY_RUN_SHA_MISMATCH');
    }
    if (!checks.backup_proof_source_group_matches) {
      reasons.push('BLOCKED_BACKUP_PROOF_SOURCE_GROUP_MISMATCH');
    }
    if (!checks.backup_proof_total_rows_matches) {
      reasons.push('BLOCKED_BACKUP_PROOF_TOTAL_ROWS_MISMATCH');
    }
    if (!checks.backup_proof_crm_importable_matches) {
      reasons.push('BLOCKED_BACKUP_PROOF_CRM_IMPORTABLE_MISMATCH');
    }
    if (!checks.backup_proof_raw_values_excluded) {
      reasons.push('BLOCKED_BACKUP_PROOF_RAW_VALUES_NOT_EXCLUDED');
    }
  }
  if (!checks.operator_authorization_present)
    reasons.push('BLOCKED_OPERATOR_AUTHORIZATION_NOT_PROVIDED');
  else if (!checks.operator_authorization_matches_required) {
    reasons.push('BLOCKED_EXACT_OPERATOR_AUTHORIZATION_MISMATCH');
  }
  if (!checks.idempotency_key_present) reasons.push('BLOCKED_IDEMPOTENCY_KEY_NOT_PROVIDED');
  if (!checks.created_by_user_key_present) reasons.push('BLOCKED_CREATED_BY_USER_KEY_NOT_PROVIDED');
  if (!checks.production_confirmation_present) {
    reasons.push('BLOCKED_PRODUCTION_CONFIRMATION_NOT_PROVIDED');
  } else if (!checks.production_confirmation_matches_required) {
    reasons.push('BLOCKED_PRODUCTION_CONFIRMATION_MISMATCH');
  }
  if (!checks.manual_review_handling_present) {
    reasons.push('BLOCKED_MANUAL_REVIEW_HANDLING_NOT_PROVIDED');
  } else if (!checks.manual_review_handling_readable_json) {
    reasons.push('BLOCKED_MANUAL_REVIEW_HANDLING_UNREADABLE');
  } else {
    if (!checks.manual_review_rows_match) reasons.push('BLOCKED_MANUAL_REVIEW_COUNT_MISMATCH');
    if (!checks.manual_review_rows_excluded_or_terminal) {
      reasons.push('BLOCKED_MANUAL_REVIEW_ROWS_NOT_EXCLUDED_OR_TERMINAL');
    }
    if (!checks.manual_review_raw_values_excluded) {
      reasons.push('BLOCKED_MANUAL_REVIEW_RAW_VALUES_NOT_EXCLUDED');
    }
  }
  if (!checks.database_url_configured) reasons.push('BLOCKED_DATABASE_URL_NOT_CONFIGURED');
  return Array.from(new Set(reasons)).sort();
}

async function directoryInputStatus(kind: string, directory: string) {
  try {
    const stats = await stat(directory);
    return {
      present: stats.isDirectory(),
      nonempty: stats.isDirectory(),
      fingerprint: stats.isDirectory() ? fingerprintValue(kind, directory) : null,
    };
  } catch {
    return { present: false, nonempty: false, fingerprint: null };
  }
}

async function textInputStatus(kind: string, filePath: string): Promise<LoadedTextInput> {
  try {
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

function summarizeInput(input: LoadedTextInput) {
  return {
    present: input.present,
    nonempty: input.nonempty,
    fingerprint: input.fingerprint,
  };
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

function readBoolean(object: Record<string, unknown> | null, key: string) {
  return typeof object?.[key] === 'boolean' ? object[key] : null;
}

function textOrNull(value: unknown) {
  return typeof value === 'string' && value ? value : null;
}

function numberOrNull(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
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
  return createHash('sha256').update(`rabbi-day-one-crm-apply:${kind}\0${value}`).digest('hex');
}

function parseArgs(argv: string[]) {
  const values = new Map<string, string>();
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) values.set(match[1] as string, match[2] as string);
  }
  return {
    backupProofFile: values.get('backup-proof-file'),
    createdByUserKeyFile: values.get('created-by-user-key-file'),
    databaseUrlEnvName: values.get('database-url-env-name'),
    dryRunReportFile: values.get('dry-run-report-file'),
    expectedDryRunSha256: values.get('expected-dry-run-sha256'),
    idempotencyKeyFile: values.get('idempotency-key-file'),
    manualReviewHandlingFile: values.get('manual-review-handling-file'),
    operatorAuthorizationFile: values.get('operator-authorization-file'),
    out: values.get('out'),
    privateAuthorizationFile: values.get('private-authorization-file'),
    productionConfirmationFile: values.get('production-confirmation-file'),
    sourcePacketDir: values.get('source-packet-dir'),
    targetEnvironment: values.get('target-environment') as TargetEnvironment | undefined,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = await runCrmApplyReadinessPreflight(args);
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
