import { describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../../../../../../../packages/config/src/index.ts';
import type { DbPool } from '../../../../../../../packages/db/src/index.ts';
import type { AdminOperationsActor } from '../../../../../../../packages/contracts/src/admin/operations/index.ts';
import { AdminOperationsService } from './service.ts';

const actor: AdminOperationsActor = {
  product: 'one_time_mishnayos',
  runtimeTier: 'isolated_staging',
  verificationEnvironmentId: 'ci',
  principal: {
    human_account_id: 'admin-account',
    role: 'admin',
    household_id: null,
    student_id: null,
    credential_version: 1,
  },
};
const config = {
  accountKey: 'account-one',
  productKey: 'one-time',
} as AppConfig;

describe('P11 Admin operations PostgreSQL service', () => {
  it('maps real scoped dashboard rows without fallback values', async () => {
    const query = vi.fn().mockImplementation((sql: string, params: unknown[]) => {
      if (sql.includes('SELECT occurrences.occurrence_key')) {
        expect(params).toEqual(['account-one', 'one-time']);
        return Promise.resolve({
          rows: [
            {
              occurrence_key: 'occurrence-one',
              class_series_key: 'class-one',
              title: 'Mishnayos Class',
              starts_at: new Date('2026-07-29T07:00:00.000Z'),
              occurrence_state: 'scheduled',
              access_state: 'ready',
            },
          ],
        });
      }
      if (sql.includes('AS access_or_billing')) {
        expect(params).toEqual(['account-one', 'one-time']);
        return Promise.resolve({
          rows: [
            {
              access_or_billing: 2,
              zoom_readiness: 1,
              content_failures: 0,
              unanswered_questions: 3,
              urgent_tickets: 1,
            },
          ],
        });
      }
      if (sql.includes("FILTER (WHERE lifecycle_state = 'received')")) {
        expect(params).toEqual(['account-one', 'one-time']);
        return Promise.resolve({
          rows: [{ received: 1, processing: 2, needs_review: 1, publishing: 0, failed: 0 }],
        });
      }
      if (sql.includes('AS active_households')) {
        expect(params).toEqual(['account-one', 'one-time']);
        return Promise.resolve({
          rows: [
            {
              active_households: 4,
              active_students: 8,
              attendance_recorded: 12,
              badges_awarded: 5,
            },
          ],
        });
      }
      if (sql.includes('AS communications')) {
        expect(params).toEqual([
          'account-one',
          'one-time',
          '2026-07-28T06:45:00.000Z',
          '2026-07-29T06:45:00.000Z',
        ]);
        return Promise.resolve({
          rows: [
            {
              communications: 6,
              audit_events: 9,
              last_activity_at: new Date('2026-07-29T06:44:00.000Z'),
            },
          ],
        });
      }
      if (sql.includes('DISTINCT ON (provider)')) {
        expect(params).toEqual(['account-one', 'one-time', 'test']);
        return Promise.resolve({
          rows: [
            {
              provider: 'zoom',
              environment: 'test',
              readiness_state: 'canary_verified',
              observed_at: new Date('2026-07-29T06:43:00.000Z'),
            },
          ],
        });
      }
      if (sql.includes('AS queue_depth')) {
        expect(params).toEqual(['account-one', 'one-time']);
        return Promise.resolve({
          rows: [
            {
              queue_depth: 2,
              oldest_queued_at: new Date('2026-07-29T06:43:00.000Z'),
              dead_letter_count: 1,
            },
          ],
        });
      }
      throw new Error(`Unexpected dashboard query: ${sql}`);
    });
    const service = new AdminOperationsService(
      { query } as unknown as DbPool,
      config,
      () => new Date('2026-07-29T06:45:00.000Z'),
    );
    await expect(service.readDashboard(actor)).resolves.toMatchObject({
      source: 'persistent_store',
      authorization: 'runtime_admin',
      needsAttention: { accessOrBilling: 2, unansweredQuestions: 3 },
      peopleAndLearning: { activeHouseholds: 4, activeStudents: 8 },
      providerHealth: [{ provider: 'zoom', state: 'canary_verified', sourceEnvironment: 'test' }],
      recentActivity: {
        windowStartedAt: '2026-07-28T06:45:00.000Z',
        windowEndedAt: '2026-07-29T06:45:00.000Z',
      },
      operations: { queueHealth: { depth: 2, oldestAgeSeconds: 120, deadLetterCount: 1 } },
    });
    expect(query).toHaveBeenCalledTimes(7);
  });

  it('uses one account/product-scoped POST-body search query and paginates opaquely', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          kind: 'student',
          target_id: 'student-one',
          label: 'Student One',
          metadata: 'household-one',
          status: 'active',
          matched_by: 'name',
        },
        {
          kind: 'student',
          target_id: 'student-two',
          label: 'Student Two',
          metadata: 'household-two',
          status: 'active',
          matched_by: 'name',
        },
      ],
    });
    const service = new AdminOperationsService({ query } as unknown as DbPool, config);
    const page = await service.search(actor, {
      query: 'Student',
      kinds: ['student'],
      pageSize: 1,
      cursor: null,
    });
    expect(page).toMatchObject({
      queryInUrl: false,
      analyticsAllowed: false,
      results: [{ kind: 'student', targetId: 'student-one' }],
    });
    expect(page.nextCursor).toMatch(/^[A-Za-z0-9_-]+$/u);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('WITH authorized_results');
    expect(sql.match(/account_key = \$1/g)?.length).toBeGreaterThanOrEqual(8);
    expect(sql.match(/product_key = \$2/g)?.length).toBeGreaterThanOrEqual(8);
    expect(sql).toContain("metadata->>'mishnah_reference'");
    expect(sql).toContain("concat('Ticket ', submissions.source_ticket_id)");
    expect(sql).toContain('contact_key AS metadata');
    expect(params.slice(0, 3)).toEqual(['account-one', 'one-time', 'Student']);
    expect(params[5]).toBe(2);
  });

  it('performs a fresh scoped target read and returns one neutral stale outcome', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ lifecycle: 'active' }] })
      .mockResolvedValueOnce({ rows: [{ lifecycle: 'archived' }] });
    const service = new AdminOperationsService({ query } as unknown as DbPool, config);
    await expect(
      service.resolveNavigation(actor, {
        kind: 'student',
        targetId: 'student-one',
        selectedCredentialVersion: 1,
      }),
    ).resolves.toEqual({
      state: 'open',
      href: '/app/students/student-one',
      cache: 'no-store',
    });
    await expect(
      service.resolveNavigation(actor, {
        kind: 'student',
        targetId: 'student-one',
        selectedCredentialVersion: 1,
      }),
    ).resolves.toEqual({
      state: 'unavailable',
      reason: 'missing_or_unauthorized',
      cache: 'no-store',
    });
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('account_key = $1');
    expect(sql).toContain('product_key = $2');
    expect(params).toEqual(['account-one', 'one-time', 'student-one']);
  });
});
