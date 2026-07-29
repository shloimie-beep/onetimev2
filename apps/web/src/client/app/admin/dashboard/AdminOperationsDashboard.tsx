import React from 'react';
import type {
  AdminDashboardSnapshot,
  AdminOperationalView,
} from '../../../../../../../packages/contracts/src/admin/operations/index.ts';
import { ADMIN_CANONICAL_PRIMARY_NAVIGATION } from '../../../../../../../packages/contracts/src/admin/operations/index.ts';
import {
  V21AppShell,
  V21StatePanel,
} from '../../../../../../../packages/brand-system/src/react-v21.tsx';
import { type V21StateKind } from '../../../../../../../packages/brand-system/src/v21.ts';

export function AdminOperationsDashboard(props: {
  snapshot: AdminDashboardSnapshot | null;
  state?: V21StateKind;
  safeMessage?: string;
  onNavigate: (href: string) => void;
  onOpenOccurrence: (occurrenceId: string) => void;
}) {
  const navigation = [
    ...ADMIN_CANONICAL_PRIMARY_NAVIGATION.map((item) => ({
      ...item,
      current: item.id === 'dashboard',
    })),
    { id: 'search', label: 'Search', href: '/app/search', current: false },
  ];

  return (
    <V21AppShell
      role="admin"
      title="Operating dashboard"
      navigation={navigation}
      onNavigate={props.onNavigate}
    >
      <p>Current One Time operations from authorized persistent records.</p>
      {props.state || !props.snapshot ? (
        <V21StatePanel
          kind={props.state ?? 'error'}
          title={props.state === 'loading' ? 'Loading operations' : 'Operations unavailable'}
        >
          <p>
            {props.safeMessage ??
              'Real operational data could not be loaded. No placeholder data is shown.'}
          </p>
        </V21StatePanel>
      ) : (
        <DashboardSections
          snapshot={props.snapshot}
          onNavigate={props.onNavigate}
          onOpenOccurrence={props.onOpenOccurrence}
        />
      )}
    </V21AppShell>
  );
}

