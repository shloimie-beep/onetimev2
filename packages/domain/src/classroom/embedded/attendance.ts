import type {
  AttendanceEvent,
  AttendanceInterval,
  AttendanceProjection,
} from '../../../../contracts/src/classroom/embedded/index.ts';
import { EmbeddedClassroomError } from './errors.ts';

type MillisecondInterval = { start: number; end: number };

export function reconcileAttendance(input: {
  events: readonly AttendanceEvent[];
  scheduled_start_at: string;
  scheduled_end_at: string;
  prior_projection: AttendanceProjection | null;
  now: Date;
}): AttendanceProjection {
  const events = deduplicate(input.events);
  if (events.length === 0) {
    return emptyProjection(input.prior_projection, input.now);
  }
  assertOneSubject(events);
  assertPriorProjection(input.prior_projection, events[0]!);
  const correction = events
    .filter((event) => event.source === 'admin_correction')
    .sort(compareEvent)
    .at(-1);
  const providerEvents = events.filter(
    (event) => event.source === 'zoom_provider' && event.provider_verified,
  );
  const clientEvents = events.filter((event) => event.source === 'embedded_client');
  const providerIntervals = intervalsFromEvents(providerEvents);
  const clientIntervals = intervalsFromEvents(clientEvents);

  let selected: MillisecondInterval[];
  let state: AttendanceProjection['reconciliation_state'];
  if (correction !== undefined) {
    selected = intervalsFromCorrection(correction.correction_intervals);
    state = 'admin_corrected';
  } else if (providerIntervals.length > 0) {
    selected = providerIntervals;
    state = sameIntervals(merge(providerIntervals), merge(clientIntervals))
      ? 'provider_verified'
      : clientIntervals.length > 0
        ? 'provider_mismatch'
        : 'provider_verified';
  } else {
    selected = clientIntervals;
    state = 'provisional';
  }
  if (
    input.prior_projection?.reconciliation_state === 'admin_corrected' &&
    state !== 'admin_corrected'
  ) {
    throw new EmbeddedClassroomError(
      'invalid_contract',
      'Audited attendance correction evidence cannot be cleared.',
    );
  }
  if (
    input.prior_projection !== null &&
    events.length < input.prior_projection.source_event_count
  ) {
    throw new EmbeddedClassroomError(
      'invalid_contract',
      'Attendance source evidence cannot regress.',
    );
  }

  const merged = merge(selected);
  const scheduledStart = instant(input.scheduled_start_at);
  const scheduledEnd = instant(input.scheduled_end_at);
  if (scheduledEnd <= scheduledStart) {
    throw new EmbeddedClassroomError(
      'invalid_contract',
      'Scheduled occurrence duration must be positive.',
    );
  }
  const totalMs = merged.reduce((sum, interval) => sum + interval.end - interval.start, 0);
  const scheduledMs = scheduledEnd - scheduledStart;
  const first = merged[0]?.start ?? null;
  const last = merged.at(-1)?.end ?? null;
  const event = events[0]!;
  return {
    scope: event.scope,
    occurrence_id: event.occurrence_id,
    student_id: event.student_id,
    first_joined_at: first === null ? null : new Date(first).toISOString(),
    last_left_at: last === null ? null : new Date(last).toISOString(),
    total_connected_minutes: round(totalMs / 60_000),
    attendance_percentage: round(Math.min(100, (totalMs / scheduledMs) * 100)),
    reconnect_count: Math.max(0, selected.length - 1),
    late: first !== null && first > scheduledStart,
    reconciliation_state: state,
    manual_correction_reason: correction?.correction_reason ?? null,
    correction_admin_id: correction?.correction_admin_id ?? null,
    source_event_count: events.length,
    version: (input.prior_projection?.version ?? 0) + 1,
    updated_at: input.now.toISOString(),
  };
}

function intervalsFromEvents(events: readonly AttendanceEvent[]): MillisecondInterval[] {
  const byLineage = new Map<string, AttendanceEvent[]>();
  for (const event of events) {
    const existing = byLineage.get(event.connection_lineage_id) ?? [];
    existing.push(event);
    byLineage.set(event.connection_lineage_id, existing);
  }
  const intervals: MillisecondInterval[] = [];
  for (const lineage of byLineage.values()) {
    let joinedAt: number | null = null;
    for (const event of lineage.sort(compareEvent)) {
      if (event.event_kind === 'joined' && joinedAt === null) {
        joinedAt = instant(event.observed_at);
      } else if (event.event_kind === 'left' && joinedAt !== null) {
        const leftAt = instant(event.observed_at);
        if (leftAt > joinedAt) intervals.push({ start: joinedAt, end: leftAt });
        joinedAt = null;
      }
    }
  }
  return intervals;
}

function intervalsFromCorrection(intervals: readonly AttendanceInterval[]): MillisecondInterval[] {
  return intervals.map((interval) => {
    const start = instant(interval.joined_at);
    const end = instant(interval.left_at);
    if (end <= start) {
      throw new EmbeddedClassroomError(
        'invalid_contract',
        'Attendance correction interval must be positive.',
      );
    }
    return { start, end };
  });
}

