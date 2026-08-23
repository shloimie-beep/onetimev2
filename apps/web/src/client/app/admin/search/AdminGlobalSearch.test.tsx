import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type {
  AdminSearchPage,
  AdminSearchResult,
} from '../../../../../../../packages/contracts/src/admin/operations/index.ts';
import {
  AdminGlobalSearch,
  AdminPrivateAuthorizationError,
  buildAdminSearchRequest,
  clearAdminPrivateSearchState,
  postPrivateAdminNavigationResolution,
  postPrivateAdminSearch,
  resultOptionId,
  shouldClearAdminPrivateState,
} from './AdminGlobalSearch.tsx';
import {
  bindAdminCredentialSnapshot,
  captureAdminPrivateCompletion,
  isAdminCredentialSnapshotCurrent,
  isAdminPrivateCompletionCurrent,
  type AdminClientAuthorization,
} from '../adminPrivateCompletion.ts';

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

function retained<T>(value: T, credentialVersion = 7) {
  return bindAdminCredentialSnapshot(value, credentialVersion);
}

describe('P11 private Admin global search', () => {
  it('groups safe authorized results and supports recent-query clearing', () => {
    const html = renderToStaticMarkup(
      <AdminGlobalSearch
        initialPage={retained(page)}
        recentQueries={retained(['Student One'])}
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
    expect(html).toContain(`aria-activedescendant="${resultOptionId(result)}"`);
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

  it('surfaces stale authorization distinctly and advertises governed search actions', async () => {
    const unauthorized = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 401 }));
    await expect(
      postPrivateAdminSearch(unauthorized, buildAdminSearchRequest('private record')),
    ).rejects.toBeInstanceOf(AdminPrivateAuthorizationError);
    await expect(
      postPrivateAdminNavigationResolution(unauthorized, {
        kind: 'student',
        targetId: 'student-one',
        selectedCredentialVersion: 7,
      }),
    ).rejects.toBeInstanceOf(AdminPrivateAuthorizationError);

    const html = renderToStaticMarkup(
      <AdminGlobalSearch
        initialPage={retained(page)}
        recentQueries={retained(['Student One'])}
        authorization={{ state: 'admin', credentialVersion: 7 }}
        onSearch={() => Promise.resolve(page)}
        onResolveOpen={() =>
          Promise.resolve({ state: 'open', href: '/app/students/student-one', cache: 'no-store' })
        }
        onClearRecentQueries={() => undefined}
        onNavigate={() => undefined}
      />,
    );
    expect(html).toContain('data-action-id="admin.search.query.form"');
    expect(html).toContain('data-action-id="admin.search.result.open.button"');
    expect(html).toContain('data-action-id="admin.search.recent.clear.button"');
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
    const setters = {
      setQuery: vi.fn(),
      setPage: vi.fn(),
      setLastRequest: vi.fn(),
      setActiveIndex: vi.fn(),
      setState: vi.fn(),
      clearRecentQueries: vi.fn(),
    };
    clearAdminPrivateSearchState(setters);
    expect(setters.setQuery).toHaveBeenCalledWith('');
    expect(setters.setPage).toHaveBeenCalledWith(null);
    expect(setters.setLastRequest).toHaveBeenCalledWith(null);
    expect(setters.setActiveIndex).toHaveBeenCalledWith(0);
    expect(setters.setState).toHaveBeenCalledWith('idle');
    expect(setters.clearRecentQueries).toHaveBeenCalledOnce();
  });

  it('uses one unique combobox-controlled listbox across grouped results', () => {
    const ticket: AdminSearchResult = {
      ...result,
      kind: 'ticket',
      targetId: 'ticket-one',
      label: 'Ticket ticket-one',
      distinguishingMetadata: 'support',
      destination: { route: '/app/tickets/:ticketId', targetId: 'ticket-one' },
    };
    const groupedPage: AdminSearchPage = { ...page, results: [result, ticket] };
    const html = renderToStaticMarkup(
      <AdminGlobalSearch
        initialPage={retained(groupedPage)}
        recentQueries={retained([])}
        authorization={{ state: 'admin', credentialVersion: 7 }}
        onSearch={() => Promise.resolve(groupedPage)}
        onResolveOpen={() =>
          Promise.resolve({ state: 'open', href: '/app/students/student-one', cache: 'no-store' })
        }
        onClearRecentQueries={() => undefined}
        onNavigate={() => undefined}
      />,
    );
    expect(html.match(/id="admin-search-results"/gu)).toHaveLength(1);
    expect(html.match(/role="listbox"/gu)).toHaveLength(1);
    expect(html.match(/aria-controls="admin-search-results"/gu)).toHaveLength(1);
    expect(html).toContain('role="group"');
    expect(html).toContain(`aria-activedescendant="${resultOptionId(result)}"`);
  });

  it('renders no private page, recent query, or request state when initially revoked', () => {
    const html = renderToStaticMarkup(
      <AdminGlobalSearch
        initialPage={retained(page)}
        initialRequest={retained(buildAdminSearchRequest('Student One', ['student']))}
        recentQueries={retained(['Student One'])}
        authorization={{ state: 'revoked', credentialVersion: 8 }}
        onSearch={() => Promise.resolve(page)}
        onResolveOpen={() =>
          Promise.resolve({ state: 'open', href: '/app/students/student-one', cache: 'no-store' })
        }
        onClearRecentQueries={() => undefined}
        onNavigate={() => undefined}
      />,
    );
    expect(html).toContain('Authorization no longer permits private Admin search');
    expect(html).not.toContain('Student One');
    expect(html).not.toContain('role="combobox"');
    expect(html).not.toContain('id="admin-search-results"');
  });

  it('drops stale search and resolver promises after generation or authorization changes', async () => {
    let authorization: AdminClientAuthorization = { state: 'admin', credentialVersion: 7 };
    let generation = 1;
    const searchCompletion = captureAdminPrivateCompletion(generation, authorization)!;
    const searchPromise = deferred<AdminSearchPage>();
    const setPage = vi.fn();
    const applySearch = searchPromise.promise.then((value) => {
      if (isAdminPrivateCompletionCurrent(searchCompletion, generation, authorization)) {
        setPage(value);
      }
    });

    generation += 1;
    const resolverCompletion = captureAdminPrivateCompletion(generation, authorization)!;
    const resolverPromise = deferred<{ href: string }>();
    const navigate = vi.fn();
    const applyResolver = resolverPromise.promise.then((value) => {
      if (isAdminPrivateCompletionCurrent(resolverCompletion, generation, authorization)) {
        navigate(value.href);
      }
    });

    generation += 1;
    authorization = { state: 'revoked', credentialVersion: 8 };
    searchPromise.resolve(page);
    resolverPromise.resolve({ href: '/app/students/student-one' });
    await Promise.all([applySearch, applyResolver]);
    expect(setPage).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('fails closed on the first render for a rotated Admin credential', () => {
    const html = renderToStaticMarkup(
      <AdminGlobalSearch
        initialPage={retained(page, 7)}
        initialRequest={retained(buildAdminSearchRequest('Student One', ['student']), 7)}
        recentQueries={retained(['Student One'], 7)}
        authorization={{ state: 'admin', credentialVersion: 8 }}
        onSearch={() => Promise.resolve(page)}
        onResolveOpen={() =>
          Promise.resolve({ state: 'open', href: '/app/students/student-one', cache: 'no-store' })
        }
        onClearRecentQueries={() => undefined}
        onNavigate={() => undefined}
      />,
    );
    expect(html).toContain('role="combobox"');
    expect(html).not.toContain('Student One');
    expect(html).not.toContain('Recent searches on this device');
    expect(html).not.toContain('id="admin-search-results"');
    expect(html).not.toContain('aria-activedescendant');
  });

  it('invalidates every retained snapshot on a same-state credential-version change', () => {
    const authorization7: AdminClientAuthorization = {
      state: 'admin',
      credentialVersion: 7,
    };
    const authorization8: AdminClientAuthorization = {
      state: 'admin',
      credentialVersion: 8,
    };
    const pageSnapshot = retained(page, 7);
    const requestSnapshot = retained(buildAdminSearchRequest('Student One', ['student']), 7);
    const recentSnapshot = retained(['Student One'], 7);

    expect(isAdminCredentialSnapshotCurrent(pageSnapshot, authorization7)).toBe(true);
    expect(isAdminCredentialSnapshotCurrent(requestSnapshot, authorization7)).toBe(true);
    expect(isAdminCredentialSnapshotCurrent(recentSnapshot, authorization7)).toBe(true);
    expect(isAdminCredentialSnapshotCurrent(pageSnapshot, authorization8)).toBe(false);
    expect(isAdminCredentialSnapshotCurrent(requestSnapshot, authorization8)).toBe(false);
    expect(isAdminCredentialSnapshotCurrent(recentSnapshot, authorization8)).toBe(false);
    expect(shouldClearAdminPrivateState(7, authorization8)).toBe(true);
  });

  it('fails all retained state closed when any snapshot has a stale credential binding', () => {
    const html = renderToStaticMarkup(
      <AdminGlobalSearch
        initialPage={retained(page, 8)}
        initialRequest={retained(buildAdminSearchRequest('Student One', ['student']), 7)}
        recentQueries={retained(['Student One'], 8)}
        authorization={{ state: 'admin', credentialVersion: 8 }}
        onSearch={() => Promise.resolve(page)}
        onResolveOpen={() =>
          Promise.resolve({ state: 'open', href: '/app/students/student-one', cache: 'no-store' })
        }
        onClearRecentQueries={() => undefined}
        onNavigate={() => undefined}
      />,
    );
    expect(html).not.toContain('Student One');
    expect(html).not.toContain('Recent searches on this device');
    expect(html).not.toContain('id="admin-search-results"');
  });

  it('uses injective DOM-safe option IDs for dotted and colon target IDs', () => {
    const dotted = { ...result, targetId: 'student.one' };
    const colon = { ...result, targetId: 'student:one' };
    const dottedId = resultOptionId(dotted);
    const colonId = resultOptionId(colon);
    expect(dottedId).not.toBe(colonId);
    expect(dottedId).toMatch(/^[A-Za-z0-9_-]+$/u);
    expect(colonId).toMatch(/^[A-Za-z0-9_-]+$/u);

    const html = renderToStaticMarkup(
      <AdminGlobalSearch
        initialPage={retained({ ...page, results: [dotted, colon] })}
        recentQueries={retained([])}
        authorization={{ state: 'admin', credentialVersion: 7 }}
        onSearch={() => Promise.resolve(page)}
        onResolveOpen={() =>
          Promise.resolve({ state: 'open', href: '/app/students/student-one', cache: 'no-store' })
        }
        onClearRecentQueries={() => undefined}
        onNavigate={() => undefined}
      />,
    );
    expect(html.match(new RegExp(`id="${dottedId}"`, 'gu'))).toHaveLength(1);
    expect(html.match(new RegExp(`id="${colonId}"`, 'gu'))).toHaveLength(1);
    expect(html).toContain(`aria-activedescendant="${dottedId}"`);
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}
