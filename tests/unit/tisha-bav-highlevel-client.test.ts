import { describe, expect, it, vi } from 'vitest';
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
});
