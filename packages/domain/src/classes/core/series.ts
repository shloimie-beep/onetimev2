import {
  CANONICAL_CLASS_DURATION_MINUTES,
  CANONICAL_CLASS_LOCAL_START_TIME,
  CANONICAL_CLASS_SERIES_ID,
  CANONICAL_CLASS_TIME_ZONE,
  CANONICAL_CLASS_WEEKDAYS,
  CLASSROOM_CORE_ERROR_CODES,
  type ClassSeriesRecord,
  type ClassSeriesState,
  type ClassroomAdminActor,
  type ClassroomCommandReceipt,
  type ClassroomEffectPlan,
  type SeriesEditCommand,
  type SeriesTransitionCommand,
} from '../../../../contracts/src/classes/core/index.ts';
import { ClassroomCoreError } from './errors.ts';

const ALLOWED_TRANSITIONS: Readonly<Record<ClassSeriesState, readonly ClassSeriesState[]>> = {
  draft: ['active', 'archived'],
  active: ['paused', 'archived'],
  paused: ['active', 'archived'],
  archived: ['draft'],
};

function zeroEffects(): ClassroomEffectPlan {
  return {
    generateOccurrences: false,
    reconcileEnrollments: false,
    visibleToFamilies: false,
    enqueueProviderWork: false,
    enqueueCommunicationWork: false,
    stopFutureWork: false,
  };
}

export function createCanonicalSeries(input: {
  accountKey: string;
  productKey: string;
  teacherProfileId: string;
  occurredAt: string;
}): ClassSeriesRecord {
  return {
    accountKey: input.accountKey,
    productKey: input.productKey,
    id: CANONICAL_CLASS_SERIES_ID,
    title: 'One Time Live Class',
    state: 'active',
    canonical: true,
    timeZone: CANONICAL_CLASS_TIME_ZONE,
    localStartTime: CANONICAL_CLASS_LOCAL_START_TIME,
    durationMinutes: CANONICAL_CLASS_DURATION_MINUTES,
    weekdays: CANONICAL_CLASS_WEEKDAYS,
    startsOn: input.occurredAt.slice(0, 10),
    teacherProfileId: input.teacherProfileId,
    embeddedClassroomRequired: true,
    recordingEnabled: true,
    version: 1,
    createdAt: input.occurredAt,
    updatedAt: input.occurredAt,
  };
}

export function createAdditionalSeries(input: {
  actor: ClassroomAdminActor;
  id: string;
  title: string;
  timeZone: string;
  localStartTime: string;
  durationMinutes: number;
  weekdays: readonly number[];
  startsOn: string;
  endsOn?: string;
  teacherProfileId: string;
  embeddedClassroomRequired: boolean;
  recordingEnabled: boolean;
  occurredAt: string;
}) {
  assertSchedule(input);
  const series: ClassSeriesRecord = {
    accountKey: input.actor.accountKey,
    productKey: input.actor.productKey,
    id: input.id,
    title: input.title,
    state: 'draft',
    canonical: false,
    timeZone: input.timeZone,
    localStartTime: input.localStartTime,
    durationMinutes: input.durationMinutes,
    weekdays: [...new Set(input.weekdays)].sort(),
    startsOn: input.startsOn,
    ...(input.endsOn ? { endsOn: input.endsOn } : {}),
    teacherProfileId: input.teacherProfileId,
    embeddedClassroomRequired: input.embeddedClassroomRequired,
    recordingEnabled: input.recordingEnabled,
    version: 1,
    createdAt: input.occurredAt,
    updatedAt: input.occurredAt,
  };
  return { series, effects: zeroEffects() };
}

export function transitionSeries(
  current: ClassSeriesRecord,
  command: SeriesTransitionCommand,
  priorReceipt?: ClassroomCommandReceipt | null,
) {
  assertScope(current, command.actor);
  const replay = checkReplay(command, priorReceipt);
  if (replay) return { series: current, effects: zeroEffects(), replay: true as const };
  if (current.version !== command.expectedVersion) {
    throw new ClassroomCoreError(
      CLASSROOM_CORE_ERROR_CODES.staleVersion,
      'The class series changed; reload before retrying.',
    );
  }
  if (current.canonical) {
    throw new ClassroomCoreError(
      CLASSROOM_CORE_ERROR_CODES.canonicalMutationDenied,
      'The canonical launch series must remain active.',
    );
  }
  if (!ALLOWED_TRANSITIONS[current.state].includes(command.to)) {
    throw new ClassroomCoreError(
      CLASSROOM_CORE_ERROR_CODES.invalidTransition,
      `Class series cannot transition from ${current.state} to ${command.to}.`,
    );
  }
  if (command.to === 'active') assertSchedule(current);
  const series = {
    ...current,
    state: command.to,
    version: current.version + 1,
    updatedAt: command.occurredAt,
  };
  return {
    series,
    effects: effectsFor(command.to),
    replay: false as const,
    receipt: {
      accountKey: current.accountKey,
      productKey: current.productKey,
      idempotencyKey: command.idempotencyKey,
      requestHash: command.requestHash,
      operation: `series:${current.state}->${command.to}`,
      resultVersion: series.version,
      committedAt: command.occurredAt,
    } satisfies ClassroomCommandReceipt,
  };
}

