import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../packages/config/src/index.ts';
import { HttpHighLevelEventClient } from '../../packages/domain/src/index.ts';

describe('Tisha BAv HighLevel client', () => {
  it('creates only tags that are absent from the location', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          tags: [{ name: "OT | Event | Tisha B'Av 2026 | Registered" }],
        }),
      )
      .mockResolvedValueOnce(Response.json({ tag: { id: 'tag_source' } }, { status: 201 }));
    const client = new HttpHighLevelEventClient({
      baseUrl: 'https://provider.example.test',
      token: 'private-test-token',
      apiVersion: '2021-07-28',
      fetchImpl,
    });

    await client.ensureTags({
      locationId: 'location_one_time',
      tags: ["OT | Event | Tisha B'Av 2026 | Registered", "OT | Source | Tisha B'Av 2026"],
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0]?.[1]?.method).toBe('GET');
    expect(fetchImpl.mock.calls[1]?.[1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ name: "OT | Source | Tisha B'Av 2026" }),
    });
  });

  it('uses the supported contact payload and tag endpoint', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ contact: { id: 'contact_operator' } }))
      .mockResolvedValueOnce(
        Response.json({ tags: [], tagsAdded: ['event-tag'] }, { status: 201 }),
      );
    const client = new HttpHighLevelEventClient({
      baseUrl: 'https://provider.example.test',
      token: 'private-test-token',
      apiVersion: '2021-07-28',
      fetchImpl,
    });

    const contact = await client.upsertContact({
      locationId: 'location_one_time',
      email: 'operator@example.test',
      source: "Tisha B'Av 2026 Landing",
      customFields: {
        'contact.one_time_signup_source': "Tisha B'Av 2026 Landing",
      },
    });
    await client.addTags({
      locationId: 'location_one_time',
      contactId: contact.contactId,
      tags: ['event-tag'],
    });

    const upsertBody = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(upsertBody.customFields).toEqual([
      {
        key: 'contact.one_time_signup_source',
        fieldValue: "Tisha B'Av 2026 Landing",
      },
    ]);
    expect(fetchImpl.mock.calls[1]?.[0]).toBe(
      'https://provider.example.test/contacts/contact_operator/tags',
    );
    expect(fetchImpl.mock.calls[1]?.[1]).toMatchObject({
      body: JSON.stringify({ tags: ['event-tag'] }),
      headers: expect.objectContaining({ version: '2023-02-21' }),
    });
  });

  it('fails when contact tag readback does not prove the event tags', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({}, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ contact: { id: 'contact_operator', tags: [] } }));
    const client = new HttpHighLevelEventClient({
      baseUrl: 'https://provider.example.test',
      token: 'private-test-token',
      apiVersion: '2021-07-28',
      fetchImpl,
    });

    await expect(
      client.addTags({
        locationId: 'location_one_time',
        contactId: 'contact_operator',
        tags: ['event-tag'],
      }),
    ).rejects.toThrow('HighLevel contact tag verification failed.');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it.each([409, 422])('does not treat workflow %s as enrollment success', async (status) => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ message: 'workflow enrollment rejected' }, { status }));
    const client = new HttpHighLevelEventClient({
      baseUrl: 'https://provider.example.test',
      token: 'private-test-token',
      apiVersion: '2021-07-28',
      fetchImpl,
    });

    await expect(
      client.addToWorkflow({
        contactId: 'contact_operator',
        workflowId: 'workflow_tisha',
        idempotencyKey: 'workflow-request-key',
      }),
    ).rejects.toThrow(`status ${status}`);
  });

  it('keeps the Tisha workflow optional for unrelated projections and enforces the location contract', () => {
    const base = {
      NODE_ENV: 'test',
      PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
      HIGHLEVEL_EVENT_SYNC_MODE: 'provider',
      HIGHLEVEL_PRIVATE_INTEGRATIONS_TOKEN: 'test-only-private-token',
      HIGHLEVEL_CANARY_RUN_ID: 'tisha-config-canary-run-0001',
      HIGHLEVEL_CANARY_DELIVERY_KEYS: 'tisha-config-delivery-key-0001',
      HIGHLEVEL_CANARY_BUDGET: '1',
    };
    expect(loadConfig(base).highLevelTishaBavWorkflowId).toBeUndefined();
    expect(() =>
      loadConfig({
        ...base,
        HIGHLEVEL_TISHA_BAV_WORKFLOW_ID: 'workflow_tisha',
        HIGHLEVEL_LOCATION_ID: 'wrong_location',
      }),
    ).toThrow('canonical One Time location');
  });

  it('rejects a partially enabled Resend fallback', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'test',
        PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
        ONE_TIME_EVENT_EMAIL_FALLBACK: 'resend',
      }),
    ).toThrow("Tisha B'Av Resend fallback config missing");
  });
});
