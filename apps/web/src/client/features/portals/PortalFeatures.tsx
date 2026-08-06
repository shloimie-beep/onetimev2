import React, { useEffect, useMemo, useState } from 'react';
import type {
  AdministrativeUpdate,
  ClassLeaderboardSummary,
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
import type { LiveClassQuestion } from '../../../../../../packages/contracts/src/live-class/index.ts';
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

export const PARENT_PORTAL_SECTIONS = [
  {
    id: 'learners',
    label: 'Learners',
    description: 'Profiles, separate Student access, and household controls.',
  },
  {
    id: 'classes',
    label: 'Classes & materials',
    description: 'Upcoming classes and approved learning resources for the selected learner.',
  },
  {
    id: 'progress',
    label: 'Progress & rewards',
    description: 'Private progress, milestones, and class activity.',
  },
  {
    id: 'billing',
    label: 'Billing',
    description: 'Your current learning access. Billing is managed separately in GHL.',
  },
  {
    id: 'updates',
    label: 'Updates',
    description: 'The selected learner’s latest private family updates.',
  },
] as const;

export const STUDENT_PORTAL_SECTIONS = [
  {
    id: 'today',
    label: 'Today',
    description: 'Your next class and private class question workspace.',
  },
  {
    id: 'library',
    label: 'Library',
    description: 'Only approved lessons and resources assigned to you.',
  },
  {
    id: 'progress',
    label: 'Progress',
    description: 'Your private learning activity, milestones, and class board.',
  },
  {
    id: 'questions',
    label: 'Questions',
    description: 'Ask the Rabbi privately and follow your submitted questions.',
  },
  {
    id: 'updates',
    label: 'Updates',
    description: 'Class and account updates meant for you.',
  },
] as const;

export type ParentPortalSection = (typeof PARENT_PORTAL_SECTIONS)[number]['id'];
export type StudentPortalSection = (typeof STUDENT_PORTAL_SECTIONS)[number]['id'];

export type ParentPortalFeatureProps = {
  viewState: PortalViewState;
  dashboard: ParentPortalDashboard | null;
  learnerMaterials?: Record<string, ParentLearnerMaterials>;
  rewardHistory?: Record<string, RewardEvent[]>;
  selectedLearnerKey?: string | null;
  selectedClassKey?: string | null;
  activeSection?: ParentPortalSection;
  navigationMode?: 'shell' | 'embedded';
  actorFingerprint: string;
  resetSignal?: number;
  onSelectLearner?: (learnerKey: string) => void;
  onSelectSection?: (section: ParentPortalSection) => void;
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
  /** @deprecated Parent support routes are isolated; this callback is ignored. */
  onPreviewSupport?: (learnerKey?: string) => void;
  onRetry?: () => void;
  accountSecurity?: React.ReactNode;
  /** @deprecated The parent-created reward-goal surface is retired; this callback is ignored. */
  onCreateRewardGoal?: (...args: never[]) => void;
};

export type StudentPortalFeatureProps = {
  viewState: PortalViewState;
  dashboard: StudentPortalDashboard | null;
  readOnly?: boolean;
  selectedClassKey?: string | null;
  /** @deprecated `helper` is accepted only for source compatibility and renders no helper surface. */
  activeSection?: StudentPortalSection | 'helper';
  navigationMode?: 'shell' | 'embedded';
  actorFingerprint: string;
  resetSignal?: number;
  onLaunchClass?: (action: ProtectedActionDescriptor) => void;
  onOpenContent?: (action: ProtectedActionDescriptor) => void;
  onSubmitQuestion?: (question: string, classKey?: string | undefined) => void;
  onSubmitClassroomQuestion?: (occurrenceKey: string, body: string) => void;
  liveClassQuestions?: LiveClassQuestion[];
  onMarkLiveClassReady?: (questionKey: string, ready: boolean) => void;
  onSelectSection?: (section: StudentPortalSection) => void;
  onPreviewSupport?: () => void;
  onRetry?: () => void;
  accountSecurity?: React.ReactNode;
  libraryWorkspace?: React.ReactNode;
  libraryDetailMode?: boolean;
  learningOverview?: React.ReactNode;
  /** @deprecated The class-helper surface is retired; this callback is ignored. */
  onQueryHelper?: (question: string, classKey?: string) => Promise<unknown>;
};

export function ParentPortalFeature({
  viewState,
  dashboard,
  learnerMaterials = {},
  rewardHistory = {},
  selectedLearnerKey,
  selectedClassKey,
  activeSection: requestedSection,
  navigationMode = 'embedded',
  actorFingerprint,
  resetSignal,
  onSelectLearner,
  onSelectSection,
  onCreateLearner,
  onEditLearner,
  onArchiveLearner,
  onRestoreLearner,
  onStudentAccessAction,
  onLaunchClass,
  onOpenContent,
  onRetry,
  accountSecurity,
}: ParentPortalFeatureProps) {
  const [activeLearnerKey, setActiveLearnerKey] = useState<string | null>(
    selectedLearnerKey ?? null,
  );
  const [localSection, setLocalSection] = useState<ParentPortalSection>('learners');
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
  const activeSection = requestedSection ?? localSection;
  const selectedClasses = selectedLearner
    ? (dashboard?.upcoming_classes[selectedLearner.learner_key] ?? [])
    : [];
  const selectedClass = selectedClassKey
    ? (selectedClasses.find(({ class_key }) => class_key === selectedClassKey) ?? null)
    : null;
  const selectedUpdates = selectedLearner
    ? (dashboard?.updates[selectedLearner.learner_key] ?? [])
    : [];

  function selectSection(section: ParentPortalSection) {
    setLocalSection(section);
    onSelectSection?.(section);
  }

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
        {accountSecurity}
      </section>
    );
  }

  return (
    <section className="ot-portal" data-portal-role="parent" data-state={viewState}>
      <StatusStrip viewState={viewState} onRetry={onRetry} />
      <PortalWorkspace
        role="parent"
        navigationMode={navigationMode}
        sections={PARENT_PORTAL_SECTIONS}
        activeSection={activeSection}
        onSelectSection={(section) => selectSection(section as ParentPortalSection)}
        summaryCards={[
          {
            section: 'learners',
            label: 'Active learners',
            value: `${dashboard.household.active_learner_count} active learners`,
            detail: dashboard.household.display_name,
          },
          {
            section: 'classes',
            label: 'Next class',
            value: selectedClasses[0]?.title ?? 'No class',
            detail: selectedClasses[0]?.starts_at
              ? formatDate(selectedClasses[0].starts_at)
              : 'Nothing scheduled',
          },
          {
            section: 'classes',
            label: 'Approved materials',
            value: String(
              (selectedMaterials?.library.length ?? 0) +
                (selectedMaterials?.review_sheets.length ?? 0),
            ),
            detail:
              selectedMaterials?.library[0]?.title ??
              selectedMaterials?.review_sheets[0]?.title ??
              'No approved material yet',
          },
          {
            section: 'progress',
            label: 'Learning points',
            value: String(
              selectedLearner ? (dashboard.rewards[selectedLearner.learner_key]?.balance ?? 0) : 0,
            ),
            detail: selectedLearner?.display_name ?? 'Select a learner',
          },
        ]}
        topControls={
          <LearnerSwitcher
            learners={learners}
            selectedLearner={selectedLearner}
            onCreateLearner={onCreateLearner}
            onSelect={(learner) => {
              setActiveLearnerKey(learner.learner_key);
              onSelectLearner?.(learner.learner_key);
            }}
          />
        }
      >
        {activeSection === 'learners' && selectedLearner && (
          <>
            <div className="ot-focus-columns">
              <section aria-labelledby="household-heading">
                <div className="ot-panel-head">
                  <div>
                    <h2 id="household-heading">Household</h2>
                    <p>Consent: {label(dashboard.household.consent_status)}</p>
                  </div>
                </div>
                <p className="ot-muted">
                  Choose a learner above to manage that child’s separate profile and Student access.
                </p>
              </section>
              <section aria-labelledby="learner-heading">
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
              </section>
            </div>
            {accountSecurity}
          </>
        )}

        {activeSection === 'classes' &&
          selectedLearner &&
          (selectedClassKey ? (
            <PortalClassDetail
              role="parent"
              item={selectedClass}
              learnerName={selectedLearner.display_name}
            />
          ) : (
            <div className="ot-focus-columns">
              <section aria-labelledby="parent-classes-heading">
                <h2 id="parent-classes-heading">Upcoming classes</h2>
                <ClassSummary
                  learner={selectedLearner}
                  classes={selectedClasses}
                  onLaunch={onLaunchClass}
                />
              </section>
              <section aria-labelledby="parent-materials-heading">
                <h2 id="parent-materials-heading">Materials</h2>
                <MaterialsSummary
                  key={selectedLearner.learner_key}
                  library={selectedMaterials?.library ?? []}
                  reviewSheets={selectedMaterials?.review_sheets ?? []}
                  onOpen={(action) => onOpenContent?.(selectedLearner.learner_key, action)}
                />
              </section>
            </div>
          ))}

        {activeSection === 'progress' && selectedLearner && (
          <>
            <h2 id="parent-progress-heading">Progress &amp; rewards</h2>
            <RewardSummary
              rewards={dashboard.rewards[selectedLearner.learner_key]}
              progress={selectedMaterials?.progress}
              history={rewardHistory[selectedLearner.learner_key] ?? []}
              gamification={
                selectedMaterials?.gamification ??
                dashboard.gamification?.[selectedLearner.learner_key]
              }
            />
            <LeaderboardPanel
              leaderboard={dashboard.leaderboard}
              ownLearnerKey={selectedLearner.learner_key}
            />
          </>
        )}

        {activeSection === 'billing' && <BillingSummaryPanel billing={dashboard.billing} />}

        {activeSection === 'updates' && (
          <>
            <h2 id="parent-updates-heading">Updates</h2>
            <UpdatesList updates={selectedUpdates} />
          </>
        )}
      </PortalWorkspace>
    </section>
  );
}

