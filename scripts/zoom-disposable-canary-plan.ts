import { createHmac, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { ZOOM_ISOLATED_CANARY_AGENDA } from '../packages/domain/src/providers/zoom-rest.ts';

export const ZOOM_DISPOSABLE_CANARY_ORIGIN = 'https://ot99-web-onetimev2-pr-105.up.railway.app';
export const ZOOM_DISPOSABLE_CANARY_ATTESTATION =
  'CREATE_ONE_DISTINCT_PR105_MEETING_TISHA_UNTOUCHED_DELETE_AFTER_PROOF';
export const ZOOM_DISPOSABLE_CANARY_PROVISION_AUTHORIZATION = 'PROVISION_FICTIONAL_STUDENT_1_ONCE';
export const ZOOM_DISPOSABLE_CANARY_CLEANUP_AUTHORIZATION =
  'DELETE_ONE_CREATED_PR105_DISPOSABLE_MEETING_ONCE';
export const ZOOM_DISPOSABLE_CANARY_LEARNER_KEY = 'full_app_preview_student_1';
export const ZOOM_DISPOSABLE_CANARY_PURPOSE = 'distinct_disposable_pr105_canary';
export const ZOOM_DISPOSABLE_CANARY_TOPIC_PREFIX = 'One Time PR105 disposable control ';

const fullSha = /^[0-9a-f]{40}$/u;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const hexMac = /^[0-9a-f]{64}$/u;
const forbiddenStateKeys = new Set([
  'email',
  'join_url',
  'start_url',
  'registrant_token',
  'access_token',
  'zak',
]);
const protectedInputsForbiddenInDisposableJob = [
  'ONE_TIME_PROTECTED_CLASS_TARGET_URL',
  'ONE_TIME_TISHA_BAV_2026_ZOOM_JOIN_URL',
  'ZOOM_REAL_CONTROL_MEETING_ID',
  'ZOOM_REAL_CONTROL_MEETING_PASSCODE',
] as const;
const allowedStateKeys = new Set([
  'schema_version',
  'purpose',
  'sequence',
  'previous_state_mac',
  'operation_id',
  'execution_head',
  'origin',
  'phase',
  'created_by_this_run',
  'cleanup_deadline',
  'created_at',
  'updated_at',
  'host_user_id',
  'topic',
  'agenda',
  'starts_at',
  'duration_minutes',
  'tisha_target_input_absent',
  'protected_target_input_absent',
  'meeting_id',
  'passcode',
  'registration_disabled_for_sdk_join',
  'registrants',
  'failure_category',
  'deleted_at',
  'state_mac',
]);

export type ZoomDisposableCanaryPhase =
  | 'create_intent'
  | 'meeting_created'
  | 'registration_in_flight'
  | 'ready'
  | 'cleanup_required'
  | 'cleanup_delete_in_flight'
  | 'deleted';

export type ZoomDisposableCanaryFailureCategory =
  | 'meeting_create_outcome_ambiguous'
  | 'meeting_material_incomplete'
  | 'meeting_state_write_failed'
  | 'registration_outcome_ambiguous'
  | 'registration_disable_unverified'
  | 'cleanup_provider_ambiguous';

export type ZoomDisposableCanaryStatePayload = {
  schema_version: 3;
  purpose: typeof ZOOM_DISPOSABLE_CANARY_PURPOSE;
  sequence: number;
  previous_state_mac: string | null;
  operation_id: string;
  execution_head: string;
  origin: typeof ZOOM_DISPOSABLE_CANARY_ORIGIN;
  phase: ZoomDisposableCanaryPhase;
  created_by_this_run: true;
  cleanup_deadline: string;
  created_at: string;
  updated_at: string;
  host_user_id: string;
  topic: string;
  agenda: typeof ZOOM_ISOLATED_CANARY_AGENDA;
  starts_at: string;
  duration_minutes: 60;
  tisha_target_input_absent: true;
  protected_target_input_absent: true;
  meeting_id?: string | undefined;
  passcode?: string | undefined;
  registration_disabled_for_sdk_join?: boolean | undefined;
  registrants: Array<{
    learner_key: typeof ZOOM_DISPOSABLE_CANARY_LEARNER_KEY;
    registrant_token_ref: string;
  }>;
  failure_category?: ZoomDisposableCanaryFailureCategory | undefined;
  deleted_at?: string | undefined;
};

export type ZoomDisposableCanaryState = ZoomDisposableCanaryStatePayload & {
  state_mac: string;
};

export type ZoomDisposableCanaryPreflight = {
  operationId: string;
  executionHead: string;
  origin: typeof ZOOM_DISPOSABLE_CANARY_ORIGIN;
  statePath: string;
  keyholderDir: string;
  learnerKey: typeof ZOOM_DISPOSABLE_CANARY_LEARNER_KEY;
  cleanupDeadline?: string | undefined;
};

export function assertZoomDisposableCanaryProvisionPreflight(
  source: NodeJS.ProcessEnv,
  options: { now?: Date; repositoryRoot?: string } = {},
): ZoomDisposableCanaryPreflight & { cleanupDeadline: string } {
  const shared = assertSharedPreflight(source, options.repositoryRoot);
  requireExact(
    source,
    'ZOOM_REAL_CONTROL_PROVISION_AUTHORIZATION',
    ZOOM_DISPOSABLE_CANARY_PROVISION_AUTHORIZATION,
  );
  if (hasBoundInput(source, 'ZOOM_PROTECTED_TARGET_ROTATION_ATTESTATION')) {
    fail('PROVISIONING_ATTESTATION_AMBIGUOUS');
  }
  const cleanupDeadline = requireValue(source, 'ZOOM_DISPOSABLE_CANARY_CLEANUP_DEADLINE');
  const now = options.now ?? new Date();
  const deadline = new Date(cleanupDeadline);
  const remaining = deadline.getTime() - now.getTime();
  if (
    !Number.isFinite(deadline.getTime()) ||
    remaining < 10 * 60_000 ||
    remaining > 6 * 60 * 60_000
  ) {
    fail('CLEANUP_DEADLINE');
  }
  return { ...shared, cleanupDeadline: deadline.toISOString() };
}

export function assertZoomDisposableCanaryCleanupPreflight(
  source: NodeJS.ProcessEnv,
  options: { repositoryRoot?: string } = {},
): ZoomDisposableCanaryPreflight {
  const shared = assertSharedPreflight(source, options.repositoryRoot);
  requireExact(
    source,
    'ZOOM_DISPOSABLE_CANARY_CLEANUP_AUTHORIZATION',
    ZOOM_DISPOSABLE_CANARY_CLEANUP_AUTHORIZATION,
  );
  if (hasBoundInput(source, 'ZOOM_REAL_CONTROL_PROVISION_AUTHORIZATION')) {
    fail('PROVISION_AUTHORIZATION_MUST_BE_CLEARED');
  }
  return shared;
}

export function createZoomDisposableCanaryIntent(input: {
  operationId: string;
  executionHead: string;
  cleanupDeadline: string;
  hostUserId: string;
  startsAt: Date;
  now?: Date | undefined;
  stateSecret: string;
}): ZoomDisposableCanaryState {
  const now = (input.now ?? new Date()).toISOString();
  return signZoomDisposableCanaryState(
    {
      schema_version: 3,
      purpose: ZOOM_DISPOSABLE_CANARY_PURPOSE,
      sequence: 1,
      previous_state_mac: null,
      operation_id: input.operationId,
      execution_head: input.executionHead,
      origin: ZOOM_DISPOSABLE_CANARY_ORIGIN,
      phase: 'create_intent',
      created_by_this_run: true,
      cleanup_deadline: input.cleanupDeadline,
      created_at: now,
      updated_at: now,
      host_user_id: input.hostUserId,
      topic: zoomDisposableCanaryTopic(input.operationId, input.startsAt),
      agenda: ZOOM_ISOLATED_CANARY_AGENDA,
      starts_at: input.startsAt.toISOString(),
      duration_minutes: 60,
      tisha_target_input_absent: true,
      protected_target_input_absent: true,
      registrants: [],
    },
    input.stateSecret,
  );
}

export function transitionZoomDisposableCanaryState(
  previous: ZoomDisposableCanaryState,
  changes: Partial<
    Pick<
      ZoomDisposableCanaryStatePayload,
      | 'phase'
      | 'meeting_id'
      | 'passcode'
      | 'registration_disabled_for_sdk_join'
      | 'registrants'
      | 'failure_category'
      | 'deleted_at'
    >
  >,
  stateSecret: string,
  now: Date = new Date(),
): ZoomDisposableCanaryState {
  if (changes.phase) assertAllowedTransition(previous.phase, changes.phase);
  const payload: ZoomDisposableCanaryStatePayload = {
    ...withoutStateMac(previous),
    ...changes,
    sequence: previous.sequence + 1,
    previous_state_mac: previous.state_mac,
    updated_at: now.toISOString(),
  };
  if (changes.phase === 'deleted') {
    delete payload.meeting_id;
    delete payload.passcode;
    delete payload.registration_disabled_for_sdk_join;
    delete payload.failure_category;
    payload.registrants = [];
    payload.deleted_at = changes.deleted_at ?? now.toISOString();
  }
  return signZoomDisposableCanaryState(payload, stateSecret);
}

export function signZoomDisposableCanaryState(
  payload: ZoomDisposableCanaryStatePayload,
  stateSecret: string,
): ZoomDisposableCanaryState {
  if (stateSecret.length < 32) failState('STATE_SECRET');
  validateStatePayload(payload);
  const stateMac = createHmac('sha256', stateSecret).update(canonicalJson(payload)).digest('hex');
  return { ...payload, state_mac: stateMac };
}

export function parseZoomDisposableCanaryState(
  value: unknown,
  stateSecret: string,
  expected?: {
    operationId?: string | undefined;
    executionHead?: string | undefined;
    origin?: string | undefined;
  },
): ZoomDisposableCanaryState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) failState('SHAPE');
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).some((key) => !allowedStateKeys.has(key))) failState('UNKNOWN_FIELD');
  assertNoForbiddenNestedKeys(raw);
  const state = raw as unknown as ZoomDisposableCanaryState;
  if (!hexMac.test(String(state.state_mac ?? ''))) failState('MAC');
  const payload = withoutStateMac(state);
  validateStatePayload(payload);
  const expectedMac = createHmac('sha256', stateSecret)
    .update(canonicalJson(payload))
    .digest('hex');
  if (!constantTimeHexEqual(state.state_mac, expectedMac)) failState('MAC');
  if (expected?.operationId && state.operation_id !== expected.operationId) failState('OPERATION');
  if (expected?.executionHead && state.execution_head !== expected.executionHead)
    failState('SOURCE');
  if (expected?.origin && state.origin !== expected.origin) failState('ORIGIN');
  return state;
}

