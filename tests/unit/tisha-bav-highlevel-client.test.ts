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
      .mockResolvedValueOnce(Response.json({ tags: [], tagsAdded: ['event-tag'] }, { status: 201 }))
      .mockResolvedValueOnce(
        Response.json({ contact: { id: 'contact_operator', tags: ['event-tag'] } }),
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
    expect(fetchImpl.mock.calls[2]?.[0]).toBe(
      'https://provider.example.test/contacts/contact_operator',
    );
    expect(fetchImpl.mock.calls[2]?.[1]?.method).toBe('GET');
  });

  it('fails when contact tag readback does not prove the event tags', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({}, { status: 201 }))
      .mockResolvedValue(Response.json({ contact: { id: 'contact_operator', tags: [] } }));
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
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it('retries transient and eventually consistent contact tag readback', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({}, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ message: 'temporarily unavailable' }, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ contact: { id: 'contact_operator', tags: [] } }))
      .mockResolvedValueOnce(
        Response.json({ contact: { id: 'contact_operator', tags: ['event-tag'] } }),
      );
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
    ).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it.each([
    [409, 'Contact is already enrolled'],
    [422, 'Contact is already part of this workflow and can not be added again.'],
  ] as const)(
    'returns the typed already-active outcome for an exact workflow membership %s response',
    async (status, message) => {
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ message }, { status }));
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
      ).resolves.toEqual({ outcome: 'already_active' });
    },
  );

  it('returns enrolled only for a successful workflow request', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({}, { status: 201 }));
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
    ).resolves.toEqual({ outcome: 'enrolled' });
  });

  it('removes and re-adds one active workflow execution for a repeat registration', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({}, { status: 200 }))
      .mockResolvedValueOnce(Response.json({}, { status: 201 }));
    const client = new HttpHighLevelEventClient({
      baseUrl: 'https://provider.example.test',
      token: 'private-test-token',
      apiVersion: '2021-07-28',
      fetchImpl,
    });

    await expect(
      client.restartWorkflow({
        contactId: 'contact_operator',
        workflowId: 'workflow_tisha',
        idempotencyKey: 'workflow-request-key',
      }),
    ).resolves.toEqual({ outcome: 'enrolled' });

    expect(fetchImpl.mock.calls).toEqual([
      [
        'https://provider.example.test/contacts/contact_operator/workflow/workflow_tisha',
        expect.objectContaining({ method: 'DELETE' }),
      ],
      [
        'https://provider.example.test/contacts/contact_operator/workflow/workflow_tisha',
        expect.objectContaining({ method: 'POST' }),
      ],
    ]);
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

  it.each(['duplicate', 'already exists'])(
    'does not treat a generic workflow %s conflict as enrollment proof',
    async (message) => {
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ message }, { status: 409 }));
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
      ).rejects.toThrow('status 409');
    },
  );

  it('rejects provider mode without the exact workflow and location contract', () => {
    const base = {
      NODE_ENV: 'test',
      PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
      HIGHLEVEL_EVENT_SYNC_MODE: 'provider',
      HIGHLEVEL_PRIVATE_INTEGRATIONS_TOKEN: 'test-only-private-token',
    };
    expect(() => loadConfig(base)).toThrow('HIGHLEVEL_TISHA_BAV_WORKFLOW_ID');
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

  it('rejects a partially enabled primary Resend confirmation transport', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'test',
        PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
        ONE_TIME_TISHA_BAV_CONFIRMATION_TRANSPORT: 'resend',
      }),
    ).toThrow("Tisha B'Av Resend confirmation config missing");
  });
});
