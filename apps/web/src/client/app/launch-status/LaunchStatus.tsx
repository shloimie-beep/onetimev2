import React, { useEffect, useState } from 'react';
import type { OperatorLaunchStatusProjection } from '@onetime/contracts';
import { Badge, Button, Card, ErrorState, Link, LoadingState } from '@onetime/brand-system/react';
import { AuthExpiredError, getOperatorLaunchStatus } from '../crm-api.js';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; projection: OperatorLaunchStatusProjection };

export function LaunchStatus({ onProtectedStateCleared }: { onProtectedStateCleared: () => void }) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setState({ kind: 'loading' });
    try {
      const response = await getOperatorLaunchStatus();
      setState({ kind: 'ready', projection: response.launch_status });
    } catch (error) {
      if (error instanceof AuthExpiredError) {
        onProtectedStateCleared();
        return;
      }
      setState({
        kind: 'error',
        message: 'The launch summary could not be loaded from the current Board projection.',
      });
    }
  }

  if (state.kind === 'loading') return <LoadingState label="Loading Launch Status" />;
  if (state.kind === 'error') {
    return (
      <ErrorState
        title="Launch Status unavailable"
        body={state.message}
        action={
          <Button type="button" onClick={() => void load()}>
            Try again
          </Button>
        }
      />
    );
  }
  return <LaunchStatusContent projection={state.projection} />;
}

export function LaunchStatusContent({
  projection,
}: {
  projection: OperatorLaunchStatusProjection;
}) {
  const milestone = projection.current_milestone;
  return (
    <section className="launch-status" data-goal-id={projection.goal_id}>
      <header className="launch-status__hero">
        <div>
          <p className="ot-kicker">Launch readiness</p>
          <h2>Launch Status</h2>
          <p>Current verified release progress</p>
        </div>
        <Badge>Board-derived</Badge>
      </header>

      <Card className="dashboard-card launch-status__progress state-ready">
        <header>
          <h3>Current milestone</h3>
          <strong>{milestone.percentage}%</strong>
        </header>
        <progress
          aria-label="Current launch milestone progress"
          max={milestone.acceptance_total}
          value={milestone.acceptance_complete}
        />
        <p>
          {milestone.acceptance_complete} of {milestone.acceptance_total} assigned acceptance checks
          are complete.
        </p>
      </Card>

      <div className="launch-status__grid">
        <Card>
          <h3>Latest change</h3>
          <p>{projection.what_changed}</p>
        </Card>

        <Card>
          <h3>Works now</h3>
          <ul className="launch-status__list">
            {projection.works_now.map((track) => (
              <li key={track.track_id}>
                <strong>{track.label}</strong>
                <span>{track.acceptance_ids.length} accepted check(s)</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h3>Remaining and in progress</h3>
          <ul className="launch-status__list">
            {projection.remaining.map((track) => (
              <li key={track.track_id}>
                <strong>{track.label}</strong>
                <span>{statusLabel(track.status)}</span>
                <small>{track.next_action}</small>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h3>Exact blockers</h3>
          {projection.blockers.length === 0 ? (
            <p>No exact blockers are recorded for this milestone.</p>
          ) : (
            <ul className="launch-status__list">
              {projection.blockers.map((blocker) => (
                <li key={blocker.track_id}>
                  <strong>{blocker.label}</strong>
                  <span>{blocker.reason}</span>
                  <small>{blocker.code}</small>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="dashboard-card launch-status__next state-action_needed">
          <h3>Next executable task</h3>
          <strong>{projection.next_executable_task.label}</strong>
          <p>{projection.next_executable_task.action}</p>
        </Card>
      </div>

      <nav className="launch-status__links" aria-label="Safe launch routes">
        {projection.safe_links.map((link) => (
          <Link key={link.id} className="button-secondary" href={link.href}>
            {link.label}
          </Link>
        ))}
      </nav>

      <p className="launch-status__source">
        Read-only projection generated from the canonical launch Board on{' '}
        {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
          new Date(projection.generated_at),
        )}
        .
      </p>
    </section>
  );
}

function statusLabel(status: OperatorLaunchStatusProjection['remaining'][number]['status']) {
  if (status === 'provider_off') return 'Provider off';
  if (status === 'waiting_external') return 'Waiting on external proof';
  if (status === 'ready_for_convergence') return 'Ready to integrate';
  if (status === 'needs_operator_decision') return 'Needs operator decision';
  if (status === 'unclaimed') return 'Ready to assign';
  if (status === 'blocked') return 'Blocked';
  return 'In progress';
}
