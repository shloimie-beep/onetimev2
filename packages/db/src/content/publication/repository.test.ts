import { describe, expect, it } from 'vitest';
import {
  createPostgresContentPublicationRepository,
  type ContentPublicationSqlClient,
} from './repository.ts';

describe('P21 PostgreSQL publication repository', () => {
  it('uses a transaction and parameterized Student-scoped resume insert', async () => {
    const client = new CapturingClient();
    const repository = createPostgresContentPublicationRepository({
      connect: async () => client,
    });

    await repository.inTransaction((unit) =>
      unit.saveResume(
        {
          studentId: 'student_one',
          householdId: 'household_one',
          contentId: 'content_one',
          publicationVersion: 4,
          positionMs: 125_000,
          updatedAt: '2026-07-29T10:46:00.000Z',
          version: 1,
        },
        null,
      ),
    );

    expect(client.queries.map((query) => query.text.trim().split(/\s+/)[0])).toEqual([
      'BEGIN',
      'INSERT',
      'COMMIT',
    ]);
    const insert = client.queries[1];
    expect(insert?.text).toContain('ON CONFLICT (student_id, content_id) DO NOTHING');
    expect(insert?.values?.slice(0, 6)).toEqual([
      'student_one',
      'household_one',
      'content_one',
      4,
      125_000,
      1,
    ]);
    expect(client.released).toBe(true);
  });

  it('rolls back an optimistic conflict without a partial commit', async () => {
    const client = new CapturingClient(true);
    const repository = createPostgresContentPublicationRepository({
      connect: async () => client,
    });

    await expect(
      repository.inTransaction((unit) =>
        unit.saveContent(
          {
            contentId: 'content_one',
            contentVersionId: 'content_version_one',
            contentVersionDigest: '1'.repeat(64),
            participantSetVersion: 'participant_set_v1',
            participantSnapshotSetDigest: '2'.repeat(64),
            participantReviewState: 'complete',
            unresolvedParticipantCount: 0,
            requiredRedactionCount: 1,
            completedRedactionCount: 1,
            redactionReviewDigest: '3'.repeat(64),
            version: 5,
            state: 'published',
            title: 'Berachos Review',
            englishTranscriptText: 'Approved transcript',
            classTopic: 'Berachos',
            mishnahReferences: ['Berachos 1:1'],
            occurredAt: '2026-07-27T16:00:00.000Z',
            updatedAt: '2026-07-29T10:42:00.000Z',
            durationMs: 3_600_000,
            approval: {
              approvalId: 'approval_one',
              approvedByAdminId: 'admin_one',
              approvedAt: '2026-07-29T10:40:00.000Z',
              policyVersion: 'content-publication-v1',
              evidence: {
                contentVersionId: 'content_version_one',
                contentVersionDigest: '1'.repeat(64),
                participantSnapshotSetDigest: '2'.repeat(64),
                participantSetVersion: 'participant_set_v1',
                participantReviewState: 'complete',
                unresolvedParticipantCount: 0,
                requiredRedactionCount: 1,
                completedRedactionCount: 1,
                redactionReviewDigest: '3'.repeat(64),
                adminAttestation: {
                  attestationId: 'attestation_one',
                  attestedByAdminId: 'admin_one',
                  attestedAt: '2026-07-29T10:39:00.000Z',
                  inspectedMediaAndMemberVisibleArtifacts: true,
                  requiredRedactionsComplete: true,
                },
              },
            },
            publicationGeneration: 1,
            playbackGrantGeneration: 1,
            pendingProviderOperationId: null,
            pendingProviderRequestHash: null,
            opaqueProviderAssetRef: 'asset_private_01',
            providerReadbackDigest: '4'.repeat(64),
            publishedAt: '2026-07-29T10:42:00.000Z',
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
          },
          4,
        ),
      ),
    ).rejects.toThrowError('content_publication_optimistic_conflict');
    expect(client.queries.at(-1)?.text).toBe('ROLLBACK');
    expect(client.queries.some((query) => query.text === 'COMMIT')).toBe(false);
    expect(client.released).toBe(true);
  });

  it('writes versioned assignments, library projections, and protected notices in one transaction', async () => {
    const client = new CapturingClient();
    const repository = createPostgresContentPublicationRepository({
      connect: async () => client,
    });

    await repository.inTransaction((unit) =>
      unit.savePublicationMaterialization({
        contentId: 'content_one',
        contentVersionId: 'content_version_one',
        publicationGeneration: 1,
        assignments: [
          {
            assignmentId: 'assignment_one',
            assignmentVersion: 1,
            contentId: 'content_one',
            contentVersionId: 'content_version_one',
            publicationGeneration: 1,
            studentId: 'student_one',
            householdId: 'household_one',
            occurrenceId: 'occurrence_one',
            studentVersion: 5,
            enrollmentVersion: 6,
            accessVersion: 7,
            serviceAccountConsentVersion: 8,
            privacyVersion: 9,
            revocationVersion: 10,
            active: true,
            revokedAt: null,
          },
        ],
        libraryProjections: [
          {
            projectionId: 'projection_one',
            assignmentId: 'assignment_one',
            assignmentVersion: 1,
            contentId: 'content_one',
            contentVersionId: 'content_version_one',
            publicationGeneration: 1,
            studentId: 'student_one',
            householdId: 'household_one',
            internalRoute: '/app/student/library/content_one',
            active: true,
            createdAt: '2026-07-29T10:44:00.000Z',
          },
        ],
        notices: [
          {
            noticeId: 'notice_student_one',
            recipientKind: 'student',
            recipientId: 'student_one',
            studentId: 'student_one',
            householdId: 'household_one',
            category: 'recording_available',
            contentId: 'content_one',
            contentVersionId: 'content_version_one',
            sourceVersion: 4,
            title: 'New recording available',
            body: 'Berachos Review is ready in your library.',
            actionLabel: 'Watch recording',
            actionPath: '/app/student/library/content_one',
            deliveryState: 'pending',
            createdAt: '2026-07-29T10:44:00.000Z',
          },
          {
            noticeId: 'notice_adult_one',
            recipientKind: 'adult',
            recipientId: 'adult_one',
            studentId: 'student_one',
            householdId: 'household_one',
            category: 'recording_available',
            contentId: 'content_one',
            contentVersionId: 'content_version_one',
            sourceVersion: 4,
            title: 'New recording available',
            body: 'A recording is available for the household.',
            actionLabel: 'Open household',
            actionPath: '/app/parent',
            deliveryState: 'pending',
            createdAt: '2026-07-29T10:44:00.000Z',
          },
        ],
      }),
    );

    const sql = client.queries.map((query) => query.text).join('\n');
    expect(sql).toContain('onetime.student_content_assignments');
    expect(sql).toContain('onetime.student_library_projections');
    expect(sql.match(/onetime\.protected_recording_notices/g)).toHaveLength(2);
    expect(client.queries[0]?.text).toBe('BEGIN');
    expect(client.queries.at(-1)?.text).toBe('COMMIT');
  });
});

class CapturingClient implements ContentPublicationSqlClient {
  readonly queries: { text: string; values?: readonly unknown[] }[] = [];
  released = false;

  constructor(private readonly failUpdates = false) {}

  async query<Row extends Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: Row[]; rowCount: number }> {
    this.queries.push(values === undefined ? { text } : { text, values });
    return {
      rows: [],
      rowCount: this.failUpdates && text.includes('UPDATE') ? 0 : 1,
    };
  }

  release() {
    this.released = true;
  }
}
