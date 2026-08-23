import { describe, expect, it, vi } from 'vitest';
import type {
  ParentLearningPrincipal,
  ParentLearningRecord,
  ParentLearningRepository,
} from '../../../../../../../packages/contracts/src/portals/parent-learning/index.ts';
import { createParentLearningService } from './service.ts';

const principal: ParentLearningPrincipal = {
  role: 'parent',
  adult_id: 'adult-1',
  human_account_id: 'account-1',
  household_id: 'household-1',
  session_id: 'session-1',
};
const record: ParentLearningRecord = {
  participant_id: 'parent:household-1',
  adult_id: principal.adult_id,
  human_account_id: principal.human_account_id,
  household_id: principal.household_id,
  display_name: 'Ari Levi',
  state: 'active',
  learner_ordinal: 1,
  active_child_student_count: 0,
  entitlement: {
    account_key: 'one_time',
    class_series_key: 'class_series_one_time_daily',
    class_title: 'Daily One Time Mishnayos',
    effective_at: '2026-08-16T10:00:00.000Z',
  },
  next_class: {
    occurrence_id: 'occurrence-1',
    title: 'Daily One Time Mishnayos',
    starts_at: '2026-08-16T12:00:00.000Z',
    ends_at: '2026-08-16T13:00:00.000Z',
    join_opens_at: '2026-08-16T11:45:00.000Z',
    join_closes_at: '2026-08-16T13:15:00.000Z',
    state: 'live',
    launch_action: {
      action_key: 'parent-production-basic-launch-occurrence-1',
      label: 'Join class',
      kind: 'class_launch',
      method: 'POST',
      href: '/api/v1/portals/parent/classroom/production-basic/launch',
      launch_token_ref: null,
      expires_at: '2026-08-16T13:15:00.000Z',
    },
  },
  library_items: [
    {
      content_id: 'content-1',
      content_version_id: 'version-1',
      title: 'Shavuos review',
      item_type: 'video',
      published_at: '2026-07-19T10:00:00.000Z',
      progress: null,
      open_action: {
        action_key: 'parent-content-open-content-1',
        label: 'Open content',
        kind: 'content_open',
        method: 'GET',
        href: '/api/v1/portals/parent/learning/content/content-1/open',
        launch_token_ref: null,
        expires_at: null,
      },
    },
  ],
  activity: {
    attended_occurrence_count: 0,
    started_content_count: 0,
    completed_content_count: 0,
    submitted_question_count: 0,
  },
};

describe('Parent learning service', () => {
  it('loads the Parent participant and commits Parent-attributed activity', async () => {
    const repository: ParentLearningRepository = {
      loadOwnedParticipant: vi.fn(async () => record),
      recordAttendance: vi.fn(async () => ({
        disposition: 'committed' as const,
        operation: 'attendance_recorded' as const,
        entity_id: 'attendance-1',
      })),
      recordContentProgress: vi.fn(async () => ({
        disposition: 'committed' as const,
        operation: 'content_progress_recorded' as const,
        entity_id: 'progress-1',
      })),
      submitQuestion: vi.fn(async () => ({
        disposition: 'committed' as const,
        operation: 'question_submitted' as const,
        entity_id: 'question-1',
      })),
      loadContentOpenTarget: vi.fn(async () => ({
        content_id: 'content-1',
        item_type: 'video' as const,
      })),
      loadContentProgressTarget: vi.fn(async () => ({
        content_id: 'content-1',
        content_version_id: 'version-1',
        duration_ms: 90_000,
      })),
    };
    const service = createParentLearningService({ repository });
    const context = {
      idempotency_key: 'parent-attendance-0001',
      canonical_request_hash: 'a'.repeat(64),
      occurred_at: '2026-08-16T12:00:00.000Z',
    };

    await expect(service.overview(principal)).resolves.toMatchObject({
      learner_ordinal: 1,
      capacity: { total_learners: 4, child_student_limit: 3 },
    });
    await expect(
      service.recordAttendance(
        principal,
        {
          occurrence_id: 'occurrence-1',
          event_kind: 'joined',
          connection_lineage_id: 'connection-1',
          source_event_ref_digest: 'b'.repeat(64),
        },
        context,
      ),
    ).resolves.toMatchObject({ operation: 'attendance_recorded' });
    expect(repository.recordAttendance).toHaveBeenCalledWith(
      expect.objectContaining({
        write: expect.objectContaining({
          participant_id: 'parent:household-1',
          actor_kind: 'parent',
        }),
      }),
    );
    await expect(service.openContent(principal, 'content-1')).resolves.toMatchObject({
      kind: 'content_open',
      method: 'GET',
      href: '/app/learning/items/content-1',
    });
    await expect(service.productionBasicActor(principal)).resolves.toEqual({
      kind: 'parent',
      scope: { account_key: 'one_time', product_key: 'one_time_mishnayos' },
      participant_id: 'parent:household-1',
      household_id: 'household-1',
      display_name: 'Ari Levi',
      entitled: true,
    });
  });

  it('fails closed when no active Parent participant exists', async () => {
    const repository = {
      loadOwnedParticipant: vi.fn(async () => null),
    } as unknown as ParentLearningRepository;
    await expect(
      createParentLearningService({ repository }).overview(principal),
    ).rejects.toMatchObject({ code: 'parent_learning_missing' });
  });

  it('uses the governed exact-version duration and validates completion on the server', async () => {
    const recordContentProgress = vi.fn(async () => ({
      disposition: 'committed' as const,
      operation: 'content_progress_recorded' as const,
      entity_id: 'progress-1',
    }));
    const repository: ParentLearningRepository = {
      loadOwnedParticipant: vi.fn(async () => record),
      loadContentOpenTarget: vi.fn(async () => null),
      loadContentProgressTarget: vi.fn(async () => ({
        content_id: 'content-1',
        content_version_id: 'version-1',
        duration_ms: 90_000,
      })),
      recordAttendance: vi.fn(),
      recordContentProgress,
      submitQuestion: vi.fn(),
    };
    const service = createParentLearningService({ repository });
    const context = {
      idempotency_key: 'parent-progress-0001',
      canonical_request_hash: 'a'.repeat(64),
      occurred_at: '2026-08-16T12:00:00.000Z',
    };

    await expect(
      service.recordContentProgress(
        principal,
        {
          content_id: 'content-1',
          content_version_id: 'version-1',
          position_ms: 1,
          duration_ms: 1,
          completed: true,
        },
        context,
      ),
    ).rejects.toMatchObject({ code: 'parent_learning_input_invalid' });
    expect(recordContentProgress).not.toHaveBeenCalled();

    await expect(
      service.recordContentProgress(
        principal,
        {
          content_id: 'content-1',
          content_version_id: 'version-1',
          position_ms: 1,
          duration_ms: 90_000,
          completed: true,
        },
        context,
      ),
    ).rejects.toMatchObject({ code: 'parent_learning_input_invalid' });
    expect(recordContentProgress).not.toHaveBeenCalled();

    await service.recordContentProgress(
      principal,
      {
        content_id: 'content-1',
        content_version_id: 'version-1',
        position_ms: 90_000,
        duration_ms: 90_000,
        completed: true,
      },
      context,
    );
    expect(recordContentProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        write: expect.objectContaining({
          duration_ms: 90_000,
          position_ms: 90_000,
          completed: true,
        }),
      }),
    );
  });
});
