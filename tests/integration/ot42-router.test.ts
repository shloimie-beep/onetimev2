import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createOt42CrmRouter,
  type Ot42CrmRepository,
  type Ot42CrmSession,
} from '../../apps/web/src/server/crm/register.ts';

const validUuid = '11111111-1111-4111-8111-111111111111';
const validEtag = '"opaque-version"';

describe('OT-42 CRM router guard order', () => {
  const servers: Array<{ close: () => void }> = [];

  afterEach(() => {
    for (const server of servers.splice(0)) server.close();
  });

  it('returns 401 before repository access when authentication is absent', async () => {
    const harness = await createHarness({ session: null });
    const response = await fetch(`${harness.baseUrl}/api/v1/crm/contacts/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ limit: 12 }),
    });
    expect(response.status).toBe(401);
    expect(harness.calls).toEqual([]);
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('returns 403 before csrf and repository access when capability is missing', async () => {
    const harness = await createHarness({ role: 'viewer' });
    const response = await fetch(`${harness.baseUrl}/api/v1/crm/tags`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': validUuid,
        'if-match': validEtag,
      },
      body: JSON.stringify({ display_name: 'Warm lead' }),
    });
    expect(response.status).toBe(403);
    expect(harness.csrfChecks).toBe(0);
    expect(harness.calls).toEqual([]);
  });

  it('returns csrf and precondition errors before repository mutation access', async () => {
    const csrfHarness = await createHarness({ csrfValid: false });
    const csrfResponse = await fetch(`${csrfHarness.baseUrl}/api/v1/crm/tags`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': validUuid,
        'if-match': validEtag,
      },
      body: JSON.stringify({ display_name: 'Warm lead' }),
    });
    expect(csrfResponse.status).toBe(403);
    expect(csrfHarness.calls).toEqual([]);

    const preconditionHarness = await createHarness({});
    const preconditionResponse = await fetch(`${preconditionHarness.baseUrl}/api/v1/crm/tags`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': validUuid,
      },
      body: JSON.stringify({ display_name: 'Warm lead' }),
    });
    expect(preconditionResponse.status).toBe(428);
    expect(preconditionHarness.calls).toEqual([]);
  });

  it('calls the repository once after auth, capability, csrf, idempotency, and etag pass', async () => {
    const harness = await createHarness({});
    const response = await fetch(`${harness.baseUrl}/api/v1/crm/tags`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': validUuid,
        'if-match': validEtag,
      },
      body: JSON.stringify({ display_name: 'Warm lead' }),
    });
    expect(response.status).toBe(200);
    expect(harness.calls).toEqual(['createTag']);
    expect(harness.csrfChecks).toBe(1);
  });

  it('performs exactly one scoped repository lookup for a missing contact', async () => {
    const harness = await createHarness({ missingContact: true });
    const response = await fetch(`${harness.baseUrl}/api/v1/crm/contacts/contact_missing`);
    expect(response.status).toBe(404);
    expect(harness.calls).toEqual(['getContact']);
  });

  async function createHarness(options: {
    session?: Ot42CrmSession | null;
    role?: string;
    csrfValid?: boolean;
    missingContact?: boolean;
  }) {
    const calls: string[] = [];
    let csrfChecks = 0;
    const session =
      options.session === null
        ? null
        : {
            sessionKey: 'session_1',
            actor: {
              accountKey: 'acct_test',
              productKey: 'prod_test',
              userKey: 'user_test',
              role: options.role ?? 'owner',
              roleLabel: 'Owner',
            },
          };
    const repository = repositoryWithCalls(calls, options.missingContact === true);
    const app = express();
    app.use(express.json());
    app.use(
      '/api/v1/crm',
      createOt42CrmRouter({
        config: {} as never,
        pool: {} as never,
        guards: {
          loadSession: async () => session,
          verifyCsrf: async () => {
            csrfChecks += 1;
            return options.csrfValid !== false;
          },
        },
        repository,
      }),
    );
    const server = await new Promise<import('node:http').Server>((resolve) => {
      const started = app.listen(0, () => resolve(started));
    });
    servers.push(server);
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing test server port');
    return {
      baseUrl: `http://127.0.0.1:${address.port}`,
      calls,
      get csrfChecks() {
        return csrfChecks;
      },
    };
  }
});

function repositoryWithCalls(calls: string[], missingContact: boolean): Ot42CrmRepository {
  const ok = { success: true };
  return new Proxy({} as Ot42CrmRepository, {
    get(_target, prop) {
      return async () => {
        calls.push(String(prop));
        if (prop === 'getContact' && missingContact) return null;
        return ok;
      };
    },
  });
}
