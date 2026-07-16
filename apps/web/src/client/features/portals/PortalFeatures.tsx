import React, { useEffect, useMemo, useState } from 'react';
import type {
  AdministrativeUpdate,
  HelperAvailability,
  LearnerProfile,
  LibraryItem,
  ParentLearnerMaterials,
  ParentPortalDashboard,
  ProgressSummary,
  ProtectedActionDescriptor,
  RewardBalance,
  RewardEvent,
  StudentAccessState,
  StudentPortalDashboard,
  UpcomingClassSummary,
} from '../../../../../../packages/contracts/src/portals/index.ts';

export type PortalViewState =
  | 'loading'
  | 'ready'
  | 'empty'
  | 'partial-error'
  | 'offline'
  | 'permission'
  | 'session-expired'
  | 'conflict'
  | 'limit-reached'
  | 'success'
  | 'retry';

export type ParentPortalFeatureProps = {
  viewState: PortalViewState;
  dashboard: ParentPortalDashboard | null;
  learnerMaterials?: Record<string, ParentLearnerMaterials>;
  rewardHistory?: Record<string, RewardEvent[]>;
  selectedLearnerKey?: string | null;
  actorFingerprint: string;
  resetSignal?: number;
  onSelectLearner?: (learnerKey: string) => void;
  onCreateLearner?: () => void;
  onEditLearner?: (learnerKey: string) => void;
  onArchiveLearner?: (learnerKey: string) => void;
  onRestoreLearner?: (learnerKey: string) => void;
  onStudentAccessAction?: (
    learnerKey: string,
    action: 'setup' | 'reset' | 'suspend' | 'restore',
  ) => void;
  onLaunchClass?: (learnerKey: string, action: ProtectedActionDescriptor) => void;
  onPreviewSupport?: (learnerKey?: string) => void;
  onRetry?: () => void;
};

export type StudentPortalFeatureProps = {
  viewState: PortalViewState;
  dashboard: StudentPortalDashboard | null;
  actorFingerprint: string;
  resetSignal?: number;
  onLaunchClass?: (action: ProtectedActionDescriptor) => void;
  onOpenContent?: (action: ProtectedActionDescriptor) => void;
  onPreviewSupport?: () => void;
  onRetry?: () => void;
};

