import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../../../../../../packages/config/src/index.ts';
import type { ContentPublicationPrincipal } from '../../../../../../../packages/contracts/src/content/publication/index.ts';
import type { DbPool } from '../../../../../../../packages/db/src/index.ts';
import {
  composeContentPublicationService,
  createContentPublicationFeatureRegistration,
  disabledVimeoBinding,
} from './composition.ts';

describe('P21 content-publication composition', () => {
  it('publishes one central feature descriptor for both protected route families', () => {
    const registration = createContentPublicationFeatureRegistration({
      resolveIdentity: async () => null,
      verifyCsrf: async () => false,
    });
    expect(registration).toMatchObject({
      featureId: 'onetime.content-publication',
      contractVersion: '1.0.0',
      mountPath: '/api',
    });
  });

  it('composes repository functionality while the default provider binding remains prohibited', () => {
    const config = testConfig();
    const binding = disabledVimeoBinding(config);
    expect(binding).toMatchObject({
      provider: 'vimeo',
      active: false,
      mutation_policy: 'prohibited',
      allowed_operation_types: [],
    });
    expect(() => composeContentPublicationService({ config, pool: unusedPool() })).not.toThrow();
  });

  it('resolves resume concurrency from the independent resume aggregate', async () => {
    const queries: string[] = [];
    const pool = tracedPool(queries, 7);
    const service = composeContentPublicationService({ config: testConfig(), pool });

    await expect(
      service.resolveResumeExpectedVersion({
        principal: studentPrincipal(),
        contentId: 'content-one',
      }),
    ).resolves.toBe(7);

    expect(queries.some((query) => query.includes('student_content_resume'))).toBe(true);
    expect(queries.some((query) => query.includes('content_publications'))).toBe(false);
  });

  it('uses version zero for a new independent resume aggregate', async () => {
    const service = composeContentPublicationService({
      config: testConfig(),
      pool: tracedPool([], null),
    });
    await expect(
      service.resolveResumeExpectedVersion({
        principal: studentPrincipal(),
        contentId: 'content-one',
      }),
    ).resolves.toBe(0);
  });
});

function testConfig() {
  return loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    AUTH_CSRF_SECRET: 'test-content-publication-csrf-secret',
  });
}

function unusedPool(): DbPool {
  const unavailable = async () => {
    throw new Error('P21 composition performed unexpected database access.');
  };
  return {
    connect: unavailable,
    query: unavailable,
    end: async () => undefined,
  } as unknown as DbPool;
}

function tracedPool(queries: string[], resumeVersion: number | null): DbPool {
  return {
    connect: async () => ({
      query: async (text: string) => {
        queries.push(text);
        if (text.includes('student_content_resume')) {
          return {
            rows: resumeVersion === null ? [] : [{ resume_json: { version: resumeVersion } }],
            rowCount: resumeVersion === null ? 0 : 1,
          };
        }
        return { rows: [], rowCount: 0 };
      },
      release: () => undefined,
    }),
    query: async () => ({ rows: [], rowCount: 0 }),
    end: async () => undefined,
  } as unknown as DbPool;
}

function studentPrincipal(): ContentPublicationPrincipal {
  return {
    actorId: 'student-user-one',
    role: 'student',
    accountKey: 'account-one',
    productKey: 'one_time_mishnayos',
    householdId: 'household-one',
    studentId: 'student-one',
    sessionId: 'session-one',
    sessionVersion: 1,
    accessState: 'active',
  };
}
