import React, { useEffect, useMemo, useState } from 'react';
import type {
  AdministrativeUpdate,
  ClassLeaderboardSummary,
  HelperAnswer,
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
  StudentQuestion,
  StudentPortalDashboard,
  UpcomingClassSummary,
} from '../../../../../../packages/contracts/src/portals/index.ts';
import type { GamificationSummary } from '../../../../../../packages/contracts/src/gamification/index.ts';

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
    action: 'setup' | 'reset' | 'suspend' | 'restore' | 'revoke_sessions',
  ) => void;
  onLaunchClass?: (learnerKey: string, action: ProtectedActionDescriptor) => void;
  onOpenContent?: (learnerKey: string, action: ProtectedActionDescriptor) => void;
  onPreviewSupport?: (learnerKey?: string) => void;
  onBillingCheckout?: () => void;
  onBillingPortal?: () => void;
  onCreateRewardGoal?: (
    learnerKey: string,
    goal: { title: string; description: string; pointsRequired: number },
  ) => void;
  onRetry?: () => void;
};

export type StudentPortalFeatureProps = {
  viewState: PortalViewState;
  dashboard: StudentPortalDashboard | null;
  actorFingerprint: string;
  resetSignal?: number;
  onLaunchClass?: (action: ProtectedActionDescriptor) => void;
  onOpenContent?: (action: ProtectedActionDescriptor) => void;
  onQueryHelper?: (question: string) => Promise<HelperAnswer>;
  onSubmitQuestion?: (question: string, classKey?: string | undefined) => void;
  onSubmitClassroomQuestion?: (occurrenceKey: string, body: string) => void;
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
  onOpenContent,
  onPreviewSupport,
  onBillingCheckout,
  onBillingPortal,
  onCreateRewardGoal,
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
          {onCreateLearner && (
            <button type="button" className="ot-button ot-button-primary" onClick={onCreateLearner}>
              Add learner
            </button>
          )}
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
            {onCreateLearner && (
              <button
                type="button"
                className="ot-icon-button"
                aria-label="Add learner"
                title="Add learner"
                onClick={onCreateLearner}
              >
                +
              </button>
            )}
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
          <BillingSummaryPanel
            billing={dashboard.billing}
            onCheckout={onBillingCheckout}
            onPortal={onBillingPortal}
          />
        </section>

        {selectedLearner && (
          <section className="ot-panel ot-focus-panel" aria-labelledby="learner-heading">
            <div className="ot-panel-head">
              <div>
                <h2 id="learner-heading">{selectedLearner.display_name}</h2>
                <p>{selectedLearner.hebrew_name ?? 'Learner profile'}</p>
              </div>
              <div className="ot-action-row">
                {onEditLearner && (
                  <button
                    type="button"
                    className="ot-button"
                    onClick={() => onEditLearner(selectedLearner.learner_key)}
                  >
                    Edit
                  </button>
                )}
                {selectedLearner.learner_status === 'archived'
                  ? onRestoreLearner && (
                      <button
                        type="button"
                        className="ot-button"
                        onClick={() => onRestoreLearner(selectedLearner.learner_key)}
                      >
                        Restore
                      </button>
                    )
                  : onArchiveLearner && (
                      <button
                        type="button"
                        className="ot-button"
                        onClick={() => onArchiveLearner(selectedLearner.learner_key)}
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
              onOpen={(action) => onOpenContent?.(selectedLearner.learner_key, action)}
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
              gamification={
                selectedMaterials?.gamification ??
                dashboard.gamification?.[selectedLearner.learner_key]
              }
              onCreateRewardGoal={
                onCreateRewardGoal
                  ? (goal) => onCreateRewardGoal(selectedLearner.learner_key, goal)
                  : undefined
              }
            />
            <LeaderboardPanel
              leaderboard={dashboard.leaderboard}
              ownLearnerKey={selectedLearner.learner_key}
            />
            <UpdatesList updates={dashboard.updates[selectedLearner.learner_key] ?? []} />
          </section>
        )}
      </div>
    </section>
  );
}

function BillingSummaryPanel({
  billing,
  onCheckout,
  onPortal,
}: {
  billing: ParentPortalDashboard['billing'];
  onCheckout?: (() => void) | undefined;
  onPortal?: (() => void) | undefined;
}) {
  if (!billing.enabled) {
    return (
      <section className="ot-subsection" aria-labelledby="billing-heading">
        <div className="ot-section-title">
          <h3 id="billing-heading">Billing</h3>
          <span>Unavailable</span>
        </div>
        <p>Billing is unavailable in this environment.</p>
        <dl className="ot-stats">
          <div>
            <dt>Access</dt>
            <dd>{billing.grants_access ? 'Active' : 'Not active'}</dd>
          </div>
        </dl>
      </section>
    );
  }
  const status = billing.entitlement_status ?? 'pending';
  const showCheckout =
    billing.checkout_available && status !== 'active' && status !== 'scheduled_end';
  const showPortal = billing.customer_portal_available;
  return (
    <section className="ot-subsection" aria-labelledby="billing-heading">
      <div>
        <h3 id="billing-heading">Billing</h3>
        <p>{billing.plan_truth}</p>
      </div>
      <dl className="ot-mini-metrics">
        <div>
          <dt>Status</dt>
          <dd>{label(status)}</dd>
        </div>
        <div>
          <dt>Access</dt>
          <dd>{billing.grants_access ? 'Active' : 'Not active'}</dd>
        </div>
      </dl>
      {billing.current_period_end && (
        <p className="ot-muted">
          Current period ends {formatDate(billing.current_period_end)}
          {billing.cancel_at_period_end ? '. Cancellation scheduled.' : ''}
        </p>
      )}
      {billing.recovery_required && (
        <p className="ot-warning" role="status">
          Payment recovery is required before learning access resumes.
        </p>
      )}
      <div className="ot-action-row">
        {showCheckout && (
          <button
            type="button"
            className="ot-button ot-button-primary"
            disabled={!onCheckout}
            onClick={onCheckout}
          >
            Start checkout
          </button>
        )}
        {showPortal && (
          <button type="button" className="ot-button" disabled={!onPortal} onClick={onPortal}>
            Manage billing
          </button>
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
  onQueryHelper,
  onSubmitQuestion,
  onSubmitClassroomQuestion,
  onPreviewSupport,
  onRetry,
}: StudentPortalFeatureProps) {
  const [sessionMarker, setSessionMarker] = useState(actorFingerprint);
  const [question, setQuestion] = useState('');
  const [questionState, setQuestionState] = useState<'idle' | 'sent' | 'blocked'>('idle');
  useEffect(() => {
    setSessionMarker(actorFingerprint);
  }, [actorFingerprint, resetSignal]);
  const currentClass = dashboard?.upcoming_classes[0] ?? null;

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
          {currentClass && (
            <form
              className="ot-question-form"
              onSubmit={(event) => {
                event.preventDefault();
                const body = question.trim();
                if (body.length < 3 || !onSubmitClassroomQuestion) {
                  setQuestionState('blocked');
                  return;
                }
                onSubmitClassroomQuestion(currentClass.class_key, body);
                setQuestion('');
                setQuestionState('sent');
              }}
            >
              <label htmlFor="student-question">Question for class</label>
              <textarea
                id="student-question"
                value={question}
                minLength={3}
                maxLength={360}
                rows={3}
                onChange={(event) => {
                  setQuestion(event.currentTarget.value);
                  setQuestionState('idle');
                }}
              />
              <div className="ot-action-row">
                <button type="submit" className="ot-button" disabled={!onSubmitClassroomQuestion}>
                  Send question
                </button>
                {questionState !== 'idle' && (
                  <span role={questionState === 'blocked' ? 'alert' : 'status'}>
                    {questionState === 'sent' ? 'Sent' : 'Enter at least three characters.'}
                  </span>
                )}
              </div>
            </form>
          )}
        </section>
        <section className="ot-panel" aria-labelledby="student-library-heading">
          <h2 id="student-library-heading">Library</h2>
          {dashboard.featured_lesson && <FeaturedLesson lesson={dashboard.featured_lesson} />}
          <ContentList
            items={dashboard.library_items.filter(
              (item) => item.status === 'published' && Boolean(item.content_factory),
            )}
            onOpen={onOpenContent}
          />
        </section>
        <section className="ot-panel" aria-labelledby="student-helper-heading">
          <h2 id="student-helper-heading">Class Helper</h2>
          <ClassHelperPanel helper={dashboard.helper} onQueryHelper={onQueryHelper} />
        </section>
        <section className="ot-panel" aria-labelledby="student-progress-heading">
          <h2 id="student-progress-heading">Progress</h2>
          <RewardSummary
            rewards={dashboard.rewards}
            progress={dashboard.progress}
            history={[]}
            gamification={dashboard.gamification}
          />
          <LeaderboardPanel
            leaderboard={dashboard.leaderboard}
            ownLearnerKey={dashboard.learner.learner_key}
          />
        </section>
        <section className="ot-panel" aria-labelledby="student-questions-heading">
          <h2 id="student-questions-heading">Questions</h2>
          <QuestionPanel
            questions={dashboard.questions}
            upcoming={dashboard.upcoming_classes}
            onSubmitQuestion={onSubmitQuestion}
          />
        </section>
        <section className="ot-panel" aria-labelledby="student-updates-heading">
          <h2 id="student-updates-heading">Updates</h2>
          <UpdatesList updates={dashboard.updates} />
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
    | ((
        learnerKey: string,
        action: 'setup' | 'reset' | 'suspend' | 'restore' | 'revoke_sessions',
      ) => void)
    | undefined;
}) {
  const status = access?.status ?? 'not_configured';
  const actions = useMemo(() => {
    if (learner.learner_status === 'archived') return [] as const;
    if (status === 'not_configured' || status === 'disabled') return ['setup'] as const;
    if (status === 'suspended') return ['restore', 'reset'] as const;
    return ['reset', 'revoke_sessions', 'suspend'] as const;
  }, [learner.learner_status, status]);
  return (
    <section className="ot-subsection" aria-labelledby="student-access-heading">
      <div>
        <h3 id="student-access-heading">Student access</h3>
        <p>
          Status:{' '}
          {learner.learner_status === 'archived'
            ? 'Paused while learner is archived'
            : label(status)}
        </p>
        {access?.username_display && <p>Username: {access.username_display}</p>}
        {access?.credential_status && (
          <p>
            Credentials: {label(access.credential_status)}
            {access.password_version ? ` - version ${access.password_version}` : ''}
          </p>
        )}
      </div>
      {onAction && actions.length > 0 && (
        <div className="ot-action-row">
          {actions.map((action) => (
            <button
              type="button"
              className={action === 'suspend' ? 'ot-button ot-button-danger' : 'ot-button'}
              key={action}
              onClick={() => onAction(learner.learner_key, action)}
            >
              {label(action)}
            </button>
          ))}
        </div>
      )}
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
          {item.launch_action && onLaunch && (
            <button
              type="button"
              className="ot-button ot-button-primary"
              title={item.launch_action.label}
              onClick={() => {
                if (!item.launch_action) return;
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
              {item.launch_action.label}
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
  onOpen,
  onPreviewSupport,
}: {
  library: LibraryItem[];
  reviewSheets: LibraryItem[];
  helper: HelperAvailability;
  onOpen?: ((action: ProtectedActionDescriptor) => void) | undefined;
  onPreviewSupport?: (() => void) | undefined;
}) {
  return (
    <section className="ot-subsection" aria-labelledby="materials-heading">
      <h3 id="materials-heading">Materials</h3>
      <ContentList items={[...library, ...reviewSheets]} onOpen={onOpen} />
      <HelperState helper={helper} />
      {onPreviewSupport && (
        <button type="button" className="ot-button" onClick={onPreviewSupport}>
          Technical support
        </button>
      )}
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
              {item.lesson && (
                <span>
                  {item.lesson.approved_messages.length} approved messages,{' '}
                  {item.lesson.resource_count} resources
                </span>
              )}
              {item.content_factory && (
                <div className="ot-stack">
                  {item.content_factory.is_demo && (
                    <span className="ot-guardrail-note">Demo — approved synthetic lesson data</span>
                  )}
                  <p>{item.content_factory.approved_summary}</p>
                  <span>Captions active · {label(item.content_factory.progress_state)}</span>
                  <details>
                    <summary>Approved review questions</summary>
                    <ol>
                      {item.content_factory.approved_review_questions.map((question) => (
                        <li key={question}>{question}</li>
                      ))}
                    </ol>
                  </details>
                </div>
              )}
            </div>
            {action && onOpen && (
              <button
                type="button"
                className="ot-button"
                title={action.label}
                onClick={() => onOpen(action)}
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

function ClassHelperPanel({
  helper,
  onQueryHelper,
}: {
  helper: HelperAvailability;
  onQueryHelper?: ((question: string) => Promise<HelperAnswer>) | undefined;
}) {
  const [draft, setDraft] = useState('');
  const [answer, setAnswer] = useState<HelperAnswer | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'answered' | 'error'>('idle');
  const [error, setError] = useState('');
  const trimmed = draft.trim();
  const canAsk = helper.available && Boolean(onQueryHelper) && trimmed.length > 0;
  return (
    <div className="ot-stack ot-helper-panel">
      <HelperState helper={helper} />
      <p className="ot-muted">
        Class Helper answers from Rabbi Scheller's approved class material.
      </p>
      <form
        className="ot-question-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canAsk || !onQueryHelper) return;
          setState('loading');
          setError('');
          void onQueryHelper(trimmed)
            .then((result) => {
              setAnswer(result);
              setDraft('');
              setState('answered');
            })
            .catch((caught: unknown) => {
              setState('error');
              setError(
                caught instanceof Error
                  ? caught.message
                  : 'Class Helper is being prepared for this class. Send a private question and we will route it for review.',
              );
            });
        }}
      >
        <label className="ot-field">
          <span>Ask Class Helper</span>
          <textarea
            value={draft}
            maxLength={800}
            rows={4}
            disabled={!helper.available || state === 'loading'}
            onChange={(event) => {
              setDraft(event.currentTarget.value);
              setState('idle');
              setError('');
            }}
          />
        </label>
        <button type="submit" className="ot-button ot-button-primary" disabled={!canAsk}>
          {state === 'loading' ? 'Checking' : 'Ask helper'}
        </button>
      </form>
      {error && (
        <p className="ot-warning" role="alert">
          {error}
        </p>
      )}
      {answer && (
        <article className="ot-helper-answer" data-abstained={answer.abstained}>
          <p>{answer.answer}</p>
          {answer.citations.length > 0 && (
            <ul className="ot-citation-list" aria-label="Approved sources">
              {answer.citations.map((citation) => (
                <li key={`${citation.content_id}:${citation.section_id}`}>
                  <a href={citation.deep_link}>{citation.section_title}</a>
                </li>
              ))}
            </ul>
          )}
        </article>
      )}
    </div>
  );
}

function QuestionPanel({
  questions,
  upcoming,
  onSubmitQuestion,
}: {
  questions: StudentQuestion[];
  upcoming: UpcomingClassSummary[];
  onSubmitQuestion?: ((question: string, classKey?: string | undefined) => void) | undefined;
}) {
  const [draft, setDraft] = useState('');
  const [classKey, setClassKey] = useState(upcoming[0]?.class_key ?? '');
  const [preview, setPreview] = useState<{
    question: string;
    classKey?: string | undefined;
  } | null>(null);
  const trimmed = draft.trim();
  useEffect(() => {
    if (upcoming.length === 0) {
      setClassKey('');
      return;
    }
    if (!upcoming.some((item) => item.class_key === classKey)) {
      setClassKey(upcoming[0]?.class_key ?? '');
    }
  }, [classKey, upcoming]);
  return (
    <div className="ot-stack">
      <form
        className="ot-question-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!trimmed || !onSubmitQuestion) return;
          setPreview({ question: trimmed, classKey: classKey || undefined });
        }}
      >
        {upcoming.length > 0 && (
          <ClassPicker
            label="Class"
            items={upcoming}
            value={classKey}
            onChange={(nextClassKey) => {
              setClassKey(nextClassKey);
              setPreview(null);
            }}
          />
        )}
        <label className="ot-field">
          <span>Ask privately</span>
          <textarea
            value={draft}
            maxLength={800}
            rows={4}
            onChange={(event) => {
              setDraft(event.currentTarget.value);
              setPreview(null);
            }}
          />
        </label>
        <button
          type="submit"
          className="ot-button ot-button-primary"
          disabled={!trimmed || !onSubmitQuestion}
        >
          Preview private question
        </button>
      </form>
      {preview && (
        <div className="ot-private-preview" role="status">
          <strong>Private question preview</strong>
          <p>{preview.question}</p>
          <div className="ot-action-row">
            <button
              type="button"
              className="ot-button ot-button-primary"
              onClick={() => {
                if (!onSubmitQuestion) return;
                onSubmitQuestion(preview.question, preview.classKey);
                setDraft('');
                setPreview(null);
              }}
            >
              Send private question
            </button>
            <button type="button" className="ot-button" onClick={() => setPreview(null)}>
              Edit
            </button>
          </div>
        </div>
      )}
      {questions.length === 0 ? (
        <p className="ot-muted">Submitted questions will appear here.</p>
      ) : (
        questions.map((question) => (
          <article className="ot-item ot-update" key={question.question_key}>
            <div>
              <strong>{label(question.status)}</strong>
              <p>{question.question}</p>
              {question.answer_preview && <p>{question.answer_preview}</p>}
            </div>
            <span>{formatDate(question.submitted_at)}</span>
          </article>
        ))
      )}
    </div>
  );
}

function ClassPicker({
  label: pickerLabel,
  items,
  value,
  onChange,
}: {
  label: string;
  items: UpcomingClassSummary[];
  value: string;
  onChange: (classKey: string) => void;
}) {
  return (
    <fieldset className="ot-choice-field">
      <legend>{pickerLabel}</legend>
      <div className="ot-choice-list" role="radiogroup" aria-label={pickerLabel}>
        {items.map((item) => (
          <button
            type="button"
            className="ot-choice"
            role="radio"
            aria-checked={item.class_key === value}
            key={item.class_key}
            onClick={() => onChange(item.class_key)}
          >
            <strong>{item.title}</strong>
            <span>{item.starts_at ? formatDate(item.starts_at) : label(item.status)}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function FeaturedLesson({
  lesson,
}: {
  lesson: NonNullable<StudentPortalDashboard['featured_lesson']>;
}) {
  return (
    <article className="ot-featured-lesson">
      <div>
        <p className="ot-kicker">Featured lesson</p>
        <strong>{lesson.title}</strong>
        {lesson.description && <span>{lesson.description}</span>}
      </div>
      <dl className="ot-mini-metrics">
        <div>
          <dt>Resources</dt>
          <dd>{lesson.resource_count}</dd>
        </div>
        <div>
          <dt>Questions</dt>
          <dd>{lesson.approved_messages.length}</dd>
        </div>
      </dl>
    </article>
  );
}

function LeaderboardPanel({
  leaderboard,
  ownLearnerKey,
}: {
  leaderboard?: ClassLeaderboardSummary | undefined;
  ownLearnerKey?: string | undefined;
}) {
  if (!leaderboard) return null;
  if (!leaderboard.published) {
    return (
      <section className="ot-leaderboard" aria-label="Class leaderboard">
        <div className="ot-section-title">
          <h3>{leaderboard.title}</h3>
          <span>Rabbi review</span>
        </div>
        <p className="ot-muted">The class board is waiting for Rabbi publication.</p>
      </section>
    );
  }
  return (
    <section className="ot-leaderboard" aria-label="Class leaderboard">
      <div className="ot-section-title">
        <h3>{leaderboard.title}</h3>
        <span>All time</span>
      </div>
      {leaderboard.entries.length === 0 ? (
        <p className="ot-muted">Class progress will appear after approved learning events.</p>
      ) : (
        <ol className="ot-leaderboard-list">
          {leaderboard.entries.map((entry, index) => (
            <li
              key={entry.learner_key}
              className="ot-leaderboard-row"
              data-own={entry.own_entry || entry.learner_key === ownLearnerKey}
            >
              <span className="ot-rank">{index + 1}</span>
              <div>
                <strong>{entry.display_name}</strong>
                <span>
                  {entry.attendance_count} classes, {entry.completed_lessons} lessons,{' '}
                  {entry.approved_questions} approved questions
                </span>
              </div>
              <b>{entry.points} pts</b>
            </li>
          ))}
        </ol>
      )}
      <p className="ot-guardrail-note">
        Authenticated class board. Actual names are class-only; Rabbi corrections are audited.
      </p>
    </section>
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
  gamification,
  onCreateRewardGoal,
}: {
  rewards?: RewardBalance | undefined;
  progress?: ProgressSummary | undefined;
  history: RewardEvent[];
  gamification?: GamificationSummary | undefined;
  onCreateRewardGoal?:
    ((goal: { title: string; description: string; pointsRequired: number }) => void) | undefined;
}) {
  if (!rewards) return <p className="ot-muted">Rewards are not loaded.</p>;
  if (gamification) {
    return (
      <GamificationSummaryView
        summary={gamification}
        fallbackProgress={progress}
        fallbackRewards={rewards}
        onCreateRewardGoal={onCreateRewardGoal}
      />
    );
  }
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

function GamificationSummaryView({
  summary,
  fallbackProgress,
  fallbackRewards,
  onCreateRewardGoal,
}: {
  summary: GamificationSummary;
  fallbackProgress?: ProgressSummary | undefined;
  fallbackRewards: RewardBalance;
  onCreateRewardGoal?:
    ((goal: { title: string; description: string; pointsRequired: number }) => void) | undefined;
}) {
  const attendance = summary.streaks.find((streak) => streak.kind === 'attendance');
  const review = summary.streaks.find((streak) => streak.kind === 'review');
  return (
    <div className="ot-stack ot-gamification" data-guardrails={summary.guardrails.student_scope}>
      {summary.celebration && (
        <section className="ot-celebration" role="status">
          <strong>{summary.celebration.title}</strong>
          <span>{summary.celebration.detail}</span>
        </section>
      )}
      <div className="ot-level-card">
        <div>
          <p className="ot-kicker">Level {summary.level.level}</p>
          <h3>{summary.level.title}</h3>
          <p>{summary.learning_points} meaningful learning points</p>
        </div>
        <ProgressMeter
          label={
            summary.level.next_level_points
              ? `${summary.level.progress_percent}% to next level`
              : 'Top V1 level'
          }
          value={summary.level.progress_percent}
        />
      </div>
      <ProgressSummaryView
        progress={fallbackProgress ?? progressFromSummary(summary)}
        rewards={fallbackRewards}
      />
      <div className="ot-progress-bars" aria-label="Learning progress">
        <ProgressMeter
          label="Mishnayos"
          value={percent(summary.progress.mishnayos_completed, summary.progress.mishnayos_target)}
        />
        <ProgressMeter
          label="Classes"
          value={percent(
            summary.progress.classes_attended,
            Math.max(1, summary.progress.classes_total),
          )}
        />
        <ProgressMeter
          label="Review"
          value={percent(
            summary.progress.review_items_completed,
            Math.max(1, summary.progress.review_items_total),
          )}
        />
        <ProgressMeter label="Retention" value={summary.progress.retention_percent} />
      </div>
      <div className="ot-streak-grid">
        <StreakCard title="Attendance streak" streak={attendance} />
        <StreakCard title="Review streak" streak={review} />
      </div>
      <BadgeList badges={summary.badges} />
      <MilestoneList milestones={summary.milestones} />
      <ClassMilestoneList milestones={summary.class_milestones} />
      <ParentRewardList rewards={summary.parent_rewards} />
      {onCreateRewardGoal && <ParentRewardGoalForm onCreate={onCreateRewardGoal} />}
      <AccomplishmentList accomplishments={summary.accomplishments} />
      <p className="ot-guardrail-note">
        Private progress only. No public rankings, random rewards, or points for empty clicks.
      </p>
    </div>
  );
}

function ProgressMeter({ label, value }: { label: string; value: number }) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="ot-progress-meter">
      <span>{label}</span>
      <div aria-hidden="true">
        <i style={{ width: `${safeValue}%` }} />
      </div>
      <strong>{safeValue}%</strong>
    </div>
  );
}

function StreakCard({
  title,
  streak,
}: {
  title: string;
  streak?: GamificationSummary['streaks'][number] | undefined;
}) {
  if (!streak) return null;
  return (
    <article className="ot-streak-card" data-streak-state={streak.status}>
      <strong>{title}</strong>
      <span>{streak.current_count} current</span>
      <small>
        Best {streak.best_count}; grace {streak.grace_remaining}
      </small>
    </article>
  );
}

function BadgeList({ badges }: { badges: GamificationSummary['badges'] }) {
  if (badges.length === 0) {
    return <p className="ot-muted">Badges will appear after learning progress.</p>;
  }
  return (
    <div className="ot-badge-list" aria-label="Badges">
      {badges.map((badge) => (
        <span
          className={`ot-badge tone-${badge.tone}`}
          key={badge.badge_key}
          title={badge.description}
        >
          {badge.title}
        </span>
      ))}
    </div>
  );
}

function MilestoneList({ milestones }: { milestones: GamificationSummary['milestones'] }) {
  return (
    <div className="ot-stack" aria-label="Personal milestones">
      {milestones.map((milestone) => (
        <article
          className="ot-item ot-milestone"
          data-status={milestone.status}
          key={milestone.milestone_key}
        >
          <div>
            <strong>{milestone.title}</strong>
            <span>{milestone.description}</span>
          </div>
          <b>
            {milestone.progress_current}/{milestone.progress_target}
          </b>
        </article>
      ))}
    </div>
  );
}

function ClassMilestoneList({
  milestones,
}: {
  milestones: GamificationSummary['class_milestones'];
}) {
  if (milestones.length === 0) {
    return <p className="ot-muted">Class milestones will appear here.</p>;
  }
  return (
    <div className="ot-stack" aria-label="Class milestones">
      {milestones.map((milestone) => (
        <article
          className="ot-item ot-milestone"
          data-status={milestone.status}
          key={milestone.class_milestone_key}
        >
          <div>
            <strong>{milestone.title}</strong>
            <span>{milestone.description}</span>
          </div>
          <b>
            {milestone.progress_current}/{milestone.progress_target}
          </b>
        </article>
      ))}
    </div>
  );
}

function ParentRewardList({ rewards }: { rewards: GamificationSummary['parent_rewards'] }) {
  if (rewards.length === 0) {
    return <p className="ot-muted">Optional parent rewards can be added for this learner.</p>;
  }
  return (
    <div className="ot-stack" aria-label="Parent rewards">
      {rewards.map((reward) => (
        <article className="ot-item" key={reward.reward_goal_key}>
          <div>
            <strong>{reward.title}</strong>
            <span>{reward.description || label(reward.status)}</span>
          </div>
          <b>{reward.points_required} pts</b>
        </article>
      ))}
    </div>
  );
}

function ParentRewardGoalForm({
  onCreate,
}: {
  onCreate: (goal: { title: string; description: string; pointsRequired: number }) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pointsRequired, setPointsRequired] = useState(50);
  const canSubmit = title.trim().length > 0 && pointsRequired > 0;
  return (
    <form
      className="ot-reward-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSubmit) return;
        onCreate({ title: title.trim(), description: description.trim(), pointsRequired });
        setTitle('');
        setDescription('');
        setPointsRequired(50);
      }}
    >
      <label className="ot-field">
        <span>Parent reward</span>
        <input
          value={title}
          maxLength={160}
          onChange={(event) => setTitle(event.currentTarget.value)}
        />
      </label>
      <label className="ot-field">
        <span>Details</span>
        <input
          value={description}
          maxLength={320}
          onChange={(event) => setDescription(event.currentTarget.value)}
        />
      </label>
      <label className="ot-field">
        <span>Points required</span>
        <input
          type="number"
          min={1}
          max={5000}
          value={pointsRequired}
          onChange={(event) => setPointsRequired(Number(event.currentTarget.value))}
        />
      </label>
      <button type="submit" className="ot-button ot-button-primary" disabled={!canSubmit}>
        Add reward
      </button>
    </form>
  );
}

function AccomplishmentList({
  accomplishments,
}: {
  accomplishments: GamificationSummary['accomplishments'];
}) {
  if (accomplishments.length === 0) {
    return (
      <p className="ot-muted">Accomplishments will appear after learning events are recorded.</p>
    );
  }
  return (
    <div className="ot-stack" aria-label="Accomplishment history">
      {accomplishments.map((event) => (
        <article className="ot-item" data-reversal={event.points_delta < 0} key={event.event_key}>
          <div>
            <strong>{event.title}</strong>
            <span>{event.detail}</span>
            <small>{formatDate(event.occurred_at)}</small>
          </div>
          <b>{event.points_delta > 0 ? `+${event.points_delta}` : event.points_delta}</b>
        </article>
      ))}
    </div>
  );
}

function progressFromSummary(summary: GamificationSummary): ProgressSummary {
  return {
    attendance_count: summary.progress.classes_attended,
    watch_minutes: 0,
    completed_items: summary.progress.review_items_completed + summary.progress.mishnayos_completed,
    last_activity_at: summary.accomplishments[0]?.occurred_at ?? null,
  };
}

function percent(current: number, target: number) {
  return target <= 0 ? 0 : Math.min(100, Math.round((current / target) * 100));
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
