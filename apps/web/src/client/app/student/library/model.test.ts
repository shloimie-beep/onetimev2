import { describe, expect, it } from 'vitest';
import type { StudentPlaybackGrant } from '../../../../../../../packages/contracts/src/content/publication/index.ts';
import { buildStudentLibraryView, safePlaybackBootstrap } from './model.ts';

describe('P21 Student library client boundary', () => {
  it('projects safe internal library items and truthful result counts', () => {
    const view = buildStudentLibraryView({
      query: '  Berachos   1:1 ',
      items: [
        {
          contentId: 'content_one',
          title: 'Berachos Review',
          classTopic: 'Berachos',
          mishnahReferences: ['Berachos 1:1'],
          occurredAt: '2026-07-27T16:00:00.000Z',
          durationMs: 3_600_000,
          resumePositionMs: 125_000,
          internalRoute: '/app/student/library/content_one',
        },
      ],
    });
    expect(view).toMatchObject({
      heading: 'Library',
      query: 'Berachos 1:1',
      resultCountLabel: '1 lesson',
    });
    expect(JSON.stringify(view)).not.toMatch(/vimeo|https?:|providerAsset/i);
  });

  it('accepts only a live canonical same-origin playback bootstrap', () => {
    const grant: StudentPlaybackGrant = {
      contentId: 'content_one',
      publicationVersion: 4,
      playbackSessionId: 'session_one',
      bootstrapPath: '/api/v1/student/library/content_one/playback',
      issuedAt: '2026-07-29T10:45:00.000Z',
      expiresAt: '2026-07-29T10:50:00.000Z',
      renewable: true,
    };
    expect(safePlaybackBootstrap(grant, new Date('2026-07-29T10:49:59.999Z'))).toBe(
      grant.bootstrapPath,
    );
    expect(safePlaybackBootstrap(grant, new Date('2026-07-29T10:50:00.000Z'))).toBeNull();
    expect(
      safePlaybackBootstrap(
        { ...grant, bootstrapPath: 'https://player.invalid/private' },
        new Date('2026-07-29T10:49:00.000Z'),
      ),
    ).toBeNull();
  });
});
