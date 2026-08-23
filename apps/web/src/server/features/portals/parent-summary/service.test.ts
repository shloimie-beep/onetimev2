import { describe, expect, it, vi } from 'vitest';
import {
  PARENT_SUMMARY_ERROR_CODES,
  type ParentSummaryPrincipal,
  type ParentSummaryRecord,
} from '../../../../../../../packages/contracts/src/portals/parent-summary/index.ts';
import { createParentSummaryService, ParentSummaryError } from './service.ts';

const principal: ParentSummaryPrincipal = {
  role: 'parent',
  adult_id: 'adult-1',
  household_id: 'household-1',
  session_id: 'session-1',
};

const record: ParentSummaryRecord = {
  household_id: 'household-1',
  owner_adult_id: 'adult-1',
  display_name: 'Our household',
  generated_at: '2026-07-29T05:30:00Z',
  students: [{ student_id: 'student-1', display_name: 'Student One', state: 'active' }],
  schedule: [
    {
      schedule_id: 'schedule-1',
      student_id: 'student-1',
      title: 'Weekly learning session',
      starts_at: '2026-08-02T17:00:00Z',
      ends_at: '2026-08-02T18:00:00Z',
      status: 'upcoming',
    },
  ],
  progress: [
    {
      student_id: 'student-1',
      attendance: {
        attended_sessions: 7,
        scheduled_sessions: 8,
        attendance_percent: 88,
        current_streak: 3,
      },
      badges: [
        {
          badge_id: 'badge-1',
          label: 'Consistent attendance',
          awarded_at: '2026-07-20T12:00:00Z',
        },
      ],
    },
  ],
  updates: [
    {
      update_id: 'update-1',
      kind: 'reminder',
      title: 'Schedule reminder',
      summary: 'The next session starts Sunday at 5:00 PM.',
      published_at: '2026-07-29T05:00:00Z',
    },
  ],
};

function buildService(value: ParentSummaryRecord | null = record) {
  return createParentSummaryService({
    repository: { loadParentSummary: vi.fn(async () => value) },
  });
}

describe('P13 Parent summary service', () => {
  it('returns only Parent-safe schedule, attendance, badges, updates, and support data', async () => {
    const snapshot = await buildService().overview(principal);

    expect(snapshot.contract_version).toBe('1.1.0');
    expect(snapshot.featured_welcome_video).toMatchObject({
      status: 'unavailable',
      reason: 'no_approved_version',
    });
    expect(snapshot.progress[0]?.attendance.attended_sessions).toBe(7);
    expect(snapshot.schedule[0]?.title).toBe('Weekly learning session');
    expect(snapshot.updates[0]?.kind).toBe('reminder');
    expect(snapshot.support.href).toBe('/app/parent/support');
    expect(JSON.stringify(snapshot)).not.toMatch(
      /owner_adult_id|join_url|recording|library|private_question|rabbi_answer/i,
    );
  });

  it('denies a wrong role before loading household data', async () => {
    const loadParentSummary = vi.fn(async () => record);
    const service = createParentSummaryService({ repository: { loadParentSummary } });

    await expect(
      service.overview({ ...principal, role: 'student' } as unknown as ParentSummaryPrincipal),
    ).rejects.toMatchObject({
      code: PARENT_SUMMARY_ERROR_CODES.roleDenied,
    });
    expect(loadParentSummary).not.toHaveBeenCalled();
  });

  it('denies a cross-household or wrong-owner record', async () => {
    await expect(
      buildService({ ...record, household_id: 'household-2' }).overview(principal),
    ).rejects.toBeInstanceOf(ParentSummaryError);
    await expect(
      buildService({ ...record, owner_adult_id: 'adult-2' }).overview(principal),
    ).rejects.toMatchObject({
      code: PARENT_SUMMARY_ERROR_CODES.scopeDenied,
    });
  });

  it('fails closed when schedule or progress references a foreign Student', async () => {
    await expect(
      buildService({
        ...record,
        schedule: [{ ...record.schedule[0]!, student_id: 'student-foreign' }],
      }).overview(principal),
    ).rejects.toMatchObject({
      code: PARENT_SUMMARY_ERROR_CODES.invalidRecord,
    });
    await expect(
      buildService({
        ...record,
        progress: [{ ...record.progress[0]!, student_id: 'student-foreign' }],
      }).overview(principal),
    ).rejects.toMatchObject({
      code: PARENT_SUMMARY_ERROR_CODES.invalidRecord,
    });
  });

  it('returns a bounded empty state and reports a missing summary', async () => {
    const empty = await buildService({
      ...record,
      students: [],
      schedule: [],
      progress: [],
      updates: [],
    }).overview(principal);
    expect(empty.students).toEqual([]);
    await expect(buildService(null).overview(principal)).rejects.toMatchObject({
      code: PARENT_SUMMARY_ERROR_CODES.summaryMissing,
    });
  });
});
