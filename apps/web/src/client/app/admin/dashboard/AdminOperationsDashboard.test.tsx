import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  ADMIN_OPERATIONAL_VIEWS,
  type AdminDashboardSnapshot,
} from '../../../../../../../packages/contracts/src/admin/operations/index.ts';
import { AdminOperationsDashboard } from './AdminOperationsDashboard.tsx';

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
        onNavigate={() => undefined}
        onOpenOccurrence={() => undefined}
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
    ]) {
      expect(html).toContain(heading);
    }
    expect(html).toContain('Mishnayos Class');
    expect(html).not.toMatch(/demo|fictional|placeholder count/iu);
  });

  it('fails closed without a persistent snapshot', () => {
    const html = renderToStaticMarkup(
      <AdminOperationsDashboard
        snapshot={null}
        state="error"
        onNavigate={() => undefined}
        onOpenOccurrence={() => undefined}
      />,
    );
    expect(html).toContain('No placeholder data is shown');
    expect(html).not.toContain('Active households');
  });
});

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
      communications: 3,
      auditEvents: 7,
      lastActivityAt: '2026-07-29T06:44:00.000Z',
    },
    providerHealth: [
      {
        ...scope,
        source: 'persistent_store',
        provider: 'zoom',
        state: 'live',
        observedAt: '2026-07-29T06:43:00.000Z',
      },
    ],
    operationalViews: ADMIN_OPERATIONAL_VIEWS,
  };
}
