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
}: {
  csrfToken: string;
  actorFingerprint: string;
  onProtectedStateCleared: () => void;
}) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<readonly StudentLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [grant, setGrant] = useState<StudentPlaybackBootstrap | null>(null);
  const [playbackStatus, setPlaybackStatus] = useState('');
  const [resumePosition, setResumePosition] = useState('0');
  const view = useMemo(() => buildStudentLibraryView({ query, items }), [query, items]);

  useEffect(() => {
    setGrant(null);
    setPlaybackStatus('');
    void search('');
  }, [actorFingerprint]);

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
    <section aria-labelledby="student-publication-library-heading">
      <header>
        <p className="ot-kicker">Approved private lessons</p>
        <h2 id="student-publication-library-heading">{view.heading}</h2>
        <p>Only lessons assigned to this Student account are available here.</p>
      </header>
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
      {loading && <p role="status">Loading private library...</p>}
      {error && (
        <p className="notice-banner error" role="alert">
          {error}
        </p>
      )}
      {!loading && !error && <p role="status">{view.resultCountLabel}</p>}
      <div>
        {view.items.map((item) => (
          <Card key={item.contentId}>
            <h3>{item.title}</h3>
            <p>{item.classTopic}</p>
            <p>{item.mishnahReferences.join(', ')}</p>
            <p>{formatDuration(item.resumePositionMs)} watched</p>
            <Button type="button" variant="primary" onClick={() => void open(item)}>
              Open protected lesson
            </Button>
          </Card>
        ))}
      </div>
      {grant && (
        <Card>
          <h3>Protected playback</h3>
          <p role="status">{playbackStatus}</p>
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
            <Button type="button" onClick={() => void saveResume()}>
              Save progress
            </Button>
            <Button type="button" onClick={() => void renew()}>
              Renew protected access
            </Button>
          </div>
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
