import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card } from '@onetime/brand-system/react';
import type { ParentWelcomeVideoSlot } from '../../../../../../../packages/contracts/src/portals/parent-welcome/index.ts';
import { joinZoomMeetingProductionBasic } from '../../zoom-meeting-sdk-client.ts';
import {
  createParentLearningApi,
  type ParentLearningApi,
  type ParentLearningActionDescriptor,
  type ParentLearningBootstrap,
  type ParentLearningLibraryItem,
  type ParentLearningSnapshot,
} from './api.ts';
import {
  createParentClassroomLaunchController,
  type ParentClassroomLaunchStatus,
  type ParentClassroomSdkJoin,
} from './classroom-launch.ts';
import { ParentWelcomeVideo } from './ParentWelcomeVideo.tsx';
import { createParentAddStudentEventController } from './welcome-video.ts';

export type ParentLearningView = 'today' | 'classroom' | 'library' | 'questions';

const unavailableWelcomeVideo: ParentWelcomeVideoSlot = {
  contract_version: '1.0.0',
  status: 'unavailable',
  reason: 'no_approved_version',
  title: 'Welcome to One Time',
  message: 'The Parent welcome video is not available yet. Your learning access is ready.',
};

const defaultNavigate = (path: string) => window.location.assign(path);
const defaultNow = () => new Date();

export function ParentLearningWorkspace({
  view,
  initial,
  api: suppliedApi,
  navigate = defaultNavigate,
  joinClassroom = joinZoomMeetingProductionBasic,
  now = defaultNow,
}: {
  view: ParentLearningView;
  initial?: ParentLearningBootstrap;
  api?: ParentLearningApi;
  navigate?: (path: string) => void;
  joinClassroom?: ParentClassroomSdkJoin;
  now?: () => Date;
}) {
  const api = useMemo(() => suppliedApi ?? createParentLearningApi(), [suppliedApi]);
  const [bootstrap, setBootstrap] = useState<ParentLearningBootstrap | null>(initial ?? null);
  const [welcomeVideo, setWelcomeVideo] = useState<ParentWelcomeVideoSlot>(unavailableWelcomeVideo);
  const [error, setError] = useState('');
  const eventCsrfToken = bootstrap?.csrf_token ?? null;
  const addStudentEvents = useMemo(
    () =>
      createParentAddStudentEventController({
        recordEvent: (command) =>
          eventCsrfToken
            ? api.recordWelcomeEvent(command, eventCsrfToken)
            : Promise.resolve(undefined),
      }),
    [api, eventCsrfToken],
  );

  useEffect(() => {
    if (initial) return undefined;
    let active = true;
    api
      .load()
      .then((next) => {
        if (active) setBootstrap(next);
      })
      .catch((cause: unknown) => {
        if (active) setError(safeError(cause));
      });
    return () => {
      active = false;
    };
  }, [api, initial]);

  useEffect(() => {
    let active = true;
    api
      .loadWelcomeVideo()
      .then((slot) => {
        if (active) setWelcomeVideo(slot);
      })
      .catch(() => {
        if (active) setWelcomeVideo(unavailableWelcomeVideo);
      });
    return () => {
      active = false;
    };
  }, [api]);

  if (!bootstrap) {
    return (
      <section className="parent-learning-workspace" aria-live="polite">
        <h2>Parent learning</h2>
        <p>{error || 'Loading your One Time learning...'} </p>
        {error ? (
          <Button
            type="button"
            onClick={() => {
              setError('');
              void api
                .load()
                .then(setBootstrap)
                .catch((cause: unknown) => setError(safeError(cause)));
            }}
          >
            Try again
          </Button>
        ) : null}
      </section>
    );
  }

  const { snapshot, csrf_token: csrfToken } = bootstrap;
  return (
    <section className="parent-learning-workspace" aria-label="Parent learning">
      {view === 'today' ? (
        <header className="parent-learning-workspace__hero">
          <p className="ot-kicker">Parent learning</p>
          <h2>
            Hi, <span dir="auto">{snapshot.display_name}</span>
          </h2>
          <p className="parent-learning-workspace__capacity">
            {parentLearnerCapacityLabel(snapshot.capacity)}
          </p>
          <div className="parent-learning-workspace__actions" aria-label="Parent learning actions">
            <a className="button-primary" href={parentLearningPrimaryHref(snapshot)}>
              See One Time now
            </a>
            {snapshot.capacity.available_child_student_seats > 0 ? (
              <a
                className="button-secondary"
                href="/app/parent/students/new"
                onClick={() =>
                  addStudentEvents.clicked(
                    welcomeVideo.status === 'ready' ? welcomeVideo.video_version_id : null,
                  )
                }
              >
                Add Student
              </a>
            ) : (
              <button type="button" className="button-secondary" disabled>
                Add Student
              </button>
            )}
          </div>
          {snapshot.capacity.available_child_student_seats === 0 ? (
            <p role="status">All 3 child learner spots are in use.</p>
          ) : null}
        </header>
      ) : null}

      {view === 'today' ? (
        <ParentToday
          snapshot={snapshot}
          welcomeVideo={welcomeVideo}
          csrfToken={csrfToken}
          api={api}
        />
      ) : null}
      {view === 'classroom' ? (
        <ParentClassroom
          snapshot={snapshot}
          csrfToken={csrfToken}
          api={api}
          joinClassroom={joinClassroom}
          now={now}
        />
      ) : null}
      {view === 'library' ? (
        <ParentLibrary snapshot={snapshot} api={api} navigate={navigate} />
      ) : null}
      {view === 'questions' ? (
        <ParentQuestions snapshot={snapshot} csrfToken={csrfToken} api={api} />
      ) : null}
    </section>
  );
}

