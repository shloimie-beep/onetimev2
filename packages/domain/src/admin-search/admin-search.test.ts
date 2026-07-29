import { describe, expect, it } from 'vitest';
import {
  ADMIN_OPERATIONAL_VIEWS,
  ADMIN_QUICK_ACTIONS,
  ADMIN_SEARCH_KINDS,
  type AdminDashboardSnapshot,
  type AdminOperationsActor,
  type AdminOperationsReadRepository,
  type AdminSearchPage,
  type AdminSearchRequest,
  type AdminSearchResult,
  type AdminTargetAuthorization,
} from '../../../contracts/src/admin/operations/index.ts';
import {
  normalizeAdminSearchRequest,
  readAuthorizedAdminDashboard,
  resolveAuthorizedAdminNavigation,
  searchAuthorizedAdminOperations,
} from './index.ts';

const scope = {
  product: 'one_time_mishnayos',
  runtimeTier: 'isolated_staging',
  verificationEnvironmentId: 'ci',
} as const;
const actor: AdminOperationsActor = {
  ...scope,
  principal: {
    human_account_id: 'admin-account',
    role: 'admin',
    household_id: null,
    student_id: null,
    credential_version: 3,
  },
};

class MemoryOperationsRepository implements AdminOperationsReadRepository {
  constructor(
    readonly dashboard: AdminDashboardSnapshot = dashboardFixture(),
    readonly page: AdminSearchPage = searchPageFixture(),
    readonly target: AdminTargetAuthorization = {
      state: 'authorized',
      kind: 'student',
      targetId: 'student-one',
    },
  ) {}

  readDashboard() {
    return Promise.resolve(this.dashboard);
  }

  search(_scope: typeof scope, _request: AdminSearchRequest) {
    return Promise.resolve(this.page);
  }

  resolveTarget() {
    return Promise.resolve(this.target);
  }
}

