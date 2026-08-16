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
  jerusalemLocalDate,
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
    expect(sql).toMatch(/^UPDATE onetime\.class_occurrences/u);
    expect(sql).not.toContain('WITH candidate');
    expect(sql).toContain('occurrence_key = (');
    expect(sql).toContain('ORDER BY candidate.starts_at, candidate.occurrence_key');
    expect(sql).toContain('series.is_canonical = true');
    expect(sql).toContain('candidate.local_class_date = $4::date');
    expect(sql).toContain('production_basic_live_expires_at > $3');
    expect(sql).not.toContain('AT TIME ZONE');
    expect(parameters).toEqual([
      STUDENT.account_key,
      STUDENT.product_key,
      NOW,
      '2026-08-13',
      MEETING_DIGEST,
      new Date('2026-08-13T12:00:00.000Z'),
    ]);
  });

  it('derives the authoritative class date at the Jerusalem calendar boundary', () => {
    expect(jerusalemLocalDate(new Date('2026-08-12T20:59:59.999Z'))).toBe('2026-08-12');
    expect(jerusalemLocalDate(new Date('2026-08-12T21:00:00.000Z'))).toBe('2026-08-13');
  });

  it('clears only the exact current Jerusalem occurrence and meeting digest', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [] });
    const marker = createProductionBasicHostLiveMarker({ query } as unknown as DbPool);

    await marker.clear({
      scope: { account_key: STUDENT.account_key, product_key: STUDENT.product_key },
      meeting_ref_digest: MEETING_DIGEST,
      cleared_at: NOW,
    });
    const [sql, parameters] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/^UPDATE onetime\.class_occurrences/u);
    expect(sql).not.toContain('UPDATE onetime.class_occurrences AS');
    expect(sql).not.toContain('FROM onetime.class_series AS series\n          WHERE');
    expect(sql).toContain('local_class_date = $5::date');
    expect(sql).toContain('production_basic_meeting_ref_digest = $3');
    expect(sql).toContain('occurrence_key = (');
    expect(sql).toContain('ORDER BY candidate.starts_at, candidate.occurrence_key');
    expect(sql).not.toContain('AT TIME ZONE');
    expect(parameters).toEqual([
      STUDENT.account_key,
      STUDENT.product_key,
      MEETING_DIGEST,
      NOW,
      '2026-08-13',
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
    expect(sql).toContain("learner.learner_status = 'active'");
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

  it('reads Parent live state only through the active owned participant entitlement', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [{ '?column?': 1 }] });
    const marker = createProductionBasicHostLiveMarker({ query } as unknown as DbPool);
    await expect(
      marker.currentForParent({
        scope: { account_key: STUDENT.account_key, product_key: STUDENT.product_key },
        participant_id: 'parent_participant_live',
        household_id: LEARNER.household_key,
        meeting_ref_digest: MEETING_DIGEST,
        observed_at: NOW,
      }),
    ).resolves.toBe(true);
    const [sql, parameters] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('onetime.parent_learning_class_entitlements');
    expect(sql).toContain('onetime.parent_learning_participants');
    expect(sql).toContain("participant.state = 'active'");
    expect(sql).toContain("entitlement.entitlement_state = 'active'");
    expect(sql).toContain('entitlement.effective_at <= $6');
    expect(sql).toContain('series.is_canonical = true');
    expect(sql).toContain('occurrence.production_basic_meeting_ref_digest = $5');
    expect(sql).toContain('occurrence.production_basic_live_expires_at > $6');
    expect(parameters).toEqual([
      STUDENT.account_key,
      STUDENT.product_key,
      'parent_participant_live',
      LEARNER.household_key,
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

  it('keeps an entitled current live occurrence visible after its join window closes', async () => {
    const lateNow = new Date('2026-08-16T17:51:00.000Z');
    const query = vi.fn().mockResolvedValue({
      rowCount: 1,
      rows: [
        {
          occurrence_key: OCCURRENCE_KEY,
          title: 'Daily One Time Mishnayos',
          starts_at: new Date('2026-08-16T16:00:00.000Z'),
        },
      ],
    });
    const pool = { query } as unknown as DbPool;
    const householdAccess = vi.fn().mockResolvedValue(true);
    const base = {
      upcomingForLearner: vi.fn().mockResolvedValue([]),
      protectedLaunch: vi.fn(),
    };
    const adapter = createProductionBasicLiveClassAccessAdapter({
      base,
      pool,
      meeting_ref_digest: MEETING_DIGEST,
      household_has_learning_access: householdAccess,
      clock: () => lateNow,
    });

    await expect(adapter.upcomingForLearner({ actor: STUDENT, learner: LEARNER })).resolves.toEqual(
      [
        {
          class_key: OCCURRENCE_KEY,
          title: 'Daily One Time Mishnayos',
          starts_at: '2026-08-16T16:00:00.000Z',
          status: 'live',
          launch_action: null,
        },
      ],
    );
    expect(householdAccess).toHaveBeenCalledWith({
      pool,
      accountKey: STUDENT.account_key,
      productKey: STUDENT.product_key,
      householdKey: LEARNER.household_key,
      now: lateNow,
    });
    const [sql, parameters] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('series.title');
    expect(sql).toContain('occurrence.starts_at');
    expect(sql).not.toContain('joinable_until');
    expect(sql).toContain("entitlement.entitlement_state = 'active'");
    expect(sql).toContain("learner.learner_status = 'active'");
    expect(sql).toContain('series.is_canonical = true');
    expect(sql).toContain('occurrence.production_basic_meeting_ref_digest = $5');
    expect(sql).toContain('occurrence.production_basic_live_expires_at > $6');
    expect(parameters).toEqual([
      STUDENT.account_key,
      STUDENT.product_key,
      LEARNER.household_key,
      LEARNER.learner_key,
      MEETING_DIGEST,
      lateNow,
    ]);
  });

  it('does not recover a late live occurrence when household learning access is denied', async () => {
    const lateNow = new Date('2026-08-16T17:51:00.000Z');
    const query = vi.fn();
    const pool = { query } as unknown as DbPool;
    const householdAccess = vi.fn().mockResolvedValue(false);
    const base = {
      upcomingForLearner: vi.fn().mockResolvedValue([]),
      protectedLaunch: vi.fn(),
    };
    const adapter = createProductionBasicLiveClassAccessAdapter({
      base,
      pool,
      meeting_ref_digest: MEETING_DIGEST,
      household_has_learning_access: householdAccess,
      clock: () => lateNow,
    });

    await expect(adapter.upcomingForLearner({ actor: STUDENT, learner: LEARNER })).resolves.toEqual(
      [],
    );
    expect(householdAccess).toHaveBeenCalledWith({
      pool,
      accountKey: STUDENT.account_key,
      productKey: STUDENT.product_key,
      householdKey: LEARNER.household_key,
      now: lateNow,
    });
    expect(query).not.toHaveBeenCalled();
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
