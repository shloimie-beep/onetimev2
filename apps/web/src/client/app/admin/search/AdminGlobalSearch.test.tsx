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
  postPrivateAdminNavigationResolution,
  postPrivateAdminSearch,
  shouldClearAdminPrivateState,
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
        authorization={{ state: 'admin', credentialVersion: 7 }}
        onSearch={() => Promise.resolve(page)}
        onResolveOpen={() =>
          Promise.resolve({ state: 'open', href: '/app/students/student-one', cache: 'no-store' })
        }
        onClearRecentQueries={() => undefined}
        onNavigate={() => undefined}
      />,
    );
    expect(html).toContain('Students');
    expect(html).toContain('Student One');
    expect(html).toContain('Clear recent searches');
    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-controls="admin-search-results"');
    expect(html).toContain('aria-activedescendant="admin-search-option-student-student-one"');
    expect(html).toContain('role="option"');
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

  it('resolves selected targets through a fresh private no-store POST and invalidates stale state', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          state: 'open',
          href: '/app/students/student-one',
          cache: 'no-store',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    await expect(
      postPrivateAdminNavigationResolution(fetcher, {
        kind: 'student',
        targetId: 'student-one',
        selectedCredentialVersion: 7,
      }),
    ).resolves.toMatchObject({ state: 'open', href: '/app/students/student-one' });
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe('/api/v2.1/admin/operations/resolve');
    expect(init).toMatchObject({
      method: 'POST',
      cache: 'no-store',
      credentials: 'same-origin',
    });
    expect(shouldClearAdminPrivateState(7, { state: 'admin', credentialVersion: 7 })).toBe(false);
    expect(shouldClearAdminPrivateState(7, { state: 'revoked', credentialVersion: 7 })).toBe(true);
    expect(shouldClearAdminPrivateState(7, { state: 'admin', credentialVersion: 8 })).toBe(true);
    expect(shouldClearAdminPrivateState(7, { state: 'admin', credentialVersion: 7 }, true)).toBe(
      true,
    );
  });
});
