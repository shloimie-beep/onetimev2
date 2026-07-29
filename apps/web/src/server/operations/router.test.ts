import { createServer, type Server } from 'node:http';
import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  candidateIdentity,
  healthyInput,
  runtimeIdentities,
} from '../../../../../packages/observability/v21/test-fixtures.ts';
import {
  createOperationsDiagnosticsRouter,
  type OperationsAdminAuthorization,
  type OperationsDiagnosticsPorts,
} from './router.ts';

let server: Server | null = null;

afterEach(async () => {
  if (server) await new Promise<void>((resolve) => server?.close(() => resolve()));
  server = null;
});

describe('P33 exact Admin operations authorization', () => {
  it.each([
    ['anonymous', { authorized: false }],
    [
      'Parent',
      {
        authorized: true,
        principal: { ...adminPrincipal(), role: 'parent' },
      },
    ],
    [
      'Student',
      {
        authorized: true,
        principal: { ...adminPrincipal(), role: 'student' },
      },
    ],
    [
      'forged role',
      {
        authorized: true,
        principal: { ...adminPrincipal(), source: 'client_assertion' },
      },
    ],
    [
      'stale Admin',
      {
        authorized: true,
        principal: { ...adminPrincipal(), current: false },
      },
    ],
  ])('conceals the route from %s without invoking observers', async (_name, authorization) => {
    const readRuntimes = vi.fn(async () => runtimeIdentities());
    const readHealthObservations = vi.fn(async () => observations());
    const response = await request(
      createOperationsDiagnosticsRouter({
        ...basePorts(),
        authorizeAdmin: async () => authorization as OperationsAdminAuthorization,
        readRuntimes,
        readHealthObservations,
      }),
      '/runtime-identity',
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      success: false,
      code: 'not_found',
      message: 'Resource was not found.',
    });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(readRuntimes).not.toHaveBeenCalled();
    expect(readHealthObservations).not.toHaveBeenCalled();
  });

  it('allows only a current server-session Admin principal', async () => {
    const response = await request(
      createOperationsDiagnosticsRouter(basePorts()),
      '/runtime-identity',
    );
    expect(response.status).toBe(200);
    expect((await response.json()).agreement.ok).toBe(true);
  });
});

describe('P33 protected diagnostics readiness and exact-body leakage gate', () => {
  it('returns 503 when a required observation is missing', async () => {
    const input = healthyInput();
    const response = await request(
      createOperationsDiagnosticsRouter({
        ...basePorts(),
        readHealthObservations: async () => ({
          ...observations(),
          queues: input.queues.slice(1),
        }),
      }),
      '/health',
    );
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.status).toBe('sev1');
    expect(body.evidence_ready).toBe(false);
    expect(JSON.stringify(body)).toContain('queue_observation_missing');
  });

  it.each([
    [
      '/runtime-identity',
      'private-runtime@example.test',
      (ports: OperationsDiagnosticsPorts) => ({
        ...ports,
        candidate: { ...ports.candidate, candidate_id: 'private-runtime@example.test' },
      }),
    ],
    [
      '/health',
      'private-health-literal',
      (ports: OperationsDiagnosticsPorts) => ({
        ...ports,
        readDiagnosticPayloads: async () => [{ authorization: 'Basic private-health-literal' }],
      }),
    ],
    [
      '/alerts',
      'private-alert-literal',
      (ports: OperationsDiagnosticsPorts) => ({
        ...ports,
        readDiagnosticPayloads: async () => [
          {
            safe_context: {
              message: 'token=private-alert-literal',
            },
          },
        ],
      }),
    ],
  ])('emits only a fixed safe 503 for injection on %s', async (path, literal, inject) => {
    const response = await request(createOperationsDiagnosticsRouter(inject(basePorts())), path);
    const body = await response.json();
    const serialized = JSON.stringify(body);
    expect(response.status).toBe(503);
    expect(body).toEqual({
      schema_version: '2.0.0',
      success: false,
      code: 'ops_diagnostic_safety_block',
      message: 'Operational response was blocked.',
    });
    expect(serialized).not.toContain(literal);
  });
});

function basePorts(): OperationsDiagnosticsPorts {
  return {
    authorizeAdmin: async () => ({ authorized: true, principal: adminPrincipal() }),
    candidate: candidateIdentity(),
    readRuntimes: async () => runtimeIdentities(),
    readHealthObservations: async () => observations(),
    now: () => new Date(healthyInput().generated_at),
  };
}

function adminPrincipal() {
  return {
    source: 'server_session' as const,
    role: 'admin' as const,
    current: true as const,
    principal_id: 'admin-shloimie',
    account_key: 'one-time',
    product_key: 'mishnayos',
    session_id: 'session-current',
  };
}

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