export function assertZoomDisposableCanaryJournal(states: ZoomDisposableCanaryState[]) {
  if (states.length < 1) failState('JOURNAL_EMPTY');
  states.forEach((state, index) => {
    if (state.sequence !== index + 1) failState('JOURNAL_SEQUENCE');
    if (index === 0) {
      if (state.previous_state_mac !== null) failState('JOURNAL_CHAIN');
      return;
    }
    assertAllowedTransition(states[index - 1]!.phase, state.phase);
    if (state.previous_state_mac !== states[index - 1]?.state_mac) failState('JOURNAL_CHAIN');
    if (
      state.operation_id !== states[0]?.operation_id ||
      state.execution_head !== states[0]?.execution_head ||
      state.origin !== states[0]?.origin
    ) {
      failState('JOURNAL_BINDING');
    }
  });
  return states.at(-1)!;
}

function assertAllowedTransition(from: ZoomDisposableCanaryPhase, to: ZoomDisposableCanaryPhase) {
  const allowed: Record<ZoomDisposableCanaryPhase, ZoomDisposableCanaryPhase[]> = {
    create_intent: ['meeting_created', 'cleanup_required', 'deleted'],
    meeting_created: ['registration_in_flight', 'cleanup_delete_in_flight', 'deleted'],
    registration_in_flight: ['ready', 'cleanup_required', 'cleanup_delete_in_flight', 'deleted'],
    ready: ['cleanup_delete_in_flight', 'deleted'],
    cleanup_required: ['cleanup_delete_in_flight', 'deleted'],
    cleanup_delete_in_flight: ['deleted'],
    deleted: [],
  };
  if (!allowed[from].includes(to)) failState('TRANSITION');
}

