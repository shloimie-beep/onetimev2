import { afterEach, describe, expect, it, vi } from 'vitest';
import { HighLevelHttpAdapter } from '../../../apps/worker/src/highlevel/adapter.ts';
import { loadConfig } from '../../../packages/config/src/index.ts';
import type { HighLevelProjection } from '../../../packages/domain/src/highlevel/dispatcher.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('HighLevel HTTP adapter operation identity', () => {
  it('binds a distinct durable operation key to upsert and add-tag requests', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ contact: { id: 'provider-contact-fixture' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ tags: ['OT | Lead'] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ contact: { tags: ['OT | Lead'] } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    const config = loadConfig({
      NODE_ENV: 'test',
      HIGHLEVEL_EVENT_SYNC_MODE: 'provider',
      HIGHLEVEL_PRIVATE_INTEGRATIONS_TOKEN: 'test-provider-token',
      HIGHLEVEL_CANARY_RUN_ID: 'adapter-canary-run-0001',
      HIGHLEVEL_CANARY_DELIVERY_KEYS: 'adapter-delivery-key-0001',
      HIGHLEVEL_CANARY_BUDGET: '1',
    });
    const adapter = new HighLevelHttpAdapter(config);
    const projection: HighLevelProjection = {
      idempotencyKey: 'adult-event-idempotency-0001',
      eventName: 'adult.signup.submitted',
      locationId: config.highLevelLocationId,
      adult: {
        contactKey: 'adult-contact-fixture',
        email: 'adult@example.test',
        displayName: 'Adult Fixture',
        phone: null,
      },
      tagsToAdd: ['OT | Lead'],
      customFields: [{ id: 'TRZGYm5rfFdjpYHM0HLL', value: 'adult-contact-fixture' }],
    };

    const upsert = await adapter.upsertContact(projection, {
      operationKey: 'highlevel-operation-upsert-0001',
      idempotencyKey: projection.idempotencyKey,
    });
    await adapter.addTags(
      {
        locationId: projection.locationId,
        providerContactId: upsert.providerContactId,
        tagsToAdd: projection.tagsToAdd,
      },
      {
        operationKey: 'highlevel-operation-add-tags-0001',
        idempotencyKey: projection.idempotencyKey,
      },
    );
    await expect(
      adapter.readTags(
        {
          locationId: projection.locationId,
          providerContactId: upsert.providerContactId,
        },
        {
          operationKey: 'highlevel-operation-read-tags-0001',
          idempotencyKey: projection.idempotencyKey,
        },
      ),
    ).resolves.toEqual(['OT | Lead']);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(headersFor(fetchMock.mock.calls[0]?.[1])).toMatchObject({
      'idempotency-key': 'highlevel-operation-upsert-0001',
    });
    expect(headersFor(fetchMock.mock.calls[1]?.[1])).toMatchObject({
      'idempotency-key': 'highlevel-operation-add-tags-0001',
    });
    expect(headersFor(fetchMock.mock.calls[2]?.[1])).toMatchObject({
      'idempotency-key': 'highlevel-operation-read-tags-0001',
    });
  });
});

function headersFor(init: RequestInit | undefined) {
  return Object.fromEntries(new Headers(init?.headers).entries());
}