describe('P11 authorized Admin operations domain', () => {
  it('returns only authorized persistent dashboard and all required search entity kinds', async () => {
    const repository = new MemoryOperationsRepository();
    const dashboard = await readAuthorizedAdminDashboard({ actor, repository });
    const page = await searchAuthorizedAdminOperations({
      actor,
      repository,
      request: {
        query: '  Family   One ',
        kinds: ADMIN_SEARCH_KINDS,
        pageSize: 20,
        cursor: null,
      },
    });
    expect(dashboard.source).toBe('persistent_store');
    expect(dashboard.operationalViews.map((view) => view.id)).toEqual([
      'communications',
      'tickets',
      'billing_access',
      'integrations',
      'operations',
      'audit',
    ]);
    expect(page.results.map((result) => result.kind)).toEqual(ADMIN_SEARCH_KINDS);
    expect(page).toMatchObject({
      authorization: 'runtime_admin',
      queryInUrl: false,
      analyticsAllowed: false,
    });
    expect(
      normalizeAdminSearchRequest({
        query: '  Family   One ',
        kinds: ['household', 'household'],
        pageSize: 10,
        cursor: null,
      }),
    ).toEqual({
      query: 'Family One',
      kinds: ['household'],
      pageSize: 10,
      cursor: null,
    });
  });

  it('rechecks current credential version and selected target immediately before navigation', async () => {
    const repository = new MemoryOperationsRepository();
    await expect(
      resolveAuthorizedAdminNavigation({
        actor,
        repository,
        request: { kind: 'student', targetId: 'student-one', selectedCredentialVersion: 3 },
      }),
    ).resolves.toEqual({
      state: 'open',
      href: '/app/students/student-one',
      cache: 'no-store',
    });
    await expect(
      resolveAuthorizedAdminNavigation({
        actor,
        repository,
        request: { kind: 'student', targetId: 'student-one', selectedCredentialVersion: 2 },
      }),
    ).resolves.toMatchObject({ state: 'unavailable', reason: 'missing_or_unauthorized' });
    await expect(
      resolveAuthorizedAdminNavigation({
        actor,
        repository: new MemoryOperationsRepository(dashboardFixture(), searchPageFixture(), {
          state: 'archived',
        }),
        request: { kind: 'student', targetId: 'student-one', selectedCredentialVersion: 3 },
      }),
    ).resolves.toMatchObject({ state: 'unavailable', reason: 'missing_or_unauthorized' });
  });

  it('denies non-Admin, cross-environment, synthetic, unsafe-route, and malformed-query reads', async () => {
    const repository = new MemoryOperationsRepository();
    await expect(
      readAuthorizedAdminDashboard({
        actor: { ...actor, principal: { ...actor.principal, role: 'parent' } },
        repository,
      }),
    ).rejects.toThrow(/Admin session/u);
    await expect(
      readAuthorizedAdminDashboard({
        actor,
        repository: new MemoryOperationsRepository({
          ...dashboardFixture(),
          needsAttention: {
            ...dashboardFixture().needsAttention,
            verificationEnvironmentId: 'provider_sandbox',
          },
        }),
      }),
    ).rejects.toThrow(/Cross-product/u);
    await expect(
      readAuthorizedAdminDashboard({
        actor,
        repository: new MemoryOperationsRepository({
          ...dashboardFixture(),
          source: 'fixture' as 'persistent_store',
        }),
      }),
    ).rejects.toThrow(/persistent-store/u);
    await expect(
      searchAuthorizedAdminOperations({
        actor,
        repository: new MemoryOperationsRepository(
          dashboardFixture(),
          searchPageFixture([
            {
              ...searchResult('adult'),
              destination: {
                route: '/app/tickets/:ticketId',
                targetId: 'adult-one',
              },
            } as AdminSearchResult,
          ]),
        ),
        request: {
          query: 'adult',
          kinds: ['adult'],
          pageSize: 20,
          cursor: null,
        },
      }),
    ).rejects.toThrow(/route/u);
    await expect(
      readAuthorizedAdminDashboard({
        actor,
        repository: new MemoryOperationsRepository({
          ...dashboardFixture(),
          providerHealth: [
            {
              ...dashboardFixture().providerHealth[0]!,
              sourceEnvironment: 'production',
            },
          ],
        }),
      }),
    ).rejects.toThrow(/environment/u);
    await expect(
      readAuthorizedAdminDashboard({
        actor,
        repository: new MemoryOperationsRepository({
          ...dashboardFixture(),
          providerHealth: [
            {
              ...dashboardFixture().providerHealth[0]!,
              state: 'live',
            },
          ],
        }),
      }),
    ).rejects.toThrow(/relabeled live/u);
    await expect(
      readAuthorizedAdminDashboard({
        actor,
        repository: new MemoryOperationsRepository({
          ...dashboardFixture(),
          recentActivity: {
            ...dashboardFixture().recentActivity,
            windowStartedAt: '2026-07-01T00:00:00.000Z',
          },
        }),
      }),
    ).rejects.toThrow(/bounded window/u);
    await expect(
      searchAuthorizedAdminOperations({
        actor,
        repository: new MemoryOperationsRepository(
          dashboardFixture(),
          searchPageFixture([
            {
              ...searchResult('content'),
              distinguishingMetadata: 'https://vimeo.com/private-target',
            },
          ]),
        ),
        request: { query: 'content', kinds: ['content'], pageSize: 20, cursor: null },
      }),
    ).rejects.toThrow(/provider|secret/u);
    for (const request of [
      { query: 'x', kinds: ['adult'], pageSize: 20, cursor: null },
      { query: 'valid', kinds: [], pageSize: 20, cursor: null },
      { query: 'valid', kinds: ['adult'], pageSize: 51, cursor: null },
      { query: 'valid\u0000term', kinds: ['adult'], pageSize: 20, cursor: null },
      { query: 'valid', kinds: ['adult'], pageSize: 20, cursor: 'not+safe' },
    ] as AdminSearchRequest[]) {
      await expect(
        searchAuthorizedAdminOperations({ actor, repository, request }),
      ).rejects.toThrow();
    }
  });
});