function ParentToday({
  snapshot,
  welcomeVideo,
  csrfToken,
  api,
}: {
  snapshot: ParentLearningSnapshot;
  welcomeVideo: ParentWelcomeVideoSlot;
  csrfToken: string;
  api: ParentLearningApi;
}) {
  return (
    <div className="parent-learning-workspace__grid">
      <Card>
        <p className="ot-kicker">Next class</p>
        <h2>{snapshot.next_class?.title ?? snapshot.class_entitlement.class_title}</h2>
        {snapshot.next_class ? (
          <p>{formatClassTime(snapshot.next_class.starts_at)}</p>
        ) : (
          <p>Your next class will appear here as soon as it is scheduled.</p>
        )}
        <a href="/app/parent/classroom">Open Classroom</a>
      </Card>
      <Card>
        <p className="ot-kicker">Your learning</p>
        <h2>One Parent learner profile</h2>
        <dl className="parent-learning-workspace__activity">
          <div>
            <dt>Classes attended</dt>
            <dd>{snapshot.activity.attended_occurrence_count}</dd>
          </div>
          <div>
            <dt>Questions sent</dt>
            <dd>{snapshot.activity.submitted_question_count}</dd>
          </div>
        </dl>
      </Card>
      <Card>
        <p className="ot-kicker">Welcome</p>
        {welcomeVideo.status === 'unavailable' ? (
          <>
            <h2>{welcomeVideo.title}</h2>
            <p>{welcomeVideo.message}</p>
          </>
        ) : (
          <ParentWelcomeVideo
            key={welcomeVideo.video_version_id}
            slot={welcomeVideo}
            csrfToken={csrfToken}
            api={api}
          />
        )}
      </Card>
    </div>
  );
}

function ParentClassroom({
  snapshot,
  csrfToken,
  api,
  joinClassroom,
  now,
}: {
  snapshot: ParentLearningSnapshot;
  csrfToken: string;
  api: ParentLearningApi;
  joinClassroom: ParentClassroomSdkJoin;
  now: () => Date;
}) {
  const [status, setStatus] = useState<ParentClassroomLaunchStatus>('idle');
  const launchAction = snapshot.next_class?.launch_action ?? null;
  const launchController = useMemo(
    () =>
      createParentClassroomLaunchController({
        requestArtifact: (action, token) => api.launchClass(action, token),
        joinMeeting: joinClassroom,
        recordAttendance: (command, token) => api.recordAttendance(command, token),
        now,
        onStatus: setStatus,
      }),
    [api, joinClassroom, now],
  );

  useEffect(() => {
    launchController.activate();
    return () => launchController.dispose();
  }, [launchController]);

  return (
    <Card>
      <p className="ot-kicker">Parent learner</p>
      <h2>Next class</h2>
      {snapshot.next_class ? (
        <>
          <h3>{snapshot.next_class.title}</h3>
          <p>{formatClassTime(snapshot.next_class.starts_at)}</p>
          {launchAction ? (
            <Button
              type="button"
              disabled={status !== 'idle'}
              onClick={() =>
                void launchController.launch(
                  launchAction,
                  csrfToken,
                  snapshot.next_class!.occurrence_id,
                )
              }
            >
              {classLaunchLabel(status, launchAction)}
            </Button>
          ) : (
            <p>Joining is not available for this class yet.</p>
          )}
          {status === 'connected' ? <p role="status">Classroom connected.</p> : null}
          {status === 'connection_error' ? (
            <div role="alert">
              <p>The classroom connection stopped before it opened.</p>
              <Button type="button" onClick={() => void launchController.retryConnection()}>
                Try connection again
              </Button>
            </div>
          ) : null}
          {status === 'unknown_effect' ? (
            <div role="alert">
              <p>
                We could not confirm the classroom launch. To prevent a duplicate launch, refresh
                the classroom status before trying again.
              </p>
              <a href="/app/parent/classroom">Refresh classroom status</a>
            </div>
          ) : null}
          <div
            id="zmmtg-root"
            className="parent-learning-workspace__classroom-sdk"
            aria-live="polite"
          />
        </>
      ) : (
        <p>No upcoming Parent class is scheduled yet.</p>
      )}
    </Card>
  );
}

