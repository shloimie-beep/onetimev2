import { describe, expect, it, vi } from 'vitest';
import type { DbPool } from '../../../../../../../packages/db/src/index.ts';
import type { ParentLearningPrincipal } from '../../../../../../../packages/contracts/src/portals/parent-learning/index.ts';
import { createPostgresParentLearningRepository } from './postgres-repository.ts';

const principal: ParentLearningPrincipal = {
  role: 'parent',
  adult_id: 'adult-1',
  human_account_id: 'account-1',
  household_id: 'household-1',
  session_id: 'session-1',
};

describe('PostgreSQL Parent learning repository', () => {
  it('loads only the authenticated Parent participant and Parent-owned facts', async () => {
    const query = vi.fn(async (text: string, _values: readonly unknown[] = []) => {
      if (text.includes('SELECT item.content_item_key AS content_id')) {
        return {
          rowCount: 1,
          rows: [
            {
              content_id: 'content-shavuos',
              content_version_id: 'revision-shavuos-1',
              title: 'Shavuos review',
              item_type: 'video',
              published_at: '2026-07-19T10:00:00.000Z',
              position_ms: 30_000,
              duration_ms: 90_000,
              completed: false,
              progress_updated_at: '2026-08-16T11:00:00.000Z',
            },
          ],
        };
      }
      return {
        rowCount: 1,
        rows: [
          {
            participant_id: 'parent:household-1',
            adult_id: 'adult-1',
            human_account_id: 'account-1',
            household_id: 'household-1',
            display_name: 'Ari Levi',
            participant_state: 'active',
            learner_ordinal: 1,
            active_seat_count: 1,
            account_key: 'one_time',
            class_series_key: 'class_series_one_time_daily',
            class_title: 'Daily One Time Mishnayos',
            effective_at: '2026-08-16T10:00:00.000Z',
            next_occurrence_id: 'occurrence-live',
            next_starts_at: '2026-08-16T11:55:00.000Z',
            next_ends_at: '2026-08-16T12:55:00.000Z',
            next_join_opens_at: '2026-08-16T11:45:00.000Z',
            next_join_closes_at: '2026-08-16T13:15:00.000Z',
            next_state: 'ready',
            next_live_confirmed_at: '2026-08-16T11:59:00.000Z',
            next_live_expires_at: '2026-08-16T13:59:00.000Z',
            next_live_meeting_ref_digest: 'd'.repeat(64),
            attended_occurrence_count: 2,
            started_content_count: 3,
            completed_content_count: 1,
            submitted_question_count: 4,
          },
        ],
      };
    });
    const repository = createPostgresParentLearningRepository({ query } as unknown as DbPool, {
      accountKey: 'one_time',
      productionBasicMeetingRefDigest: 'd'.repeat(64),
      clock: () => new Date('2026-08-16T12:00:00.000Z'),
    });

    await expect(repository.loadOwnedParticipant(principal)).resolves.toMatchObject({
      participant_id: 'parent:household-1',
      learner_ordinal: 1,
      activity: { attended_occurrence_count: 2, submitted_question_count: 4 },
      next_class: {
        occurrence_id: 'occurrence-live',
        state: 'live',
        launch_action: {
          method: 'POST',
          href: '/api/v1/classroom/production-basic/launch',
          launch_token_ref: null,
        },
      },
      library_items: [
        {
          content_id: 'content-shavuos',
          content_version_id: 'revision-shavuos-1',
          progress: { position_ms: 30_000, duration_ms: 90_000, completed: false },
        },
      ],
    });
    const sql = String(query.mock.calls[0]?.[0]);
    expect(sql).toContain('parent_learning_participants');
    expect(sql).toContain('parent_learning_attendance_events');
    expect(sql).toContain('parent_learning_content_progress_events');
    expect(sql).toContain('parent_learning_questions');
    expect(sql).not.toMatch(/student_content|classroom_attendance_projection_v21/u);
    expect(query.mock.calls[0]?.[1]).toEqual([
      'one_time',
      'adult-1',
      'account-1',
      'household-1',
      'session-1',
      '2026-08-16T12:00:00.000Z',
      'd'.repeat(64),
    ]);
    const librarySql = String(query.mock.calls[1]?.[0]);
    expect(librarySql).toContain('content_item_entitlements');
    expect(librarySql).toContain("item.item_type = 'video'");
    expect(librarySql).toContain("content_entitlement.audience = 'all_active_learners'");
    expect(librarySql).toContain("content_entitlement.audience = 'household'");
    expect(librarySql).toContain('parent_learning_content_progress_events');
    expect(librarySql).not.toMatch(/portal_learners|student_id|learner_key/u);
  });

  it('rechecks Parent session, household entitlement, and publication before opening content', async () => {
    const query = vi.fn(async (text: string, _values: readonly unknown[] = []) => {
      expect(text).toContain('content_item_entitlements');
      expect(text).toContain("session.active_role = 'parent'");
      expect(text).toContain("participant.participant_kind = 'parent'");
      expect(text).not.toMatch(/portal_learners|student_id|learner_key/u);
      return {
        rowCount: 1,
        rows: [
          {
            content_id: 'content-shavuos',
            content_version_id: 'revision-shavuos-1',
            title: 'Shavuos review',
            item_type: 'video',
            published_at: '2026-07-19T10:00:00.000Z',
            progress_updated_at: null,
          },
        ],
      };
    });
    const repository = createPostgresParentLearningRepository({ query } as unknown as DbPool, {
      accountKey: 'one_time',
      clock: () => new Date('2026-08-16T12:00:00.000Z'),
    });

    await expect(
      repository.loadContentOpenTarget({
        principal,
        participant_id: 'parent:household-1',
        content_id: 'content-shavuos',
      }),
    ).resolves.toEqual({ content_id: 'content-shavuos', item_type: 'video' });
    expect(query.mock.calls[0]?.[1]).toEqual([
      'one_time',
      'parent:household-1',
      'adult-1',
      'account-1',
      'household-1',
      'session-1',
      '2026-08-16T12:00:00.000Z',
      'content-shavuos',
    ]);
  });

  it('resolves the governed duration for the exact published content version across both protected sources', async () => {
    const query = vi.fn(async (sql: string, values: readonly unknown[] = []) => {
      expect(sql).toContain('learning_delivery_content_factory_items');
      expect(sql).toContain('ot104r_vimeo_sources');
      expect(sql).toContain('item.published_revision_key = $9');
      expect(sql).toContain('prepared_duration_ms');
      expect(sql).toContain('source.duration_ms');
      expect(sql).toContain('BETWEEN 1 AND 9007199254740991');
      expect(sql).toContain("access.current_state IN ('free', 'active', 'grace')");
      expect(values).toEqual([
        'one_time',
        'parent:household-1',
        'adult-1',
        'account-1',
        'household-1',
        'session-1',
        '2026-08-16T12:00:00.000Z',
        'content-shavuos',
        'revision-shavuos-1',
      ]);
      return {
        rowCount: 1,
        rows: [
          {
            governed_content_id: 'content-shavuos',
            governed_content_version_id: 'revision-shavuos-1',
            governed_duration_ms: 90_000,
          },
        ],
      };
    });
    const repository = createPostgresParentLearningRepository({ query } as unknown as DbPool, {
      accountKey: 'one_time',
      clock: () => new Date('2026-08-16T12:00:00.000Z'),
    });

    await expect(
      repository.loadContentProgressTarget({
        principal,
        participant_id: 'parent:household-1',
        content_id: 'content-shavuos',
        content_version_id: 'revision-shavuos-1',
      }),
    ).resolves.toEqual({
      content_id: 'content-shavuos',
      content_version_id: 'revision-shavuos-1',
      duration_ms: 90_000,
    });
  });

  it('writes Parent attendance through an active Parent entitlement without a learner key', async () => {
    const query = vi.fn(async (sql: string, _values: readonly unknown[] = []) => {
      if (sql.includes('INSERT INTO onetime.parent_learning_attendance_events')) {
        return { rowCount: 1, rows: [{ entity_id: 'parent-attendance-1' }] };
      }
      return { rowCount: 0, rows: [] };
    });
    const repository = createPostgresParentLearningRepository({ query } as unknown as DbPool, {
      accountKey: 'one_time',
    });
    const result = await repository.recordAttendance({
      principal,
      write: {
        participant_id: 'parent:household-1',
        household_id: 'household-1',
        actor_kind: 'parent',
        occurrence_id: 'occurrence-1',
        event_kind: 'joined',
        connection_lineage_id: 'connection-1',
        source_event_ref_digest: 'b'.repeat(64),
        context: {
          idempotency_key: 'parent-attendance-0001',
          canonical_request_hash: 'a'.repeat(64),
          occurred_at: '2026-08-16T12:00:00.000Z',
        },
      },
    });

    expect(result).toEqual({
      disposition: 'committed',
      operation: 'attendance_recorded',
      entity_id: 'parent-attendance-1',
    });
    const sql = String(query.mock.calls[0]?.[0]);
    expect(sql).toContain("participant.participant_kind = 'parent'");
    expect(sql).toContain("entitlement.entitlement_state = 'active'");
    expect(sql).not.toMatch(/student_id|learner_key/u);
  });

  it('rechecks the governed source duration and computes completion in the progress insert', async () => {
    const query = vi.fn(async (sql: string, _values: readonly unknown[] = []) => {
      if (sql.includes('INSERT INTO onetime.parent_learning_content_progress_events')) {
        return { rowCount: 1, rows: [{ entity_id: 'parent-progress-1' }] };
      }
      return { rowCount: 0, rows: [] };
    });
    const repository = createPostgresParentLearningRepository({ query } as unknown as DbPool, {
      accountKey: 'one_time',
    });

    await expect(
      repository.recordContentProgress({
        principal,
        write: {
          participant_id: 'parent:household-1',
          household_id: 'household-1',
          actor_kind: 'parent',
          content_id: 'content-shavuos',
          content_version_id: 'revision-shavuos-1',
          position_ms: 90_000,
          duration_ms: 90_000,
          completed: true,
          context: {
            idempotency_key: 'parent-progress-0001',
            canonical_request_hash: 'a'.repeat(64),
            occurred_at: '2026-08-16T12:00:00.000Z',
          },
        },
      }),
    ).resolves.toMatchObject({ operation: 'content_progress_recorded' });
    const sql = String(query.mock.calls[0]?.[0]);
    expect(sql).toContain('learning_delivery_content_factory_items');
    expect(sql).toContain('ot104r_vimeo_sources');
    expect(sql).toContain('governed_duration');
    expect(sql).toContain('BETWEEN 1 AND 9007199254740991');
    expect(sql).toMatch(/\$10\s*=\s*target\.governed_duration/u);
    expect(sql).toMatch(/target\.governed_duration\s*=\s*\$11/u);
    expect(sql).not.toMatch(/\$12[^\n]*AS completed/u);
  });

  it('rejects an idempotency key reused with different Parent activity input', async () => {
    const query = vi
      .fn(async (_sql: string, _values: readonly unknown[] = []) => ({
        rowCount: 0,
        rows: [] as Record<string, unknown>[],
      }))
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ entity_id: 'parent-attendance-existing', request_hash: 'c'.repeat(64) }],
      });
    const repository = createPostgresParentLearningRepository({ query } as unknown as DbPool, {
      accountKey: 'one_time',
    });

    await expect(
      repository.recordAttendance({
        principal,
        write: {
          participant_id: 'parent:household-1',
          household_id: 'household-1',
          actor_kind: 'parent',
          occurrence_id: 'occurrence-1',
          event_kind: 'joined',
          connection_lineage_id: 'connection-1',
          source_event_ref_digest: 'b'.repeat(64),
          context: {
            idempotency_key: 'parent-attendance-0001',
            canonical_request_hash: 'a'.repeat(64),
            occurred_at: '2026-08-16T12:00:00.000Z',
          },
        },
      }),
    ).rejects.toMatchObject({ code: 'parent_learning_idempotency_conflict' });
  });
});
