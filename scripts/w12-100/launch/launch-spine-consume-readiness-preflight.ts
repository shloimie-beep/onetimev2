import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const ONE_TIME_LAUNCH_SPINE_CONSUME_READINESS_SCHEMA =
  'onetime.one_time_finish_now.launch_spine_consume_readiness_preflight.v1';
export const ONE_TIME_LAUNCH_SPINE_CONSUME_CONFIRMATION =
  'ONE-TIME-PRODUCTION-LAUNCH-SPINE-CONSUME-OK';

const DEFAULT_PRIVATE_DIR = 'C:/Users/User/.onetime-w13-104-private';
const DEFAULT_RUN_DIR = 'ops/codex-runs/ONE-TIME-FINISH-NOW';
const DEFAULT_READONLY_DIR = `${DEFAULT_RUN_DIR}/production-launch-spine-readonly`;
const DEFAULT_ROUTE_READBACK = `${DEFAULT_READONLY_DIR}/route-readback.json`;
const DEFAULT_SYNTHETIC_PROBES = `${DEFAULT_READONLY_DIR}/synthetic-probes.json`;
const DEFAULT_ROLE_BASELINE = 'ops/codex-runs/W13-103/ROLE-ACCEPTANCE.json';
const DEFAULT_PRIVATE_CONSUME_PLAN = `${DEFAULT_PRIVATE_DIR}/ONE-TIME-LAUNCH-SPINE-CONSUME-PLAN.private.json`;
const DEFAULT_CLEANUP_INSTRUCTIONS = `${DEFAULT_PRIVATE_DIR}/ONE-TIME-LAUNCH-SPINE-CLEANUP-INSTRUCTIONS.private.json`;
const DEFAULT_OPERATOR_AUTHORIZATION = `${DEFAULT_PRIVATE_DIR}/ONE-TIME-LAUNCH-SPINE-OPERATOR-AUTHORIZATION.private.txt`;
const DEFAULT_PRODUCTION_CONFIRMATION = `${DEFAULT_PRIVATE_DIR}/ONE-TIME-LAUNCH-SPINE-PRODUCTION-CONFIRMATION.private.txt`;
const DEFAULT_ADMIN_JOURNEY_INPUT = `${DEFAULT_PRIVATE_DIR}/ONE-TIME-LAUNCH-SPINE-ADMIN-JOURNEY.private.json`;
const DEFAULT_PARENT_JOURNEY_INPUT = `${DEFAULT_PRIVATE_DIR}/ONE-TIME-LAUNCH-SPINE-PARENT-JOURNEY.private.json`;
const DEFAULT_STUDENT_JOURNEY_INPUT = `${DEFAULT_PRIVATE_DIR}/ONE-TIME-LAUNCH-SPINE-STUDENT-JOURNEY.private.json`;
const DEFAULT_SIGNUP_LEAD_INPUT = `${DEFAULT_PRIVATE_DIR}/ONE-TIME-LAUNCH-SPINE-SIGNUP-LEAD.private.json`;

type TargetEnvironment = 'local' | 'test' | 'staging' | 'production';

export type LaunchSpineConsumeReadinessPreflightOptions = {
  adminJourneyInputFile?: string | undefined;
  cleanupInstructionsFile?: string | undefined;
  expectedRouteReadbackSha256?: string | undefined;
  expectedSyntheticProbesSha256?: string | undefined;
  now?: Date | undefined;
  operatorAuthorizationFile?: string | undefined;
  parentJourneyInputFile?: string | undefined;
  privateConsumePlanFile?: string | undefined;
  productionConfirmationFile?: string | undefined;
  roleBaselineFile?: string | undefined;
  routeReadbackFile?: string | undefined;
  signupLeadInputFile?: string | undefined;
  studentJourneyInputFile?: string | undefined;
  syntheticProbesFile?: string | undefined;
  targetEnvironment?: TargetEnvironment | undefined;
};

