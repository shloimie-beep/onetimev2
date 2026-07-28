import { describe, expect, it } from 'vitest';
import {
  CANONICAL_CLASS_SERIES_ID,
  type ClassOccurrenceRecord,
  type ClassSeriesRecord,
  type ClassroomAdminActor,
  type SeriesEnrollmentRecord,
  type StudentEligibilityRecord,
} from '../../../../contracts/src/classes/core/index.ts';
import { CANONICAL_CLASS_SERIES, generateRollingOccurrences } from '../../calendar/index.ts';
import {
  ClassroomCoreError,
  applyStudentLifecycleWithCanonicalEnrollment,
  assertCanonicalCatalog,
  assertManualUnenrollAllowed,
  createAdditionalSeries,
  createCanonicalSeries,
  createOccurrence,
  editSeries,
  generateCoreOccurrences,
  planCanonicalEnrollmentReconciliation,
  rescheduleOccurrence,
  transitionOccurrence,
  transitionSeries,
} from './index.ts';

const at = '2026-07-28T20:00:00.000Z';
const actor: ClassroomAdminActor = {
  accountKey: 'account-1',
  productKey: 'one-time',
  principalId: 'admin-1',
  role: 'admin',
};

function draft(): ClassSeriesRecord {
  return createAdditionalSeries({
    actor,
    id: 'series-2',
    title: 'Additional class',
    timeZone: 'Asia/Jerusalem',
    localStartTime: '18:15',
    durationMinutes: 45,
    weekdays: [0, 2, 4],
    startsOn: '2026-08-02',
    teacherProfileId: 'teacher-1',
    embeddedClassroomRequired: true,
    recordingEnabled: false,
    occurredAt: at,
  }).series;
}

function seriesCommand(
  current: ClassSeriesRecord,
  to: ClassSeriesRecord['state'],
  key = `${current.state}-${to}`,
) {
  return {
    actor,
    seriesId: current.id,
    to,
    expectedVersion: current.version,
    idempotencyKey: key,
    requestHash: `hash-${key}`,
    occurredAt: '2026-07-28T20:01:00.000Z',
  };
}

function occurrence(state: ClassOccurrenceRecord['state'] = 'scheduled'): ClassOccurrenceRecord {
  return {
    accountKey: actor.accountKey,
    productKey: actor.productKey,
    id: 'occurrence-1',
    seriesId: 'series-2',
    localClassDate: '2026-08-02',
    startsAt: '2026-08-02T16:00:00.000Z',
    scheduledEndsAt: '2026-08-02T17:00:00.000Z',
    joinOpensAt: '2026-08-02T15:50:00.000Z',
    joinClosesAt: '2026-08-02T17:15:00.000Z',
    state,
    scheduleVersion: 1,
    version: 1,
    createdAt: at,
    updatedAt: at,
  };
}

function occurrenceCommand(
  current: ClassOccurrenceRecord,
  to: ClassOccurrenceRecord['state'],
  minute: number,
) {
  return {
    actor,
    occurrenceId: current.id,
    to,
    expectedVersion: current.version,
    idempotencyKey: `${current.state}-${to}`,
    requestHash: `hash-${current.state}-${to}`,
    occurredAt: `2026-07-28T20:${String(minute).padStart(2, '0')}:00.000Z`,
  };
}

const student: StudentEligibilityRecord = {
  accountKey: actor.accountKey,
  productKey: actor.productKey,
  studentId: 'student-1',
  householdId: 'household-1',
  state: 'archived',
  version: 3,
};

function enrollment(
  studentId = student.studentId,
  state: SeriesEnrollmentRecord['state'] = 'active',
): SeriesEnrollmentRecord {
  return {
    accountKey: actor.accountKey,
    productKey: actor.productKey,
    id: `${CANONICAL_CLASS_SERIES_ID}:${studentId}`,
    seriesId: CANONICAL_CLASS_SERIES_ID,
    studentId,
    householdId: 'household-1',
    state,
    source: 'student_activation',
    effectiveAt: at,
    idempotencyKey: `enroll-${studentId}`,
    auditRef: `audit-${studentId}`,
    version: 1,
  };
}

