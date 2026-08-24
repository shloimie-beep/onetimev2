import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type {
  LiveClassConsoleSnapshot,
  LiveClassParticipant,
  LiveClassQuestion,
  LiveClassStageState,
  SessionUser,
} from '@onetime/contracts';
import {
  LIVE_CONSOLE_SECTIONS,
  adminPrimaryNav,
  liveConsoleHref,
  rabbiPrimaryNav,
  liveConsoleSectionFromSearch,
} from './admin-ia.js';
import { AppShell, type ShellNavItem, type ShellUser } from './shell/AppShell.js';
import { WorkspaceTabs } from './shell/WorkspaceTabs.js';
import './crm.css';
import { startZoomMeetingProductionBasic } from './zoom-meeting-sdk-client.ts';
import {
  confirmProductionBasicHostEnded,
  confirmProductionBasicHostLive,
  readHostProductionBasicReadiness,
  requestHostProductionBasicLaunch,
} from '../classroom/production-basic-launch-client.ts';

type ConsoleData = LiveClassConsoleSnapshot['data'];

type ApiSession = {
  authenticated: true;
  user: SessionUser;
  csrf_token: string;
  expires_at: string;
  capabilities?: {
    operator_experience?: {
      live_console?: boolean;
    };
  };
};

type Notice = { kind: 'info' | 'success' | 'error'; message: string };
type HostClassState = 'ready' | 'live' | 'closing' | 'zoom_ended' | 'access_close_failed';

function LiveApp() {
  const stageSession = stageSessionFromPath(location.pathname);
  if (stageSession) return <LiveStage stageSession={stageSession} />;
  return <LiveConsole />;
}

function requireHostZak(zak: string | undefined): string {
  if (!zak) throw new Error('Classroom is unavailable.');
  return zak;
}

