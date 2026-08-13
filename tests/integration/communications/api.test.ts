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
      '/api/v1/crm/contacts/contact_public_test/communications?from=2026-07-01T00:00:00.000Z&to=2026-07-15T00:00:00.000Z',
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('vary')).toContain('Cookie');
    const json = await response.json();
    expect(json).toMatchObject({
      success: true,
      availability: 'available',
      source_scope: 'canonical_communication_history',
      mailbox_complete: false,
    });
    expect(json.items).toHaveLength(2);
    expect(json.items[0]).toMatchObject({
      direction: 'outbound',
      local_state: 'queued',
      state_label: 'Queued',
      source: 'local_outbox_intent',
      provenance: 'local_database',
      recipient_masked: 'Email recipient',
      transport_available: false,
    });
    expect(json.items[1]).toMatchObject({
      local_state: 'sink_delivered',
      state_label: 'Processed by non-provider sink',
      recipient_masked: 'WhatsApp recipient ending 7890',
    });
    const serialized = JSON.stringify(json);
    expect(serialized).not.toContain('parent.person');
    expect(serialized).not.toContain('example.test');
    expect(serialized).not.toContain('+12125557890');
    expect(serialized).not.toContain('delivery_key');
    expect(serialized).not.toMatch(/\bSent\b|\bDelivered\b/);
  });

  it('returns stored webhook and provider status truth without pretending mailbox completeness', async () => {
    repository.rows = [
      {
        id: 'whatsapp-inbox:event_1',
        accountKey: ownerSession.accountKey,
        productKey: ownerSession.productKey,
        contactKey: 'contact_public_test',
        eventType: 'whatsapp_inbound_message.v1',
        channel: 'whatsapp',
        direction: 'inbound',
        status: 'received',
        createdAt: '2026-07-14T10:00:00.000Z',
        occurredAt: '2026-07-14T09:59:00.000Z',
        deliveredAt: null,
        emailNormalized: null,
        phoneNormalized: null,
        source: 'stored_whatsapp_webhook',
        provenance: 'stored_webhook',
        previewRedacted: 'Inbound WhatsApp message was stored. Body is encrypted and hidden.',
        providerReferenceDigest: 'a'.repeat(64),
      },
      {
        id: 'whatsapp-delivery:event_2',
        accountKey: ownerSession.accountKey,
        productKey: ownerSession.productKey,
        contactKey: 'contact_public_test',
        eventType: 'whatsapp_provider_delivery_event.v1',
        channel: 'whatsapp',
        direction: 'outbound',
        status: 'delivered',
        createdAt: '2026-07-14T11:00:00.000Z',
        occurredAt: '2026-07-14T11:00:00.000Z',
        deliveredAt: '2026-07-14T11:00:00.000Z',
        emailNormalized: null,
        phoneNormalized: null,
        source: 'stored_provider_delivery_event',
        provenance: 'stored_provider_event',
        previewRedacted: 'Stored WhatsApp provider status. Message body is hidden.',
        providerReferenceDigest: 'b'.repeat(64),
      },
    ];
    const response = await api(
      '/api/v1/crm/contacts/contact_public_test/communications?from=2026-07-01T00:00:00.000Z&to=2026-07-15T00:00:00.000Z&direction=inbound&source=stored_whatsapp_webhook',
    );
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(repository.calls[0]).toMatchObject({
      filters: {
        direction: 'inbound',
        source: 'stored_whatsapp_webhook',
      },
    });
    expect(json.mailbox_complete).toBe(false);
    expect(json.items[0]).toMatchObject({
      intent_type: 'whatsapp_inbound_message',
      direction: 'inbound',
      source: 'stored_whatsapp_webhook',
      provider_reference_digest: 'a'.repeat(64),
      preview_redacted: 'Inbound WhatsApp message was stored. Body is encrypted and hidden.',
    });
    expect(JSON.stringify(json)).not.toContain('message body');
  });

  it('returns redacted account-security delivery history to Admin without secure-link leakage', async () => {
    repository.rows = [
      {
        id: 'lifecycle:redacted-delivery-key',
        accountKey: ownerSession.accountKey,
        productKey: ownerSession.productKey,
        contactKey: null,
        eventType: 'account_password_reset.v1',
        channel: 'email',
        direction: 'outbound',
        status: 'delivered',
        createdAt: '2026-07-14T11:00:00.000Z',
        occurredAt: '2026-07-14T11:00:00.000Z',
        deliveredAt: '2026-07-14T11:00:02.000Z',
        emailNormalized: null,
        phoneNormalized: null,
        source: 'account_lifecycle_outbox',
        provenance: 'local_database',
        previewRedacted: 'Password reset delivery status. Message body and secure link are hidden.',
        providerReferenceDigest: null,
        idempotencyKey: null,
        participantKind: 'account',
        participantLabel: 'Protected Admin · Admin account',
      },
    ];
    const response = await api(
      '/api/v1/communications?from=2026-07-01T00:00:00.000Z&to=2026-07-15T00:00:00.000Z&intent_type=password_reset&status=delivered&source=account_lifecycle_outbox',
      'admin',
    );
    expect(response.status).toBe(200);
    expect(repository.calls[0]).toMatchObject({
      rawEventType: 'account_password_reset.v1',
      filters: {
        intent_type: 'password_reset',
        status: 'delivered',
        source: 'account_lifecycle_outbox',
        channel: 'email',
        direction: 'outbound',
      },
    });
    const json = await response.json();
    expect(json.items).toHaveLength(1);
    expect(json.items[0]).toMatchObject({
      intent_type: 'password_reset',
      event_label: 'Password reset email',
      local_state: 'delivered',
      state_label: 'Delivered',
      source: 'account_lifecycle_outbox',
      source_label: 'Account security delivery',
      participant_kind: 'account',
      participant_label: 'Protected Admin · Admin account',
      recipient_masked: 'Account email (hidden)',
      provider_reference_digest: null,
      idempotency_key: null,
    });
    expect(JSON.stringify(json)).not.toMatch(/#token=|reset-password|provider-message|secret/u);
  });

  it('keeps the global Admin surface bound to One Time account delivery history', async () => {
    const response = await api(
      '/api/v1/communications?source=stored_whatsapp_webhook&direction=inbound',
      'admin',
    );
    expect(response.status).toBe(200);
    expect(repository.calls[0]).toMatchObject({
      mode: { kind: 'global' },
      filters: {
        channel: 'email',
        direction: 'outbound',
        source: 'account_lifecycle_outbox',
      },
    });
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

  it('allows the Rabbi communications role without widening access to other staff roles', async () => {
    const rabbi = await api('/api/v1/communications', 'rabbi');
    expect(rabbi.status).toBe(200);
    expect(repository.calls).toHaveLength(1);
  });

  it('returns 503 when the authoritative session resolver is unavailable', async () => {
    const unavailable = await api('/api/v1/communications', 'unavailable');
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toMatchObject({ code: 'SESSION_UNAVAILABLE' });
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
      source_scope: 'canonical_communication_history',
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

  it('returns a no-store, read-only workflow registry projection without speculative UI evidence', async () => {
    const listResponse = await api('/api/v1/communications/workflows');
    expect(listResponse.status).toBe(200);
    expect(listResponse.headers.get('cache-control')).toBe('private, no-store');
    const listJson = await listResponse.json();
    expect(listJson.workflows.length).toBeGreaterThan(10);
    expect(listJson.workflows[0]).toMatchObject({
      workflow_key: 'OT-01',
      observed_status: 'DRAFT_SHELL',
    });
    expect(listJson.external_readback).toMatchObject({ result_artifact_present: false });

    const response = await api('/api/v1/communications/workflows/OT-01');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const json = await response.json();
    expect(json).toMatchObject({
      success: true,
      source_scope: 'repository_workflow_registry',
      workflow: {
        workflow_key: 'OT-01',
        observed_status: 'DRAFT_SHELL',
      },
      external_readback: {
        status: 'pending_external_readback',
        result_artifact_present: false,
        registry_reconciled_from_result: false,
      },
      boundaries: {
        read_only: true,
        provider_actions_available: false,
        student_contacts_allowed: false,
        live_charges_allowed: false,
      },
    });
    expect(json.workflow).not.toHaveProperty('essentialValues');
    expect(JSON.stringify(json)).not.toMatch(
      /publication_authorized|enrollment_authorized|https?:\/\//u,
    );
  });

  it('returns neutral workflow errors and enforces the same owner/admin boundary', async () => {
    expect((await api('/api/v1/communications/workflows/not-registered')).status).toBe(404);
    expect((await api('/api/v1/communications/workflows/OT-01', 'member')).status).toBe(403);
    expect((await fetch(`${baseUrl}/api/v1/communications/workflows/OT-01`)).status).toBe(401);
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
    if (!role) return { status: 'missing' } as const;
    if (role === 'unavailable') return { status: 'unavailable' } as const;
    return { status: 'resolved', session: { ...ownerSession, role } } as const;
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
