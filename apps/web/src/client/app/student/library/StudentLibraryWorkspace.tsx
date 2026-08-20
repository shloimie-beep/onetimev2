import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Input } from '@onetime/brand-system/react';
import type { StudentLibraryItem } from '../../../../../../../packages/contracts/src/content/publication/index.ts';
import {
  PortalApiError,
  bootstrapStudentPublicationPlayback,
  readStudentPublicationPlayback,
  renewStudentPublicationPlayback,
  saveStudentPublicationResume,
  searchStudentPublicationLibrary,
  type StudentPlaybackBootstrap,
} from '../../portal-api.ts';
import { buildStudentLibraryView } from './model.ts';

export function StudentLibraryWorkspace({
  csrfToken,
  actorFingerprint,
  onProtectedStateCleared,
  selectedContentId,
}: {
  csrfToken: string;
  actorFingerprint: string;
  onProtectedStateCleared: () => void;
  selectedContentId?: string | null | undefined;
}) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<readonly StudentLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [grant, setGrant] = useState<StudentPlaybackBootstrap | null>(null);
  const [playbackStatus, setPlaybackStatus] = useState('');
  const [resumePosition, setResumePosition] = useState('0');
  const view = useMemo(() => buildStudentLibraryView({ query, items }), [query, items]);
  const detailMode = selectedContentId !== undefined;
  const selectedItem =
    typeof selectedContentId === 'string'
      ? (view.items.find((item) => item.contentId === selectedContentId) ?? null)
      : null;

  useEffect(() => {
    setGrant(null);
    setPlaybackStatus('');
    setItems([]);
    void search('');
  }, [actorFingerprint, selectedContentId]);

  async function search(nextQuery = query) {
    setLoading(true);
    setError('');
    try {
      setItems(await searchStudentPublicationLibrary({ csrfToken, query: nextQuery.trim() }));
    } catch (requestError) {
      handleError(requestError);
    } finally {
      setLoading(false);
    }
  }

  async function open(item: StudentLibraryItem) {
    setError('');
    setPlaybackStatus('');
    try {
      const nextGrant = await bootstrapStudentPublicationPlayback({
        csrfToken,
        contentId: item.contentId,
      });
      if (!safeBootstrapPath(nextGrant)) throw new Error('Protected playback is unavailable.');
      const readback = await readStudentPublicationPlayback(nextGrant.bootstrapPath);
      if (!readback.authorized || readback.contentId !== item.contentId) {
        throw new Error('Protected playback is unavailable.');
      }
      setGrant(nextGrant);
      setResumePosition(String(item.resumePositionMs));
      setPlaybackStatus(`Protected playback authorized until ${formatTime(nextGrant.expiresAt)}.`);
    } catch (requestError) {
      handleError(requestError);
    }
  }

  async function renew() {
    if (!grant) return;
    try {
      const nextGrant = await renewStudentPublicationPlayback({
        csrfToken,
        contentId: grant.contentId,
      });
      if (!safeBootstrapPath(nextGrant)) throw new Error('Protected playback is unavailable.');
      setGrant(nextGrant);
      setPlaybackStatus(`Protected playback renewed until ${formatTime(nextGrant.expiresAt)}.`);
    } catch (requestError) {
      handleError(requestError);
    }
  }

  async function saveResume() {
    if (!grant) return;
    const positionMs = Number(resumePosition);
    if (!Number.isSafeInteger(positionMs) || positionMs < 0) {
      setError('Enter a valid resume position.');
      return;
    }
    try {
      const saved = await saveStudentPublicationResume({
        csrfToken,
        contentId: grant.contentId,
        positionMs,
      });
      setPlaybackStatus(`Resume position saved at ${formatDuration(saved.positionMs)}.`);
    } catch (requestError) {
      handleError(requestError);
    }
  }

  function handleError(requestError: unknown) {
    if (requestError instanceof PortalApiError && requestError.status === 401) {
      onProtectedStateCleared();
    }
    setError(requestError instanceof Error ? requestError.message : 'The library is unavailable.');
  }

  return (
    <div className="student-publication-library">
      <header>
        <p className="ot-kicker">Approved private lessons</p>
        <h3 id="student-publication-library-heading">
          {detailMode ? 'Lesson details' : 'Private lesson search'}
        </h3>
        <p>
          {detailMode
            ? 'Playback and review stay inside this Student account.'
            : 'Only lessons assigned to this Student account are available here.'}
        </p>
      </header>
      {!detailMode && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void search();
          }}
        >
          <label>
            <span>Search lessons</span>
            <Input
              value={query}
              maxLength={120}
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
          </label>
          <Button type="submit" disabled={loading}>
            Search
          </Button>
        </form>
      )}
      {loading && !detailMode && <p role="status">Loading private library...</p>}
      {error && (
        <p className="notice-banner error" role="alert">
          {error}
        </p>
      )}
      {detailMode ? (
        <StudentLibraryDetail
          item={selectedItem}
          loading={loading}
          unavailable={!error}
          onOpen={(item) => void open(item)}
        />
      ) : (
        <>
          {!loading && !error && (
            <p role="status">
              {view.items.length === 0
                ? 'The class library is being migrated. Recordings and review materials will begin appearing soon.'
                : view.resultCountLabel}
            </p>
          )}
          <div>
            {view.items.map((item) => (
              <Card key={item.contentId}>
                <h3>{item.title}</h3>
                <p>{item.classTopic}</p>
                <p>{item.mishnahReferences.join(', ')}</p>
                <p>{formatDuration(item.resumePositionMs)} watched</p>
                <a
                  className="ot-button ot-button-primary"
                  href={`/app/student/library/${encodeURIComponent(item.contentId)}`}
                >
                  View lesson details
                </a>
              </Card>
            ))}
          </div>
        </>
      )}
      {grant && detailMode && (
        <Card>
          <h3>Protected playback</h3>
          <p role="status">{playbackStatus}</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void saveResume();
            }}
          >
            <label>
              <span>Resume position in milliseconds</span>
              <Input
                type="number"
                min="0"
                value={resumePosition}
                onChange={(event) => setResumePosition(event.currentTarget.value)}
              />
            </label>
            <div className="ot-action-row">
              <Button type="submit">Save progress</Button>
              <Button type="button" onClick={() => void renew()}>
                Renew protected access
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}