function LiveConsole() {
  const [session, setSession] = useState<ApiSession | null>(null);
  const [data, setData] = useState<ConsoleData | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [productionBasicReady, setProductionBasicReady] = useState(false);
  const [hostClassState, setHostClassState] = useState<HostClassState>('ready');
  const occurrenceKey = useMemo(() => {
    const routeMatch = /^\/app\/live\/([^/]+)$/u.exec(location.pathname);
    return routeMatch?.[1]
      ? decodeURIComponent(routeMatch[1])
      : new URLSearchParams(location.search).get('occurrence_key');
  }, []);
  const section = liveConsoleSectionFromSearch(location.search);
  const liveConsoleSections = LIVE_CONSOLE_SECTIONS.map((item) => ({
    ...item,
    href: liveConsoleHref(item.id, occurrenceKey),
  }));

  async function load() {
    setLoading(true);
    try {
      const nextSession = await api<ApiSession>('/api/v1/auth/session');
      setSession(nextSession);
      const snapshot = await api<LiveClassConsoleSnapshot>(
        occurrenceKey
          ? `/api/v1/live-class/questions?occurrence_key=${encodeURIComponent(occurrenceKey)}`
          : '/api/v1/live-class/questions',
      );
      setData(snapshot.data);
      setNotice(null);
    } catch (error) {
      setNotice({ kind: 'error', message: messageFor(error, 'Live console could not load.') });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 2500);
    return () => window.clearInterval(interval);
  }, [occurrenceKey]);

  useEffect(() => {
    if (!session) return;
    void readHostProductionBasicReadiness(session.csrf_token)
      .then(setProductionBasicReady)
      .catch(() => setProductionBasicReady(false));
  }, [session?.csrf_token]);

  async function startProductionBasic() {
    if (!session) return;
    let zoomEnded = false;
    try {
      const artifact = await requestHostProductionBasicLaunch(session.csrf_token);
      let pendingAccessClose: Promise<void> | null = null;
      await startZoomMeetingProductionBasic({
        sdkWebVersion: artifact.sdk_web_version,
        meetingNumber: artifact.meeting_number,
        signature: artifact.signature,
        meetingPassword: artifact.meeting_password,
        userName: artifact.user_name,
        leaveUrl: artifact.leave_path,
        zak: requireHostZak(artifact.zak),
        onMeetingStatus: (status) => {
          if (status === 3) {
            zoomEnded = true;
            pendingAccessClose = closeProductionBasicAccess();
          }
        },
      });
      if (zoomEnded) {
        await pendingAccessClose;
        return;
      }
      await confirmProductionBasicHostLive(session.csrf_token);
      if (zoomEnded) {
        await pendingAccessClose;
        await closeProductionBasicAccess();
      } else {
        setHostClassState('live');
        setNotice({ kind: 'success', message: 'Protected class started.' });
      }
    } catch {
      if (!zoomEnded) setNotice({ kind: 'error', message: 'Classroom is unavailable.' });
    }
  }

  async function closeProductionBasicAccess() {
    if (!session) return;
    setHostClassState('closing');
    setNotice({ kind: 'info', message: 'Zoom ended. Closing One Time Student access…' });
    try {
      await confirmProductionBasicHostEnded(session.csrf_token);
      setHostClassState('zoom_ended');
      setNotice({ kind: 'success', message: 'Zoom ended. One Time Student access is closed.' });
    } catch {
      setHostClassState('access_close_failed');
      setNotice({
        kind: 'error',
        message: 'Zoom ended, but One Time Student access may still be open. Retry access close.',
      });
    }
  }

  async function postControl(path: string, body: Record<string, unknown>, label: string) {
    if (!session) return;
    try {
      await api(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': session.csrf_token },
        body: JSON.stringify({ ...body, idempotency_key: idempotencyKey(label) }),
      });
      setNotice({ kind: 'success', message: `${label} queued.` });
      await load();
    } catch (error) {
      setNotice({ kind: 'error', message: messageFor(error, `${label} failed.`) });
    }
  }

  const liveConsoleReady = session?.capabilities?.operator_experience?.live_console === true;
  const navItems: ShellNavItem[] =
    session?.user.role === 'rabbi'
      ? rabbiPrimaryNav('live-console', liveConsoleReady)
      : adminPrimaryNav('live-console', liveConsoleReady);
  const utilityItems: ShellNavItem[] = [];
  const selected = data?.selected_question ?? null;

  return (
    <AppShell
      user={session ? shellUserFromSession(session.user) : null}
      navItems={navItems}
      utilityItems={utilityItems}
      title="Live Console"
      description="One Time classroom control"
      notice={notice ? <LiveNotice notice={notice} /> : undefined}
      onNavigate={(href) => {
        window.location.assign(href);
      }}
      onLogout={() => {
        if (session) void logout(session.csrf_token);
      }}
      onSignIn={() =>
        window.location.assign(
          `/login?return_to=${encodeURIComponent(`${location.pathname}${location.search}`)}`,
        )
      }
    >
      <section className="live-console" aria-busy={loading}>
        <WorkspaceTabs
          tabs={liveConsoleSections}
          currentId={section}
          label="Live Console area"
          onNavigate={(href) => window.location.assign(href)}
        />
        <header className="live-console__header">
          <div>
            <p className="ot-kicker">Admin Console</p>
            <h2>{data?.stage.class_label ?? 'One Time live class'}</h2>
          </div>
          <div className="live-console__status">
            <StatusPill
              label="Zoom"
              value={
                productionBasicReady
                  ? 'protected recurring ready'
                  : (data?.zoom.adapter ?? 'not configured')
              }
            />
            <StatusPill label="OBS" value={data?.obs.connected ? 'connected' : 'optional off'} />
            <StatusPill label="Telegram" value="optional off" />
          </div>
        </header>

        {section === 'current-class' && (
          <section className="live-panel" aria-labelledby="live-current-class-heading">
            <h3 id="live-current-class-heading">Current Class</h3>
            <p>
              {data?.stage.class_label ?? 'One Time live class'} is the focused classroom control
              surface.
            </p>
            <details className="live-advanced">
              <summary>Advanced</summary>
              <h4>Stage and OBS</h4>
              {data && <StagePreview data={data} />}
              <div className="live-action-grid">
                <button
                  type="button"
                  className="ot-button"
                  onClick={() =>
                    selected &&
                    void postControl(
                      '/api/v1/live-class/obs/commands',
                      { action: 'feature_student', question_key: selected.question_key },
                      'OBS feature student',
                    )
                  }
                  disabled={!selected}
                >
                  OBS Featured Student
                </button>
                <button
                  type="button"
                  className="ot-button secondary"
                  onClick={() =>
                    void postControl(
                      '/api/v1/live-class/obs/commands',
                      { action: 'done' },
                      'OBS slides',
                    )
                  }
                >
                  OBS Slides
                </button>
                <button
                  type="button"
                  className="ot-button danger"
                  onClick={() =>
                    void postControl(
                      '/api/v1/live-class/obs/commands',
                      { action: 'emergency_reset' },
                      'Emergency reset',
                    )
                  }
                >
                  Emergency Reset
                </button>
              </div>
              <ObsHealth data={data} />
            </details>
          </section>
        )}

        {section === 'questions' && (
          <div className="live-console__layout">
            <section className="live-panel live-panel--queue" aria-labelledby="live-queue-heading">
              <div className="live-panel__title">
                <h3 id="live-queue-heading">Queued Questions</h3>
                <button type="button" className="ot-button secondary" onClick={() => void load()}>
                  Refresh
                </button>
              </div>
              <QuestionQueue
                questions={data?.questions ?? []}
                selectedKey={selected?.question_key ?? null}
                onSelect={(question) =>
                  void postControl(
                    `/api/v1/live-class/questions/${encodeURIComponent(question.question_key)}/select`,
                    {},
                    'Select question',
                  )
                }
                onResolve={(question, resolution) =>
                  void postControl(
                    `/api/v1/live-class/questions/${encodeURIComponent(question.question_key)}/complete`,
                    { resolution },
                    resolution.replaceAll('_', ' '),
                  )
                }
              />
            </section>
            <section
              className="live-panel live-panel--selected"
              aria-labelledby="live-selected-heading"
            >
              <div className="live-panel__title">
                <h3 id="live-selected-heading">Selected Student</h3>
                {selected && <span>{selected.status.replaceAll('_', ' ')}</span>}
              </div>
              {selected ? (
                <SelectedQuestion
                  question={selected}
                  onFeature={() =>
                    void postControl(
                      `/api/v1/live-class/questions/${encodeURIComponent(selected.question_key)}/live`,
                      {},
                      'Feature student',
                    )
                  }
                  onFinish={(resolution) =>
                    void postControl(
                      `/api/v1/live-class/questions/${encodeURIComponent(selected.question_key)}/complete`,
                      { resolution },
                      resolution === 'answered' ? 'Done' : resolution.replaceAll('_', ' '),
                    )
                  }
                />
              ) : (
                <p className="live-empty">Select a question to prepare the student.</p>
              )}
            </section>
          </div>
        )}

        {section === 'zoom' && (
          <section className="live-panel" aria-labelledby="live-zoom-heading">
            <h3 id="live-zoom-heading">Zoom</h3>
            <ZoomHealth
              data={data}
              occurrenceKey={occurrenceKey}
              productionBasicReady={productionBasicReady}
              onStartProductionBasic={() => void startProductionBasic()}
              onRetryCloseAccess={() => void closeProductionBasicAccess()}
              hostClassState={hostClassState}
              onOpenClassroom={() =>
                occurrenceKey &&
                window.location.assign(
                  `/app/live-console/zoom-host?occurrence_key=${encodeURIComponent(occurrenceKey)}`,
                )
              }
              onChooseOccurrence={() => window.location.assign('/app/classes/occurrences')}
            />
            {selected ? (
              <ZoomControls
                question={selected}
                participant={participantFor(data?.participants ?? [], selected)}
                onZoom={(operation) =>
                  void postControl(
                    '/api/v1/live-class/zoom/control',
                    { operation, question_key: selected.question_key },
                    operation.replaceAll('_', ' '),
                  )
                }
              />
            ) : (
              <p className="live-empty">Select a question before using participant controls.</p>
            )}
          </section>
        )}
      </section>
    </AppShell>
  );
}

