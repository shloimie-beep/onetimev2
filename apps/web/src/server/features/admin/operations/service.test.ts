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
      expect(params).toEqual(['account-one', 'one-time']);
      if (sql.includes('SELECT occurrences.occurrence_key')) {
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
        return Promise.resolve({
          rows: [{ received: 1, processing: 2, needs_review: 1, publishing: 0, failed: 0 }],
        });
      }
      if (sql.includes('AS active_households')) {
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
        return Promise.resolve({
          rows: [
            {
              provider: 'zoom',
              readiness_state: 'live',
              observed_at: new Date('2026-07-29T06:43:00.000Z'),
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
      providerHealth: [{ provider: 'zoom', state: 'live' }],
    });
    expect(query).toHaveBeenCalledTimes(6);
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
    expect(params.slice(0, 3)).toEqual(['account-one', 'one-time', 'Student']);
    expect(params[5]).toBe(2);
  });
});
