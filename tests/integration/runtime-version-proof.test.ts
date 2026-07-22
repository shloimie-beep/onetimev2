import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../apps/web/src/server/app.ts';
import { loadConfig } from '../../packages/config/src/index.ts';
import { createMemoryPool, type DbPool } from '../../packages/db/src/index.ts';

let server: ReturnType<ReturnType<typeof createApp>['listen']>;
let baseUrl: string;
let pool: DbPool;

const runtimeCommit = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const railwayGitCommit = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

beforeAll(async () => {
  const config = loadConfig({
    NODE_ENV: 'test',
    APP_VERSION: 'rollback-proof-candidate',
    COMMIT_SHA: runtimeCommit,
    RAILWAY_DEPLOYMENT_ID: 'deployment-runtime-proof-123',
    RAILWAY_SNAPSHOT_ID: 'snapshot-runtime-proof-123',
    RAILWAY_PROJECT_ID: 'project-runtime-proof-123',
    RAILWAY_ENVIRONMENT_ID: 'environment-runtime-proof-123',
    RAILWAY_SERVICE_ID: 'service-runtime-proof-123',
    RAILWAY_SERVICE_NAME: 'ot99-web',
    RAILWAY_GIT_COMMIT_SHA: railwayGitCommit,
  });
  pool = createMemoryPool();
  const app = createApp({ config, pool });
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, (error?: Error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  const address = server.address();
  if (typeof address !== 'object' || !address) throw new Error('missing test server address');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
  await pool.end();
});

describe('runtime version proof', () => {
  it('binds /version to non-secret Railway runtime deployment identity', async () => {
    const response = await fetch(`${baseUrl}/version`);
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body).toEqual({
      version: 'rollback-proof-candidate',
      commit_sha: railwayGitCommit,
      target_app: 'one-time',
      deployment: {
        provider: 'railway',
        deployment_id: 'deployment-runtime-proof-123',
        snapshot_id: 'snapshot-runtime-proof-123',
        project_id: 'project-runtime-proof-123',
        environment_id: 'environment-runtime-proof-123',
        service_id: 'service-runtime-proof-123',
        service_name: 'ot99-web',
        git_commit_sha: railwayGitCommit,
      },
    });
    expect(JSON.stringify(body)).not.toMatch(/database|password|secret|token/i);
  });
});
