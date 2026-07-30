import {
  CLASSROOM_CORE_ERROR_CODES,
  type ClassOccurrenceRecord,
  type ClassOccurrenceState,
  type ClassSeriesRecord,
  type ClassroomCommandReceipt,
  type OccurrenceCreateCommand,
  type OccurrenceRescheduleCommand,
  type OccurrenceTransitionCommand,
} from '../../../../contracts/src/classes/core/index.ts';
import { generateRollingOccurrences } from '../../calendar/index.ts';
import { ClassroomCoreError } from './errors.ts';

const ALLOWED_TRANSITIONS: Readonly<Record<ClassOccurrenceState, readonly ClassOccurrenceState[]>> =
  {
    scheduled: ['preparing', 'canceled'],
    preparing: ['ready', 'canceled'],
    ready: ['live', 'canceled'],
    live: ['completed'],
    completed: [],
    canceled: ['scheduled'],
  };

export function generateCoreOccurrences(
  series: ClassSeriesRecord,
  options: { fromLocalDate: string; occurredAt: string },
) {
  if (series.state !== 'active') return [];
  return generateRollingOccurrences(
    {
      id: series.id,
      title: series.title,
      timeZone: series.timeZone,
      localStartTime: series.localStartTime,
      durationMinutes: series.durationMinutes,
      weekdays: series.weekdays,
      startsOn: series.startsOn,
      ...(series.endsOn ? { endsOn: series.endsOn } : {}),
      active: true,
      version: series.version,
    },
    { fromLocalDate: options.fromLocalDate },
  ).map((occurrence): ClassOccurrenceRecord => ({
    accountKey: series.accountKey,
    productKey: series.productKey,
    id: occurrence.id,
    seriesId: series.id,
    localClassDate: occurrence.localClassDate,
    startsAt: occurrence.startsAt,
    scheduledEndsAt: occurrence.endsAt,
    joinOpensAt: new Date(Date.parse(occurrence.startsAt) - 10 * 60_000).toISOString(),
    joinClosesAt: new Date(Date.parse(occurrence.endsAt) + 15 * 60_000).toISOString(),
    state: 'scheduled',
    scheduleVersion: series.version,
    version: 1,
    createdAt: options.occurredAt,
    updatedAt: options.occurredAt,
  }));
}

export function createOccurrence(
  series: ClassSeriesRecord,
  command: OccurrenceCreateCommand,
  priorReceipt?: ClassroomCommandReceipt | null,
) {
  assertScope(series, command.actor);
  if (priorReceipt) {
    assertReplay(command, priorReceipt);
    return { occurrence: undefined, replay: true as const };
  }
  if (series.version !== command.expectedVersion) {
    throw new ClassroomCoreError(
      CLASSROOM_CORE_ERROR_CODES.staleVersion,
      'The class series changed; reload before scheduling an occurrence.',
    );
  }
  if (series.state !== 'active') {
    throw new ClassroomCoreError(
      CLASSROOM_CORE_ERROR_CODES.invalidTransition,
      'Occurrences can be created only for an active series.',
    );
  }
  assertOccurrenceSchedule(command, command.occurredAt);
  const occurrence: ClassOccurrenceRecord = {
    accountKey: series.accountKey,
    productKey: series.productKey,
    id: `${series.id}:${command.localClassDate}`,
    seriesId: series.id,
    localClassDate: command.localClassDate,
    startsAt: command.startsAt,
    scheduledEndsAt: command.scheduledEndsAt,
    joinOpensAt: command.joinOpensAt,
    joinClosesAt: command.joinClosesAt,
    state: 'scheduled',
    scheduleVersion: series.version,
    version: 1,
    createdAt: command.occurredAt,
    updatedAt: command.occurredAt,
  };
  return {
    occurrence,
    replay: false as const,
    receipt: receiptFor(occurrence, command, 'occurrence:create', command.occurredAt),
  };
}

export function transitionOccurrence(
  current: ClassOccurrenceRecord,
  command: OccurrenceTransitionCommand,
  priorReceipt?: ClassroomCommandReceipt | null,
) {
  assertScope(current, command.actor);
  if (priorReceipt) {
    assertReplay(command, priorReceipt);
    return { occurrence: current, replay: true as const };
  }
  assertVersion(current, command.expectedVersion);
  if (!ALLOWED_TRANSITIONS[current.state].includes(command.to)) {
    throw new ClassroomCoreError(
      CLASSROOM_CORE_ERROR_CODES.invalidTransition,
      `Class occurrence cannot transition from ${current.state} to ${command.to}.`,
    );
  }
  if (
    current.state === 'canceled' &&
    command.to === 'scheduled' &&
    Date.parse(current.startsAt) <= Date.parse(command.occurredAt)
  ) {
    throw new ClassroomCoreError(
      CLASSROOM_CORE_ERROR_CODES.occurrenceInPast,
      'Only a canceled future occurrence can be restored.',
    );
  }
  const occurrence = {
    ...current,
    state: command.to,
    scheduleVersion:
      current.state === 'canceled' && command.to === 'scheduled'
        ? current.scheduleVersion + 1
        : current.scheduleVersion,
    version: current.version + 1,
    updatedAt: command.occurredAt,
  };
  return {
    occurrence,
    replay: false as const,
    receipt: receiptFor(
      occurrence,
      command,
      `occurrence:${current.state}->${command.to}`,
      command.occurredAt,
    ),
    revokeOldLaunchGrants: current.state === 'canceled' && command.to === 'scheduled',
  };
}

