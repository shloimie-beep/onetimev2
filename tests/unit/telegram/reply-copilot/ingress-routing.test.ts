import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  NO_SUGGESTION_REVIEW_REQUIRED,
  REPLY_COPILOT_ROUTE_TABLE_VERSION,
  type NormalizedGhlInboundEmail,
  type ReplyCopilotVoiceExample,
} from '../../../../packages/contracts/src/telegram/reply-copilot.ts';
import {
  parseAndNormalizeGhlInboundEmail,
  ReplyCopilotIngressError,
} from '../../../../packages/domain/src/telegram/reply-copilot/ingress.ts';
import { routeReplyCopilotInbound } from '../../../../packages/domain/src/telegram/reply-copilot/routing.ts';
import {
  verifyGhlEd25519Signature,
  verifyWorkflowSharedSecret,
} from '../../../../packages/domain/src/telegram/reply-copilot/security.ts';
import {
  proposeRabbiVoiceProfileRevision,
  RABBI_REPLY_VOICE_PROFILE,
  suggestReplyCopilotResponse,
} from '../../../../packages/domain/src/telegram/reply-copilot/voice.ts';

describe('OT-LIVE-003 GHL ingress and deterministic routing', () => {
  it('verifies the temporary shared-secret path without leaking secret material', () => {
    expect(verifyWorkflowSharedSecret('correct-value-123', 'correct-value-123')).toBe(true);
    expect(verifyWorkflowSharedSecret('wrong-value-12345', 'correct-value-123')).toBe(false);
    expect(verifyWorkflowSharedSecret(undefined, 'correct-value-123')).toBe(false);
  });

  it('verifies the canonical raw-body Ed25519 signature', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const raw = Buffer.from('{"type":"InboundMessage"}', 'utf8');
    const signature = sign(null, raw, privateKey).toString('base64');
    const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    expect(verifyGhlEd25519Signature(raw, signature, pem)).toBe(true);
    expect(verifyGhlEd25519Signature(Buffer.from(`${raw.toString()} `), signature, pem)).toBe(
      false,
    );
  });

  it('normalizes bounded inbound email identity and strips HTML', () => {
    const normalized = normalize({
      body: '<p>Can you explain the first Mishnah?</p><br>Thank you',
      attachments: [
        { fileName: 'sheet.pdf', mimeType: 'application/pdf', sizeBytes: 1200, url: 'ptr://one' },
      ],
    });
    expect(normalized).toMatchObject({
      eventKey: 'wh_1',
      direction: 'inbound',
      channel: 'email',
      body: 'Can you explain the first Mishnah?\n\nThank you',
      senderDisplayName: 'Parent One',
      emailMessageId: 'email_1',
      threadId: 'thread_1',
    });
    expect(normalized.attachmentMetadata).toEqual([
      {
        name: 'sheet.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1200,
        pointer: 'ptr://one',
      },
    ]);
  });

  it.each([
    [{ locationId: 'wrong' }, 'GHL_LOCATION_DENIED'],
    [{ direction: 'outbound' }, 'GHL_DIRECTION_DENIED'],
    [{ messageType: 'SMS' }, 'GHL_CHANNEL_DENIED'],
    [
      { attachments: Array.from({ length: 9 }, () => 'ptr://file') },
      'GHL_ATTACHMENTS_BOUNDS_INVALID',
    ],
  ])('rejects denied or unbounded payloads', (change, code) => {
    expect(() => normalize(change)).toThrowError(expect.objectContaining({ code }));
  });

  it('routes protected administrative classes to Shloimie before Torah keywords', () => {
    const result = routeReplyCopilotInbound(
      inbound({ body: 'I need a refund for the Mishnah class subscription.' }),
      { route: 'RABBI', confidence: 1 },
    );
    expect(result).toEqual({
      route: 'SHLOIMIE',
      reasonCode: 'billing_or_subscription',
      protectedAdministrativeClass: true,
      confidence: 'hard_rule',
      routeTableVersion: REPLY_COPILOT_ROUTE_TABLE_VERSION,
    });
  });

  it('routes substantive Torah/teaching content to Rabbi and info/generic mail to Shloimie', () => {
    expect(
      routeReplyCopilotInbound(inbound({ body: 'What did you teach in the Mishnah today?' })).route,
    ).toBe('RABBI');
    expect(routeReplyCopilotInbound(inbound({ body: 'Hello, I have a question.' })).route).toBe(
      'SHLOIMIE',
    );
    expect(
      routeReplyCopilotInbound(
        inbound({ to: 'rabbi@onetimeonetime.com', body: 'A general note.' }),
        { route: 'RABBI', confidence: 0.9 },
      ).route,
    ).toBe('RABBI');
  });

  it('creates only grounded suggestions and fails closed for sensitive content', () => {
    const teaching = inbound({ body: 'How do the color coding and review quizzes help?' });
    const suggested = suggestReplyCopilotResponse({
      inbound: teaching,
      routing: routeReplyCopilotInbound(teaching),
    });
    expect(suggested.state).toBe('suggested');
    expect(suggested.text).toContain('color coding');
    expect(suggested.voiceProfileVersion).toBe(RABBI_REPLY_VOICE_PROFILE.version);
    expect(suggested.text).not.toMatch(/world-famous/i);

    const sensitive = inbound({ body: 'Please give a halachic ruling and guarantee it.' });
    const blocked = suggestReplyCopilotResponse({
      inbound: sensitive,
      routing: routeReplyCopilotInbound(sensitive),
    });
    expect(blocked).toMatchObject({
      state: 'review_required',
      text: NO_SUGGESTION_REVIEW_REQUIRED,
    });
  });

  it('proposes but never auto-promotes a profile revision from enough approved outcomes', () => {
    const examples = Array.from({ length: 12 }, (_, index) => voiceExample(index, true));
    const proposal = proposeRabbiVoiceProfileRevision(examples);
    expect(proposal).toMatchObject({
      status: 'awaiting_explicit_admin_approval',
      autoPromoted: false,
      rollbackVersion: RABBI_REPLY_VOICE_PROFILE.version,
      approvedExampleCount: 12,
    });
    expect(proposeRabbiVoiceProfileRevision(examples.slice(0, 11))).toBeNull();
    expect(
      proposeRabbiVoiceProfileRevision(
        examples.map((entry) => ({ ...entry, approvedForVoice: false })),
      ),
    ).toBeNull();
  });
});

