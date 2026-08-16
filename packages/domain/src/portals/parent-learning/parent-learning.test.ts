import { describe, expect, it } from 'vitest';
import {
  buildParentLearningSnapshot,
  ParentLearningError,
  prepareParentContentProgress,
  prepareParentQuestion,
} from './index.ts';
import type {
  ParentLearningPrincipal,
  ParentLearningRecord,
} from '../../../../contracts/src/portals/parent-learning/index.ts';

const principal: ParentLearningPrincipal = {
  role: 'parent',
  adult_id: 'adult-1',
  human_account_id: 'account-1',
  household_id: 'household-1',
  session_id: 'session-1',
};

const record: ParentLearningRecord = {
  participant_id: 'parent:household-1',
  adult_id: 'adult-1',
  human_account_id: 'account-1',
  household_id: 'household-1',
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
      href: '/api/v1/classroom/production-basic/launch',
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
    attended_occurrence_count: 2,
    started_content_count: 3,
    completed_content_count: 1,
    submitted_question_count: 4,
  },
};

describe('Parent-first learning policy', () => {
  it('projects the Parent as learner one of four while preserving three child seats', () => {
    expect(buildParentLearningSnapshot({ principal, record })).toMatchObject({
      participant_id: 'parent:household-1',
      learner_ordinal: 1,
      capacity: {
        total_learners: 4,
        parent_learners: 1,
        child_student_limit: 3,
      },
      activity: {
        attended_occurrence_count: 2,
        completed_content_count: 1,
      },
      next_class: {
        occurrence_id: 'occurrence-1',
        launch_action: {
          href: '/api/v1/classroom/production-basic/launch',
        },
      },
      library_items: [
        {
          content_id: 'content-1',
          content_version_id: 'version-1',
          open_action: {
            href: '/api/v1/portals/parent/learning/content/content-1/open',
          },
        },
      ],
    });
    expect(JSON.stringify(buildParentLearningSnapshot({ principal, record }))).not.toMatch(
      /https?:\/\/|vimeo|zoom\.us/iu,
    );
  });

  it('denies a record from another household or HumanAccount', () => {
    expect(() =>
      buildParentLearningSnapshot({
        principal,
        record: { ...record, human_account_id: 'account-2' },
      }),
    ).toThrowError(ParentLearningError);
    expect(() =>
      buildParentLearningSnapshot({
        principal,
        record: { ...record, household_id: 'household-2' },
      }),
    ).toThrowError(expect.objectContaining({ code: 'parent_learning_scope_denied' }));
  });

  it('attributes progress and Rabbi questions to the Parent participant only', () => {
    const context = {
      idempotency_key: 'parent-progress-0001',
      canonical_request_hash: 'a'.repeat(64),
      occurred_at: '2026-08-16T12:00:00.000Z',
    };
    expect(
      prepareParentContentProgress({
        principal,
        record,
        target: {
          content_id: 'content-1',
          content_version_id: 'version-1',
          duration_ms: 60_000,
        },
        command: {
          content_id: 'content-1',
          content_version_id: 'version-1',
          position_ms: 30_000,
          duration_ms: 60_000,
          completed: false,
        },
        context,
      }),
    ).toMatchObject({
      participant_id: 'parent:household-1',
      actor_kind: 'parent',
      household_id: 'household-1',
    });
    expect(
      prepareParentQuestion({
        principal,
        record,
        command: {
          class_series_key: 'class_series_one_time_daily',
          private_body: '  May a Parent review this Mishnah again?  ',
        },
        context: { ...context, idempotency_key: 'parent-question-0001' },
      }),
    ).toMatchObject({
      participant_id: 'parent:household-1',
      actor_kind: 'parent',
      private_body: 'May a Parent review this Mishnah again?',
    });
  });
});
