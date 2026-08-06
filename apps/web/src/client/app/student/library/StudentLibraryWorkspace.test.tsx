import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  StudentLibraryDetail,
  StudentLibraryWorkspace,
  safeBootstrapPath,
} from './StudentLibraryWorkspace.tsx';

describe('P21 Student publication library workspace', () => {
  it('renders a Student-only safe library boundary without provider details', () => {
    const html = renderToStaticMarkup(
      <StudentLibraryWorkspace
        csrfToken="csrf-test"
        actorFingerprint="student-session"
        onProtectedStateCleared={() => undefined}
      />,
    );
    expect(html).toContain('Approved private lessons');
    expect(html).toContain('Search lessons');
    expect(html).not.toMatch(/vimeo|provider[_ -]?asset|approval evidence|https?:\/\//iu);
  });

  it('accepts only a live same-origin canonical bootstrap path', () => {
    const grant = {
      contentId: 'content-one',
      bootstrapPath: '/api/v1/student/library/content-one/playback',
      issuedAt: '2026-08-01T10:00:00.000Z',
      expiresAt: '2026-08-01T10:05:00.000Z',
      renewable: true as const,
    };
    expect(safeBootstrapPath(grant, new Date('2026-08-01T10:04:59.999Z'))).toBe(true);
    expect(safeBootstrapPath(grant, new Date('2026-08-01T10:05:00.000Z'))).toBe(false);
    expect(
      safeBootstrapPath(
        { ...grant, bootstrapPath: 'https://player.invalid/private' },
        new Date('2026-08-01T10:01:00.000Z'),
      ),
    ).toBe(false);
  });

  it('renders an entitled lesson detail without exposing provider data', () => {
    const html = renderToStaticMarkup(
      <StudentLibraryDetail
        loading={false}
        item={{
          contentId: 'lesson-one',
          title: 'Mishnah Berachos review',
          classTopic: 'Review the first perek',
          mishnahReferences: ['Berachos 1:1', 'Berachos 1:2'],
          occurredAt: '2026-08-01T10:00:00.000Z',
          durationMs: 900_000,
          resumePositionMs: 125_000,
          internalRoute: '/app/student/library/lesson-one',
        }}
        onOpen={() => undefined}
      />,
    );
    expect(html).toContain('Playback and review');
    expect(html).toContain('Mishnah Berachos review');
    expect(html).toContain('Berachos 1:1, Berachos 1:2');
    expect(html).toContain('15:00');
    expect(html).toContain('2:05');
    expect(html).toContain('Open protected lesson');
    expect(html).toContain('href="/app/student/library"');
    expect(html).not.toMatch(/vimeo|provider[_ -]?asset|approval evidence|https?:\/\//iu);
  });

  it('fails closed while loading and when a lesson is not assigned', () => {
    const loading = renderToStaticMarkup(
      <StudentLibraryDetail loading item={null} onOpen={() => undefined} />,
    );
    expect(loading).toContain('Loading private lesson...');
    expect(loading).not.toContain('Open protected lesson');

    const unavailable = renderToStaticMarkup(
      <StudentLibraryDetail loading={false} item={null} onOpen={() => undefined} />,
    );
    expect(unavailable).toContain('Lesson not available');
    expect(unavailable).toContain('not assigned to this Student account');
    expect(unavailable).not.toContain('Open protected lesson');
  });
});