function normalize(change: Record<string, unknown> = {}) {
  return parseAndNormalizeGhlInboundEmail({
    rawBody: Buffer.from(JSON.stringify({ ...payload(), ...change })),
    ingressKind: 'oauth_ed25519',
    now: new Date('2026-08-03T17:00:00.000Z'),
  });
}

function payload() {
  return {
    webhookId: 'wh_1',
    type: 'InboundMessage',
    locationId: 'pBSnOK2nkdxp6gf9Rg3o',
    contactId: 'contact_1',
    conversationId: 'conversation_1',
    messageId: 'message_1',
    emailMessageId: 'email_1',
    threadId: 'thread_1',
    direction: 'inbound',
    messageType: 'Email',
    from: 'Parent One <parent@example.test>',
    to: 'info@onetimeonetime.com',
    subject: 'Question',
    body: 'Hello',
    attachments: [],
    dateAdded: '2026-08-03T16:59:00.000Z',
  };
}

function inbound(change: Partial<NormalizedGhlInboundEmail>): NormalizedGhlInboundEmail {
  return { ...normalize(), ...change };
}

function voiceExample(index: number, approvedForVoice: boolean): ReplyCopilotVoiceExample {
  return {
    exampleKey: `example_${index}`,
    intentKey: `intent_${index}`,
    messageClass: 'teaching_content',
    outcome: index % 2 === 0 ? 'accepted_exact' : 'edited',
    suggestionDigest: 'a'.repeat(64),
    finalDigest: index.toString(16).padStart(64, '0'),
    promptVersion: 'prompt-v1',
    modelVersion: 'model-v1',
    approvedForVoice,
    actorUserRefHash: 'b'.repeat(64),
    finalTextRef: null,
    recordedAt: '2026-08-03T17:00:00.000Z',
  };
}

void ReplyCopilotIngressError;
