import React from 'react';
import type { AdminGamificationDashboardResponse } from '@onetime/contracts';

export function GamificationAdminPanel({
  dashboard,
  loading,
  error,
  onRetry,
}: {
  dashboard: AdminGamificationDashboardResponse | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  if (loading && !dashboard) {
    return <ReadOnlySkeleton label="Loading learning rewards" />;
  }
  if (error) {
    return (
      <StatePanel
        title="Learning rewards could not load"
        body={error}
        actionLabel="Retry"
        onAction={onRetry}
      />
    );
  }
  if (!dashboard) {
    return (
      <StatePanel
        title="Learning rewards unavailable"
        body="No gamification dashboard data has loaded yet."
        actionLabel="Retry"
        onAction={onRetry}
      />
    );
  }
  const data = dashboard.dashboard;
  return (
    <section className="gamification-admin" data-gamification-admin aria-busy={loading}>
      <div className="readonly-list rewards-summary">
        <article className="readonly-row state-ready">
          <div>
            <h2>Private learning progress</h2>
            <p>
              Student progress stays private to the learner, household, and authorized owner/admin
              staff.
            </p>
          </div>
          <dl>
            <div>
              <dt>Learners</dt>
              <dd>{data.aggregate.learner_count}</dd>
            </div>
            <div>
              <dt>Learning points</dt>
              <dd>{data.aggregate.total_learning_points}</dd>
            </div>
            <div>
              <dt>Active streaks</dt>
              <dd>{data.aggregate.active_attendance_streaks}</dd>
            </div>
            <div>
              <dt>Retention</dt>
              <dd>{data.aggregate.average_retention_percent}%</dd>
            </div>
          </dl>
        </article>
        <article className="readonly-row state-ready">
          <div>
            <h2>Guardrails</h2>
            <p>
              No public child rankings, random rewards, loot boxes, shame states, or click points.
            </p>
          </div>
          <dl>
            <div>
              <dt>Rankings</dt>
              <dd>{data.guardrails.no_public_rankings ? 'Disabled' : 'Check required'}</dd>
            </div>
            <div>
              <dt>Random rewards</dt>
              <dd>{data.guardrails.no_random_rewards ? 'Disabled' : 'Check required'}</dd>
            </div>
            <div>
              <dt>Scope</dt>
              <dd>{readableState(data.guardrails.student_scope)}</dd>
            </div>
          </dl>
        </article>
      </div>
      {data.learners.length === 0 ? (
        <StatePanel
          title="No active learners"
          body="Learner progress will appear after active portal learners exist."
        />
      ) : (
        <section className="readonly-list" aria-labelledby="reward-learners-title">
          <h2 id="reward-learners-title">Learners</h2>
          {data.learners.map((learner) => (
            <article className="readonly-row reward-learner-row" key={learner.learner_key}>
              <div>
                <h3>{learner.display_name}</h3>
                <p>{learner.level_title}</p>
              </div>
              <dl>
                <div>
                  <dt>Points</dt>
                  <dd>{learner.learning_points}</dd>
                </div>
                <div>
                  <dt>Attendance streak</dt>
                  <dd>{learner.attendance_streak}</dd>
                </div>
                <div>
                  <dt>Review streak</dt>
                  <dd>{learner.review_streak}</dd>
                </div>
                <div>
                  <dt>Retention</dt>
                  <dd>{learner.retention_percent}%</dd>
                </div>
              </dl>
            </article>
          ))}
        </section>
      )}
      <section className="readonly-list" aria-labelledby="class-milestones-title">
        <h2 id="class-milestones-title">Class milestones</h2>
        {data.class_milestones.length === 0 ? (
          <p className="state-panel">Collective class milestones will appear here.</p>
        ) : (
          data.class_milestones.map((milestone) => (
            <article className="readonly-row" key={milestone.class_milestone_key}>
              <div>
                <h3>{milestone.title}</h3>
                <p>{milestone.description}</p>
              </div>
              <dl>
                <div>
                  <dt>Status</dt>
                  <dd>{readableState(milestone.status)}</dd>
                </div>
                <div>
                  <dt>Progress</dt>
                  <dd>
                    {milestone.progress_current}/{milestone.progress_target}
                  </dd>
                </div>
              </dl>
            </article>
          ))
        )}
      </section>
      <section className="readonly-list" aria-labelledby="corrections-title">
        <h2 id="corrections-title">Correction audit</h2>
        {data.correction_audit.length === 0 ? (
          <p className="state-panel">
            Point reversals will appear here after administrator corrections.
          </p>
        ) : (
          data.correction_audit.map((audit) => (
            <article className="readonly-row reversal-row" key={audit.correction_key}>
              <div>
                <h3>Reversal recorded</h3>
                <p>{audit.reason}</p>
              </div>
              <dl>
                <div>
                  <dt>Learner</dt>
                  <dd>{audit.learner_key}</dd>
                </div>
                <div>
                  <dt>Original</dt>
                  <dd>{audit.corrected_event_key}</dd>
                </div>
                <div>
                  <dt>Reversal</dt>
                  <dd>{audit.reversal_event_key}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{formatDate(audit.created_at)}</dd>
                </div>
              </dl>
            </article>
          ))
        )}
      </section>
    </section>
  );
}

function StatePanel({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel?: string | undefined;
  onAction?: (() => void) | undefined;
}) {
  return (
    <section className="state-panel" aria-labelledby="gamification-state-title">
      <h2 id="gamification-state-title">{title}</h2>
      <p>{body}</p>
      {actionLabel && onAction && (
        <button type="button" className="button-primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </section>
  );
}

function ReadOnlySkeleton({ label }: { label: string }) {
  return (
    <div className="skeleton-list" role="status" aria-label={label}>
      {Array.from({ length: 4 }).map((_, index) => (
        <div className="skeleton-row" key={index}>
          <span />
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}

function readableState(value: string) {
  return value.replaceAll('_', ' ').replace(/^\w/, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}