export function buildZoomDisposableCanarySanitizedResult(input: {
  state: ZoomDisposableCanaryState;
  providerCounts: {
    oauth: number;
    get: number;
    post: number;
    patch: number;
    delete: number;
  };
}) {
  return {
    mode: ZOOM_DISPOSABLE_CANARY_PURPOSE,
    phase: input.state.phase,
    exact_source_verified: true,
    fictional_student_1_only: true,
    tisha_target_bound: false,
    protected_class_target_bound: false,
    persistent_staging_changed: false,
    production_changed: false,
    customer_invites_sent: false,
    provider_counts: input.providerCounts,
    cleanup_required: input.state.phase === 'cleanup_required',
    deleted_tombstone_written: input.state.phase === 'deleted',
    protected_values_printed: false,
  };
}

export function zoomDisposableCanaryTopic(operationId: string, startsAt: Date) {
  return `${ZOOM_DISPOSABLE_CANARY_TOPIC_PREFIX}${operationId} ${startsAt
    .toISOString()
    .slice(0, 16)}Z`;
}

function assertSharedPreflight(
  source: NodeJS.ProcessEnv,
  repositoryRoot = process.cwd(),
): ZoomDisposableCanaryPreflight {
  requireExact(source, 'ONE_TIME_RUNTIME_ENVIRONMENT', 'isolated_staging');
  requireExact(source, 'ZOOM_CLASSROOM_ENABLED', 'true');
  requireExact(source, 'ZOOM_CLASSROOM_PROVIDER_MODE', 'sink');
  requireExact(source, 'ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED', 'false');
  requireExact(source, 'ZOOM_CLASSROOM_CANARY_ENABLED', 'false');
  requireExact(
    source,
    'ZOOM_DISTINCT_DISPOSABLE_ISOLATED_CANARY_ATTESTATION',
    ZOOM_DISPOSABLE_CANARY_ATTESTATION,
  );
  requireExact(source, 'ZOOM_CLASSROOM_CANARY_LEARNER_KEY', ZOOM_DISPOSABLE_CANARY_LEARNER_KEY);
  requireExact(source, 'PUBLIC_BASE_URL', ZOOM_DISPOSABLE_CANARY_ORIGIN);
  requireExact(source, 'ZOOM_MEETING_SDK_ALLOWED_ORIGIN', ZOOM_DISPOSABLE_CANARY_ORIGIN);
  if (hasBoundInput(source, 'BNA_KEYHOLDER_DIR')) fail('BNA_KEYHOLDER_FORBIDDEN');
  for (const variable of protectedInputsForbiddenInDisposableJob) {
    if (hasBoundInput(source, variable)) fail(`FORBIDDEN_INPUT_${variable}`);
  }
  const executionHead = requireValue(source, 'ZOOM_REAL_CONTROL_EXPECTED_SOURCE_SHA');
  const deployedHead = requireValue(source, 'RAILWAY_GIT_COMMIT_SHA');
  if (!fullSha.test(executionHead) || executionHead !== deployedHead) fail('EXACT_SOURCE_SHA');
  const operationId = requireValue(source, 'ZOOM_DISPOSABLE_CANARY_OPERATION_ID');
  if (!uuid.test(operationId)) fail('OPERATION_ID');
  const keyholderDir = path.resolve(requireValue(source, 'ONE_TIME_ZOOM_KEYHOLDER_DIR'));
  const statePath = path.resolve(requireValue(source, 'ZOOM_DISPOSABLE_CANARY_STATE_PATH'));
  const repository = path.resolve(repositoryRoot);
  if (
    !path.isAbsolute(requireValue(source, 'ONE_TIME_ZOOM_KEYHOLDER_DIR')) ||
    !path.isAbsolute(requireValue(source, 'ZOOM_DISPOSABLE_CANARY_STATE_PATH')) ||
    !isInside(keyholderDir, statePath) ||
    isInside(repository, keyholderDir) ||
    isInside(repository, statePath)
  ) {
    fail('PRIVATE_PATH');
  }
  return {
    operationId,
    executionHead,
    origin: ZOOM_DISPOSABLE_CANARY_ORIGIN,
    statePath,
    keyholderDir,
    learnerKey: ZOOM_DISPOSABLE_CANARY_LEARNER_KEY,
  };
}