describe('P16 class series lifecycle', () => {
  it('OTV2-CLASSROOM-223 creates additional series as invisible, effect-free draft', () => {
    const result = createAdditionalSeries({
      actor,
      id: 'series-2',
      title: 'Additional class',
      timeZone: 'Asia/Jerusalem',
      localStartTime: '18:15',
      durationMinutes: 45,
      weekdays: [0, 2, 4],
      startsOn: '2026-08-02',
      teacherProfileId: 'teacher-1',
      embeddedClassroomRequired: true,
      recordingEnabled: false,
      occurredAt: at,
    });
    expect(result.series.state).toBe('draft');
    expect(result.effects).toEqual({
      generateOccurrences: false,
      reconcileEnrollments: false,
      visibleToFamilies: false,
      enqueueProviderWork: false,
      enqueueCommunicationWork: false,
      stopFutureWork: false,
    });
  });

  it('OTV2-CLASSROOM-234 enforces the exact full series transition graph', () => {
    let current = draft();
    current = transitionSeries(current, seriesCommand(current, 'active')).series;
    expect(current.state).toBe('active');
    current = transitionSeries(current, seriesCommand(current, 'paused')).series;
    current = transitionSeries(current, seriesCommand(current, 'active')).series;
    current = transitionSeries(current, seriesCommand(current, 'archived')).series;
    current = transitionSeries(current, seriesCommand(current, 'draft')).series;
    expect(current.state).toBe('draft');

    const archived = transitionSeries(draft(), seriesCommand(draft(), 'archived')).series;
    expect(() => transitionSeries(archived, seriesCommand(archived, 'active'))).toThrowError(
      /cannot transition/,
    );
  });

  it('OTV2-CLASSROOM-065 fences stale writes and makes exact replay idempotent', () => {
    const current = draft();
    const command = seriesCommand(current, 'active', 'activate-1');
    const result = transitionSeries(current, command);
    expect(result.effects.visibleToFamilies).toBe(true);
    expect(transitionSeries(result.series, command, result.receipt).replay).toBe(true);
    expect(() =>
      transitionSeries(result.series, { ...command, requestHash: 'different' }, result.receipt),
    ).toThrowError(/different request/);
    expect(() =>
      transitionSeries(result.series, {
        ...seriesCommand(result.series, 'paused'),
        expectedVersion: 1,
      }),
    ).toThrowError(/reload/);
  });

  it('OTV2-CLASSROOM-065 edits nonarchived additional series without draft effects', () => {
    const current = draft();
    const result = editSeries(current, {
      actor,
      seriesId: current.id,
      patch: { title: 'Updated additional class', localStartTime: '18:30' },
      expectedVersion: current.version,
      idempotencyKey: 'edit-series-1',
      requestHash: 'hash-edit-series-1',
      occurredAt: '2026-07-28T20:01:00.000Z',
    });
    expect(result.series).toMatchObject({
      title: 'Updated additional class',
      localStartTime: '18:30',
      state: 'draft',
      version: 2,
    });
    expect(result.effects.visibleToFamilies).toBe(false);
    const archived = transitionSeries(current, seriesCommand(current, 'archived')).series;
    expect(() =>
      editSeries(archived, {
        actor,
        seriesId: archived.id,
        patch: { title: 'Denied' },
        expectedVersion: archived.version,
        idempotencyKey: 'edit-archived',
        requestHash: 'hash-edit-archived',
        occurredAt: at,
      }),
    ).toThrowError(/Restore an archived series/);
  });

  it('OTV2-CLASSROOM-184 keeps exactly one immutable active canonical launch series', () => {
    const canonical = createCanonicalSeries({
      accountKey: actor.accountKey,
      productKey: actor.productKey,
      teacherProfileId: 'rabbi-eli',
      occurredAt: at,
    });
    expect(canonical).toMatchObject({
      state: 'active',
      canonical: true,
      timeZone: 'Asia/Jerusalem',
      localStartTime: '19:00',
      durationMinutes: 60,
      weekdays: [0, 1, 2, 3, 4],
    });
    expect(() => transitionSeries(canonical, seriesCommand(canonical, 'paused'))).toThrowError(
      /must remain active/,
    );
    expect(() => assertCanonicalCatalog([canonical, { ...canonical, id: 'copy' }])).toThrowError(
      /exactly one/,
    );
  });

  it('OTV2-CLASSROOM-184 reuses P15 DST-safe rolling 90-day canonical generation', () => {
    const events = generateRollingOccurrences(CANONICAL_CLASS_SERIES, {
      fromLocalDate: '2026-03-01',
    });
    expect(events.length).toBeGreaterThanOrEqual(63);
    expect(new Set(events.map((event) => event.localClassDate)).size).toBe(events.length);
    expect(events.find((event) => event.localClassDate === '2026-03-22')?.startsAt).toBe(
      '2026-03-22T17:00:00.000Z',
    );
    expect(events.find((event) => event.localClassDate === '2026-03-29')?.startsAt).toBe(
      '2026-03-29T16:00:00.000Z',
    );
  });
});

