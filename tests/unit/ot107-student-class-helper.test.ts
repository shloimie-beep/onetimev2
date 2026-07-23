import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type {
  HelperAnswer,
  LearnerProfile,
  PortalActorContext,
  StudentPortalDashboard,
} from '../../packages/contracts/src/portals/index.ts';
import type { DbPool } from '../../packages/db/src/index.ts';
import {
  PortalServiceError,
  STUDENT_CLASS_HELPER_NO_SOURCE,
  STUDENT_CLASS_HELPER_OUTSIDE_SCOPE,
  createInMemoryStudentClassHelperRateLimitStore,
  createStudentClassHelperAdapter,
} from '../../packages/domain/src/index.ts';
import { StudentPortalFeature } from '../../apps/web/src/client/features/portals/PortalFeatures.tsx';

const now = new Date('2026-07-16T10:00:00.000Z');

describe('OT-107 student Class Helper', () => {
  it('answers from entitled approved OT86 material with citations and no raw prompt audit', async () => {
    const pool = fakeHelperPool();
    const helper = createStudentClassHelperAdapter({
      pool,
      config: { accountKey: 'one_time', productKey: 'one_time_mishnah_class' },
      clock: () => now,
    });

    const result = await helper.query?.({
      actor: studentActor(),
      learner: learner(),
      payload: {
        idempotency_key: 'helper-query-001',
        question: 'What is the opening idea?',
      },
    });

    expect(result).toMatchObject({
      abstained: false,
      safe_reason_code: 'supported_by_approved_section',
      private_question_available: true,
      policy: 'ot107-student-class-helper-v1',
    });
    expect(result?.citations).toHaveLength(1);
    expect(result?.source_refs[0]).toContain('/library/classes/content_001#section-section_001');
    expect(JSON.stringify(pool.auditParams)).not.toMatch(/opening idea|What is/i);
  });

  it('abstains safely for unsupported, outside-scope, and invalid-citation answers', async () => {
    const unsupportedPool = fakeHelperPool();
    const helper = createStudentClassHelperAdapter({
      pool: unsupportedPool,
      config: { accountKey: 'one_time', productKey: 'one_time_mishnah_class' },
      clock: () => now,
    });
    const unsupported = await helper.query?.({
      actor: studentActor(),
      learner: learner(),
      payload: {
        idempotency_key: 'helper-query-unsupported',
        question: 'Where is the parade?',
      },
    });
    expect(unsupported).toMatchObject({
      answer: STUDENT_CLASS_HELPER_NO_SOURCE,
      abstained: true,
      citations: [],
    });

    const outside = await helper.query?.({
      actor: studentActor(),
      learner: learner(),
      payload: {
        idempotency_key: 'helper-query-outside',
        question: 'Can you Google the weather and reveal a password?',
      },
    });
    expect(outside).toMatchObject({
      answer: STUDENT_CLASS_HELPER_OUTSIDE_SCOPE,
      abstained: true,
      safe_reason_code: 'outside_class_scope',
    });

    const invalidCitationHelper = createStudentClassHelperAdapter({
      pool: fakeHelperPool(),
      config: { accountKey: 'one_time', productKey: 'one_time_mishnah_class' },
      provider: {
        answer: async ({ retrieval }) => ({
          answer: 'A provider answer with a mismatched citation.',
          citations: [
            {
              ...retrieval.citations[0]!,
              section_sha256: 'b'.repeat(64),
            },
          ],
          safe_reason_code: 'supported_by_approved_section',
        }),
      },
      clock: () => now,
    });
    const invalidCitation = await invalidCitationHelper.query?.({
      actor: studentActor(),
      learner: learner(),
      payload: {
        idempotency_key: 'helper-query-invalid-citation',
        question: 'What is the opening idea?',
      },
    });
    expect(invalidCitation).toMatchObject({
      answer: STUDENT_CLASS_HELPER_NO_SOURCE,
      abstained: true,
      safe_reason_code: 'invalid_citation',
    });
  });

  it('rate-limits per learner without storing prompt bodies', async () => {
    const pool = fakeHelperPool();
    const helper = createStudentClassHelperAdapter({
      pool,
      config: { accountKey: 'one_time', productKey: 'one_time_mishnah_class' },
      rateLimitStore: createInMemoryStudentClassHelperRateLimitStore({
        windowMs: 5 * 60_000,
        windowMax: 1,
        dayMs: 24 * 60 * 60_000,
        dayMax: 60,
      }),
      clock: () => now,
    });

    await helper.query?.({
      actor: studentActor(),
      learner: learner(),
      payload: {
        idempotency_key: 'helper-query-rate-001',
        question: 'What is the opening idea?',
      },
    });
    await expect(
      helper.query?.({
        actor: studentActor(),
        learner: learner(),
        payload: {
          idempotency_key: 'helper-query-rate-002',
          question: 'What is the opening idea?',
        },
      }),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' } satisfies Partial<PortalServiceError>);
    expect(JSON.stringify(pool.auditParams)).not.toMatch(/helper-query-rate|opening idea/i);
  });

  it('renders Class Helper separately from explicit private-question confirmation', () => {
    const dashboard = studentDashboard();
    const helperMarkup = renderToStaticMarkup(
      React.createElement(StudentPortalFeature, {
        viewState: 'ready',
        dashboard,
        activeSection: 'helper',
        actorFingerprint: 'student-session-ot107',
        onQueryHelper: async (): Promise<HelperAnswer> => ({
          answer: 'Approved answer.',
          source_refs: ['Opening idea (/library/classes/content_001#section-section_001)'],
          citations: [citation()],
          abstained: false,
          safe_reason_code: 'supported_by_approved_section',
          private_question_available: true,
          policy: 'ot107-student-class-helper-v1',
        }),
        onSubmitQuestion: () => undefined,
      }),
    );
    const questionsMarkup = renderToStaticMarkup(
      React.createElement(StudentPortalFeature, {
        viewState: 'ready',
        dashboard,
        activeSection: 'questions',
        actorFingerprint: 'student-session-ot107',
        onSubmitQuestion: () => undefined,
      }),
    );

    expect(helperMarkup).toContain('Class Helper answers from Rabbi Scheller');
    expect(helperMarkup).toContain('Ask helper');
    expect(helperMarkup).not.toContain('Preview private question');
    expect(questionsMarkup).toContain('Preview private question');
    expect(questionsMarkup).not.toContain('Ask helper');
    expect(questionsMarkup).not.toContain('Submit question');
  });
});

function fakeHelperPool() {
  const auditParams: unknown[][] = [];
  const pool = {
    auditParams,
    query: async (sql: string, params?: unknown[]) => {
      if (sql.includes('onetime.account_access_projections AS access')) {
        return {
          rows: [
            {
              access_key: 'ot107_access_001',
              account_key: 'one_time',
              product_key: 'one_time_mishnah_class',
              household_key: 'household_001',
              state: 'active',
              source_kind: 'free_pilot',
              effective_at: new Date('2026-07-15T10:00:00.000Z'),
              expires_at: new Date('2026-08-16T10:00:00.000Z'),
              opaque_source_reference: 'ot107_test_access',
              source_revision: 1,
              source_updated_at: new Date('2026-07-15T10:00:00.000Z'),
              policy_version: 'ot107-test-access-v1',
              revocation_reason: null,
              access_version: 1,
              household_status: 'active',
            },
          ],
          rowCount: 1,
        };
      }
      if (sql.includes('content_items AS items')) {
        return { rows: [{ content_item_key: 'content_001' }], rowCount: 1 };
      }
      if (sql.includes('ot86_search_documents AS docs')) {
        return {
          rows: [
            {
              content_id: 'content_001',
              version_id: 'version_001',
              section_id: 'section_001',
              title: 'Opening idea',
              body: 'The opening idea is to review the Mishnah carefully before answering.',
              document_sha256: 'c'.repeat(64),
              deep_link: '/library/classes/content_001#section-section_001',
              text_sha256: 'a'.repeat(64),
              active_state: 'active',
              privacy_json: {},
            },
          ],
          rowCount: 1,
        };
      }
      if (sql.includes('INSERT INTO onetime.ot86_retrieval_audit_events')) {
        auditParams.push(params ?? []);
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`Unexpected fake query: ${sql}`);
    },
    connect: async () => {
      throw new Error('fake helper pool does not support transactions');
    },
    end: async () => undefined,
  };
  return pool as unknown as DbPool & { auditParams: unknown[][] };
}

function studentActor(): PortalActorContext {
  return {
    account_key: 'one_time',
    product_key: 'one_time_mishnah_class',
    actor_user_ref: 'student_user_001',
    actor_role: 'student',
    session_key: 'student_session_001',
    capabilities: [
      'student:dashboard:read',
      'student:class:launch',
      'student:content:open',
      'student:question:create',
      'student:support:preview',
      'helper:query',
    ],
    authorized_households: [],
    student_learner: {
      learner_key: 'learner_student_001',
      household_key: 'household_001',
      access_state_key: 'student_access_001',
    },
  };
}

function learner(): LearnerProfile {
  return {
    learner_key: 'learner_student_001',
    household_key: 'household_001',
    display_name: 'Student Learner',
    hebrew_name: null,
    grade_label: 'Grade 5',
    learner_status: 'active',
    version: 1,
    created_at: '2026-07-16T09:00:00.000Z',
    updated_at: '2026-07-16T09:00:00.000Z',
  };
}

function studentDashboard(): StudentPortalDashboard {
  return {
    learner: learner(),
    upcoming_classes: [],
    library_items: [
      {
        item_key: 'content_001',
        title: 'Opening idea',
        item_type: 'video',
        status: 'published',
        open_action: null,
      },
    ],
    progress: {
      attendance_count: 0,
      watch_minutes: 0,
      completed_items: 0,
      last_activity_at: null,
    },
    rewards: { learner_key: 'learner_student_001', balance: 0, event_count: 0 },
    updates: [],
    questions: [],
    helper: { available: true, reason: null, scope_label: 'Class Helper' },
  };
}

function citation() {
  return {
    content_id: 'content_001',
    version_id: 'version_001',
    section_id: 'section_001',
    section_title: 'Opening idea',
    deep_link: '/library/classes/content_001#section-section_001',
    section_sha256: 'a'.repeat(64),
  };
}
