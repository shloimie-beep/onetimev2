import { createServer, type Server } from 'node:http';
import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  candidateIdentity,
  healthyInput,
  runtimeIdentities,
} from '../../../../../packages/observability/v21/test-fixtures.ts';
import { createOperationsDiagnosticsRouter } from './router.ts';

let server: Server | null = null;

afterEach(async () => {
  if (server) await new Promise<void>((resolve) => server?.close(() => resolve()));
  server = null;
});

describe('P33 protected operations diagnostics', () => {
  it('conceals the route from an unauthorized request', async () => {
    const readRuntimes = vi.fn(async () => runtimeIdentities());
    const response = await request(
      createOperationsDiagnosticsRouter({
        authorize: () => false,
        candidate: candidateIdentity(),
        readRuntimes,
        readHealthObservations: async () => observations(),
      }),
      '/runtime-identity',
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      success: false,
      code: 'NOT_FOUND',
      message: 'Resource was not found.',
    });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(readRuntimes).not.toHaveBeenCalled();
  });

  it('reports protected payload leakage as Sev1 without returning the material', async () => {
    const response = await request(
      createOperationsDiagnosticsRouter({
        authorize: () => true,
        candidate: candidateIdentity(),
        readRuntimes: async () => runtimeIdentities(),
        readHealthObservations: async () => ({
          ...observations(),
          providers: observations().providers.map((provider, index) =>
            index === 0
              ? { ...provider, safe_account_ref: 'private-parent@example.test' }
              : provider,
          ),
        }),
        readDiagnosticPayloads: async () => [
          { authorization: 'Bearer secret-value-not-for-output' },
        ],
        now: () => new Date('2026-07-29T01:00:00.000Z'),
      }),
      '/health',
    );
    const body = JSON.stringify(await response.json());
    expect(response.status).toBe(503);
    expect(body).toContain('operational_leakage_secret_field');
    expect(body).not.toContain('secret-value-not-for-output');
    expect(body).not.toContain('private-parent@example.test');
  });
});

function observations() {
  const { database, migrations, queues, workers, providers } = healthyInput();
  return { database, migrations, queues, workers, providers };
}

async function request(router: express.Router, path: string): Promise<Response> {
  const app = express();
  app.use('/ops', router);
  server = createServer(app);
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not bind.');
  return fetch(`http://127.0.0.1:${address.port}/ops${path}`);
}