function ParentLibrary({
  snapshot,
  api,
  navigate,
}: {
  snapshot: ParentLearningSnapshot;
  api: ParentLearningApi;
  navigate: (path: string) => void;
}) {
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  function open(item: ParentLearningLibraryItem) {
    if (openingId) return;
    setOpeningId(item.content_id);
    setErrorId(null);
    void api
      .openContent(item.open_action)
      .then((action) => navigate(action.href))
      .catch(() => {
        setOpeningId(null);
        setErrorId(item.content_id);
      });
  }

  return (
    <Card>
      <p className="ot-kicker">Parent learner</p>
      <h2>Lessons</h2>
      {snapshot.library_items.length === 0 ? (
        <p>No entitled lessons are available yet.</p>
      ) : (
        <ul className="parent-learning-workspace__library">
          {snapshot.library_items.map((item) => (
            <li key={item.content_id}>
              <div>
                <p className="ot-kicker">Video</p>
                <h3>{item.title}</h3>
              </div>
              <Button type="button" disabled={openingId !== null} onClick={() => open(item)}>
                {openingId === item.content_id ? 'Opening lesson...' : item.open_action.label}
              </Button>
              {errorId === item.content_id ? (
                <p role="alert">This lesson could not be opened. Try again.</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ParentQuestions({
  snapshot,
  csrfToken,
  api,
}: {
  snapshot: ParentLearningSnapshot;
  csrfToken: string;
  api: ParentLearningApi;
}) {
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  return (
    <Card>
      <p className="ot-kicker">Parent learner</p>
      <h2>Ask Rabbi Eli</h2>
      <p>Questions sent here belong to your Parent learner profile.</p>
      <form
        className="parent-learning-workspace__question"
        onSubmit={(event) => {
          event.preventDefault();
          const privateBody = draft.trim();
          if (privateBody.length < 3 || status === 'saving') return;
          setStatus('saving');
          void api
            .submitQuestion(
              {
                class_series_key: snapshot.class_entitlement.class_series_key,
                private_body: privateBody,
              },
              csrfToken,
            )
            .then(() => {
              setDraft('');
              setStatus('saved');
            })
            .catch(() => setStatus('error'));
        }}
      >
        <label htmlFor="parent-learning-question">Ask a private question</label>
        <textarea
          id="parent-learning-question"
          required
          minLength={3}
          maxLength={2_000}
          value={draft}
          onChange={(event) => {
            setDraft(event.currentTarget.value);
            setStatus('idle');
          }}
        />
        <Button type="submit" disabled={status === 'saving' || draft.trim().length < 3}>
          {status === 'saving' ? 'Sending...' : 'Send question'}
        </Button>
        {status === 'saved' ? <p role="status">Question sent.</p> : null}
        {status === 'error' ? (
          <p role="alert">Your question could not be sent. Try again.</p>
        ) : null}
      </form>
    </Card>
  );
}

export function parentLearningPrimaryHref(_snapshot: ParentLearningSnapshot) {
  return '/app/parent/classroom';
}

export function parentClassroomDocumentNavigationRequired(
  currentPathname: string,
  targetPathname: string,
) {
  return currentPathname === '/app/parent/classroom' || targetPathname === '/app/parent/classroom';
}

export function parentLearnerCapacityLabel(snapshot: ParentLearningSnapshot['capacity']) {
  return `Parent learner + ${snapshot.active_child_students} of ${snapshot.child_student_limit} child learners`;
}

function classLaunchLabel(
  status: ParentClassroomLaunchStatus,
  action: ParentLearningActionDescriptor,
) {
  if (status === 'requesting') return 'Requesting classroom...';
  if (status === 'joining') return 'Opening classroom...';
  if (status === 'connected') return 'Classroom connected';
  return action.label;
}

function formatClassTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Class time is being confirmed.';
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed);
}

function safeError(cause: unknown) {
  return cause instanceof Error ? cause.message : 'Parent learning is unavailable right now.';
}