function validateStatePayload(payload: ZoomDisposableCanaryStatePayload) {
  if (
    payload.schema_version !== 3 ||
    payload.purpose !== ZOOM_DISPOSABLE_CANARY_PURPOSE ||
    !Number.isSafeInteger(payload.sequence) ||
    payload.sequence < 1 ||
    (payload.sequence === 1
      ? payload.previous_state_mac !== null
      : !hexMac.test(String(payload.previous_state_mac))) ||
    !uuid.test(payload.operation_id) ||
    !fullSha.test(payload.execution_head) ||
    payload.origin !== ZOOM_DISPOSABLE_CANARY_ORIGIN ||
    payload.created_by_this_run !== true ||
    payload.tisha_target_input_absent !== true ||
    payload.protected_target_input_absent !== true ||
    payload.agenda !== ZOOM_ISOLATED_CANARY_AGENDA ||
    payload.duration_minutes !== 60 ||
    !payload.host_user_id ||
    !validDate(payload.starts_at) ||
    payload.topic !==
      zoomDisposableCanaryTopic(payload.operation_id, new Date(payload.starts_at)) ||
    !validDate(payload.created_at) ||
    !validDate(payload.updated_at) ||
    !validDate(payload.cleanup_deadline) ||
    !Array.isArray(payload.registrants) ||
    ![
      'create_intent',
      'meeting_created',
      'registration_in_flight',
      'ready',
      'cleanup_required',
      'cleanup_delete_in_flight',
      'deleted',
    ].includes(payload.phase)
  ) {
    failState('PAYLOAD');
  }
  const registrants = payload.registrants as unknown[];
  if (
    registrants.length > 1 ||
    registrants.some((value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return true;
      const registrant = value as Record<string, unknown>;
      return (
        Object.keys(registrant).some(
          (key) => !['learner_key', 'registrant_token_ref'].includes(key),
        ) ||
        registrant.learner_key !== ZOOM_DISPOSABLE_CANARY_LEARNER_KEY ||
        typeof registrant.registrant_token_ref !== 'string' ||
        !registrant.registrant_token_ref
      );
    })
  ) {
    failState('LEARNER_SCOPE');
  }
  if (
    payload.failure_category !== undefined &&
    ![
      'meeting_create_outcome_ambiguous',
      'meeting_material_incomplete',
      'meeting_state_write_failed',
      'registration_outcome_ambiguous',
      'registration_disable_unverified',
      'cleanup_provider_ambiguous',
    ].includes(payload.failure_category)
  ) {
    failState('FAILURE_CATEGORY');
  }
  if (
    payload.registration_disabled_for_sdk_join !== undefined &&
    typeof payload.registration_disabled_for_sdk_join !== 'boolean'
  ) {
    failState('REGISTRATION_STATE');
  }
  const hasMeetingId = typeof payload.meeting_id === 'string' && payload.meeting_id.length > 0;
  const hasPasscode = typeof payload.passcode === 'string' && payload.passcode.length > 0;
  if (
    (payload.meeting_id !== undefined && !hasMeetingId) ||
    (payload.passcode !== undefined && !hasPasscode) ||
    (hasPasscode && !hasMeetingId)
  ) {
    failState('PHASE_FIELDS');
  }
  if (
    payload.phase === 'create_intent' &&
    (payload.meeting_id !== undefined ||
      payload.passcode !== undefined ||
      payload.registrants.length > 0)
  ) {
    failState('PHASE_FIELDS');
  }
  if (
    ['meeting_created', 'registration_in_flight'].includes(payload.phase) &&
    (!hasMeetingId || !hasPasscode)
  ) {
    failState('PHASE_FIELDS');
  }
  if (['cleanup_required', 'cleanup_delete_in_flight'].includes(payload.phase) && !hasMeetingId) {
    failState('PHASE_FIELDS');
  }
  if (
    ['meeting_created', 'registration_in_flight'].includes(payload.phase) &&
    payload.registrants.length > 0
  ) {
    failState('PHASE_FIELDS');
  }
  if (payload.phase === 'cleanup_required' && payload.failure_category === undefined) {
    failState('PHASE_FIELDS');
  }
  if (
    payload.phase === 'ready' &&
    (!hasMeetingId ||
      !hasPasscode ||
      payload.registrants.length !== 1 ||
      payload.registration_disabled_for_sdk_join !== true ||
      payload.failure_category !== undefined)
  ) {
    failState('PHASE_FIELDS');
  }
  if (
    payload.phase === 'deleted' &&
    (payload.meeting_id !== undefined ||
      payload.passcode !== undefined ||
      payload.registration_disabled_for_sdk_join !== undefined ||
      payload.failure_category !== undefined ||
      payload.registrants.length !== 0 ||
      !payload.deleted_at ||
      !validDate(payload.deleted_at))
  ) {
    failState('PHASE_FIELDS');
  }
}

