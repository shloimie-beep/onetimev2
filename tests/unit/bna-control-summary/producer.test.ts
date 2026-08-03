import { createHmac } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import {
  BNA_CONTROL_SUMMARY_EVENT_TYPES,
  type BnaControlSummaryEventType,
  type BnaControlSummaryInput,
} from '../../../packages/domain/src/bna-control-summary/contract.ts';
import {
  BNA_CONTROL_SUMMARY_CONFIG_NAMES,
  BnaControlSummaryProducerError,
  createBnaControlSummaryProducer,
  loadBnaControlSummaryProducerConfig,
  stableBnaControlSummaryIdentity,
} from '../../../packages/domain/src/bna-control-summary/producer.ts';

const SECRET = 'test-only-bna-summary-hmac-secret-32-bytes-minimum';
const KEY_ID = 'onetime-bna-summary-test-v1';
const NOW = new Date('2026-08-03T20:00:00.000Z');

describe.each(BNA_CONTROL_SUMMARY_EVENT_TYPES)('BNA control summary event %s', (eventType) => {
  it('prepares the exact sanitized v1 envelope', () => {
    const producer = configuredProducer();
    const plan = producer.prepare(eventInput(eventType));

    expect(plan.envelope).toMatchObject({
      schema_version: 'bna.control_summary.v1',
      event_type: eventType,
      data_classification: 'sanitized_summary',
      signature_algorithm: 'hmac-sha256',
      key_id: KEY_ID,
      signed_at: NOW.toISOString(),
      replay_window_seconds: 300,
    });
    expect(Object.keys(plan.envelope).sort()).toEqual(
      [
        'schema_version',
        'event_type',
        'event_id',
        'idempotency_key',
        'source_product',
        'source_workspace',
        'source_object_type',
        'source_object_id',
        'source_object_version',
        'occurred_at',
        'title',
        'status',
        'assignee',
        'priority',
        'deep_link',
        'data_classification',
        'signature_algorithm',
        'key_id',
        'signed_at',
        'replay_window_seconds',
      ].sort(),
    );
  });
});

