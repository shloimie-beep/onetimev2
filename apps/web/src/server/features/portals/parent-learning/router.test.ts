import type { AddressInfo } from 'node:net';
import express, { type Express } from 'express';
import { describe, expect, it, vi } from 'vitest';
import type {
  ParentLearningRecord,
  ParentLearningRepository,
  ParentLearningSnapshot,
} from '../../../../../../../packages/contracts/src/portals/parent-learning/index.ts';
import type { V21ParentSessionContext } from '../../auth/v21-adult-session.ts';
import { createParentLearningRouter } from './router.ts';
import { createParentLearningService, type ParentLearningService } from './service.ts';

const snapshot: ParentLearningSnapshot = {
  contract_version: '1.0.0',
  participant_id: 'parent:household-router',
  household_id: 'household-router',
  display_name: 'Router Parent',
  state: 'active',
  learner_ordinal: 1,
  capacity: {
    total_learners: 4,
    parent_learners: 1,
    child_student_limit: 3,
    active_child_students: 0,
    available_child_student_seats: 3,
  },
  class_entitlement: {
    class_series_key: 'class_series_one_time_daily',
    class_title: 'Daily One Time Mishnayos',
    effective_at: '2026-08-16T10:00:00.000Z',
  },
  next_class: {
    occurrence_id: 'occurrence-router',
    title: 'Daily One Time Mishnayos',
    starts_at: '2026-08-16T12:00:00.000Z',
    ends_at: '2026-08-16T13:00:00.000Z',
    join_opens_at: '2026-08-16T11:45:00.000Z',
    join_closes_at: '2026-08-16T13:15:00.000Z',
    state: 'live',
    launch_action: {
      action_key: 'parent-production-basic-launch-occurrence-router',
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
      content_id: 'content-router',
      content_version_id: 'version-router',
      title: 'Shavuos review',
      item_type: 'video',
      published_at: '2026-07-19T10:00:00.000Z',
      progress: null,
      open_action: {
        action_key: 'parent-content-open-content-router',
        label: 'Open content',
        kind: 'content_open',
        method: 'GET',
        href: '/api/v1/portals/parent/learning/content/content-router/open',
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

const sessionContext = {
  adultId: 'adult-router',
  normalizedEmail: 'router@example.test',
  ownerDisplayName: 'Router Parent',
  ownedHouseholdCount: 1,
  session: {
    sessionId: 'session-router',
    humanAccountId: 'account-router',
    activeRole: 'parent',
    activeHouseholdId: 'household-router',
  },
  household: {
    householdId: 'household-router',
    displayName: 'Router household',
    classification: 'family',
    accessState: 'active',
    ownerRelationship: 'account_owner',
  },
} as V21ParentSessionContext;

function setup(input: { csrf?: boolean; service?: ParentLearningService } = {}) {
  const receipt = {
    disposition: 'committed' as const,
    operation: 'question_submitted' as const,
    entity_id: 'parent-question-1',
  };
  const service =
    input.service ??
    ({
      overview: vi.fn().mockResolvedValue(snapshot),
      recordAttendance: vi.fn().mockResolvedValue({
        ...receipt,
        operation: 'attendance_recorded',
        entity_id: 'parent-attendance-1',
      }),
      recordContentProgress: vi.fn().mockResolvedValue({
        ...receipt,
        operation: 'content_progress_recorded',
        entity_id: 'parent-progress-1',
      }),
      submitQuestion: vi.fn().mockResolvedValue(receipt),
      openContent: vi.fn().mockResolvedValue({
        action_key: 'parent-content-play-content-router',
        label: 'Play video',
        kind: 'content_open',
        method: 'GET',
        href: '/app/learning/items/content-router',
        launch_token_ref: null,
        expires_at: null,
      }),
    } as unknown as ParentLearningService);
  const sessions = {
    bootstrapCookieHeader: vi.fn().mockResolvedValue({
      status: 'resolved',
      context: sessionContext,
      csrf_token: 'csrf-bootstrap-token',
      expires_at: '2026-08-17T12:00:00.000Z',
    }),
    verifyCsrf: vi.fn().mockResolvedValue(input.csrf === false ? null : sessionContext),
  };
  const app = express();
  app.use(express.json());
  app.use(
    '/api/v1/portals/parent',
    createParentLearningRouter({
      service,
      sessions,
      clock: () => new Date('2026-08-16T12:00:00.000Z'),
    }),
  );
  return { app, service };
}

describe('Parent learning router', () => {
  it('returns the Parent learner-one snapshot and server-derived principal', async () => {
    const { app, service } = setup();
    const response = await send(app, '/api/v1/portals/parent/learning', {
      headers: { cookie: 'ot_v21_parent=opaque' },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect((await response.json()).data).toEqual({
      snapshot,
      csrf_token: 'csrf-bootstrap-token',
    });
    expect(service.overview).toHaveBeenCalledWith({
      role: 'parent',
      adult_id: 'adult-router',
      human_account_id: 'account-router',
      household_id: 'household-router',
      session_id: 'session-router',
    });
  });

  it('takes idempotency and CSRF from headers and rejects Student-scoped body fields', async () => {
    const { app, service } = setup();
    const invalid = await send(app, '/api/v1/portals/parent/learning/questions', {
      method: 'POST',
      headers: validHeaders('parent-question-0001'),
      body: {
        class_series_key: 'class_series_one_time_daily',
        private_body: 'Can I review this?',
        student_id: 'student-attacker',
      },
    });
    expect(invalid.status).toBe(400);
    expect(service.submitQuestion).not.toHaveBeenCalled();

    const valid = await send(app, '/api/v1/portals/parent/learning/questions', {
      method: 'POST',
      headers: validHeaders('parent-question-0002'),
      body: {
        class_series_key: 'class_series_one_time_daily',
        private_body: 'Can I review this?',
      },
    });
    expect(valid.status).toBe(201);
    expect(service.submitQuestion).toHaveBeenCalledWith(
      expect.objectContaining({ human_account_id: 'account-router' }),
      {
        class_series_key: 'class_series_one_time_daily',
        private_body: 'Can I review this?',
      },
      expect.objectContaining({
        idempotency_key: 'parent-question-0002',
        occurred_at: '2026-08-16T12:00:00.000Z',
        canonical_request_hash: expect.stringMatching(/^[0-9a-f]{64}$/u),
      }),
    );
  });

  it('rejects a mutation before body handling when CSRF is unavailable', async () => {
    const { app, service } = setup({ csrf: false });
    const response = await send(app, '/api/v1/portals/parent/learning/content-progress', {
      method: 'POST',
      headers: validHeaders('parent-progress-0001'),
      body: {
        content_id: 'content-1',
        content_version_id: 'version-1',
        position_ms: 0,
        duration_ms: 1,
        completed: false,
      },
    });
    expect(response.status).toBe(403);
    expect(service.recordContentProgress).not.toHaveBeenCalled();
  });

  it('resolves entitled Parent playback without accepting Student keys', async () => {
    const { app, service } = setup();
    const opened = await send(app, '/api/v1/portals/parent/learning/content/content-router/open', {
      headers: { cookie: 'ot_v21_parent=opaque' },
    });
    expect(opened.status).toBe(200);
    expect(await opened.json()).toEqual({
      success: true,
      data: {
        action: expect.objectContaining({ href: '/app/learning/items/content-router' }),
      },
    });
    expect(service.openContent).toHaveBeenCalledWith(
      expect.objectContaining({ household_id: 'household-router' }),
      'content-router',
    );

    expect(JSON.stringify(snapshot.next_class?.launch_action)).not.toMatch(
      /student_id|learner_key|https?:\/\//iu,
    );
    expect(snapshot.next_class?.launch_action).toMatchObject({
      method: 'POST',
      href: '/api/v1/classroom/production-basic/launch',
      launch_token_ref: null,
    });
  });

  it('rejects forged completion and client duration before recording progress', async () => {
    const recordContentProgress = vi.fn(async () => ({
      disposition: 'committed' as const,
      operation: 'content_progress_recorded' as const,
      entity_id: 'parent-progress-1',
    }));
    const repository = {
      loadOwnedParticipant: vi.fn(async () => parentLearningRecord()),
      loadContentOpenTarget: vi.fn(async () => null),
      loadContentProgressTarget: vi.fn(async () => ({
        content_id: 'content-router',
        content_version_id: 'version-router',
        duration_ms: 90_000,
      })),
      recordAttendance: vi.fn(),
      recordContentProgress,
      submitQuestion: vi.fn(),
    } as ParentLearningRepository;
    const { app } = setup({ service: createParentLearningService({ repository }) });

    for (const [idempotencyKey, body] of [
      [
        'parent-progress-forged-duration',
        {
          content_id: 'content-router',
          content_version_id: 'version-router',
          position_ms: 1,
          duration_ms: 1,
          completed: true,
        },
      ],
      [
        'parent-progress-forged-completion',
        {
          content_id: 'content-router',
          content_version_id: 'version-router',
          position_ms: 1,
          duration_ms: 90_000,
          completed: true,
        },
      ],
    ] as const) {
      const response = await send(app, '/api/v1/portals/parent/learning/content-progress', {
        method: 'POST',
        headers: validHeaders(idempotencyKey),
        body,
      });
      expect(response.status).toBe(400);
    }
    expect(recordContentProgress).not.toHaveBeenCalled();
  });
});

function parentLearningRecord(): ParentLearningRecord {
  return {
    participant_id: snapshot.participant_id,
    adult_id: sessionContext.adultId,
    human_account_id: sessionContext.session.humanAccountId,
    household_id: snapshot.household_id,
    display_name: snapshot.display_name,
    state: 'active',
    learner_ordinal: 1,
    active_child_student_count: snapshot.capacity.active_child_students,
    entitlement: {
      account_key: 'one_time',
      ...snapshot.class_entitlement,
    },
    next_class: snapshot.next_class,
    library_items: snapshot.library_items,
    activity: snapshot.activity,
  };
}

function validHeaders(idempotencyKey: string) {
  return {
    cookie: 'ot_v21_parent=opaque',
    'x-csrf-token': 'csrf-valid',
    'x-idempotency-key': idempotencyKey,
  };
}

async function send(
  app: Express,
  pathname: string,
  input: {
    method?: 'GET' | 'POST';
    headers?: Record<string, string>;
    body?: unknown;
  } = {},
) {
  const server = await new Promise<ReturnType<Express['listen']>>((resolve, reject) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
    listening.once('error', reject);
  });
  const address = server.address() as AddressInfo;
  try {
    return await fetch(`http://127.0.0.1:${address.port}${pathname}`, {
      method: input.method ?? 'GET',
      headers: {
        ...(input.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...input.headers,
      },
      ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
    });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}