describe('P16 class occurrence lifecycle', () => {
  it('OTV2-CLASSROOM-066 follows scheduled to completed and rejects completed mutation', () => {
    let current = occurrence();
    for (const [next, minute] of [
      ['preparing', 1],
      ['ready', 2],
      ['live', 3],
      ['completed', 4],
    ] as const) {
      current = transitionOccurrence(current, occurrenceCommand(current, next, minute)).occurrence;
    }
    expect(current.state).toBe('completed');
    expect(() =>
      transitionOccurrence(current, occurrenceCommand(current, 'canceled', 5)),
    ).toThrowError(/cannot transition/);
  });

  it('OTV2-CLASSROOM-066 cancels pre-live states and restores only before start', () => {
    for (const state of ['scheduled', 'preparing', 'ready'] as const) {
      const current = occurrence(state);
      const canceled = transitionOccurrence(
        current,
        occurrenceCommand(current, 'canceled', 1),
      ).occurrence;
      const restored = transitionOccurrence(canceled, occurrenceCommand(canceled, 'scheduled', 2));
      expect(restored.occurrence.scheduleVersion).toBe(2);
      expect(restored.revokeOldLaunchGrants).toBe(true);
    }
    const past = {
      ...occurrence('canceled'),
      startsAt: '2026-07-28T19:00:00.000Z',
    };
    expect(() => transitionOccurrence(past, occurrenceCommand(past, 'scheduled', 2))).toThrowError(
      /future occurrence/,
    );
  });

  it('OTV2-CLASSROOM-066 reschedules future truth with a new schedule version', () => {
    const current = occurrence();
    const result = rescheduleOccurrence(current, {
      actor,
      occurrenceId: current.id,
      localClassDate: '2026-08-03',
      startsAt: '2026-08-03T16:30:00.000Z',
      scheduledEndsAt: '2026-08-03T17:30:00.000Z',
      joinOpensAt: '2026-08-03T16:20:00.000Z',
      joinClosesAt: '2026-08-03T17:45:00.000Z',
      expectedVersion: current.version,
      idempotencyKey: 'reschedule-1',
      requestHash: 'hash-reschedule-1',
      occurredAt: at,
    });
    expect(result.occurrence).toMatchObject({
      state: 'scheduled',
      scheduleVersion: 2,
      localClassDate: '2026-08-03',
    });
    expect(result.revokeOldLaunchGrants).toBe(true);
  });

  it('OTV2-CLASSROOM-066 generates visible occurrence truth only for active series', () => {
    const inactive = draft();
    expect(
      generateCoreOccurrences(inactive, {
        fromLocalDate: '2026-08-02',
        occurredAt: at,
      }),
    ).toEqual([]);
    const active = transitionSeries(inactive, seriesCommand(inactive, 'active')).series;
    const generated = generateCoreOccurrences(active, {
      fromLocalDate: '2026-08-02',
      occurredAt: at,
    });
    expect(generated.length).toBeGreaterThan(0);
    expect(new Set(generated.map((item) => item.id)).size).toBe(generated.length);
    expect(generated[0]?.joinOpensAt).toBeDefined();
    expect(generated[0]?.joinClosesAt).toBeDefined();
  });

  it('OTV2-CLASSROOM-066 creates an explicit future occurrence with stable identity', () => {
    const active = transitionSeries(draft(), seriesCommand(draft(), 'active')).series;
    const result = createOccurrence(active, {
      actor,
      seriesId: active.id,
      localClassDate: '2026-08-05',
      startsAt: '2026-08-05T16:00:00.000Z',
      scheduledEndsAt: '2026-08-05T17:00:00.000Z',
      joinOpensAt: '2026-08-05T15:50:00.000Z',
      joinClosesAt: '2026-08-05T17:15:00.000Z',
      expectedVersion: active.version,
      idempotencyKey: 'create-occurrence-1',
      requestHash: 'hash-create-occurrence-1',
      occurredAt: at,
    });
    expect(result.occurrence).toMatchObject({
      id: `${active.id}:2026-08-05`,
      state: 'scheduled',
      scheduleVersion: active.version,
    });
  });
});