export type LaunchSpineConsumeReadinessPreflightReport = {
  schema_version: typeof ONE_TIME_LAUNCH_SPINE_CONSUME_READINESS_SCHEMA;
  generated_at: string;
  status: 'ready' | 'blocked';
  blocked_reasons: string[];
  target_environment: TargetEnvironment;
  readonly_evidence: {
    route_readback_path: string;
    route_readback_sha256: string | null;
    expected_route_readback_sha256: string | null;
    route_readback_status: string | null;
    route_count: number | null;
    passed_count: number | null;
    synthetic_probes_path: string;
    synthetic_probes_sha256: string | null;
    expected_synthetic_probes_sha256: string | null;
    synthetic_probes_status: string | null;
    role_baseline_path: string;
    role_baseline_status: string | null;
    required_authorization_statement: string | null;
    required_production_confirmation: typeof ONE_TIME_LAUNCH_SPINE_CONSUME_CONFIRMATION;
  };
  protected_sources: {
    private_consume_plan_path: string;
    cleanup_instructions_path: string;
    operator_authorization_path: string;
    production_confirmation_path: string;
    admin_journey_input_path: string;
    parent_journey_input_path: string;
    student_journey_input_path: string;
    signup_lead_input_path: string;
    raw_values_included: false;
    secrets_printed: false;
    production_database_connected: false;
    production_database_read: false;
    production_database_writes: 0;
    form_submits_performed: 0;
    setup_or_reset_links_consumed: 0;
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
  consuming_paths: {
    role_journeys_ready: boolean;
    production_signup_submit_ready: boolean;
    at_least_one_path_ready: boolean;
  };
  checks: Record<string, boolean>;
};

type LoadedTextInput = {
  present: boolean;
  nonempty: boolean;
  value: string | null;
  fingerprint: string | null;
};

type JsonSummary = {
  present: boolean;
  readableJson: boolean;
  value: Record<string, unknown> | null;
};

type RouteReadbackSummary = {
  present: boolean;
  routeCount: number | null;
  passedCount: number | null;
  readOnlySafety: boolean;
  status: string | null;
};

type SyntheticProbeSummary = {
  externalMutationsSafe: boolean;
  present: boolean;
  requiredReadOnlyProbesPassed: boolean;
  status: string | null;
};

type RoleBaselineSummary = {
  browserContextsPassed: boolean;
  present: boolean;
  status: string | null;
};

export async function runLaunchSpineConsumeReadinessPreflight(
  options: LaunchSpineConsumeReadinessPreflightOptions = {},
): Promise<LaunchSpineConsumeReadinessPreflightReport> {
  const generatedAt = (options.now ?? new Date()).toISOString();
  const targetEnvironment = options.targetEnvironment ?? 'production';
  const routeReadbackFile = options.routeReadbackFile ?? DEFAULT_ROUTE_READBACK;
  const syntheticProbesFile = options.syntheticProbesFile ?? DEFAULT_SYNTHETIC_PROBES;
  const roleBaselineFile = options.roleBaselineFile ?? DEFAULT_ROLE_BASELINE;
  const privateConsumePlanFile = options.privateConsumePlanFile ?? DEFAULT_PRIVATE_CONSUME_PLAN;
  const cleanupInstructionsFile = options.cleanupInstructionsFile ?? DEFAULT_CLEANUP_INSTRUCTIONS;
  const operatorAuthorizationFile =
    options.operatorAuthorizationFile ?? DEFAULT_OPERATOR_AUTHORIZATION;
  const productionConfirmationFile =
    options.productionConfirmationFile ?? DEFAULT_PRODUCTION_CONFIRMATION;
  const adminJourneyInputFile = options.adminJourneyInputFile ?? DEFAULT_ADMIN_JOURNEY_INPUT;
  const parentJourneyInputFile = options.parentJourneyInputFile ?? DEFAULT_PARENT_JOURNEY_INPUT;
  const studentJourneyInputFile = options.studentJourneyInputFile ?? DEFAULT_STUDENT_JOURNEY_INPUT;
  const signupLeadInputFile = options.signupLeadInputFile ?? DEFAULT_SIGNUP_LEAD_INPUT;

  const [
    routeReadback,
    syntheticProbes,
    roleBaseline,
    privateConsumePlanInput,
    cleanupInstructionsInput,
    operatorAuthorization,
    productionConfirmation,
    adminJourneyInput,
    parentJourneyInput,
    studentJourneyInput,
    signupLeadInput,
  ] = await Promise.all([
    loadRouteReadbackSummary(routeReadbackFile),
    loadSyntheticProbeSummary(syntheticProbesFile),
    loadRoleBaselineSummary(roleBaselineFile),
    textInputStatus('privateConsumePlan', privateConsumePlanFile),
    textInputStatus('cleanupInstructions', cleanupInstructionsFile),
    textInputStatus('operatorAuthorization', operatorAuthorizationFile),
    textInputStatus('productionConfirmation', productionConfirmationFile),
    textInputStatus('adminJourneyInput', adminJourneyInputFile),
    textInputStatus('parentJourneyInput', parentJourneyInputFile),
    textInputStatus('studentJourneyInput', studentJourneyInputFile),
    textInputStatus('signupLeadInput', signupLeadInputFile),
  ]);

  const privateConsumePlan = parseJsonInput(privateConsumePlanInput.value);
  const cleanupInstructions = parseJsonInput(cleanupInstructionsInput.value);
  const routeReadbackSha256 = routeReadback.present ? await sha256File(routeReadbackFile) : null;
  const syntheticProbesSha256 = syntheticProbes.present
    ? await sha256File(syntheticProbesFile)
    : null;
  const expectedRouteReadbackSha256 =
    normalizeOptionalSha(options.expectedRouteReadbackSha256) ?? routeReadbackSha256;
  const expectedSyntheticProbesSha256 =
    normalizeOptionalSha(options.expectedSyntheticProbesSha256) ?? syntheticProbesSha256;
  const requiredAuthorizationStatement =
    routeReadbackSha256 && syntheticProbesSha256
      ? exactOneTimeLaunchSpineConsumeAuthorizationStatement({
          routeReadbackSha256,
          syntheticProbesSha256,
          targetEnvironment,
        })
      : null;

  const checks = {
    route_readback_available: routeReadback.present,
    route_readback_status_passed: routeReadback.status === 'passed',
    route_readback_sha_matches_expected:
      Boolean(routeReadbackSha256) && routeReadbackSha256 === expectedRouteReadbackSha256,
    route_readback_safety_readonly: routeReadback.readOnlySafety,
    synthetic_probes_available: syntheticProbes.present,
    synthetic_probes_required_readonly_checks_passed: syntheticProbes.requiredReadOnlyProbesPassed,
    synthetic_probes_external_mutations_safe: syntheticProbes.externalMutationsSafe,
    synthetic_probes_sha_matches_expected:
      Boolean(syntheticProbesSha256) && syntheticProbesSha256 === expectedSyntheticProbesSha256,
    role_baseline_available: roleBaseline.present,
    role_baseline_status_passed: roleBaseline.status === 'passed',
    role_baseline_browser_contexts_passed: roleBaseline.browserContextsPassed,
    private_consume_plan_present: privateConsumePlanInput.present,
    private_consume_plan_readable_json: privateConsumePlan.readableJson,
    private_consume_plan_target_environment_matches:
      privateConsumePlan.value?.target_environment === targetEnvironment,
    private_consume_plan_raw_values_excluded:
      privateConsumePlan.value?.raw_values_included === false,
    private_consume_plan_role_journeys_authorized:
      readBoolean(privateConsumePlan.value, 'role_journeys_authorized') === true,
    private_consume_plan_production_signup_submit_authorized:
      readBoolean(privateConsumePlan.value, 'production_signup_submit_authorized') === true,
    cleanup_instructions_present: cleanupInstructionsInput.present,
    cleanup_instructions_readable_json: cleanupInstructions.readableJson,
    cleanup_instructions_raw_values_excluded:
      cleanupInstructions.value?.raw_values_included === false,
    cleanup_instructions_authorized:
      readBoolean(cleanupInstructions.value, 'post_run_cleanup_authorized') === true,
    operator_authorization_present: operatorAuthorization.nonempty,
    operator_authorization_matches_required:
      Boolean(requiredAuthorizationStatement) &&
      operatorAuthorization.value === requiredAuthorizationStatement,
    production_confirmation_present: productionConfirmation.nonempty,
    production_confirmation_matches_required:
      productionConfirmation.value === ONE_TIME_LAUNCH_SPINE_CONSUME_CONFIRMATION,
    admin_journey_input_present: adminJourneyInput.nonempty,
    parent_journey_input_present: parentJourneyInput.nonempty,
    student_journey_input_present: studentJourneyInput.nonempty,
    signup_lead_input_present: signupLeadInput.nonempty,
    no_raw_values_in_report: true,
    no_production_side_effects: true,
  };
  const roleJourneysReady =
    checks.private_consume_plan_role_journeys_authorized &&
    checks.admin_journey_input_present &&
    checks.parent_journey_input_present &&
    checks.student_journey_input_present;
  const productionSignupSubmitReady =
    checks.private_consume_plan_production_signup_submit_authorized &&
    checks.signup_lead_input_present;
  const atLeastOnePathReady = roleJourneysReady || productionSignupSubmitReady;
  const blockedReasons = blockedReadinessReasons(checks, {
    role_journeys_ready: roleJourneysReady,
    production_signup_submit_ready: productionSignupSubmitReady,
    at_least_one_path_ready: atLeastOnePathReady,
  });

  return {
    schema_version: ONE_TIME_LAUNCH_SPINE_CONSUME_READINESS_SCHEMA,
    generated_at: generatedAt,
    status: blockedReasons.length ? 'blocked' : 'ready',
    blocked_reasons: blockedReasons,
    target_environment: targetEnvironment,
    readonly_evidence: {
      route_readback_path: routeReadbackFile,
      route_readback_sha256: routeReadbackSha256,
      expected_route_readback_sha256: expectedRouteReadbackSha256,
      route_readback_status: routeReadback.status,
      route_count: routeReadback.routeCount,
      passed_count: routeReadback.passedCount,
      synthetic_probes_path: syntheticProbesFile,
      synthetic_probes_sha256: syntheticProbesSha256,
      expected_synthetic_probes_sha256: expectedSyntheticProbesSha256,
      synthetic_probes_status: syntheticProbes.status,
      role_baseline_path: roleBaselineFile,
      role_baseline_status: roleBaseline.status,
      required_authorization_statement: requiredAuthorizationStatement,
      required_production_confirmation: ONE_TIME_LAUNCH_SPINE_CONSUME_CONFIRMATION,
    },
    protected_sources: {
      private_consume_plan_path: privateConsumePlanFile,
      cleanup_instructions_path: cleanupInstructionsFile,
      operator_authorization_path: operatorAuthorizationFile,
      production_confirmation_path: productionConfirmationFile,
      admin_journey_input_path: adminJourneyInputFile,
      parent_journey_input_path: parentJourneyInputFile,
      student_journey_input_path: studentJourneyInputFile,
      signup_lead_input_path: signupLeadInputFile,
      raw_values_included: false,
      secrets_printed: false,
      production_database_connected: false,
      production_database_read: false,
      production_database_writes: 0,
      form_submits_performed: 0,
      setup_or_reset_links_consumed: 0,
      external_sends_performed: false,
      provider_mutation_count: 0,
    },
    inputs: {
      privateConsumePlan: summarizeInput(privateConsumePlanInput),
      cleanupInstructions: summarizeInput(cleanupInstructionsInput),
      operatorAuthorization: summarizeInput(operatorAuthorization),
      productionConfirmation: summarizeInput(productionConfirmation),
      adminJourneyInput: summarizeInput(adminJourneyInput),
      parentJourneyInput: summarizeInput(parentJourneyInput),
      studentJourneyInput: summarizeInput(studentJourneyInput),
      signupLeadInput: summarizeInput(signupLeadInput),
    },
    consuming_paths: {
      role_journeys_ready: roleJourneysReady,
      production_signup_submit_ready: productionSignupSubmitReady,
      at_least_one_path_ready: atLeastOnePathReady,
    },
    checks,
  };
}

export function exactOneTimeLaunchSpineConsumeAuthorizationStatement(input: {
  routeReadbackSha256: string;
  syntheticProbesSha256: string;
  targetEnvironment: TargetEnvironment;
}) {
  return [
    'APPROVE_ONE_TIME_PRODUCTION_LAUNCH_SPINE_CONSUME',
    input.routeReadbackSha256,
    input.syntheticProbesSha256,
    input.targetEnvironment,
  ].join(':');
}

function blockedReadinessReasons(
  checks: LaunchSpineConsumeReadinessPreflightReport['checks'],
  consumingPaths: LaunchSpineConsumeReadinessPreflightReport['consuming_paths'],
) {
  const reasons: string[] = [];
  if (!checks.route_readback_available) {
    reasons.push('BLOCKED_ROUTE_READBACK_NOT_FOUND');
  } else {
    if (!checks.route_readback_status_passed) reasons.push('BLOCKED_ROUTE_READBACK_NOT_PASSED');
    if (!checks.route_readback_sha_matches_expected) {
      reasons.push('BLOCKED_ROUTE_READBACK_SHA_MISMATCH');
    }
    if (!checks.route_readback_safety_readonly) {
      reasons.push('BLOCKED_ROUTE_READBACK_SAFETY_NOT_READONLY');
    }
  }
  if (!checks.synthetic_probes_available) {
    reasons.push('BLOCKED_SYNTHETIC_PROBES_NOT_FOUND');
  } else {
    if (!checks.synthetic_probes_required_readonly_checks_passed) {
      reasons.push('BLOCKED_SYNTHETIC_PROBES_READONLY_CHECKS_NOT_PASSED');
    }
    if (!checks.synthetic_probes_external_mutations_safe) {
      reasons.push('BLOCKED_SYNTHETIC_PROBES_EXTERNAL_MUTATIONS_UNSAFE');
    }
    if (!checks.synthetic_probes_sha_matches_expected) {
      reasons.push('BLOCKED_SYNTHETIC_PROBES_SHA_MISMATCH');
    }
  }
  if (!checks.role_baseline_available) {
    reasons.push('BLOCKED_ROLE_BASELINE_NOT_FOUND');
  } else {
    if (!checks.role_baseline_status_passed) reasons.push('BLOCKED_ROLE_BASELINE_NOT_PASSED');
    if (!checks.role_baseline_browser_contexts_passed) {
      reasons.push('BLOCKED_ROLE_BASELINE_BROWSER_CONTEXTS_NOT_PASSED');
    }
  }
  if (!checks.private_consume_plan_present) {
    reasons.push('BLOCKED_PRIVATE_CONSUME_PLAN_NOT_PROVIDED');
  } else if (!checks.private_consume_plan_readable_json) {
    reasons.push('BLOCKED_PRIVATE_CONSUME_PLAN_UNREADABLE');
  } else {
    if (!checks.private_consume_plan_target_environment_matches) {
      reasons.push('BLOCKED_PRIVATE_CONSUME_PLAN_TARGET_ENVIRONMENT_MISMATCH');
    }
    if (!checks.private_consume_plan_raw_values_excluded) {
      reasons.push('BLOCKED_PRIVATE_CONSUME_PLAN_RAW_VALUES_NOT_EXCLUDED');
    }
  }
  if (!checks.cleanup_instructions_present) {
    reasons.push('BLOCKED_CLEANUP_INSTRUCTIONS_NOT_PROVIDED');
  } else if (!checks.cleanup_instructions_readable_json) {
    reasons.push('BLOCKED_CLEANUP_INSTRUCTIONS_UNREADABLE');
  } else {
    if (!checks.cleanup_instructions_raw_values_excluded) {
      reasons.push('BLOCKED_CLEANUP_INSTRUCTIONS_RAW_VALUES_NOT_EXCLUDED');
    }
    if (!checks.cleanup_instructions_authorized) {
      reasons.push('BLOCKED_CLEANUP_INSTRUCTIONS_NOT_AUTHORIZED');
    }
  }
  if (!checks.operator_authorization_present) {
    reasons.push('BLOCKED_OPERATOR_AUTHORIZATION_NOT_PROVIDED');
  } else if (!checks.operator_authorization_matches_required) {
    reasons.push('BLOCKED_EXACT_OPERATOR_AUTHORIZATION_MISMATCH');
  }
  if (!checks.production_confirmation_present) {
    reasons.push('BLOCKED_PRODUCTION_CONFIRMATION_NOT_PROVIDED');
  } else if (!checks.production_confirmation_matches_required) {
    reasons.push('BLOCKED_PRODUCTION_CONFIRMATION_MISMATCH');
  }
  if (!consumingPaths.at_least_one_path_ready) {
    reasons.push('BLOCKED_NO_CONSUMING_PROOF_PATH_READY');
    if (!consumingPaths.role_journeys_ready) {
      if (!checks.private_consume_plan_role_journeys_authorized) {
        reasons.push('BLOCKED_ROLE_JOURNEYS_NOT_AUTHORIZED');
      }
      if (!checks.admin_journey_input_present) {
        reasons.push('BLOCKED_ADMIN_JOURNEY_INPUT_NOT_PROVIDED');
      }
      if (!checks.parent_journey_input_present) {
        reasons.push('BLOCKED_PARENT_JOURNEY_INPUT_NOT_PROVIDED');
      }
      if (!checks.student_journey_input_present) {
        reasons.push('BLOCKED_STUDENT_JOURNEY_INPUT_NOT_PROVIDED');
      }
    }
    if (!consumingPaths.production_signup_submit_ready) {
      if (!checks.private_consume_plan_production_signup_submit_authorized) {
        reasons.push('BLOCKED_PRODUCTION_SIGNUP_SUBMIT_NOT_AUTHORIZED');
      }
      if (!checks.signup_lead_input_present) {
        reasons.push('BLOCKED_PRODUCTION_SIGNUP_LEAD_INPUT_NOT_PROVIDED');
      }
    }
  }
  return Array.from(new Set(reasons)).sort();
}

async function loadRouteReadbackSummary(filePath: string): Promise<RouteReadbackSummary> {
  const parsed = await loadJsonObject(filePath);
  if (!parsed.present || !parsed.value) {
    return {
      present: false,
      routeCount: null,
      passedCount: null,
      readOnlySafety: false,
      status: null,
    };
  }
  const safety = objectOrNull(parsed.value.safety);
  return {
    present: true,
    routeCount: numberOrNull(parsed.value.route_count),
    passedCount: numberOrNull(parsed.value.passed_count),
    readOnlySafety:
      parsed.value.status === 'passed' &&
      safety?.production_database_writes === 0 &&
      safety?.crm_import_applies === 0 &&
      safety?.emails_sent === 0 &&
      safety?.provider_mutations === 0 &&
      safety?.deployments === 0 &&
      safety?.form_submits === 0 &&
      safety?.setup_or_reset_links_consumed === 0 &&
      safety?.response_bodies_committed === false,
    status: textOrNull(parsed.value.status),
  };
}

async function loadSyntheticProbeSummary(filePath: string): Promise<SyntheticProbeSummary> {
  const parsed = await loadJsonObject(filePath);
  if (!parsed.present || !parsed.value) {
    return {
      externalMutationsSafe: false,
      present: false,
      requiredReadOnlyProbesPassed: false,
      status: null,
    };
  }
  const results = Array.isArray(parsed.value.results) ? parsed.value.results : [];
  const statuses = new Map<string, string>();
  for (const result of results) {
    const record = objectOrNull(result);
    const id = textOrNull(record?.id);
    const status = textOrNull(record?.status);
    if (id && status) statuses.set(id, status);
  }
  const externalMutations = objectOrNull(parsed.value.external_mutations);
  return {
    externalMutationsSafe:
      externalMutations?.production_database === false &&
      externalMutations?.providers === false &&
      externalMutations?.sends === false &&
      externalMutations?.deployment === false,
    present: true,
    requiredReadOnlyProbesPassed:
      statuses.get('public_landing') === 'passed' &&
      statuses.get('public_signup') === 'passed' &&
      statuses.get('auth_lifecycle_login_page') === 'passed' &&
      statuses.get('private_session_role_denial') === 'passed' &&
      statuses.get('db_readiness') === 'passed',
    status: textOrNull(parsed.value.status),
  };
}

async function loadRoleBaselineSummary(filePath: string): Promise<RoleBaselineSummary> {
  const parsed = await loadJsonObject(filePath);
  if (!parsed.present || !parsed.value) {
    return { browserContextsPassed: false, present: false, status: null };
  }
  const browserContexts = objectOrNull(parsed.value.browser_contexts);
  return {
    browserContextsPassed:
      browserContexts?.administrator === 'passed' &&
      browserContexts?.parent === 'passed' &&
      browserContexts?.student === 'passed',
    present: true,
    status: textOrNull(parsed.value.status),
  };
}

async function loadJsonObject(filePath: string): Promise<JsonSummary> {
  try {
    const value = parseJsonInput(await readFile(filePath, 'utf8'));
    return {
      present: true,
      readableJson: value.readableJson,
      value: value.value,
    };
  } catch {
    return { present: false, readableJson: false, value: null };
  }
}

function parseJsonInput(value: string | null): Omit<JsonSummary, 'present'> {
  if (!value) return { readableJson: false, value: null };
  try {
    const parsed = JSON.parse(value) as unknown;
    return {
      readableJson: Boolean(parsed && typeof parsed === 'object' && !Array.isArray(parsed)),
      value:
        parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : null,
    };
  } catch {
    return { readableJson: false, value: null };
  }
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

function summarizeInput(input: LoadedTextInput) {
  return {
    present: input.present,
    nonempty: input.nonempty,
    fingerprint: input.fingerprint,
  };
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
  return createHash('sha256')
    .update(`one-time-launch-spine-consume:${kind}\0${value}`)
    .digest('hex');
}

function parseArgs(argv: string[]) {
  const values = new Map<string, string>();
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) values.set(match[1] as string, match[2] as string);
  }
  return {
    adminJourneyInputFile: values.get('admin-journey-input-file'),
    cleanupInstructionsFile: values.get('cleanup-instructions-file'),
    expectedRouteReadbackSha256: values.get('expected-route-readback-sha256'),
    expectedSyntheticProbesSha256: values.get('expected-synthetic-probes-sha256'),
    operatorAuthorizationFile: values.get('operator-authorization-file'),
    out: values.get('out'),
    parentJourneyInputFile: values.get('parent-journey-input-file'),
    privateConsumePlanFile: values.get('private-consume-plan-file'),
    productionConfirmationFile: values.get('production-confirmation-file'),
    roleBaselineFile: values.get('role-baseline-file'),
    routeReadbackFile: values.get('route-readback-file'),
    signupLeadInputFile: values.get('signup-lead-input-file'),
    studentJourneyInputFile: values.get('student-journey-input-file'),
    syntheticProbesFile: values.get('synthetic-probes-file'),
    targetEnvironment: values.get('target-environment') as TargetEnvironment | undefined,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = await runLaunchSpineConsumeReadinessPreflight(args);
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