function withoutStateMac(state: ZoomDisposableCanaryState): ZoomDisposableCanaryStatePayload {
  return Object.fromEntries(
    Object.entries(state).filter(([key]) => key !== 'state_mac'),
  ) as ZoomDisposableCanaryStatePayload;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function assertNoForbiddenNestedKeys(value: unknown) {
  if (Array.isArray(value)) {
    value.forEach(assertNoForbiddenNestedKeys);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (forbiddenStateKeys.has(key)) failState('RAW_PROVIDER_FIELD');
    assertNoForbiddenNestedKeys(item);
  }
}

function constantTimeHexEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function requireExact(source: NodeJS.ProcessEnv, variable: string, expected: string) {
  if (source[variable] !== expected) fail(variable);
}

function requireValue(source: NodeJS.ProcessEnv, variable: string) {
  const value = source[variable];
  if (!value) fail(variable);
  return value;
}

function hasBoundInput(source: NodeJS.ProcessEnv, variable: string) {
  return Object.prototype.hasOwnProperty.call(source, variable);
}

function isInside(parent: string, candidate: string) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function validDate(value: string) {
  return typeof value === 'string' && Number.isFinite(new Date(value).getTime());
}

function fail(code: string): never {
  throw new Error(`ZOOM_DISPOSABLE_CANARY_PREFLIGHT_FAILED:${code}`);
}

function failState(code: string): never {
  throw new Error(`ZOOM_DISPOSABLE_CANARY_STATE_INVALID:${code}`);
}