function QuestionQueue({
  questions,
  selectedKey,
  onSelect,
  onResolve,
}: {
  questions: LiveClassQuestion[];
  selectedKey: string | null;
  onSelect: (question: LiveClassQuestion) => void;
  onResolve: (
    question: LiveClassQuestion,
    resolution: 'approved_for_board' | 'kept_private' | 'rejected',
  ) => void;
}) {
  if (questions.length === 0) return <p className="live-empty">No private questions yet.</p>;
  return (
    <div className="live-question-list">
      {questions.map((question) => (
        <article
          key={question.question_key}
          className="live-question-item"
          data-selected={question.question_key === selectedKey}
        >
          <div>
            <strong>{question.approved_display_name}</strong>
            <p>{question.question_preview}</p>
            <span>{question.status.replaceAll('_', ' ')}</span>
          </div>
          <div className="live-question-actions">
            <button
              type="button"
              className="ot-button"
              onClick={() => onSelect(question)}
              disabled={question.question_key === selectedKey}
            >
              Select
            </button>
            <button
              type="button"
              className="ot-button secondary"
              onClick={() => onResolve(question, 'kept_private')}
            >
              Keep Private
            </button>
            <button
              type="button"
              className="ot-button secondary"
              onClick={() => onResolve(question, 'rejected')}
            >
              Reject
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function SelectedQuestion({
  question,
  onFeature,
  onFinish,
}: {
  question: LiveClassQuestion;
  onFeature: () => void;
  onFinish: (resolution: 'answered' | 'approved_for_board' | 'kept_private' | 'rejected') => void;
}) {
  return (
    <div className="live-selected">
      <div className="live-selected__question">
        <strong>{question.approved_display_name}</strong>
        <p>{question.question_preview}</p>
      </div>
      <div className="live-console__status">
        <StatusPill label="Student" value={question.readiness} />
        <StatusPill label="Mic" value={question.mic_ready ? 'ready' : 'not ready'} />
        <StatusPill label="Video" value={question.video_ready ? 'ready' : 'not ready'} />
      </div>
      <div className="live-action-grid">
        <button
          type="button"
          className="ot-button"
          onClick={onFeature}
          disabled={question.status !== 'student_ready'}
        >
          Feature
        </button>
        <button type="button" className="ot-button secondary" onClick={() => onFinish('answered')}>
          Done
        </button>
        <button
          type="button"
          className="ot-button secondary"
          onClick={() => onFinish('approved_for_board')}
        >
          Approve Board
        </button>
        <button
          type="button"
          className="ot-button secondary"
          onClick={() => onFinish('kept_private')}
        >
          Keep Private
        </button>
      </div>
    </div>
  );
}

function ZoomControls({
  question,
  participant,
  onZoom,
}: {
  question: LiveClassQuestion;
  participant: LiveClassParticipant | null;
  onZoom: (
    operation: 'ask_unmute' | 'mute' | 'spotlight_replace' | 'spotlight_remove' | 'stop_video',
  ) => void;
}) {
  return (
    <div className="live-selected">
      <div className="live-selected__question">
        <strong>{question.approved_display_name}</strong>
        <p>{question.question_preview}</p>
      </div>
      <div className="live-roster-row">
        <span>{participant?.join_state ?? 'unknown'}</span>
        <span>{participant?.audio_state ?? 'unknown'}</span>
        <span>{participant?.video_state ?? 'unknown'}</span>
        <span>{participant?.spotlighted ? 'spotlighted' : 'not spotlighted'}</span>
      </div>
      <div className="live-action-grid">
        <button type="button" className="ot-button" onClick={() => onZoom('ask_unmute')}>
          Ask Unmute
        </button>
        <button type="button" className="ot-button secondary" onClick={() => onZoom('mute')}>
          Mute
        </button>
        <button
          type="button"
          className="ot-button secondary"
          onClick={() => onZoom('spotlight_replace')}
        >
          Spotlight
        </button>
        <button
          type="button"
          className="ot-button secondary"
          onClick={() => onZoom('spotlight_remove')}
        >
          Remove Spotlight
        </button>
        <button type="button" className="ot-button secondary" onClick={() => onZoom('stop_video')}>
          Stop Video
        </button>
      </div>
    </div>
  );
}

function StagePreview({ data }: { data: ConsoleData }) {
  const stageUrl = `${location.origin}/app/live-stage/${encodeURIComponent(data.stage.stage_session)}`;
  return (
    <div className="live-stage-card">
      <div>
        <span>Stage URL</span>
        <code>{stageUrl}</code>
      </div>
      <a className="ot-button secondary" href={stageUrl} target="_blank" rel="noreferrer">
        Open Stage
      </a>
    </div>
  );
}

function ObsHealth({ data }: { data: ConsoleData | null }) {
  return (
    <div className="live-health">
      <p>Scene: {data?.obs.current_scene ?? 'OT - Slides'}</p>
      <p>
        Scenes:{' '}
        {data?.obs.allowed_scenes.join(', ') ?? 'OT - Slides, OT - Featured Student, OT - Break'}
      </p>
      <p>Sources: {data?.obs.canonical_sources.join(', ') ?? 'configured locally'}</p>
      <p>Setup: {data?.obs.one_click_setup ?? 'tools/obs-bridge/README.md'}</p>
    </div>
  );
}

function ZoomHealth({
  data,
  occurrenceKey,
  onOpenClassroom,
  onChooseOccurrence,
  productionBasicReady,
  onStartProductionBasic,
  onRetryCloseAccess,
  hostClassState,
}: {
  data: ConsoleData | null;
  occurrenceKey: string | null;
  onOpenClassroom: () => void;
  onChooseOccurrence: () => void;
  productionBasicReady: boolean;
  onStartProductionBasic: () => void;
  onRetryCloseAccess: () => void;
  hostClassState: HostClassState;
}) {
  const legacyHostControlsReady = occurrenceKey && data?.zoom.host_control_configured;
  return (
    <div className="live-health">
      {productionBasicReady ? (
        <>
          <p>Surface: Protected recurring Zoom</p>
          <p>Mode: ready</p>
          <p>Schedule: Sunday–Thursday at 7:00 PM</p>
          <p>Advanced Stage Host: deferred/off</p>
        </>
      ) : (
        <>
          <p>Surface: {data?.zoom.host_surface_label ?? 'One Time Zoom Stage Host'}</p>
          <p>Mode: {data?.zoom.adapter ?? 'not configured'}</p>
          <p>Class occurrence: {occurrenceKey ?? 'none selected'}</p>
          <p>Video start model: participant consent</p>
        </>
      )}
      <p role="status">
        {productionBasicReady
          ? hostClassState === 'live'
            ? 'Class is live. Continue in Zoom’s native host controls.'
            : hostClassState === 'closing'
              ? 'Zoom ended. Closing One Time Student access…'
              : hostClassState === 'zoom_ended'
                ? 'Zoom ended. One Time Student access is closed.'
                : hostClassState === 'access_close_failed'
                  ? 'Zoom ended, but One Time Student access may still be open.'
                  : 'Protected recurring Zoom is ready. Start class only when the Rabbi is ready to begin.'
          : occurrenceKey
            ? data?.zoom.host_control_configured
              ? 'Secure host controls are ready for this class occurrence.'
              : 'Zoom is not ready for this class occurrence. An Administrator can provision it from Classroom.'
            : 'Choose a class occurrence before opening the Zoom classroom.'}
      </p>
      <div className="live-action-grid" aria-label="Zoom classroom actions">
        {productionBasicReady ? (
          hostClassState === 'live' ? (
            <button
              type="button"
              className="ot-button"
              onClick={() => document.getElementById('zmmtg-root')?.scrollIntoView()}
            >
              Continue Class
            </button>
          ) : hostClassState === 'access_close_failed' ? (
            <button type="button" className="ot-button" onClick={onRetryCloseAccess}>
              Retry access close
            </button>
          ) : hostClassState === 'zoom_ended' || hostClassState === 'closing' ? null : (
            <button type="button" className="ot-button" onClick={onStartProductionBasic}>
              Start Class
            </button>
          )
        ) : occurrenceKey && data?.zoom.host_control_configured ? (
          <button type="button" className="ot-button" onClick={onOpenClassroom}>
            Open Secure One Time Classroom
          </button>
        ) : (
          <button type="button" className="ot-button" onClick={onChooseOccurrence}>
            Choose and Provision a Class
          </button>
        )}
      </div>
      {productionBasicReady ? (
        <div id="zmmtg-root" aria-label="Protected Meeting SDK classroom" />
      ) : null}
      {productionBasicReady ? (
        <p>
          End the meeting using Zoom’s End Meeting for All control. When Zoom reports that the
          meeting ended, One Time closes Student access immediately.
        </p>
      ) : legacyHostControlsReady ? (
        <p>
          Enrolled Students join from their own protected Student portal. The Admin session never
          mints or impersonates a learner session.
        </p>
      ) : (
        <p>
          {data?.zoom.readiness.readiness_blockers.join(' ') || 'Zoom provisioning is required.'}
        </p>
      )}
    </div>
  );
}

function LiveStage({ stageSession }: { stageSession: string }) {
  const [stage, setStage] = useState<LiveClassStageState | null>(null);
  const [error, setError] = useState('');

  async function load() {
    try {
      const response = await api<{ success: true; data: LiveClassStageState }>(
        `/api/v1/live-class/stage/${encodeURIComponent(stageSession)}`,
      );
      setStage(response.data);
      setError('');
    } catch (loadError) {
      setError(messageFor(loadError, 'Stage is unavailable.'));
    }
  }

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 1500);
    return () => window.clearInterval(interval);
  }, [stageSession]);

  const question = stage?.selected_question ?? null;
  const participant = stage?.selected_participant ?? null;
  return (
    <main className="live-stage" data-scene={stage?.current_scene ?? 'OT - Slides'}>
      <section className="live-stage__video" aria-label="Selected participant video surface">
        <div className="live-stage__frame" data-video-state={participant?.video_state ?? 'unknown'}>
          <span>
            {participant?.video_state === 'on'
              ? question?.approved_display_name
              : 'Video not ready'}
          </span>
        </div>
      </section>
      <aside className="live-stage__caption">
        <p>{stage?.class_label ?? 'One Time live class'}</p>
        <h1>{question?.approved_display_name ?? 'Slides'}</h1>
        {question && <blockquote>{question.question_preview}</blockquote>}
        <div className="live-console__status">
          <StatusPill label="Mic" value={stage?.mic_ready ? 'ready' : 'not ready'} />
          <StatusPill label="Video" value={stage?.video_ready ? 'ready' : 'not ready'} />
        </div>
        {error && <span role="alert">{error}</span>}
      </aside>
    </main>
  );
}

function LiveNotice({ notice }: { notice: Notice }) {
  return (
    <div
      className={`notice-banner ${notice.kind}`}
      role={notice.kind === 'error' ? 'alert' : 'status'}
    >
      {notice.message}
    </div>
  );
}

function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="live-status-pill">
      <strong>{label}</strong>
      {value}
    </span>
  );
}

