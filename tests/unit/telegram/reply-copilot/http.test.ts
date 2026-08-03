import { generateKeyPairSync, sign } from 'node:crypto';
import { createServer, type RequestListener } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGhlReplyCopilotWebhookHandler } from '../../../../apps/telegram-bot/src/reply-copilot/http.ts';
import type { ReplyCopilotService } from '../../../../packages/domain/src/telegram/reply-copilot/service.ts';

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

describe('OT-LIVE-003 HTTP ingress', () => {
  it('accepts the shared-secret Customer Replied path and acknowledges duplicates', async () => {
    const ingest = vi
      .fn()
      .mockResolvedValueOnce({ duplicate: false })
      .mockResolvedValueOnce({ duplicate: true });
    const endpoint = await serve(
      createGhlReplyCopilotWebhookHandler({
        service: { ingest } as unknown as ReplyCopilotService,
        ingressKind: 'workflow_shared_secret',
        enabled: true,
        allowedLocationId: 'pBSnOK2nkdxp6gf9Rg3o',
        workflowSharedSecret: 'workflow-secret-value-123',
      }),
    );
    const first = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-onetime-webhook-secret': 'workflow-secret-value-123',
      },
      body: JSON.stringify(payload({ type: 'CustomerReplied' })),
    });
    const duplicate = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-onetime-webhook-secret': 'workflow-secret-value-123',
      },
      body: JSON.stringify(payload({ type: 'CustomerReplied' })),
    });
    expect(first.status).toBe(202);
    expect(await first.json()).toEqual({ ok: true, duplicate: false, accepted: true });
    expect(duplicate.status).toBe(200);
    expect(await duplicate.json()).toEqual({ ok: true, duplicate: true, accepted: false });
    expect(ingest).toHaveBeenCalledTimes(2);
  });

  it('verifies the canonical signature against the unchanged raw body', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const ingest = vi.fn().mockResolvedValue({ duplicate: false });
    const endpoint = await serve(
      createGhlReplyCopilotWebhookHandler({
        service: { ingest } as unknown as ReplyCopilotService,
        ingressKind: 'oauth_ed25519',
        enabled: true,
        allowedLocationId: 'pBSnOK2nkdxp6gf9Rg3o',
        ghlPublicKey: pem,
      }),
    );
    const raw = Buffer.from(JSON.stringify(payload()));
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-ghl-signature': sign(null, raw, privateKey).toString('base64'),
      },
      body: raw,
    });
    expect(response.status).toBe(202);
    expect(ingest).toHaveBeenCalledTimes(1);
    const rejected = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-ghl-signature': 'bad' },
      body: raw,
    });
    expect(rejected.status).toBe(401);
    expect(ingest).toHaveBeenCalledTimes(1);
  });

  it('keeps a disabled ingress inert', async () => {
    const ingest = vi.fn();
    const endpoint = await serve(
      createGhlReplyCopilotWebhookHandler({
        service: { ingest } as unknown as ReplyCopilotService,
        ingressKind: 'workflow_shared_secret',
        enabled: false,
        allowedLocationId: 'pBSnOK2nkdxp6gf9Rg3o',
      }),
    );
    const response = await fetch(endpoint, { method: 'POST' });
    expect(response.status).toBe(404);
    expect(ingest).not.toHaveBeenCalled();
  });
});

async function serve(handler: RequestListener) {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

function payload(change: Record<string, unknown> = {}) {
  return {
    webhookId: 'webhook_1',
    type: 'InboundMessage',
    locationId: 'pBSnOK2nkdxp6gf9Rg3o',
    contactId: 'contact_1',
    conversationId: 'conversation_1',
    messageId: 'message_1',
    emailMessageId: 'email_1',
    threadId: 'thread_1',
    direction: 'inbound',
    messageType: 'Email',
    from: 'Parent <parent@example.test>',
    to: 'info@onetimeonetime.com',
    subject: 'Question about Mishnah',
    body: 'What did you teach today?',
    attachments: [],
    ...change,
  };
}
