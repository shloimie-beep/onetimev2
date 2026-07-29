import { describe, expect, it } from 'vitest';
import type { ContentPublicationRecord } from '../../../../../../../../packages/contracts/src/content/publication/index.ts';
import { buildAdminPublicationProjection } from './model.ts';

function record(state: ContentPublicationRecord['state']): ContentPublicationRecord {
  return {
    contentId: 'content_one',
    version: 1,
    state,
    title: 'Berachos Review',
    englishTranscriptText: 'Approved transcript',
    classTopic: 'Berachos',
    mishnahReferences: ['Berachos 1:1'],
    occurredAt: '2026-07-27T16:00:00.000Z',
    updatedAt: '2026-07-27T16:00:00.000Z',
    durationMs: 3_600_000,
    approval:
      state === 'received' || state === 'needs_review'
        ? null
        : {
            approvalId: 'approval_one',
            approvedByAdminId: 'admin_one',
            approvedAt: '2026-07-29T10:40:00.000Z',
            policyVersion: 'content-publication-v1',
          },
    publicationGeneration: state === 'published' ? 1 : 0,
    opaqueProviderAssetRef: state === 'published' ? 'asset_private_01' : null,
    publishedAt: state === 'published' ? '2026-07-29T10:42:00.000Z' : null,
    archivedAt: null,
    occurrenceIds: ['occurrence_one'],
  };
}

describe('P21 Admin publication projection', () => {
  it('offers approval, publication, and unpublish only in their valid states', () => {
    expect(buildAdminPublicationProjection(record('needs_review')).allowedActions).toEqual([
      'approve',
      'attach_occurrence',
    ]);
    expect(buildAdminPublicationProjection(record('approved')).allowedActions).toEqual([
      'publish',
      'attach_occurrence',
    ]);
    expect(buildAdminPublicationProjection(record('published')).allowedActions).toEqual([
      'unpublish',
      'attach_occurrence',
    ]);
    expect(buildAdminPublicationProjection(record('archived')).allowedActions).toEqual([]);
  });
});
