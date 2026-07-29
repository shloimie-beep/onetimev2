import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  ADMIN_OPERATIONAL_VIEWS,
  ADMIN_QUICK_ACTIONS,
  type AdminDashboardSnapshot,
} from '../../../../../../../packages/contracts/src/admin/operations/index.ts';
import { AdminOperationsDashboard } from './AdminOperationsDashboard.tsx';
import {
  captureAdminPrivateCompletion,
  isAdminPrivateCompletionCurrent,
  type AdminClientAuthorization,
} from '../adminPrivateCompletion.ts';

const scope = {
  product: 'one_time_mishnayos',
  runtimeTier: 'isolated_staging',
  verificationEnvironmentId: 'ci',
} as const;

describe('P11 Admin operating dashboard', () => {
  it('renders the required hierarchy and real operational views', () => {
    const html = renderToStaticMarkup(
      <AdminOperationsDashboard
        snapshot={snapshot()}
        authorization={{ state: 'admin', credentialVersion: 7 }}
        onNavigate={() => undefined}
        onResolveOccurrence={() =>
          Promise.resolve({
            state: 'open',
            href: '/app/classroom/occurrences/occurrence-one',
            cache: 'no-store',
          })
        }
      />,
    );
    for (const heading of [
      'Now &amp; Next',
      'Needs Attention',
      'Content Pipeline',
      'People and Learning',
      'Recent Activity',
      'Provider Health',
      'Operational Views',
      'Communications',
      'Tickets',
      'Billing &amp; Access',
      'Integrations',
      'Operations',
      'Audit',
      'Quick actions',
      'Production Operations',
      'Release and source',
      'Queue depth, oldest age, and dead letter',
      'Resend',
      'GHL and Stripe',
      'Zoom',
      'Vimeo',
      'Drive and direct-upload staging',
      'Telegram',
    ]) {
      expect(html).toContain(heading);
    }
    expect(html).toContain('Mishnayos Class');
    expect(html).toContain('Israel time');
    expect(html).toContain('Asia/Jerusalem');
    expect(html).toContain('Unavailable (not reported)');
    expect(html).not.toMatch(/demo|fictional|placeholder count/iu);
  });

  it('fails closed without a persistent snapshot', () => {
    const html = renderToStaticMarkup(
      <AdminOperationsDashboard
        snapshot={null}
        state="error"
        authorization={{ state: 'admin', credentialVersion: 7 }}
        onNavigate={() => undefined}
        onResolveOccurrence={() =>
          Promise.resolve({
            state: 'unavailable',
            reason: 'missing_or_unauthorized',
            cache: 'no-store',
          })
        }
      />,
    );
    expect(html).toContain('No placeholder data is shown');
    expect(html).not.toContain('Active households');
  });

  it('renders no retained private snapshot or message when initially revoked', () => {
    const html = renderToStaticMarkup(
      <AdminOperationsDashboard
        snapshot={snapshot()}
        safeMessage="private retained failure detail"
        authorization={{ state: 'revoked', credentialVersion: 8 }}
        onNavigate={() => undefined}
        onResolveOccurrence={() =>
          Promise.resolve({
            state: 'unavailable',
            reason: 'missing_or_unauthorized',
            cache: 'no-store',
          })
        }
      />,
    );
    expect(html).toContain('Operations unavailable');
    expect(html).not.toContain('Mishnayos Class');
    expect(html).not.toContain('Active households');
    expect(html).not.toContain('private retained failure detail');
  });

  it('drops a stale occurrence resolver promise before navigation', async () => {
    let authorization: AdminClientAuthorization = { state: 'admin', credentialVersion: 7 };
    let generation = 1;
    const completion = captureAdminPrivateCompletion(generation, authorization)!;
    const resolution = deferred<{ href: string }>();
    const navigate = vi.fn();
    const apply = resolution.promise.then((value) => {
      if (isAdminPrivateCompletionCurrent(completion, generation, authorization)) {
        navigate(value.href);
      }
    });
    generation += 1;
    authorization = { state: 'revoked', credentialVersion: 8 };
    resolution.resolve({ href: '/app/classroom/occurrences/occurrence-one' });
    await apply;
    expect(navigate).not.toHaveBeenCalled();
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function snapshot(): AdminDashboardSnapshot {
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
      publishing: 0,
      failed: 0,
    },
    peopleAndLearning: {
      ...scope,
      source: 'persistent_store',
      activeHouseholds: 4,
      activeStudents: 9,
      attendanceRecorded: 15,
      badgesAwarded: 5,
    },
    recentActivity: {
      ...scope,
      source: 'persistent_store',
      windowStartedAt: '2026-07-28T06:45:00.000Z',
      windowEndedAt: '2026-07-29T06:45:00.000Z',
      communications: 3,
      auditEvents: 7,
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
      releaseSource: unavailable(),
      webWorkerAgreement: unavailable(),
      databaseMigrations: unavailable(),
      queueHealth: {
        state: 'available',
        observedAt: '2026-07-29T06:45:00.000Z',
        summary: 'Persistent queue readback',
        depth: 2,
        oldestAgeSeconds: 60,
        deadLetterCount: 0,
      },
      providerDetail: {
        state: 'available',
        observedAt: '2026-07-29T06:45:00.000Z',
        summary: 'Scoped readiness readback',
      },
      backupRestore: unavailable(),
      recentRedactedFailures: unavailable(),
    },
  };
}

function unavailable() {
  return {
    state: 'unavailable' as const,
    observedAt: '2026-07-29T06:45:00.000Z',
    reason: 'not_reported' as const,
  };
}