export function rescheduleOccurrence(
  current: ClassOccurrenceRecord,
  command: OccurrenceRescheduleCommand,
  priorReceipt?: ClassroomCommandReceipt | null,
) {
  assertScope(current, command.actor);
  if (priorReceipt) {
    assertReplay(command, priorReceipt);
    return { occurrence: current, replay: true as const };
  }
  assertVersion(current, command.expectedVersion);
  if (!['scheduled', 'canceled'].includes(current.state)) {
    throw new ClassroomCoreError(
      CLASSROOM_CORE_ERROR_CODES.invalidTransition,
      'Only a scheduled or canceled future occurrence can be rescheduled.',
    );
  }
  if (Date.parse(current.startsAt) <= Date.parse(command.occurredAt)) {
    throw new ClassroomCoreError(
      CLASSROOM_CORE_ERROR_CODES.occurrenceInPast,
      'Past occurrences are immutable.',
    );
  }
  assertOccurrenceSchedule(command, command.occurredAt);
  const occurrence = {
    ...current,
    localClassDate: command.localClassDate,
    startsAt: command.startsAt,
    scheduledEndsAt: command.scheduledEndsAt,
    joinOpensAt: command.joinOpensAt,
    joinClosesAt: command.joinClosesAt,
    state: 'scheduled' as const,
    scheduleVersion: current.scheduleVersion + 1,
    version: current.version + 1,
    updatedAt: command.occurredAt,
  };
  return {
    occurrence,
    replay: false as const,
    receipt: receiptFor(occurrence, command, 'occurrence:reschedule', command.occurredAt),
    revokeOldLaunchGrants: true,
  };
}

function assertScope(
  occurrence: Pick<ClassOccurrenceRecord | ClassSeriesRecord, 'accountKey' | 'productKey'>,
  actor: OccurrenceTransitionCommand['actor'],
) {
  if (occurrence.accountKey !== actor.accountKey || occurrence.productKey !== actor.productKey) {
    throw new ClassroomCoreError(
      CLASSROOM_CORE_ERROR_CODES.accessDenied,
      'The Admin cannot manage an occurrence outside the authenticated account and product.',
    );
  }
}

function assertOccurrenceSchedule(
  schedule: Pick<
    OccurrenceRescheduleCommand | OccurrenceCreateCommand,
    'localClassDate' | 'startsAt' | 'scheduledEndsAt' | 'joinOpensAt' | 'joinClosesAt'
  >,
  occurredAt: string,
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(schedule.localClassDate) ||
    Date.parse(schedule.startsAt) <= Date.parse(occurredAt) ||
    Date.parse(schedule.scheduledEndsAt) <= Date.parse(schedule.startsAt) ||
    Date.parse(schedule.joinOpensAt) >= Date.parse(schedule.startsAt) ||
    Date.parse(schedule.joinClosesAt) < Date.parse(schedule.scheduledEndsAt)
  ) {
    throw new ClassroomCoreError(
      CLASSROOM_CORE_ERROR_CODES.invalidSchedule,
      'Occurrence local date, start, end, and protected join windows are invalid.',
    );
  }
}

function assertVersion(occurrence: ClassOccurrenceRecord, expectedVersion: number) {
  if (occurrence.version !== expectedVersion) {
    throw new ClassroomCoreError(
      CLASSROOM_CORE_ERROR_CODES.staleVersion,
      'The class occurrence changed; reload before retrying.',
    );
  }
}

function assertReplay(
  command: Pick<
    OccurrenceTransitionCommand | OccurrenceRescheduleCommand | OccurrenceCreateCommand,
    'idempotencyKey' | 'requestHash'
  >,
  receipt: ClassroomCommandReceipt,
) {
  if (
    receipt.idempotencyKey !== command.idempotencyKey ||
    receipt.requestHash !== command.requestHash
  ) {
    throw new ClassroomCoreError(
      CLASSROOM_CORE_ERROR_CODES.conflict,
      'The idempotency key was already used for a different request.',
    );
  }
}

function receiptFor(
  occurrence: ClassOccurrenceRecord,
  command: Pick<
    OccurrenceTransitionCommand | OccurrenceRescheduleCommand | OccurrenceCreateCommand,
    'idempotencyKey' | 'requestHash'
  >,
  operation: string,
  committedAt: string,
): ClassroomCommandReceipt {
  return {
    accountKey: occurrence.accountKey,
    productKey: occurrence.productKey,
    idempotencyKey: command.idempotencyKey,
    requestHash: command.requestHash,
    operation,
    resultVersion: occurrence.version,
    committedAt,
  };
}