export function editSeries(
  current: ClassSeriesRecord,
  command: SeriesEditCommand,
  priorReceipt?: ClassroomCommandReceipt | null,
) {
  assertScope(current, command.actor);
  const replay = checkReplay(command, priorReceipt);
  if (replay) return { series: current, effects: zeroEffects(), replay: true as const };
  if (current.version !== command.expectedVersion) {
    throw new ClassroomCoreError(
      CLASSROOM_CORE_ERROR_CODES.staleVersion,
      'The class series changed; reload before retrying.',
    );
  }
  if (current.canonical) {
    throw new ClassroomCoreError(
      CLASSROOM_CORE_ERROR_CODES.canonicalMutationDenied,
      'The canonical launch series schedule is fixed.',
    );
  }
  if (current.state === 'archived') {
    throw new ClassroomCoreError(
      CLASSROOM_CORE_ERROR_CODES.invalidTransition,
      'Restore an archived series to draft before editing it.',
    );
  }
  const series: ClassSeriesRecord = {
    ...current,
    ...command.patch,
    version: current.version + 1,
    updatedAt: command.occurredAt,
  };
  assertSchedule(series);
  return {
    series,
    effects: current.state === 'active' ? effectsFor('active') : zeroEffects(),
    replay: false as const,
    receipt: {
      accountKey: current.accountKey,
      productKey: current.productKey,
      idempotencyKey: command.idempotencyKey,
      requestHash: command.requestHash,
      operation: 'series:edit',
      resultVersion: series.version,
      committedAt: command.occurredAt,
    } satisfies ClassroomCommandReceipt,
  };
}

export function assertCanonicalCatalog(series: readonly ClassSeriesRecord[]) {
  const activeCanonical = series.filter(
    (candidate) => candidate.canonical && candidate.state === 'active',
  );
  if (
    activeCanonical.length !== 1 ||
    activeCanonical[0]?.id !== CANONICAL_CLASS_SERIES_ID ||
    series.some(
      (candidate) =>
        candidate.state === 'active' &&
        candidate.id === CANONICAL_CLASS_SERIES_ID &&
        !candidate.canonical,
    )
  ) {
    throw new ClassroomCoreError(
      CLASSROOM_CORE_ERROR_CODES.duplicateCanonicalSeries,
      'The launch catalog must contain exactly one active canonical class series.',
    );
  }
}

function assertSchedule(schedule: {
  timeZone: string;
  localStartTime: string;
  durationMinutes: number;
  weekdays: readonly number[];
  startsOn: string;
  endsOn?: string;
  teacherProfileId: string;
}) {
  const validDate = /^\d{4}-\d{2}-\d{2}$/;
  if (
    !schedule.timeZone ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.localStartTime) ||
    !Number.isInteger(schedule.durationMinutes) ||
    schedule.durationMinutes < 1 ||
    schedule.durationMinutes > 1_440 ||
    schedule.weekdays.length === 0 ||
    schedule.weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 4) ||
    !validDate.test(schedule.startsOn) ||
    (schedule.endsOn !== undefined && !validDate.test(schedule.endsOn)) ||
    !schedule.teacherProfileId
  ) {
    throw new ClassroomCoreError(
      CLASSROOM_CORE_ERROR_CODES.invalidSchedule,
      'A valid Sunday-through-Thursday schedule, timezone, teacher, and duration are required.',
    );
  }
}

function assertScope(series: ClassSeriesRecord, actor: ClassroomAdminActor) {
  if (series.accountKey !== actor.accountKey || series.productKey !== actor.productKey) {
    throw new ClassroomCoreError(
      CLASSROOM_CORE_ERROR_CODES.accessDenied,
      'The Admin cannot manage a class series outside the authenticated account and product.',
    );
  }
}

function checkReplay(
  command: Pick<SeriesTransitionCommand | SeriesEditCommand, 'idempotencyKey' | 'requestHash'>,
  receipt?: ClassroomCommandReceipt | null,
) {
  if (!receipt) return false;
  if (
    receipt.idempotencyKey !== command.idempotencyKey ||
    receipt.requestHash !== command.requestHash
  ) {
    throw new ClassroomCoreError(
      CLASSROOM_CORE_ERROR_CODES.conflict,
      'The idempotency key was already used for a different request.',
    );
  }
  return true;
}

function effectsFor(state: ClassSeriesState): ClassroomEffectPlan {
  if (state === 'active') {
    return {
      generateOccurrences: true,
      reconcileEnrollments: true,
      visibleToFamilies: true,
      enqueueProviderWork: true,
      enqueueCommunicationWork: true,
      stopFutureWork: false,
    };
  }
  if (state === 'paused' || state === 'archived') {
    return { ...zeroEffects(), stopFutureWork: true };
  }
  return zeroEffects();
}