function BillingSummaryPanel({ billing }: { billing: ParentPortalDashboard['billing'] }) {
  if (!billing.enabled) {
    return (
      <section className="ot-subsection" aria-labelledby="billing-heading">
        <div className="ot-section-title">
          <h3 id="billing-heading">Learning access</h3>
          <span>Unavailable</span>
        </div>
        <p>Current learning access is unavailable in this environment.</p>
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
  return (
    <section className="ot-subsection" aria-labelledby="billing-heading">
      <div>
        <h3 id="billing-heading">Learning access</h3>
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
          Current access is scheduled through {formatDate(billing.current_period_end)}.
        </p>
      )}
      {billing.recovery_required && (
        <p className="ot-warning" role="status">
          Learning access needs operator review in GHL.
        </p>
      )}
    </section>
  );
}

export function StudentPortalFeature({
  viewState,
  dashboard,
  readOnly = false,
  selectedClassKey,
  activeSection: requestedSection,
  navigationMode = 'embedded',
  actorFingerprint,
  resetSignal,
  onLaunchClass,
  onOpenContent,
  onSubmitQuestion,
  onSubmitClassroomQuestion,
  liveClassQuestions = [],
  onMarkLiveClassReady,
  onSelectSection,
  onPreviewSupport,
  onRetry,
  accountSecurity,
  libraryWorkspace,
  libraryDetailMode = false,
  learningOverview,
}: StudentPortalFeatureProps) {
  const [sessionMarker, setSessionMarker] = useState(actorFingerprint);
  const [question, setQuestion] = useState('');
  const [questionState, setQuestionState] = useState<'idle' | 'sent' | 'blocked'>('idle');
  const [localSection, setLocalSection] = useState<StudentPortalSection>('today');
  useEffect(() => {
    setSessionMarker(actorFingerprint);
  }, [actorFingerprint, resetSignal]);
  const currentClass = dashboard?.upcoming_classes[0] ?? null;
  const selectedClass = selectedClassKey
    ? (dashboard?.upcoming_classes.find(({ class_key }) => class_key === selectedClassKey) ?? null)
    : null;
  const activeSection =
    requestedSection === 'helper' ? 'today' : (requestedSection ?? localSection);

  function selectSection(section: StudentPortalSection) {
    setLocalSection(section);
    onSelectSection?.(section);
  }

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
      data-read-only={readOnly}
    >
      <StatusStrip viewState={viewState} onRetry={onRetry} />
      <PortalWorkspace
        role="student"
        navigationMode={navigationMode}
        sections={STUDENT_PORTAL_SECTIONS}
        activeSection={activeSection}
        onSelectSection={(section) => selectSection(section as StudentPortalSection)}
        summaryCards={[
          {
            section: 'today',
            label: 'Next class',
            value: currentClass?.title ?? 'No class',
            detail: currentClass?.starts_at
              ? formatDate(currentClass.starts_at)
              : 'Nothing scheduled',
          },
          {
            section: 'library',
            label: 'Library',
            value: String(
              dashboard.library_items.filter((item) => item.status === 'published').length,
            ),
            detail:
              dashboard.library_items.find((item) => item.status === 'published')?.title ??
              'No approved lesson yet',
          },
          {
            section: 'progress',
            label: 'Learning points',
            value: String(dashboard.rewards.balance),
            detail: `${dashboard.progress.attendance_count} classes attended`,
          },
          {
            section: 'questions',
            label: 'Private questions',
            value: String(dashboard.questions.length),
            detail: 'Visible only to you and the Rabbi',
          },
        ]}
        topControls={
          <div className="ot-portal-identity" aria-label="Current learner">
            <span>Learning as</span>
            <strong>{dashboard.learner.display_name}</strong>
          </div>
        }
      >
        {activeSection === 'today' && selectedClassKey ? (
          <PortalClassDetail
            role="student"
            item={selectedClass}
            onLaunch={readOnly ? undefined : onLaunchClass}
          />
        ) : activeSection === 'today' ? (
          <>
            <h2 id="student-dashboard-heading">Today</h2>
            <ClassSummary
              classes={dashboard.upcoming_classes}
              onLaunch={readOnly ? undefined : onLaunchClass}
            />
            {currentClass && (
              <form
                className="ot-question-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const body = question.trim();
                  if (readOnly || body.length < 3 || !onSubmitClassroomQuestion) {
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
                  disabled={readOnly}
                  onChange={(event) => {
                    setQuestion(event.currentTarget.value);
                    setQuestionState('idle');
                  }}
                />
                <div className="ot-action-row">
                  <button
                    type="submit"
                    className="ot-button"
                    disabled={readOnly || !onSubmitClassroomQuestion}
                  >
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
            <LiveClassReadyPanel
              questions={liveClassQuestions}
              {...(!readOnly && onMarkLiveClassReady ? { onMarkReady: onMarkLiveClassReady } : {})}
            />
          </>
        ) : null}

        {activeSection === 'library' && (
          <>
            <h2 id="student-library-heading">Library</h2>
            {libraryWorkspace}
            {!libraryDetailMode && (
              <>
                {dashboard.featured_lesson && <FeaturedLesson lesson={dashboard.featured_lesson} />}
                <ContentList
                  items={dashboard.library_items.filter((item) => item.status === 'published')}
                  onOpen={readOnly ? undefined : onOpenContent}
                />
              </>
            )}
          </>
        )}

        {activeSection === 'progress' && (
          <>
            <h2 id="student-progress-heading">Progress</h2>
            {learningOverview ?? (
              <>
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
              </>
            )}
          </>
        )}

        {activeSection === 'questions' && (
          <>
            <h2 id="student-questions-heading">Questions</h2>
            {learningOverview ?? (
              <QuestionPanel
                questions={dashboard.questions}
                upcoming={dashboard.upcoming_classes}
                onSubmitQuestion={readOnly ? undefined : onSubmitQuestion}
                readOnly={readOnly}
              />
            )}
          </>
        )}

        {activeSection === 'updates' && (
          <>
            <h2 id="student-updates-heading">Updates</h2>
            {learningOverview ?? <UpdatesList updates={dashboard.updates} />}
            <button
              type="button"
              className="ot-button"
              disabled={readOnly || !onPreviewSupport}
              onClick={readOnly ? undefined : onPreviewSupport}
            >
              Technical help
            </button>
            {accountSecurity}
          </>
        )}
      </PortalWorkspace>
    </section>
  );
}

type PortalSectionDefinition = {
  id: string;
  label: string;
  description: string;
};

type PortalSummaryCard = {
  section: string;
  label: string;
  value: string;
  detail: string;
};

function PortalWorkspace({
  role,
  navigationMode,
  sections,
  activeSection,
  onSelectSection,
  summaryCards,
  topControls,
  children,
}: {
  role: 'parent' | 'student';
  navigationMode: 'shell' | 'embedded';
  sections: readonly PortalSectionDefinition[];
  activeSection: string;
  onSelectSection: (section: string) => void;
  summaryCards: PortalSummaryCard[];
  topControls?: React.ReactNode;
  children: React.ReactNode;
}) {
  const active = sections.find((section) => section.id === activeSection) ?? sections[0];
  if (!active) return null;
  const roleLabel = role === 'parent' ? 'Family workspace' : 'My learning';
  return (
    <div className="ot-portal-layout" data-navigation-mode={navigationMode}>
      {navigationMode === 'embedded' && (
        <aside className="ot-portal-menu" aria-label={`${roleLabel} categories`}>
          <p className="ot-kicker">{roleLabel}</p>
          <PortalSectionButtons
            sections={sections}
            activeSection={active.id}
            onSelectSection={onSelectSection}
          />
        </aside>
      )}
      <div className="ot-portal-workspace">
        <header className="ot-portal-workspace-head">
          <div>
            <p className="ot-kicker">{roleLabel}</p>
            <h2 id={`${role}-workspace-heading`}>{active.label}</h2>
            <p>{active.description}</p>
          </div>
          {topControls}
        </header>
        {navigationMode === 'embedded' && (
          <nav className="ot-portal-subnav" aria-label={`${roleLabel} categories`}>
            <PortalSectionButtons
              sections={sections}
              activeSection={active.id}
              onSelectSection={onSelectSection}
            />
          </nav>
        )}
        <section className="ot-portal-summary-grid" aria-label={`${roleLabel} overview`}>
          {summaryCards.map((card) => (
            <article
              className="ot-portal-summary-card"
              data-active={card.section === active.id}
              key={`${card.section}-${card.label}`}
            >
              <h3>{card.label}</h3>
              <strong>{card.value}</strong>
              <p>{card.detail}</p>
            </article>
          ))}
        </section>
        <section
          className="ot-panel ot-focus-panel ot-portal-focus"
          aria-labelledby={`${role}-workspace-heading`}
        >
          {children}
        </section>
      </div>
    </div>
  );
}

function PortalSectionButtons({
  sections,
  activeSection,
  onSelectSection,
}: {
  sections: readonly PortalSectionDefinition[];
  activeSection: string;
  onSelectSection: (section: string) => void;
}) {
  return (
    <div className="ot-portal-section-buttons">
      {sections.map((section) => (
        <button
          type="button"
          aria-current={section.id === activeSection ? 'page' : undefined}
          key={section.id}
          onClick={() => onSelectSection(section.id)}
        >
          <span>{section.label}</span>
          <small>{section.description}</small>
        </button>
      ))}
    </div>
  );
}

function LearnerSwitcher({
  learners,
  selectedLearner,
  onSelect,
  onCreateLearner,
}: {
  learners: LearnerProfile[];
  selectedLearner: LearnerProfile | null;
  onSelect: (learner: LearnerProfile) => void;
  onCreateLearner?: (() => void) | undefined;
}) {
  return (
    <div className="ot-learner-switcher">
      <span>Learner</span>
      <div role="list" aria-label="Choose learner">
        {learners.map((learner) => (
          <div role="listitem" key={learner.learner_key}>
            <button
              type="button"
              aria-pressed={selectedLearner?.learner_key === learner.learner_key}
              onClick={() => onSelect(learner)}
            >
              <strong>{learner.display_name}</strong>
              <small>
                {learner.grade_label ?? 'Grade not set'} - {label(learner.learner_status)}
              </small>
            </button>
          </div>
        ))}
      </div>
      {onCreateLearner && (
        <button type="button" className="ot-button" onClick={onCreateLearner}>
          Add learner
        </button>
      )}
    </div>
  );
}

function LiveClassReadyPanel({
  questions,
  onMarkReady,
}: {
  questions: LiveClassQuestion[];
  onMarkReady?: (questionKey: string, ready: boolean) => void;
}) {
  const selected = questions.find((question) =>
    ['selected', 'student_ready', 'live'].includes(question.status),
  );
  if (!selected) return null;
  const ready = selected.status === 'student_ready' || selected.status === 'live';
  return (
    <div className="ot-live-ready" role="status">
      <div>
        <strong>Rabbi selected your question.</strong>
        <p>Enable microphone and video in Zoom when you are ready to answer.</p>
      </div>
      <div className="ot-action-row">
        <button
          type="button"
          className="ot-button"
          onClick={() => onMarkReady?.(selected.question_key, true)}
          disabled={!onMarkReady || ready}
        >
          I'm ready
        </button>
        <button
          type="button"
          className="ot-button secondary"
          onClick={() => onMarkReady?.(selected.question_key, false)}
          disabled={!onMarkReady || selected.readiness === 'declined'}
        >
          Decline
        </button>
        <span>{ready ? 'Ready sent' : selected.readiness}</span>
      </div>
    </div>
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
        {(status === 'suspended' || status === 'disabled') && (
          <p className="ot-warning" role="status">
            Student sign-in is revoked. Restore access, or send a secure reset so the learner can
            sign in again.
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
          <a
            className="ot-button"
            href={`${
              learner ? '/app/parent/classes/' : '/app/student/classes/'
            }${encodeURIComponent(item.class_key)}`}
          >
            View class details
          </a>
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

function PortalClassDetail({
  role,
  item,
  learnerName,
  onLaunch,
}: {
  role: 'parent' | 'student';
  item: UpcomingClassSummary | null;
  learnerName?: string | undefined;
  onLaunch?: ((action: ProtectedActionDescriptor) => void) | undefined;
}) {
  const calendarHref = role === 'parent' ? '/app/parent/calendar' : '/app/student/calendar';
  if (!item) {
    return (
      <section aria-labelledby={`${role}-class-detail-heading`}>
        <h2 id={`${role}-class-detail-heading`}>Class not available</h2>
        <p>This class is not available to the signed-in {role}.</p>
        <a className="ot-button" href={calendarHref}>
          Back to calendar
        </a>
      </section>
    );
  }

  return (
    <section aria-labelledby={`${role}-class-detail-heading`}>
      <p className="ot-eyebrow">{role === 'parent' ? 'Parent' : 'Student'} class detail</p>
      <h2 id={`${role}-class-detail-heading`}>{item.title}</h2>
      {learnerName ? <p>{learnerName}</p> : null}
      <p>{item.starts_at ? formatDate(item.starts_at) : 'Time not available'}</p>
      <p>Status: {label(item.status)}</p>
      {role === 'parent' ? (
        <p>Parents can review schedule and status here. Classroom entry stays Student-only.</p>
      ) : item.launch_action && onLaunch ? (
        <button
          type="button"
          className="ot-button ot-button-primary"
          onClick={() => {
            if (item.launch_action) onLaunch(item.launch_action);
          }}
        >
          {item.launch_action.label}
        </button>
      ) : (
        <p>Classroom entry is not available for this class yet.</p>
      )}
      <a className="ot-button" href={calendarHref}>
        Back to calendar
      </a>
    </section>
  );
}

function MaterialsSummary({
  library,
  reviewSheets,
  onOpen,
}: {
  library: LibraryItem[];
  reviewSheets: LibraryItem[];
  onOpen?: ((action: ProtectedActionDescriptor) => void) | undefined;
}) {
  return (
    <section className="ot-subsection" aria-labelledby="materials-heading">
      <h3 id="materials-heading">Materials</h3>
      <ContentList items={[...library, ...reviewSheets]} onOpen={onOpen} />
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
  const visibleItems = items.filter((item) => !item.content_factory?.is_demo);
  if (visibleItems.length === 0) {
    return <p className="ot-muted">Published materials will appear here.</p>;
  }
  return (
    <div className="ot-stack">
      {visibleItems.map((item) => {
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

function QuestionPanel({
  questions,
  upcoming,
  onSubmitQuestion,
  readOnly = false,
}: {
  questions: StudentQuestion[];
  upcoming: UpcomingClassSummary[];
  onSubmitQuestion?: ((question: string, classKey?: string | undefined) => void) | undefined;
  readOnly?: boolean;
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
          if (readOnly || !trimmed || !onSubmitQuestion) return;
          setPreview({ question: trimmed, classKey: classKey || undefined });
        }}
      >
        {upcoming.length > 0 && (
          <ClassPicker
            label="Class"
            items={upcoming}
            value={classKey}
            disabled={readOnly}
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
            disabled={readOnly}
            onChange={(event) => {
              setDraft(event.currentTarget.value);
              setPreview(null);
            }}
          />
        </label>
        <button
          type="submit"
          className="ot-button ot-button-primary"
          disabled={readOnly || !trimmed || !onSubmitQuestion}
        >
          Review private question
        </button>
      </form>
      {preview && (
        <div className="ot-private-preview" role="status">
          <strong>Review private question</strong>
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
  disabled = false,
  onChange,
}: {
  label: string;
  items: UpcomingClassSummary[];
  value: string;
  disabled?: boolean;
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
            disabled={disabled}
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
}: {
  rewards?: RewardBalance | undefined;
  progress?: ProgressSummary | undefined;
  history: RewardEvent[];
  gamification?: GamificationSummary | undefined;
}) {
  if (!rewards) return <p className="ot-muted">Rewards are not loaded.</p>;
  if (gamification) {
    return (
      <GamificationSummaryView
        summary={gamification}
        fallbackProgress={progress}
        fallbackRewards={rewards}
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
}: {
  summary: GamificationSummary;
  fallbackProgress?: ProgressSummary | undefined;
  fallbackRewards: RewardBalance;
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