function DashboardSections(props: {
  snapshot: AdminDashboardSnapshot;
  onNavigate: (href: string) => void;
  onOpenOccurrence: (occurrenceId: string) => void;
}) {
  const { snapshot } = props;
  return (
    <>
      <p>
        <small>
          Last refreshed {formatTimestamp(snapshot.generatedAt)} — Israel time (Asia/Jerusalem)
        </small>
      </p>
      <section aria-labelledby="now-next-heading">
        <h2 id="now-next-heading">Now &amp; Next</h2>
        {snapshot.nowAndNext.length === 0 ? (
          <p>No current or upcoming class occurrence is recorded.</p>
        ) : (
          <ul>
            {snapshot.nowAndNext.map((occurrence) => (
              <li key={occurrence.occurrenceId}>
                <strong dir="auto">{occurrence.title}</strong>{' '}
                <span>{formatTimestamp(occurrence.startsAt)}</span>{' '}
                <span>
                  {occurrence.state} · {occurrence.readiness}
                </span>{' '}
                <button
                  type="button"
                  onClick={() => props.onOpenOccurrence(occurrence.occurrenceId)}
                >
                  Open Live Console
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="attention-heading">
        <h2 id="attention-heading">Needs Attention</h2>
        <SummaryList
          values={[
            ['Billing or access', snapshot.needsAttention.accessOrBilling],
            ['Zoom readiness', snapshot.needsAttention.zoomReadiness],
            ['Content failures', snapshot.needsAttention.contentFailures],
            ['Unanswered questions', snapshot.needsAttention.unansweredQuestions],
            ['Urgent tickets', snapshot.needsAttention.urgentTickets],
          ]}
        />
      </section>

      <section aria-labelledby="pipeline-heading">
        <h2 id="pipeline-heading">Content Pipeline</h2>
        <SummaryList
          values={[
            ['Received', snapshot.contentPipeline.received],
            ['Processing', snapshot.contentPipeline.processing],
            ['Needs review', snapshot.contentPipeline.needsReview],
            ['Publishing', snapshot.contentPipeline.publishing],
            ['Failed', snapshot.contentPipeline.failed],
          ]}
        />
      </section>

      <section aria-labelledby="people-learning-heading">
        <h2 id="people-learning-heading">People and Learning</h2>
        <SummaryList
          values={[
            ['Active households', snapshot.peopleAndLearning.activeHouseholds],
            ['Active Students', snapshot.peopleAndLearning.activeStudents],
            ['Attendance records', snapshot.peopleAndLearning.attendanceRecorded],
            ['Badges awarded', snapshot.peopleAndLearning.badgesAwarded],
          ]}
        />
      </section>

      <section aria-labelledby="activity-heading">
        <h2 id="activity-heading">Recent Activity</h2>
        <p>
          Previous 24 hours, {formatTimestamp(snapshot.recentActivity.windowStartedAt)} through{' '}
          {formatTimestamp(snapshot.recentActivity.windowEndedAt)} Israel time (Asia/Jerusalem).
        </p>
        <SummaryList
          values={[
            ['Communications', snapshot.recentActivity.communications],
            ['Audit events', snapshot.recentActivity.auditEvents],
          ]}
        />
        <p>
          Last recorded activity:{' '}
          {snapshot.recentActivity.lastActivityAt
            ? formatTimestamp(snapshot.recentActivity.lastActivityAt)
            : 'No activity recorded'}
        </p>
      </section>

      <section aria-labelledby="quick-actions-heading">
        <h2 id="quick-actions-heading">Quick actions</h2>
        <nav aria-label="Admin quick actions">
          <ul>
            {snapshot.quickActions.map((action) => (
              <li key={action.id}>
                <button type="button" onClick={() => props.onNavigate(action.route)}>
                  {action.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </section>

      <section aria-labelledby="operations-status-heading">
        <h2 id="operations-status-heading">Production Operations</h2>
        <OperationalStatus label="Release and source" value={snapshot.operations.releaseSource} />
        <OperationalStatus
          label="Web and worker agreement"
          value={snapshot.operations.webWorkerAgreement}
        />
        <OperationalStatus
          label="Database and migrations"
          value={snapshot.operations.databaseMigrations}
        />
        <OperationalStatus
          label="Queue depth, oldest age, and dead letter"
          value={snapshot.operations.queueHealth}
        />
        <OperationalStatus label="Provider detail" value={snapshot.operations.providerDetail} />
        <OperationalStatus
          label="Backup age and last restore proof"
          value={snapshot.operations.backupRestore}
        />
        <OperationalStatus
          label="Recent redacted failures"
          value={snapshot.operations.recentRedactedFailures}
        />
      </section>

      <section aria-labelledby="provider-health-heading">
        <h2 id="provider-health-heading">Provider Health</h2>
        {snapshot.providerHealth.length === 0 ? (
          <p>No provider readiness snapshot is recorded.</p>
        ) : (
          <ul>
            {snapshot.providerHealth.map((provider) => (
              <li key={provider.provider}>
                <strong>{provider.provider}</strong>: {provider.state}; observed{' '}
                {formatTimestamp(provider.observedAt)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="operational-views-heading">
        <h2 id="operational-views-heading">Operational Views</h2>
        <nav aria-label="Admin operational views">
          <ul>
            {snapshot.operationalViews.map((view) => (
              <li key={view.id}>
                <button type="button" onClick={() => openView(view, props.onNavigate)}>
                  {view.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </section>
    </>
  );
}

function OperationalStatus(props: {
  label: string;
  value:
    | AdminDashboardSnapshot['operations']['releaseSource']
    | AdminDashboardSnapshot['operations']['queueHealth'];
}) {
  return (
    <section aria-label={props.label}>
      <h3>{props.label}</h3>
      <p>
        {props.value.state === 'available'
          ? props.value.summary
          : `Unavailable (${props.value.reason.replaceAll('_', ' ')})`}
      </p>
    </section>
  );
}

function SummaryList(props: { values: readonly (readonly [string, number])[] }) {
  return (
    <dl>
      {props.values.map(([label, value]) => (
        <React.Fragment key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

function openView(view: AdminOperationalView, navigate: (href: string) => void) {
  navigate(view.route);
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jerusalem',
  }).format(new Date(value));
}
