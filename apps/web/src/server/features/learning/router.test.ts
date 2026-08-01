import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLearningRouter } from './router.ts';

const servers: Array<ReturnType<express.Express['listen']>> = [];
const actor = {
  sessionKey: 'session-1',
  actor: {
    accountKey: 'account-1',
    productKey: 'one_time_mishnayos',
    runtimeTier: 'isolated_staging',
    verificationEnvironmentId: 'ci',
    principalId: 'login-1',
    role: 'student' as const,
    studentId: 'student-1',
    householdId: 'household-1',
    classIds: ['class-a'],
  },
};

afterEach(async () => {
  while (servers.length) {
    const server = servers.pop();
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

describe('P22 learning router', () => {
  it('returns a neutral no-store 503 while a hard composition gate is absent', async () => {
    const baseUrl = await start({ enabled: false });
    const response = await fetch(`${baseUrl}/api/app/learning/questions`);
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(await response.json()).toEqual({
      success: false,
      code: 'LEARNING_UNAVAILABLE',
      message: 'Learning is not available yet.',
    });
  });

  it('derives the Student snapshot from the authenticated actor and exposes no attendance mutation', async () => {
    const questions = vi.fn(async () => []);
    const baseUrl = await start({ enabled: true, questions });
    const response = await fetch(`${baseUrl}/api/app/learning/student-snapshot`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      data: { questions: [], publishedQuestions: [], announcements: [], badges: [] },
    });
    expect(questions).toHaveBeenCalledWith(actor.actor);
    const forbiddenWriter = await fetch(`${baseUrl}/api/app/learning/attendance`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    expect(forbiddenWriter.status).toBe(404);
  });
});

async function start(input: { enabled: boolean; questions?: () => Promise<never[]> }) {
  const service = {
    questions: input.questions ?? (async () => []),
    announcements: async () => [],
    publishedClassQuestions: async () => [],
    badges: async () => [],
    leaderboard: async () => ({
      accountKey: 'account-1',
      productKey: 'one_time_mishnayos',
      runtimeTier: 'isolated_staging',
      verificationEnvironmentId: 'ci',
      classId: 'class-a',
      windowStartsAt: '2026-07-01T00:00:00.000Z',
      windowEndsAt: '2026-08-01T00:00:00.000Z',
      categories: { attendanceCount: [], currentAttendanceStreak: [], approvedQuestionCount: [] },
      combinedScore: null,
      public: false,
    }),
  };
  const app = express();
  app.use(express.json());
  app.use(
    '/api/app/learning',
    createLearningRouter({
      service: service as never,
      enabled: input.enabled,
      resolveActor: async () => actor,
      verifyCsrf: async () => true,
    }),
  );
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  servers.push(server);
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
