import { describe, expect, it } from 'vitest';
import type { ContentPublicationRecord } from '../../../../../../../../packages/contracts/src/content/publication/index.ts';
import { buildAdminPublicationProjection } from './model.ts';

function record(state: ContentPublicationRecord['state']): ContentPublicationRecord {
  const hash = (digit: string) => digit.repeat(64);
  return {
    contentId: 'content_one',
    contentVersionId: 'content_version_one',
    contentVersionDigest: hash('1'),
    participantSetVersion: 'participant_set_v1',
    participantSnapshotSetDigest: hash('2'),
    participantReviewState: 'complete',
    unresolvedParticipantCount: 0,
    requiredRedactionCount: 1,
    completedRedactionCount: 1,
    redactionReviewDigest: hash('3'),
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
            evidence: {
              contentVersionId: 'content_version_one',
              contentVersionDigest: hash('1'),
              participantSnapshotSetDigest: hash('2'),
              participantSetVersion: 'participant_set_v1',
              participantReviewState: 'complete',
              unresolvedParticipantCount: 0,
              requiredRedactionCount: 1,
              completedRedactionCount: 1,
              redactionReviewDigest: hash('3'),
              adminAttestation: {
                attestationId: 'attestation_one',
                attestedByAdminId: 'admin_one',
                attestedAt: '2026-07-29T10:39:00.000Z',
                inspectedMediaAndMemberVisibleArtifacts: true,
                requiredRedactionsComplete: true,
              },
            },
          },
    publicationGeneration: state === 'published' ? 1 : 0,
    playbackGrantGeneration: 1,
    pendingProviderOperationId: null,
    pendingProviderRequestHash: null,
    opaqueProviderAssetRef: state === 'published' ? 'asset_private_01' : null,
    providerReadbackDigest: state === 'published' ? hash('4') : null,
    publishedAt: state === 'published' ? '2026-07-29T10:42:00.000Z' : null,
    archivedAt: null,
    occurrenceRelations: [
      {
        relationId: 'relation_one',
        occurrenceId: 'occurrence_one',
        occurrenceVersion: 1,
        canonicalSeriesId: 'series_one',
        productKey: 'one_time_mishnayos',
        governedByAdminId: 'admin_one',
        attachedAt: '2026-07-27T16:00:00.000Z',
      },
    ],
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
