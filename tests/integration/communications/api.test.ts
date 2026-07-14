import express from 'express';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  registerCommunicationsRoutes,
  type ReadOnlySessionScopePort,
} from '../../../apps/web/src/server/communications/register.ts';
import type { AppConfig } from '../../../packages/config/src/index.ts';
import type { DbPool } from '../../../packages/db/src/index.ts';
import type {
  CommunicationIntentListInput,
  CommunicationIntentListResult,
  CommunicationsReadRepository,
  ReadOnlySessionScope,
} from '../../../packages/domain/src/communications/service.ts';
import { traceMiddleware } from '../../../packages/observability/src/index.ts';

const ownerSession: ReadOnlySessionScope = {
  accountKey: 'one_time',
  productKey: 'one_time_mishnah_class',
  userKey: 'user_owner',
  role: 'owner',
};

let server: ReturnType<express.Express['listen']>;
let baseUrl: string;
let repository: FakeRepository;

beforeEach(async () => {
  repository = new FakeRepository();
  const app = express();
  app.use(traceMiddleware);
  registerCommunicationsRoutes({
    app,
    config: {} as AppConfig,
    pool: {} as DbPool,
    cursorSecret: 'integration-secret',
    sessionPort: new HeaderSessionPort(),
    repository,
  });
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, (error?: Error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address !== 'object') throw new Error('missing test server address');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('Communications API registration hook', () => {
  it('returns local intent rows with no-store cache headers and no raw recipient data', async () => {
    repository.rows = [
      {
        id: '00000000-0000-4000-8000-000000000001',
        accountKey: ownerSession.accountKey,
        productKey: ownerSession.productKey,
        contactKey: 'contact_public_test',
        eventType: 'family_signup_email_ack.v1',
        channel: 'email',
        status: 'pending',
        createdAt: '2026-07-14T10:00:00.000Z',
        deliveredAt: null,
        emailNormalized: 'parent.person@example.test',
        phoneNormalized: '+12125557890',
      },
      {
        id: '00000000-0000-4000-8000-000000000002',
        accountKey: ownerSession.accountKey,
        productKey: ownerSession.productKey,
        contactKey: 'contact_public_test',
        eventType: 'family_signup_whatsapp_confirmation.v1',
        channel: 'whatsapp',
        status: 'sink_delivered',
        createdAt: '2026-07-14T09:00:00.000Z',
        deliveredAt: '2026-07-14T09:01:00.000Z',
        emailNormalized: 'parent.person@example.test',
        phoneNormalized: '+12125557890',
      },
    ];
    const response = await api(
      '/api/v1/communications?from=2026-07-01T00:00:00.000Z&to=2026-07-15T00:00:00.000Z',
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('vary')).toContain('Cookie');
    const json = await response.json();
    expect(json).toMatchObject({
      success: true,
      availability: 'available',
      source_scope: 'local_communication_intents_only',
      mailbox_complete: false,
    });
    expect(json.items).toHaveLength(2);
    expect(json.items[0]).toMatchObject({
      local_state: 'intent_queued',
      state_label: 'Queued locally',
      recipient_masked: 'Email recipient',
    });
    expect(json.items[1]).toMatchObject({
      local_state: 'sink_processed',
      state_label: 'Processed in test mode',
      recipient_masked: 'WhatsApp recipient ending 7890',
    });
    const serialized = JSON.stringify(json);
    expect(serialized).not.toContain('parent.person');
    expect(serialized).not.toContain('example.test');
    expect(serialized).not.toContain('+12125557890');
    expect(serialized).not.toContain('delivery_key');
    expect(serialized).not.toMatch(/\bSent\b|\bDelivered\b/);
  });

  it('denies unauthenticated and unauthorized roles before repository access', async () => {
    const unauthenticated = await fetch(`${baseUrl}/api/v1/communications`);
    expect(unauthenticated.status).toBe(401);
    expect(repository.calls).toHaveLength(0);

    for (const role of ['crm_agent', 'viewer', 'member', 'public', 'unknown', 'malformed']) {
      const denied = await api('/api/v1/communications', role);
      expect(denied.status).toBe(403);
    }
    expect(repository.calls).toHaveLength(0);
  });

  it('uses the session scope and ignores forged browser scope fields', async () => {
    await api(
      '/api/v1/communications?from=2026-07-01T00:00:00.000Z&to=2026-07-15T00:00:00.000Z&account_key=other&product_key=other',
    );
    expect(repository.calls[0]?.scope).toMatchObject({
      accountKey: 'one_time',
      productKey: 'one_time_mishnah_class',
    });
  });

  it('keeps the cursor out of URLs and binds cursor to filters and mode', async () => {
    repository.rows = Array.from({ length: 26 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      accountKey: ownerSession.accountKey,
      productKey: ownerSession.productKey,
      contactKey: 'contact_public_test',
      eventType: 'family_signup_email_ack.v1',
      channel: 'email',
      status: 'pending',
      createdAt: new Date(Date.UTC(2026, 6, 14, 10, 0, 0) - index * 1000).toISOString(),
      deliveredAt: null,
      emailNormalized: 'cursor@example.test',
      phoneNormalized: null,
    }));
    const first = await api(
      '/api/v1/communications?from=2026-07-01T00:00:00.000Z&to=2026-07-15T00:00:00.000Z&limit=25',
    );
    const firstJson = await first.json();
    expect(firstJson.next_cursor).toBeTruthy();
    expect(first.url).not.toContain(String(firstJson.next_cursor));

    const next = await fetch(
      `${baseUrl}/api/v1/communications?from=2026-07-01T00:00:00.000Z&to=2026-07-15T00:00:00.000Z&limit=25`,
      {
        headers: {
          'x-test-role': 'owner',
          'x-ot-communications-cursor': firstJson.next_cursor,
        },
      },
    );
    expect(next.status).toBe(200);
    expect(repository.calls.at(-1)?.cursor).toMatchObject({
      lastCreatedAt: repository.rows[24]?.createdAt,
      lastId: repository.rows[24]?.id,
    });

    const mismatched = await fetch(
      `${baseUrl}/api/v1/communications?from=2026-07-02T00:00:00.000Z&to=2026-07-15T00:00:00.000Z&limit=25`,
      {
        headers: {
          'x-test-role': 'owner',
          'x-ot-communications-cursor': firstJson.next_cursor,
        },
      },
    );
    expect(mismatched.status).toBe(400);
  });

  it('returns unavailable separately from empty', async () => {
    repository.sourceAvailable = false;
    const unavailable = await api('/api/v1/communications');
    expect(unavailable.status).toBe(200);
    expect(await unavailable.json()).toMatchObject({
      success: true,
      availability: 'unavailable',
      items: [],
    });
    repository.sourceAvailable = true;
    const empty = await api('/api/v1/communications');
    expect(empty.status).toBe(200);
    expect(await empty.json()).toMatchObject({
      success: true,
      availability: 'available',
      items: [],
    });
  });

  it('supports contact-local mode without accepting contact identifiers in query strings', async () => {
    await api(
      '/api/v1/crm/contacts/contact_public_test/communications?from=2026-07-01T00:00:00.000Z&to=2026-07-15T00:00:00.000Z&contact_key=other',
    );
    expect(repository.contactChecks).toEqual(['contact_public_test']);
    expect(repository.calls[0]?.mode).toEqual({
      kind: 'contact',
      contactId: 'contact_public_test',
    });
  });

  it('returns 404 for missing contacts before outbox projection', async () => {
    repository.contactIds.clear();
    const response = await api('/api/v1/crm/contacts/contact_public_test/communications');
    expect(response.status).toBe(404);
    expect(repository.contactChecks).toEqual(['contact_public_test']);
    expect(repository.calls).toHaveLength(0);
  });
});

function api(path: string, role = 'owner') {
  return fetch(`${baseUrl}${path}`, { headers: { 'x-test-role': role } });
}

class HeaderSessionPort implements ReadOnlySessionScopePort {
  async resolve(req: express.Request) {
    const role = req.header('x-test-role');
    if (!role) return null;
    return { ...ownerSession, role };
  }
}

class FakeRepository implements CommunicationsReadRepository {
  rows: CommunicationIntentListResult['rows'] = [];
  calls: CommunicationIntentListInput[] = [];
  contactIds = new Set(['contact_public_test']);
  contactChecks: string[] = [];
  sourceAvailable = true;

  async contactExists(input: { contactId: string }) {
    this.contactChecks.push(input.contactId);
    return this.contactIds.has(input.contactId);
  }

  async list(input: CommunicationIntentListInput) {
    this.calls.push(input);
    return {
      sourceAvailable: this.sourceAvailable,
      rows: this.rows,
    };
  }
}
