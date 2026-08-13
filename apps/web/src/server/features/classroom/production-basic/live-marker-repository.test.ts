import { describe, expect, it, vi } from 'vitest';
import type { DbPool } from '../../../../../../../packages/db/src/index.ts';
import type {
  LearnerProfile,
  PortalActorContext,
  ProtectedActionDescriptor,
} from '../../../../../../../packages/contracts/src/portals/index.ts';
import {
  createProductionBasicHostLiveMarker,
  createProductionBasicLiveClassAccessAdapter,
} from './live-marker-repository.ts';

const NOW = new Date('2026-08-13T10:00:00.000Z');
const MEETING_DIGEST = 'a'.repeat(64);
const OCCURRENCE_KEY = 'class_occurrence_live';
const LEARNER: LearnerProfile = {
  learner_key: 'learner_live',
  household_key: 'household_live',
  display_name: 'Student',
  hebrew_name: null,
  grade_label: null,
  learner_status: 'active',
  version: 1,
  created_at: NOW.toISOString(),
  updated_at: NOW.toISOString(),
};
const STUDENT = {
  account_key: 'account_live',
  product_key: 'product_live',
  actor_user_ref: 'student_user_live',
  actor_role: 'student',
  session_key: 'session_live',
  authorized_households: [],
  capabilities: ['student:dashboard:read', 'student:class:launch'],
  student_learner: {
    learner_key: LEARNER.learner_key,
    household_key: LEARNER.household_key,
  },
} as unknown as PortalActorContext;

describe('production-basic live-class receipt', () => {
  it('writes the exact canonical occurrence with a bounded, retry-safe receipt', async () => {
    const query = vi
      .fn()
      .mockResolvedValue({ rowCount: 1, rows: [{ occurrence_key: OCCURRENCE_KEY }] });
    const marker = createProductionBasicHostLiveMarker({ query } as unknown as DbPool);

    await expect(
      marker.confirm({
        scope: { account_key: STUDENT.account_key, product_key: STUDENT.product_key },
        meeting_ref_digest: MEETING_DIGEST,
        confirmed_at: NOW,
      }),
    ).resolves.toBe(true);

    const [sql, parameters] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('series.is_canonical = true');
    expect(sql).toContain(
      "occurrence.local_class_date = ($3::timestamptz AT TIME ZONE 'Asia/Jerusalem')::date",
    );
    expect(sql).toContain('occurrence.production_basic_live_expires_at > $3');
    expect(parameters).toEqual([
      STUDENT.account_key,
      STUDENT.product_key,
      NOW,
      MEETING_DIGEST,
      new Date('2026-08-13T12:00:00.000Z'),
    ]);
  });

  it('reads live state only through the exact Student enrollment and meeting digest', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [{ '?column?': 1 }] });
    const marker = createProductionBasicHostLiveMarker({ query } as unknown as DbPool);

    await expect(
      marker.currentForStudent({
        scope: { account_key: STUDENT.account_key, product_key: STUDENT.product_key },
        learner_key: LEARNER.learner_key,
        meeting_ref_digest: MEETING_DIGEST,
        observed_at: NOW,
      }),
    ).resolves.toBe(true);

    const [sql, parameters] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("entitlement.entitlement_state = 'active'");
    expect(sql).toContain('series.is_canonical = true');
    expect(sql).toContain('occurrence.production_basic_meeting_ref_digest = $4');
    expect(sql).toContain('occurrence.production_basic_live_expires_at > $5');
    expect(parameters).toEqual([
      STUDENT.account_key,
      STUDENT.product_key,
      LEARNER.learner_key,
      MEETING_DIGEST,
      NOW,
    ]);
  });

  it('promotes only the matching entitled Student occurrence while the receipt is current', async () => {
    const query = vi.fn().mockResolvedValue({
      rowCount: 1,
      rows: [{ occurrence_key: OCCURRENCE_KEY }],
    });
    const scheduled = [
      {
        class_key: OCCURRENCE_KEY,
        title: 'Daily One Time Mishnayos',
        starts_at: '2026-08-13T16:00:00.000Z',
        status: 'upcoming' as const,
        launch_action: action(),
      },
    ];
    const base = {
      upcomingForLearner: vi.fn().mockResolvedValue(scheduled),
      protectedLaunch: vi.fn(),
    };
    const adapter = createProductionBasicLiveClassAccessAdapter({
      base,
      pool: { query } as unknown as DbPool,
      meeting_ref_digest: MEETING_DIGEST,
      clock: () => NOW,
    });

    await expect(adapter.upcomingForLearner({ actor: STUDENT, learner: LEARNER })).resolves.toEqual(
      [expect.objectContaining({ class_key: OCCURRENCE_KEY, status: 'live', launch_action: null })],
    );
    const [sql, parameters] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("entitlement.entitlement_state = 'active'");
    expect(sql).toContain('occurrence.production_basic_meeting_ref_digest = $5');
    expect(sql).toContain('occurrence.production_basic_live_expires_at > $6');
    expect(parameters).toEqual([
      STUDENT.account_key,
      STUDENT.product_key,
      LEARNER.household_key,
      LEARNER.learner_key,
      MEETING_DIGEST,
      NOW,
    ]);
  });

  it('preserves the normal schedule for Parent, missing, expired, or mismatched receipts', async () => {
    const scheduled = [
      {
        class_key: OCCURRENCE_KEY,
        title: 'Daily One Time Mishnayos',
        starts_at: '2026-08-13T16:00:00.000Z',
        status: 'upcoming' as const,
        launch_action: action(),
      },
    ];
    const query = vi.fn().mockResolvedValue({ rowCount: 0, rows: [] });
    const base = {
      upcomingForLearner: vi.fn().mockResolvedValue(scheduled),
      protectedLaunch: vi.fn(),
    };
    const adapter = createProductionBasicLiveClassAccessAdapter({
      base,
      pool: { query } as unknown as DbPool,
      meeting_ref_digest: MEETING_DIGEST,
      clock: () => NOW,
    });

    await expect(adapter.upcomingForLearner({ actor: STUDENT, learner: LEARNER })).resolves.toEqual(
      scheduled,
    );
    const parent = {
      ...STUDENT,
      actor_role: 'parent',
      student_learner: null,
    } as unknown as PortalActorContext;
    await expect(adapter.upcomingForLearner({ actor: parent, learner: LEARNER })).resolves.toEqual(
      scheduled,
    );
    expect(query).toHaveBeenCalledTimes(1);
  });
});

function action(): ProtectedActionDescriptor {
  return {
    action_key: 'legacy_launch',
    label: 'Join class',
    kind: 'class_launch',
    method: 'POST',
    href: '/api/v1/portals/student/classes/class_occurrence_live/launch',
    launch_token_ref: 'legacy_launch_ref',
    expires_at: '2026-08-13T17:15:00.000Z',
  };
}
