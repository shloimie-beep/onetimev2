import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StudentLibraryWorkspace, safeBootstrapPath } from './StudentLibraryWorkspace.tsx';

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
});