export function StudentLibraryDetail({
  item,
  loading,
  unavailable = true,
  onOpen,
}: {
  item: StudentLibraryItem | null;
  loading: boolean;
  unavailable?: boolean;
  onOpen: (item: StudentLibraryItem) => void;
}) {
  return (
    <section aria-labelledby="student-library-detail-heading">
      <a href="/app/student/library">Back to library</a>
      {loading && <p role="status">Loading private lesson...</p>}
      {!loading && !item && unavailable && (
        <div className="ot-empty" role="status">
          <h3 id="student-library-detail-heading">Lesson not available</h3>
          <p>This lesson is not assigned to this Student account.</p>
        </div>
      )}
      {!loading && item && (
        <Card>
          <p className="ot-kicker">Playback and review</p>
          <h3 id="student-library-detail-heading">{item.title}</h3>
          <p>{item.classTopic}</p>
          <dl>
            <div>
              <dt>Mishnah references</dt>
              <dd>{item.mishnahReferences.join(', ') || 'No references listed'}</dd>
            </div>
            <div>
              <dt>Lesson length</dt>
              <dd>{formatDuration(item.durationMs)}</dd>
            </div>
            <div>
              <dt>Resume from</dt>
              <dd>{formatDuration(item.resumePositionMs)}</dd>
            </div>
          </dl>
          <Button type="button" variant="primary" onClick={() => onOpen(item)}>
            Open protected lesson
          </Button>
        </Card>
      )}
    </section>
  );
}

export function safeBootstrapPath(grant: StudentPlaybackBootstrap, now = new Date()) {
  const expiresAt = new Date(grant.expiresAt);
  return (
    Number.isFinite(now.getTime()) &&
    Number.isFinite(expiresAt.getTime()) &&
    expiresAt.getTime() > now.getTime() &&
    /^\/api\/v1\/student\/library\/[A-Za-z0-9._%:-]+\/playback$/u.test(grant.bootstrapPath) &&
    !grant.bootstrapPath.includes('?') &&
    !grant.bootstrapPath.includes('#')
  );
}

function formatDuration(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : 'expiry';
}