describe('BNA control summary producer safety', () => {
  it('is disabled by default and exposes the exact configuration names', () => {
    expect(loadBnaControlSummaryProducerConfig({})).toEqual({
      enabled: false,
      endpointUrl: null,
      keyId: null,
      secret: null,
    });
    expect(BNA_CONTROL_SUMMARY_CONFIG_NAMES).toEqual({
      enabled: 'BNA_CONTROL_SUMMARY_EVENTS_ENABLED',
      endpointUrl: 'BNA_CONTROL_SUMMARY_ENDPOINT_URL',
      keyId: 'BNA_CONTROL_SUMMARY_HMAC_KEY_ID',
      secret: 'BNA_CONTROL_SUMMARY_HMAC_SECRET',
    });
    expect(() =>
      createBnaControlSummaryProducer({
        config: loadBnaControlSummaryProducerConfig({}),
      }).prepare(eventInput('work_item.created')),
    ).toThrowError(expect.objectContaining({ code: 'producer_disabled' }));
  });

  it('requires an HTTPS endpoint and complete separate signing configuration when enabled', () => {
    const base = {
      BNA_CONTROL_SUMMARY_EVENTS_ENABLED: 'true',
      BNA_CONTROL_SUMMARY_HMAC_KEY_ID: KEY_ID,
      BNA_CONTROL_SUMMARY_HMAC_SECRET: SECRET,
    };
    expect(() =>
      loadBnaControlSummaryProducerConfig({
        ...base,
        BNA_CONTROL_SUMMARY_ENDPOINT_URL: 'http://bna.example.test/events',
      }),
    ).toThrowError(expect.objectContaining({ code: 'configuration_invalid' }));
    expect(() => loadBnaControlSummaryProducerConfig(base)).toThrowError(
      expect.objectContaining({ code: 'configuration_invalid' }),
    );
  });

  it.each([
    'notes',
    'messages',
    'transcripts',
    'contact_data',
    'student_data',
    'credentials',
    'cookies',
    'private_fields',
  ])('rejects the forbidden privacy field %s', (field) => {
    const producer = configuredProducer();
    const unsafe = { ...eventInput('work_item.updated'), [field]: 'must not leave One Time' };
    expect(() => producer.prepare(unsafe)).toThrowError(
      expect.objectContaining({ code: 'privacy_rejected' }),
    );
  });

  it('rejects contact-like summary text and sensitive deep-link query keys', () => {
    const producer = configuredProducer();
    expect(() =>
      producer.prepare({ ...eventInput('ticket.opened'), assignee: 'person@example.test' }),
    ).toThrowError(expect.objectContaining({ code: 'privacy_rejected' }));
    expect(() =>
      producer.prepare({
        ...eventInput('ticket.opened'),
        deep_link: 'https://app.onetimeonetime.com/app/operations?session=private',
      }),
    ).toThrowError(expect.objectContaining({ code: 'privacy_rejected' }));
  });

  it('signs the exact raw UTF-8 JSON body with HMAC-SHA256', () => {
    const producer = configuredProducer();
    const plan = producer.prepare(eventInput('decision.required'));
    const expected = createHmac('sha256', SECRET).update(plan.rawBody, 'utf8').digest('hex');

    expect(plan.signatureHex).toBe(expected);
    expect(plan.headers).toMatchObject({
      'X-BNA-Summary-Key-Id': KEY_ID,
      'X-BNA-Summary-Signature': `sha256=${expected}`,
    });
    expect(JSON.parse(plan.rawBody)).toEqual(plan.envelope);
    expect(producer.verify(plan)).toEqual(plan.envelope);
  });

  it('rejects a delivery plan outside the 300-second replay window', () => {
    let clock = NOW;
    const producer = configuredProducer(() => clock);
    const plan = producer.prepare(eventInput('deploy.started'));
    clock = new Date(NOW.getTime() + 301_000);

    expect(() => producer.verify(plan)).toThrowError(
      expect.objectContaining({ code: 'replay_expired' }),
    );
  });

  it('preserves the exact event ID, idempotency key, body, and signature across retries', async () => {
    const requests: Array<{ url: string; body: string; headers: HeadersInit | undefined }> = [];
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async (url, init) => {
        requests.push({ url: String(url), body: String(init?.body), headers: init?.headers });
        return new Response('', { status: 503 });
      })
      .mockImplementationOnce(async (url, init) => {
        requests.push({ url: String(url), body: String(init?.body), headers: init?.headers });
        return new Response('', { status: 202 });
      });
    const producer = configuredProducer(() => NOW, fetchImpl);
    const plan = producer.prepare(eventInput('canary.succeeded'));
    const result = await producer.deliver(plan);

    expect(result).toMatchObject({
      delivered: true,
      attempts: 2,
      eventId: plan.envelope.event_id,
      idempotencyKey: plan.envelope.idempotency_key,
    });
    expect(requests).toHaveLength(2);
    expect(requests[0]).toEqual(requests[1]);
    expect(requests[0]?.body).toBe(plan.rawBody);
    expect(JSON.parse(requests[0]?.body ?? '{}')).toMatchObject({
      event_id: plan.envelope.event_id,
      idempotency_key: plan.envelope.idempotency_key,
      source_object_version: plan.envelope.source_object_version,
    });
  });

  it('derives stable event and idempotency identities from the immutable source version', () => {
    const identityInput = {
      eventType: 'agent.result_recorded' as const,
      sourceProduct: 'One Time',
      sourceWorkspace: 'OT-V21-PRODUCTION',
      sourceObjectType: 'agent_result',
      sourceObjectId: 'OT-LIVE-001.02',
      sourceObjectVersion: 'ffd1c55a',
    };
    expect(stableBnaControlSummaryIdentity(identityInput)).toEqual(
      stableBnaControlSummaryIdentity(identityInput),
    );
    expect(
      stableBnaControlSummaryIdentity({ ...identityInput, sourceObjectVersion: 'next-version' }),
    ).not.toEqual(stableBnaControlSummaryIdentity(identityInput));
  });

  it('fails closed when the raw body is changed after signing', () => {
    const producer = configuredProducer();
    const plan = producer.prepare(eventInput('deploy.succeeded'));
    const altered = { ...plan, rawBody: plan.rawBody.replace('complete', 'failed') };
    expect(() => producer.verify(altered)).toThrow(BnaControlSummaryProducerError);
  });
});

function configuredProducer(now: () => Date = () => NOW, fetchImpl?: typeof fetch) {
  const config = loadBnaControlSummaryProducerConfig({
    BNA_CONTROL_SUMMARY_EVENTS_ENABLED: 'true',
    BNA_CONTROL_SUMMARY_ENDPOINT_URL: 'https://bna.example.test/api/control-summary-events',
    BNA_CONTROL_SUMMARY_HMAC_KEY_ID: KEY_ID,
    BNA_CONTROL_SUMMARY_HMAC_SECRET: SECRET,
  });
  return createBnaControlSummaryProducer({ config, now, ...(fetchImpl ? { fetchImpl } : {}) });
}

function eventInput(eventType: BnaControlSummaryEventType): BnaControlSummaryInput {
  const identity = stableBnaControlSummaryIdentity({
    eventType,
    sourceProduct: 'One Time',
    sourceWorkspace: 'OT-V21-PRODUCTION',
    sourceObjectType: 'work_item',
    sourceObjectId: `OT-LIVE-${eventType}`,
    sourceObjectVersion: 'version-1',
  });
  return {
    event_type: eventType,
    event_id: identity.eventId,
    idempotency_key: identity.idempotencyKey,
    source_product: 'One Time',
    source_workspace: 'OT-V21-PRODUCTION',
    source_object_type: 'work_item',
    source_object_id: `OT-LIVE-${eventType}`,
    source_object_version: 'version-1',
    occurred_at: '2026-08-03T19:59:00.000Z',
    title: 'Bounded release work is complete',
    status: 'complete',
    assignee: 'Shloimie',
    priority: 'today',
    deep_link: 'https://app.onetimeonetime.com/app/operations',
  };
}