function dashboardFixture(): AdminDashboardSnapshot {
  return {
    source: 'persistent_store',
    authorization: 'runtime_admin',
    generatedAt: '2026-07-29T06:45:00.000Z',
    nowAndNext: [
      {
        ...scope,
        source: 'persistent_store',
        occurrenceId: 'occurrence-one',
        classId: 'class-one',
        title: 'Mishnayos Class',
        startsAt: '2026-07-29T07:00:00.000Z',
        state: 'scheduled',
        readiness: 'ready',
        liveConsoleDestination: {
          route: '/app/live/:occurrenceId',
          targetId: 'occurrence-one',
        },
      },
    ],
    needsAttention: {
      ...scope,
      source: 'persistent_store',
      accessOrBilling: 1,
      zoomReadiness: 0,
      contentFailures: 0,
      unansweredQuestions: 2,
      urgentTickets: 1,
    },
    contentPipeline: {
      ...scope,
      source: 'persistent_store',
      received: 1,
      processing: 2,
      needsReview: 3,
      publishing: 1,
      failed: 0,
    },
    peopleAndLearning: {
      ...scope,
      source: 'persistent_store',
      activeHouseholds: 5,
      activeStudents: 11,
      attendanceRecorded: 20,
      badgesAwarded: 8,
    },
    recentActivity: {
      ...scope,
      source: 'persistent_store',
      windowStartedAt: '2026-07-28T06:45:00.000Z',
      windowEndedAt: '2026-07-29T06:45:00.000Z',
      communications: 4,
      auditEvents: 9,
      lastActivityAt: '2026-07-29T06:44:00.000Z',
    },
    providerHealth: [
      {
        ...scope,
        source: 'persistent_store',
        provider: 'zoom',
        state: 'canary_verified',
        observedAt: '2026-07-29T06:43:00.000Z',
        sourceEnvironment: 'test',
        observedRuntimeTier: 'isolated_staging',
        observedVerificationEnvironmentId: 'ci',
      },
    ],
    operationalViews: ADMIN_OPERATIONAL_VIEWS,
    quickActions: ADMIN_QUICK_ACTIONS,
    operations: {
      ...scope,
      source: 'persistent_store',
      releaseSource: {
        state: 'unavailable',
        observedAt: '2026-07-29T06:45:00.000Z',
        reason: 'not_reported',
      },
      webWorkerAgreement: {
        state: 'unavailable',
        observedAt: '2026-07-29T06:45:00.000Z',
        reason: 'not_reported',
      },
      databaseMigrations: {
        state: 'unavailable',
        observedAt: '2026-07-29T06:45:00.000Z',
        reason: 'not_reported',
      },
      queueHealth: {
        state: 'available',
        observedAt: '2026-07-29T06:45:00.000Z',
        summary: 'Persistent queue readback',
        depth: 1,
        oldestAgeSeconds: 60,
        deadLetterCount: 0,
      },
      providerDetail: {
        state: 'available',
        observedAt: '2026-07-29T06:45:00.000Z',
        summary: 'Scoped readiness readback',
      },
      backupRestore: {
        state: 'unavailable',
        observedAt: '2026-07-29T06:45:00.000Z',
        reason: 'not_reported',
      },
      recentRedactedFailures: {
        state: 'unavailable',
        observedAt: '2026-07-29T06:45:00.000Z',
        reason: 'not_reported',
      },
    },
  };
}

function searchPageFixture(
  results: readonly AdminSearchResult[] = ADMIN_SEARCH_KINDS.map(searchResult),
): AdminSearchPage {
  return {
    source: 'persistent_store',
    authorization: 'runtime_admin',
    queryInUrl: false,
    analyticsAllowed: false,
    results,
    nextCursor: null,
  };
}

function searchResult(kind: (typeof ADMIN_SEARCH_KINDS)[number]): AdminSearchResult {
  const targetId = `${kind}-one`;
  const destinations = {
    adult: { route: '/app/contacts/:contactId', targetId },
    household: { route: '/app/households/:householdId', targetId },
    student: { route: '/app/students/:studentId', targetId },
    class: { route: '/app/classroom/classes/:classId', targetId },
    occurrence: { route: '/app/classroom/occurrences/:occurrenceId', targetId },
    content: { route: '/app/content/:contentId', targetId },
    question: { route: '/app/classroom/questions', targetId },
    ticket: { route: '/app/tickets/:ticketId', targetId },
  } as const;
  return {
    ...scope,
    source: 'persistent_store',
    kind,
    targetId,
    label: `${kind} result`,
    distinguishingMetadata: `${kind} metadata`,
    status: 'active',
    matchedBy: 'name',
    destination: destinations[kind],
  } as AdminSearchResult;
}