export function ParentPortalFeature({
  viewState,
  dashboard,
  learnerMaterials = {},
  rewardHistory = {},
  selectedLearnerKey,
  actorFingerprint,
  resetSignal,
  onSelectLearner,
  onCreateLearner,
  onEditLearner,
  onArchiveLearner,
  onRestoreLearner,
  onStudentAccessAction,
  onLaunchClass,
  onPreviewSupport,
  onRetry,
}: ParentPortalFeatureProps) {
  const [activeLearnerKey, setActiveLearnerKey] = useState<string | null>(
    selectedLearnerKey ?? null,
  );
  useEffect(() => {
    setActiveLearnerKey(selectedLearnerKey ?? null);
  }, [actorFingerprint, resetSignal, selectedLearnerKey]);

  const learners = dashboard?.learners ?? [];
  const selectedLearner =
    learners.find((learner) => learner.learner_key === activeLearnerKey) ?? learners[0] ?? null;
  const selectedAccess = selectedLearner
    ? dashboard?.student_access.find((state) => state.learner_key === selectedLearner.learner_key)
    : null;
  const selectedMaterials = selectedLearner
    ? learnerMaterials[selectedLearner.learner_key]
    : undefined;

  if (viewState !== 'ready' && viewState !== 'success' && !dashboard) {
    return <PortalState role="parent" viewState={viewState} onRetry={onRetry} />;
  }

  if (!dashboard || learners.length === 0) {
    return (
      <section className="ot-portal" data-portal-role="parent" data-state="empty">
        <PortalTopline title="Parent Portal" subtitle="Household setup" />
        <div className="ot-empty">
          <h2>No learners yet</h2>
          <p>Add a learner to begin protected class access, progress, and updates.</p>
          <button
            type="button"
            className="ot-button ot-button-primary"
            disabled={!onCreateLearner}
            title={onCreateLearner ? 'Add learner' : 'Learner creation is unavailable in V1'}
            onClick={onCreateLearner}
          >
            Add learner
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="ot-portal" data-portal-role="parent" data-state={viewState}>
      <PortalTopline
        title="Parent Portal"
        subtitle={dashboard.household.display_name}
        aside={`${dashboard.household.active_learner_count}/3 active learners`}
      />
      <StatusStrip viewState={viewState} onRetry={onRetry} />
      <div className="ot-grid ot-grid-parent">
        <section className="ot-panel" aria-labelledby="household-heading">
          <div className="ot-panel-head">
            <div>
              <h2 id="household-heading">Household</h2>
              <p>Consent: {label(dashboard.household.consent_status)}</p>
            </div>
            <button
              type="button"
              className="ot-icon-button"
              aria-label="Add learner"
              title="Add learner"
              disabled={dashboard.household.learner_limit_reached || !onCreateLearner}
              onClick={onCreateLearner}
            >
              +
            </button>
          </div>
          {dashboard.household.learner_limit_reached && (
            <p className="ot-warning" role="status">
              V1 supports three active learners. Archive one before adding another.
            </p>
          )}
          <div className="ot-learner-list" role="list" aria-label="Learners">
            {learners.map((learner) => (
              <div role="listitem" key={learner.learner_key}>
                <button
                  type="button"
                  className="ot-learner-card"
                  aria-pressed={selectedLearner?.learner_key === learner.learner_key}
                  onClick={() => {
                    setActiveLearnerKey(learner.learner_key);
                    onSelectLearner?.(learner.learner_key);
                  }}
                >
                  <strong>{learner.display_name}</strong>
                  <span>
                    {learner.grade_label ?? 'Grade not set'} - {label(learner.learner_status)}
                  </span>
                </button>
              </div>
            ))}
          </div>
        </section>

        {selectedLearner && (
          <section className="ot-panel ot-focus-panel" aria-labelledby="learner-heading">
            <div className="ot-panel-head">
              <div>
                <h2 id="learner-heading">{selectedLearner.display_name}</h2>
                <p>{selectedLearner.hebrew_name ?? 'Learner profile'}</p>
              </div>
              <div className="ot-action-row">
                <button
                  type="button"
                  className="ot-button"
                  disabled={!onEditLearner}
                  title={onEditLearner ? 'Edit learner' : 'Learner editing is unavailable in V1'}
                  onClick={() => onEditLearner?.(selectedLearner.learner_key)}
                >
                  Edit
                </button>
                {selectedLearner.learner_status === 'archived' ? (
                  <button
                    type="button"
                    className="ot-button"
                    disabled={!onRestoreLearner}
                    title={
                      onRestoreLearner ? 'Restore learner' : 'Learner restore is unavailable in V1'
                    }
                    onClick={() => onRestoreLearner?.(selectedLearner.learner_key)}
                  >
                    Restore
                  </button>
                ) : (
                  <button
                    type="button"
                    className="ot-button"
                    disabled={!onArchiveLearner}
                    title={
                      onArchiveLearner ? 'Archive learner' : 'Learner archive is unavailable in V1'
                    }
                    onClick={() => onArchiveLearner?.(selectedLearner.learner_key)}
                  >
                    Archive
                  </button>
                )}
              </div>
            </div>
            <StudentAccessControls
              learner={selectedLearner}
              access={selectedAccess ?? null}
              onAction={onStudentAccessAction}
            />
            <ClassSummary
              learner={selectedLearner}
              classes={dashboard.upcoming_classes[selectedLearner.learner_key] ?? []}
              onLaunch={onLaunchClass}
            />
            <MaterialsSummary
              library={selectedMaterials?.library ?? []}
              reviewSheets={selectedMaterials?.review_sheets ?? []}
              helper={dashboard.helper}
              onPreviewSupport={() => onPreviewSupport?.(selectedLearner.learner_key)}
            />
          </section>
        )}

        {selectedLearner && (
          <section className="ot-panel" aria-labelledby="parent-progress-heading">
            <h2 id="parent-progress-heading">Progress And Rewards</h2>
            <RewardSummary
              rewards={dashboard.rewards[selectedLearner.learner_key]}
              progress={selectedMaterials?.progress}
              history={rewardHistory[selectedLearner.learner_key] ?? []}
            />
            <UpdatesList updates={dashboard.updates[selectedLearner.learner_key] ?? []} />
          </section>
        )}
      </div>
    </section>
  );
}

export function StudentPortalFeature({
  viewState,
  dashboard,
  actorFingerprint,
  resetSignal,
  onLaunchClass,
  onOpenContent,
  onPreviewSupport,
  onRetry,
}: StudentPortalFeatureProps) {
  const [sessionMarker, setSessionMarker] = useState(actorFingerprint);
  useEffect(() => {
    setSessionMarker(actorFingerprint);
  }, [actorFingerprint, resetSignal]);

  if (viewState !== 'ready' && viewState !== 'success' && !dashboard) {
    return <PortalState role="student" viewState={viewState} onRetry={onRetry} />;
  }
  if (!dashboard) {
    return (
      <section className="ot-portal" data-portal-role="student" data-state="empty">
        <PortalTopline title="Student Portal" subtitle="No learner connected" />
        <div className="ot-empty">
          <h2>Access is not ready</h2>
          <p>Ask your parent to finish student access setup.</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="ot-portal"
      data-portal-role="student"
      data-state={viewState}
      data-session-marker={sessionMarker}
    >
      <PortalTopline title="Student Portal" subtitle={dashboard.learner.display_name} />
      <StatusStrip viewState={viewState} onRetry={onRetry} />
      <div className="ot-grid">
        <section className="ot-panel ot-hero-panel" aria-labelledby="student-dashboard-heading">
          <h2 id="student-dashboard-heading">Today</h2>
          <ClassSummary classes={dashboard.upcoming_classes} onLaunch={onLaunchClass} />
        </section>
        <section className="ot-panel" aria-labelledby="student-library-heading">
          <h2 id="student-library-heading">Library</h2>
          <ContentList items={dashboard.library_items} onOpen={onOpenContent} />
        </section>
        <section className="ot-panel" aria-labelledby="student-progress-heading">
          <h2 id="student-progress-heading">Progress</h2>
          <ProgressSummaryView progress={dashboard.progress} rewards={dashboard.rewards} />
        </section>
        <section className="ot-panel" aria-labelledby="student-updates-heading">
          <h2 id="student-updates-heading">Updates</h2>
          <UpdatesList updates={dashboard.updates} />
          <HelperState helper={dashboard.helper} />
          <button type="button" className="ot-button" onClick={onPreviewSupport}>
            Technical help
          </button>
        </section>
      </div>
    </section>
  );
}

function PortalTopline({
  title,
  subtitle,
  aside,
}: {
  title: string;
  subtitle: string;
  aside?: string;
}) {
  return (
    <header className="ot-topline">
      <div>
        <p className="ot-kicker">One Time Mishnayos</p>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {aside && <strong className="ot-aside">{aside}</strong>}
    </header>
  );
}

function PortalState({
  role,
  viewState,
  onRetry,
}: {
  role: 'parent' | 'student';
  viewState: PortalViewState;
  onRetry?: (() => void) | undefined;
}) {
  const title =
    viewState === 'loading'
      ? 'Loading'
      : viewState === 'session-expired'
        ? 'Session expired'
        : viewState === 'permission'
          ? 'Access unavailable'
          : viewState === 'offline'
            ? 'Offline'
            : 'Needs attention';
  return (
    <section className="ot-portal" data-portal-role={role} data-state={viewState}>
      <PortalTopline
        title={role === 'parent' ? 'Parent Portal' : 'Student Portal'}
        subtitle={title}
      />
      <div className="ot-empty" role={viewState === 'permission' ? 'alert' : 'status'}>
        <h2>{title}</h2>
        <p>{stateCopy(viewState)}</p>
        {onRetry && (
          <button type="button" className="ot-button ot-button-primary" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    </section>
  );
}

function StatusStrip({
  viewState,
  onRetry,
}: {
  viewState: PortalViewState;
  onRetry?: (() => void) | undefined;
}) {
  if (viewState === 'ready') return null;
  return (
    <div className="ot-status" role={viewState === 'partial-error' ? 'alert' : 'status'}>
      <span>{stateCopy(viewState)}</span>
      {onRetry && (
        <button type="button" className="ot-text-button" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

function StudentAccessControls({
  learner,
  access,
  onAction,
}: {
  learner: LearnerProfile;
  access: StudentAccessState | null;
  onAction?:
    ((learnerKey: string, action: 'setup' | 'reset' | 'suspend' | 'restore') => void) | undefined;
}) {
  const status = access?.status ?? 'not_configured';
  const actions = useMemo(() => {
    if (status === 'not_configured' || status === 'disabled') return ['setup'] as const;
    if (status === 'suspended') return ['restore', 'reset'] as const;
    return ['reset', 'suspend'] as const;
  }, [status]);
  return (
    <section className="ot-subsection" aria-labelledby="student-access-heading">
      <div>
        <h3 id="student-access-heading">Student access</h3>
        <p>Status: {label(status)}</p>
      </div>
      <div className="ot-action-row">
        {actions.map((action) => (
          <button
            type="button"
            className={action === 'suspend' ? 'ot-button ot-button-danger' : 'ot-button'}
            key={action}
            disabled={!onAction}
            title={onAction ? label(action) : 'Student access action is unavailable'}
            onClick={() => onAction?.(learner.learner_key, action)}
          >
            {label(action)}
          </button>
        ))}
      </div>
    </section>
  );
}

function ClassSummary({
  learner,
  classes,
  onLaunch,
}: {
  learner?: LearnerProfile;
  classes: UpcomingClassSummary[];
  onLaunch?:
    | ((learnerKey: string, action: ProtectedActionDescriptor) => void)
    | ((action: ProtectedActionDescriptor) => void)
    | undefined;
}) {
  if (classes.length === 0) {
    return <p className="ot-muted">No entitled class is available right now.</p>;
  }
  return (
    <div className="ot-stack">
      {classes.map((item) => (
        <article className="ot-item" key={item.class_key}>
          <div>
            <strong>{item.title}</strong>
            <span>
              {label(item.status)}
              {item.starts_at ? ` - ${formatDate(item.starts_at)}` : ''}
            </span>
          </div>
          {item.launch_action && (
            <button
              type="button"
              className="ot-button ot-button-primary"
              disabled={!onLaunch}
              title={onLaunch ? item.launch_action.label : 'Class launch is unavailable'}
              onClick={() => {
                if (!item.launch_action || !onLaunch) return;
                if (learner) {
                  (onLaunch as (learnerKey: string, action: ProtectedActionDescriptor) => void)(
                    learner.learner_key,
                    item.launch_action,
                  );
                  return;
                }
                (onLaunch as (action: ProtectedActionDescriptor) => void)(item.launch_action);
              }}
            >
              Launch
            </button>
          )}
        </article>
      ))}
    </div>
  );
}

function MaterialsSummary({
  library,
  reviewSheets,
  helper,
  onPreviewSupport,
}: {
  library: LibraryItem[];
  reviewSheets: LibraryItem[];
  helper: HelperAvailability;
  onPreviewSupport?: (() => void) | undefined;
}) {
  return (
    <section className="ot-subsection" aria-labelledby="materials-heading">
      <h3 id="materials-heading">Materials</h3>
      <ContentList items={[...library, ...reviewSheets]} />
      <HelperState helper={helper} />
      <button
        type="button"
        className="ot-button"
        disabled={!onPreviewSupport}
        title={onPreviewSupport ? 'Technical support' : 'Technical support is unavailable'}
        onClick={onPreviewSupport}
      >
        Technical support
      </button>
    </section>
  );
}

function ContentList({
  items,
  onOpen,
}: {
  items: LibraryItem[];
  onOpen?: ((action: ProtectedActionDescriptor) => void) | undefined;
}) {
  if (items.length === 0) return <p className="ot-muted">Published materials will appear here.</p>;
  return (
    <div className="ot-stack">
      {items.map((item) => {
        const action = item.open_action;
        return (
          <article className="ot-item" key={item.item_key}>
            <div>
              <strong>{item.title}</strong>
              <span>{label(item.item_type)}</span>
            </div>
            {action && (
              <button
                type="button"
                className="ot-button"
                disabled={!onOpen}
                title={onOpen ? action.label : 'Content opening is unavailable'}
                onClick={() => onOpen?.(action)}
              >
                Open
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
}

function ProgressSummaryView({
  progress,
  rewards,
}: {
  progress: ProgressSummary;
  rewards: RewardBalance;
}) {
  return (
    <dl className="ot-metrics">
      <div>
        <dt>Classes</dt>
        <dd>{progress.attendance_count}</dd>
      </div>
      <div>
        <dt>Minutes</dt>
        <dd>{progress.watch_minutes}</dd>
      </div>
      <div>
        <dt>Completed</dt>
        <dd>{progress.completed_items}</dd>
      </div>
      <div>
        <dt>Points</dt>
        <dd>{rewards.balance}</dd>
      </div>
    </dl>
  );
}

function RewardSummary({
  rewards,
  progress,
  history,
}: {
  rewards?: RewardBalance | undefined;
  progress?: ProgressSummary | undefined;
  history: RewardEvent[];
}) {
  if (!rewards) return <p className="ot-muted">Rewards are not loaded.</p>;
  return (
    <div className="ot-stack">
      <ProgressSummaryView
        progress={
          progress ?? {
            attendance_count: 0,
            watch_minutes: 0,
            completed_items: 0,
            last_activity_at: null,
          }
        }
        rewards={rewards}
      />
      {history.map((event) => (
        <article className="ot-item" key={event.reward_event_key}>
          <div>
            <strong>{event.reason_label}</strong>
            <span>{formatDate(event.occurred_at)}</span>
          </div>
          <b>{event.points_delta > 0 ? `+${event.points_delta}` : event.points_delta}</b>
        </article>
      ))}
    </div>
  );
}

function UpdatesList({ updates }: { updates: AdministrativeUpdate[] }) {
  if (updates.length === 0) return <p className="ot-muted">No updates right now.</p>;
  return (
    <div className="ot-stack">
      {updates.map((update) => (
        <article className="ot-item ot-update" key={update.update_key}>
          <div>
            <strong>{update.title}</strong>
            <p>{update.body}</p>
          </div>
          {update.read_at ? <span>Read</span> : <span>New</span>}
        </article>
      ))}
    </div>
  );
}

function HelperState({ helper }: { helper: HelperAvailability }) {
  return (
    <div className="ot-helper" data-helper-available={helper.available}>
      <strong>{helper.scope_label}</strong>
      <span>{helper.available ? 'Available' : (helper.reason ?? 'Unavailable')}</span>
    </div>
  );
}

function stateCopy(viewState: PortalViewState) {
  if (viewState === 'loading') return 'Loading protected portal data.';
  if (viewState === 'partial-error') return 'Some information could not load.';
  if (viewState === 'offline') return 'You appear to be offline.';
  if (viewState === 'permission') return 'This account cannot open that portal view.';
  if (viewState === 'session-expired') return 'Protected state was cleared. Please sign in again.';
  if (viewState === 'conflict') return 'This changed in another session.';
  if (viewState === 'limit-reached') return 'The V1 learner limit has been reached.';
  if (viewState === 'success') return 'Saved.';
  if (viewState === 'retry') return 'Please try again.';
  return '';
}

function label(value: string) {
  return value.replaceAll('_', ' ').replace(/^\w/, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}