function participantFor(participants: LiveClassParticipant[], question: LiveClassQuestion) {
  return (
    participants.find((participant) => participant.customer_key === question.customer_key) ?? null
  );
}

async function logout(csrfToken: string) {
  await fetch('/api/v1/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'x-csrf-token': csrfToken },
  }).catch(() => undefined);
  window.location.assign('/login');
}

function shellUserFromSession(user: SessionUser): ShellUser {
  return {
    displayName: user.display_name,
    email: user.email,
    roleLabel: user.role === 'admin' ? 'Admin' : user.role_label,
  };
}

function stageSessionFromPath(pathname: string) {
  const match = pathname.match(/^\/app\/live-stage\/([^/]+)/);
  return match ? decodeURIComponent(match[1] ?? '') : null;
}

function idempotencyKey(label: string) {
  const normalized = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if ('crypto' in globalThis && typeof crypto.randomUUID === 'function') {
    return `live-${normalized}-${crypto.randomUUID()}`;
  }
  return `live-${normalized}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers: {
      accept: 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  const json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!response.ok || json.success === false) {
    throw new Error(typeof json.message === 'string' ? json.message : 'Request failed.');
  }
  return json as T;
}

function messageFor(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

const root = document.getElementById('live-root');
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <LiveApp />
    </React.StrictMode>,
  );
}
