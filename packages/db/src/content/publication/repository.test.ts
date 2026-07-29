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
            },
            publicationGeneration: 1,
            opaqueProviderAssetRef: 'asset_private_01',
            publishedAt: '2026-07-29T10:42:00.000Z',
            archivedAt: null,
            occurrenceIds: ['occurrence_one'],
          },
          4,
        ),
      ),
    ).rejects.toThrowError('content_publication_optimistic_conflict');
    expect(client.queries.at(-1)?.text).toBe('ROLLBACK');
    expect(client.queries.some((query) => query.text === 'COMMIT')).toBe(false);
    expect(client.released).toBe(true);
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
