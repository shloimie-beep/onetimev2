import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type {
  AdminSearchPage,
  AdminSearchResult,
} from '../../../../../../../packages/contracts/src/admin/operations/index.ts';
import {
  AdminGlobalSearch,
  buildAdminSearchRequest,
  postPrivateAdminSearch,
} from './AdminGlobalSearch.tsx';

const scope = {
  product: 'one_time_mishnayos',
  runtimeTier: 'isolated_staging',
  verificationEnvironmentId: 'ci',
} as const;
const result: AdminSearchResult = {
  ...scope,
  source: 'persistent_store',
  kind: 'student',
  targetId: 'student-one',
  label: 'Student One',
  distinguishingMetadata: 'Household One',
  status: 'active',
  matchedBy: 'name',
  destination: { route: '/app/students/:studentId', targetId: 'student-one' },
};
const page: AdminSearchPage = {
  source: 'persistent_store',
  authorization: 'runtime_admin',
  queryInUrl: false,
  analyticsAllowed: false,
  results: [result],
  nextCursor: 'MjA',
};

describe('P11 private Admin global search', () => {
  it('groups safe authorized results and supports recent-query clearing', () => {
    const html = renderToStaticMarkup(
      <AdminGlobalSearch
        initialPage={page}
        recentQueries={['Student One']}
        onSearch={() => Promise.resolve(page)}
        onOpen={() => undefined}
        onClearRecentQueries={() => undefined}
        onNavigate={() => undefined}
      />,
    );
    expect(html).toContain('Students');
    expect(html).toContain('Student One');
    expect(html).toContain('Clear recent searches');
    expect(html).not.toContain('?q=');
  });

  it('posts private terms only in a no-store request body', async () => {
    const request = buildAdminSearchRequest('private student name', ['student']);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(page), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    await expect(postPrivateAdminSearch(fetcher, request)).resolves.toEqual(page);
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe('/api/v2.1/admin/search');
    expect(String(url)).not.toContain('private student name');
    expect(init).toMatchObject({
      method: 'POST',
      cache: 'no-store',
      credentials: 'same-origin',
    });
    expect(String(init?.body)).toContain('private student name');
  });
});
