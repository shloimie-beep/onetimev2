import type {
  StudentLibraryItem,
  StudentPlaybackGrant,
} from '../../../../../../../packages/contracts/src/content/publication/index.ts';

export interface StudentLibraryView {
  heading: 'Library';
  query: string;
  resultCountLabel: string;
  items: readonly StudentLibraryItem[];
}

export function buildStudentLibraryView(input: {
  query: string;
  items: readonly StudentLibraryItem[];
}): StudentLibraryView {
  const query = input.query.trim().replace(/\s+/g, ' ');
  return {
    heading: 'Library',
    query,
    resultCountLabel: `${input.items.length} ${input.items.length === 1 ? 'lesson' : 'lessons'}`,
    items: input.items.map((item) => ({ ...item, mishnahReferences: [...item.mishnahReferences] })),
  };
}

export function safePlaybackBootstrap(grant: StudentPlaybackGrant, now: Date) {
  const expiresAt = new Date(grant.expiresAt);
  if (
    !Number.isFinite(now.getTime()) ||
    !Number.isFinite(expiresAt.getTime()) ||
    expiresAt.getTime() <= now.getTime() ||
    !/^\/api\/v1\/student\/library\/[A-Za-z0-9._%:-]+\/playback$/.test(grant.bootstrapPath) ||
    grant.bootstrapPath.includes('?') ||
    grant.bootstrapPath.includes('#')
  ) {
    return null;
  }
  return grant.bootstrapPath;
}