describe('P16 canonical enrollment', () => {
  it('OTV2-CLASSROOM-067 activates/restores and archives canonical enrollment together', () => {
    const activation = applyStudentLifecycleWithCanonicalEnrollment(
      { student },
      {
        scope: actor,
        studentId: student.studentId,
        householdId: student.householdId,
        action: 'activate',
        idempotencyKey: 'activate-student',
        requestHash: 'hash-activate-student',
        auditRef: 'audit-1',
        occurredAt: at,
      },
    );
    expect(activation.snapshot.student.state).toBe('active');
    expect(activation.snapshot.enrollment).toMatchObject({
      seriesId: CANONICAL_CLASS_SERIES_ID,
      state: 'active',
      source: 'student_activation',
    });

    const archived = applyStudentLifecycleWithCanonicalEnrollment(activation.snapshot, {
      scope: actor,
      studentId: student.studentId,
      householdId: student.householdId,
      action: 'archive',
      idempotencyKey: 'archive-student',
      requestHash: 'hash-archive-student',
      auditRef: 'audit-2',
      occurredAt: '2026-07-28T20:02:00.000Z',
    });
    expect(archived.snapshot.student.state).toBe('archived');
    expect(archived.snapshot.enrollment?.state).toBe('revoked');
  });

  it('OTV2-CLASSROOM-235 plans missing and extra repairs once, then no-ops', () => {
    const activeStudent = { ...student, state: 'active' as const };
    const extra = enrollment('archived-student');
    const first = planCanonicalEnrollmentReconciliation([activeStudent], [extra]);
    expect(first.map((repair) => repair.kind).sort()).toEqual(['revoke', 'upsert_active']);

    const repaired = [enrollment(activeStudent.studentId), { ...extra, state: 'revoked' as const }];
    expect(planCanonicalEnrollmentReconciliation([activeStudent], repaired)).toEqual([]);
  });

  it('OTV2-CLASSROOM-235 exposes no canonical manual opt-out but permits governed noncanonical unenroll', () => {
    expect(() => assertManualUnenrollAllowed(CANONICAL_CLASS_SERIES_ID, true)).toThrowError(
      ClassroomCoreError,
    );
    expect(() => assertManualUnenrollAllowed('future-elective', true)).not.toThrow();
    expect(() => assertManualUnenrollAllowed('past-elective', false)).toThrowError(
      /governed future/,
    );
  });
});
