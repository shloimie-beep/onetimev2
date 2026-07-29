import React, { useMemo, useState } from 'react';
import type {
  AdminSearchKind,
  AdminSearchPage,
  AdminSearchRequest,
  AdminSearchResult,
} from '../../../../../../../packages/contracts/src/admin/operations/index.ts';
import {
  ADMIN_SEARCH_KINDS,
  ADMIN_SEARCH_TRANSPORT,
} from '../../../../../../../packages/contracts/src/admin/operations/index.ts';
import {
  V21AppShell,
  V21StatePanel,
} from '../../../../../../../packages/brand-system/src/react-v21.tsx';
import { ADMIN_PRIMARY_NAVIGATION } from '../../../../../../../packages/brand-system/src/v21.ts';

const DEFAULT_PAGE_SIZE = 20;

export function buildAdminSearchRequest(
  query: string,
  kinds: readonly AdminSearchKind[] = ADMIN_SEARCH_KINDS,
  cursor: string | null = null,
): AdminSearchRequest {
  return { query, kinds, pageSize: DEFAULT_PAGE_SIZE, cursor };
}

export async function postPrivateAdminSearch(
  fetcher: typeof fetch,
  request: AdminSearchRequest,
): Promise<AdminSearchPage> {
  const response = await fetcher(ADMIN_SEARCH_TRANSPORT.path, {
    method: ADMIN_SEARCH_TRANSPORT.method,
    headers: {
      'content-type': 'application/json',
      'x-onetime-private-search': '1',
    },
    credentials: 'same-origin',
    cache: 'no-store',
    referrerPolicy: 'same-origin',
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error('Authorized Admin search is unavailable.');
  return (await response.json()) as AdminSearchPage;
}

export function AdminGlobalSearch(props: {
  initialPage?: AdminSearchPage | null;
  initialRequest?: AdminSearchRequest | null;
  recentQueries?: readonly string[];
  onSearch: (request: AdminSearchRequest) => Promise<AdminSearchPage>;
  onOpen: (result: AdminSearchResult) => void;
  onClearRecentQueries: () => void;
  onNavigate: (href: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [selectedKinds, setSelectedKinds] =
    useState<readonly AdminSearchKind[]>(ADMIN_SEARCH_KINDS);
  const [page, setPage] = useState<AdminSearchPage | null>(props.initialPage ?? null);
  const [lastRequest, setLastRequest] = useState<AdminSearchRequest | null>(
    props.initialRequest ?? null,
  );
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [activeIndex, setActiveIndex] = useState(0);
  const grouped = useMemo(() => groupResults(page?.results ?? []), [page]);
  const navigation = [
    ...ADMIN_PRIMARY_NAVIGATION.map((item) => ({ ...item, current: false })),
    { id: 'search', label: 'Search', href: '/app/search', current: true },
  ];

  const runSearch = async (cursor: string | null = null) => {
    setState('loading');
    try {
      const request =
        cursor && lastRequest
          ? { ...lastRequest, cursor }
          : buildAdminSearchRequest(query, selectedKinds, cursor);
      const result = await props.onSearch(request);
      setPage(result);
      setLastRequest({ ...request, cursor: null });
      setActiveIndex(0);
      setState('idle');
    } catch {
      setPage(null);
      setState('error');
    }
  };
  const moveSelection = (direction: -1 | 1) => {
    const length = page?.results.length ?? 0;
    if (length === 0) return;
    setActiveIndex((index) => (index + direction + length) % length);
  };

  return (
    <V21AppShell
      role="admin"
      title="Global search"
      navigation={navigation}
      onNavigate={props.onNavigate}
    >
      <p>
        Search authorized real records. Private search terms stay in the request body and are not
        sent to analytics.
      </p>
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          void runSearch();
        }}
      >
        <label>
          Search adults, households, Students, classes, content, questions, and tickets
          <input
            type="search"
            value={query}
            minLength={2}
            maxLength={128}
            autoComplete="off"
            onChange={(event) => setQuery(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                moveSelection(1);
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                moveSelection(-1);
              } else if (
                event.key === 'Enter' &&
                page?.results[activeIndex] &&
                query.trim() === lastRequest?.query
              ) {
                event.preventDefault();
                props.onOpen(page.results[activeIndex]);
              }
            }}
          />
        </label>
        <fieldset>
          <legend>Entity types</legend>
          {ADMIN_SEARCH_KINDS.map((kind) => (
            <label key={kind}>
              <input
                type="checkbox"
                checked={selectedKinds.includes(kind)}
                onChange={(event) =>
                  setSelectedKinds((current) =>
                    event.currentTarget.checked
                      ? [...new Set([...current, kind])]
                      : current.filter((value) => value !== kind),
                  )
                }
              />
              {searchKindLabel(kind)}
            </label>
          ))}
        </fieldset>
        <button type="submit" disabled={query.trim().length < 2 || selectedKinds.length === 0}>
          Search
        </button>
      </form>

      {(props.recentQueries?.length ?? 0) > 0 ? (
        <section aria-labelledby="recent-search-heading">
          <h2 id="recent-search-heading">Recent searches on this device</h2>
          <ul>
            {props.recentQueries?.map((value) => (
              <li key={value}>{value}</li>
            ))}
          </ul>
          <button type="button" onClick={props.onClearRecentQueries}>
            Clear recent searches
          </button>
        </section>
      ) : null}

      {state === 'loading' ? (
        <V21StatePanel kind="loading" title="Searching authorized records">
          <p>Results will appear after server-side authorization.</p>
        </V21StatePanel>
      ) : state === 'error' ? (
        <V21StatePanel kind="error" title="Search unavailable">
          <p>No fallback or cached private result is shown. Try again.</p>
        </V21StatePanel>
      ) : page && page.results.length === 0 ? (
        <V21StatePanel kind="empty" title="No authorized results">
          <p>Check the spelling or select more entity types.</p>
        </V21StatePanel>
      ) : page ? (
        <section aria-live="polite" aria-label="Authorized search results">
          {[...grouped.entries()].map(([kind, results]) => (
            <section key={kind} aria-labelledby={`search-${kind}-heading`}>
              <h2 id={`search-${kind}-heading`}>{searchKindLabel(kind)}</h2>
              <ul>
                {results.map((result) => {
                  const index = page.results.indexOf(result);
                  return (
                    <li key={`${result.kind}:${result.targetId}`}>
                      <button
                        type="button"
                        aria-current={index === activeIndex ? 'true' : undefined}
                        onFocus={() => setActiveIndex(index)}
                        onClick={() => props.onOpen(result)}
                      >
                        <strong dir="auto">{result.label}</strong>{' '}
                        <span dir="auto">{result.distinguishingMetadata}</span>{' '}
                        <span>{result.status}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {page.nextCursor && lastRequest ? (
            <button type="button" onClick={() => void runSearch(page.nextCursor)}>
              Next page
            </button>
          ) : null}
        </section>
      ) : null}
    </V21AppShell>
  );
}

function groupResults(results: readonly AdminSearchResult[]) {
  const grouped = new Map<AdminSearchKind, AdminSearchResult[]>();
  for (const result of results) {
    const current = grouped.get(result.kind) ?? [];
    current.push(result);
    grouped.set(result.kind, current);
  }
  return grouped;
}

function searchKindLabel(kind: AdminSearchKind) {
  const labels: Record<AdminSearchKind, string> = {
    adult: 'Adults',
    household: 'Households',
    student: 'Students',
    class: 'Classes',
    occurrence: 'Occurrences',
    content: 'Content',
    question: 'Questions',
    ticket: 'Tickets',
  };
  return labels[kind];
}