function merge(intervals: readonly MillisecondInterval[]): MillisecondInterval[] {
  const sorted = [...intervals].sort((left, right) => left.start - right.start);
  const merged: MillisecondInterval[] = [];
  for (const interval of sorted) {
    const prior = merged.at(-1);
    if (prior === undefined || interval.start > prior.end) {
      merged.push({ ...interval });
    } else {
      prior.end = Math.max(prior.end, interval.end);
    }
  }
  return merged;
}

function sameIntervals(
  left: readonly MillisecondInterval[],
  right: readonly MillisecondInterval[],
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (interval, index) =>
        interval.start === right[index]?.start && interval.end === right[index]?.end,
    )
  );
}

function deduplicate(events: readonly AttendanceEvent[]): AttendanceEvent[] {
  const seen = new Map<string, AttendanceEvent>();
  for (const event of events) {
    const prior = seen.get(event.idempotency_key);
    if (prior !== undefined && prior.source_event_ref_digest !== event.source_event_ref_digest) {
      throw new EmbeddedClassroomError(
        'invalid_contract',
        'Attendance idempotency key was reused for different evidence.',
      );
    }
    seen.set(event.idempotency_key, event);
  }
  return [...seen.values()];
}

function assertOneSubject(events: readonly AttendanceEvent[]): void {
  const first = events[0]!;
  for (const event of events) {
    if (
      event.student_id !== first.student_id ||
      event.occurrence_id !== first.occurrence_id ||
      event.scope.product !== first.scope.product ||
      event.scope.runtime_tier !== first.scope.runtime_tier ||
      event.scope.verification_environment_id !== first.scope.verification_environment_id
    ) {
      throw new EmbeddedClassroomError(
        'invalid_contract',
        'Attendance events must bind one exact Student occurrence.',
      );
    }
    if (!/^[a-f0-9]{64}$/.test(event.source_event_ref_digest)) {
      throw new EmbeddedClassroomError(
        'invalid_contract',
        'Attendance source reference must be a digest.',
      );
    }
    assertCorrectionMetadata(event);
  }
}

function assertCorrectionMetadata(event: AttendanceEvent): void {
  const isCorrection =
    event.source === 'admin_correction' && event.event_kind === 'manual_correction';
  const reason = event.correction_reason;
  const adminId = event.correction_admin_id;
  const auditRef = event.audit_ref;
  if (isCorrection) {
    if (
      reason === null ||
      reason.trim() !== reason ||
      reason.length < 3 ||
      reason.length > 1_000 ||
      adminId === null ||
      adminId.trim() !== adminId ||
      adminId.length === 0 ||
      adminId.length > 512 ||
      auditRef === null ||
      auditRef.trim() !== auditRef ||
      auditRef.length === 0 ||
      auditRef.length > 512
    ) {
      throw new EmbeddedClassroomError(
        'invalid_contract',
        'Attendance correction metadata must be canonical and P22-compatible.',
      );
    }
    return;
  }
  if (
    event.source === 'admin_correction' ||
    event.event_kind === 'manual_correction' ||
    event.correction_intervals.length > 0 ||
    reason !== null ||
    adminId !== null ||
    auditRef !== null
  ) {
    throw new EmbeddedClassroomError(
      'invalid_contract',
      'Only an audited Admin correction may carry attendance correction metadata.',
    );
  }
}

function assertPriorProjection(prior: AttendanceProjection | null, event: AttendanceEvent): void {
  if (
    prior !== null &&
    (prior.student_id !== event.student_id ||
      prior.occurrence_id !== event.occurrence_id ||
      prior.scope.product !== event.scope.product ||
      prior.scope.runtime_tier !== event.scope.runtime_tier ||
      prior.scope.verification_environment_id !== event.scope.verification_environment_id)
  ) {
    throw new EmbeddedClassroomError(
      'invalid_contract',
      'Attendance projection must remain bound to one exact Student occurrence.',
    );
  }
}

function emptyProjection(prior: AttendanceProjection | null, now: Date): AttendanceProjection {
  if (prior === null) {
    throw new EmbeddedClassroomError(
      'invalid_contract',
      'An empty first attendance projection has no subject.',
    );
  }
  return {
    ...prior,
    version: prior.version + 1,
    updated_at: now.toISOString(),
  };
}

function compareEvent(left: AttendanceEvent, right: AttendanceEvent): number {
  return (
    instant(left.observed_at) - instant(right.observed_at) ||
    compareUtf8(left.attendance_event_id, right.attendance_event_id)
  );
}

function compareUtf8(left: string, right: string): number {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const sharedLength = Math.min(leftBytes.length, rightBytes.length);
  for (let index = 0; index < sharedLength; index += 1) {
    const difference = leftBytes[index]! - rightBytes[index]!;
    if (difference !== 0) return difference;
  }
  return leftBytes.length - rightBytes.length;
}

function instant(value: string): number {
  const result = new Date(value).getTime();
  if (!Number.isFinite(result)) {
    throw new EmbeddedClassroomError('invalid_contract', 'Timestamp must be valid.');
  }
  return result;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
