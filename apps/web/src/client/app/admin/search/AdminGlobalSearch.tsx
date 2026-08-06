import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  AdminNavigationResolution,
  AdminNavigationRequest,
  AdminSearchKind,
  AdminSearchPage,
  AdminSearchRequest,
  AdminSearchResult,
} from '../../../../../../../packages/contracts/src/admin/operations/index.ts';
import {
  ADMIN_SEARCH_KINDS,
  ADMIN_SEARCH_TRANSPORT,
} from '../../../../../../../packages/contracts/src/admin/operations/index.ts';
import { V21StatePanel } from '../../../../../../../packages/brand-system/src/react-v21.tsx';
import {
  bindAdminCredentialSnapshot,
  captureAdminPrivateCompletion,
  isAdminCredentialSnapshotCurrent,
  isAdminPrivateCompletionCurrent,
  type AdminCredentialBoundSnapshot,
} from '../adminPrivateCompletion.ts';

const DEFAULT_PAGE_SIZE = 20;

export class AdminPrivateAuthorizationError extends Error {
  constructor(public readonly status: 401 | 403) {
    super('Admin authorization is no longer current.');
  }
}

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
  if (response.status === 401 || response.status === 403) {
    throw new AdminPrivateAuthorizationError(response.status);
  }
  if (!response.ok) throw new Error('Authorized Admin search is unavailable.');
  return (await response.json()) as AdminSearchPage;
}

export async function postPrivateAdminNavigationResolution(
  fetcher: typeof fetch,
  request: AdminNavigationRequest,
): Promise<AdminNavigationResolution> {
  const response = await fetcher('/api/v2.1/admin/operations/resolve', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-onetime-private-resolution': '1',
    },
    credentials: 'same-origin',
    cache: 'no-store',
    referrerPolicy: 'same-origin',
    body: JSON.stringify(request),
  });
  if (response.status === 401 || response.status === 403) {
    throw new AdminPrivateAuthorizationError(response.status);
  }
  if (!response.ok) {
    return { state: 'unavailable', reason: 'missing_or_unauthorized', cache: 'no-store' };
  }
  return (await response.json()) as AdminNavigationResolution;
}

export function shouldClearAdminPrivateState(
  observedCredentialVersion: number,
  authorization: { state: 'admin' | 'signed_out' | 'revoked'; credentialVersion: number },
  restoredFromBfcache = false,
) {
  return (
    restoredFromBfcache ||
    authorization.state !== 'admin' ||
    authorization.credentialVersion !== observedCredentialVersion
  );
}

export function clearAdminPrivateSearchState(ports: {
  setQuery: (value: string) => void;
  setPage: (value: AdminSearchPage | null) => void;
  setLastRequest: (value: AdminSearchRequest | null) => void;
  setActiveIndex: (value: number) => void;
  setState: (value: 'idle' | 'loading' | 'error') => void;
  clearRecentQueries: () => void;
}) {
  ports.setQuery('');
  ports.setPage(null);
  ports.setLastRequest(null);
  ports.setActiveIndex(0);
  ports.setState('idle');
  ports.clearRecentQueries();
}

export function AdminGlobalSearch(props: {
  initialPage?: AdminCredentialBoundSnapshot<AdminSearchPage | null>;
  initialRequest?: AdminCredentialBoundSnapshot<AdminSearchRequest | null>;
  recentQueries?: AdminCredentialBoundSnapshot<readonly string[]>;
  onSearch: (request: AdminSearchRequest) => Promise<AdminSearchPage>;
  authorization: { state: 'admin' | 'signed_out' | 'revoked'; credentialVersion: number };
  onResolveOpen: (
    result: AdminSearchResult,
    credentialVersion: number,
  ) => Promise<AdminNavigationResolution>;
  onClearRecentQueries: () => void;
  onQueryCommitted?: ((query: string) => void) | undefined;
  onNavigate: (href: string) => void;
}) {
  const initiallyAuthorized = props.authorization.state === 'admin';
  const retainedInputsCurrent =
    initiallyAuthorized &&
    [props.initialPage, props.initialRequest, props.recentQueries].every(
      (snapshot) =>
        snapshot === undefined ||
        snapshot.credentialVersion === props.authorization.credentialVersion,
    );
  const [query, setQuery] = useState('');
  const [selectedKinds, setSelectedKinds] =
    useState<readonly AdminSearchKind[]>(ADMIN_SEARCH_KINDS);
  const [pageSnapshot, setPageSnapshot] =
    useState<AdminCredentialBoundSnapshot<AdminSearchPage | null> | null>(
      retainedInputsCurrent && props.initialPage ? props.initialPage : null,
    );
  const [lastRequestSnapshot, setLastRequestSnapshot] =
    useState<AdminCredentialBoundSnapshot<AdminSearchRequest | null> | null>(
      retainedInputsCurrent && props.initialRequest ? props.initialRequest : null,
    );
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [activeIndex, setActiveIndex] = useState(0);
  const [observedCredentialVersion, setObservedCredentialVersion] = useState(
    props.authorization.credentialVersion,
  );
  const authorizationRef = useRef(props.authorization);
  const authorizationIdentityRef = useRef(
    `${props.authorization.state}:${props.authorization.credentialVersion}`,
  );
  const completionGenerationRef = useRef(0);
  const authorizationIdentity = `${props.authorization.state}:${props.authorization.credentialVersion}`;
  if (authorizationIdentityRef.current !== authorizationIdentity) {
    authorizationIdentityRef.current = authorizationIdentity;
    completionGenerationRef.current += 1;
  }
  authorizationRef.current = props.authorization;
  const retainedPropsCurrent = [props.initialPage, props.initialRequest, props.recentQueries].every(
    (snapshot) =>
      snapshot === undefined ||
      isAdminCredentialSnapshotCurrent<unknown>(snapshot, props.authorization),
  );
  const privateStateCurrent =
    props.authorization.state === 'admin' &&
    observedCredentialVersion === props.authorization.credentialVersion &&
    retainedPropsCurrent;
  const page =
    privateStateCurrent && isAdminCredentialSnapshotCurrent(pageSnapshot, props.authorization)
      ? pageSnapshot.value
      : null;
  const lastRequest =
    privateStateCurrent &&
    isAdminCredentialSnapshotCurrent(lastRequestSnapshot, props.authorization)
      ? lastRequestSnapshot.value
      : null;
  const visibleQuery = privateStateCurrent ? query : '';
  const visibleState = privateStateCurrent ? state : 'idle';
  const recentQueries =
    privateStateCurrent &&
    isAdminCredentialSnapshotCurrent(props.recentQueries, props.authorization)
      ? props.recentQueries.value
      : [];
  const grouped = useMemo(() => groupResults(page?.results ?? []), [page]);
  const clearPrivateState = (advanceGeneration = true) => {
    if (advanceGeneration) completionGenerationRef.current += 1;
    clearAdminPrivateSearchState({
      setQuery,
      setPage: (value) =>
        setPageSnapshot(
          bindAdminCredentialSnapshot(value, authorizationRef.current.credentialVersion),
        ),
      setLastRequest: (value) =>
        setLastRequestSnapshot(
          bindAdminCredentialSnapshot(value, authorizationRef.current.credentialVersion),
        ),
      setActiveIndex,
      setState,
      clearRecentQueries: props.onClearRecentQueries,
    });
  };
  useEffect(() => {
    if (shouldClearAdminPrivateState(observedCredentialVersion, props.authorization)) {
      clearPrivateState(false);
      setObservedCredentialVersion(props.authorization.credentialVersion);
    }
  }, [props.authorization?.credentialVersion, props.authorization?.state]);
  useEffect(() => {
    const invalidateBfcache = (event: PageTransitionEvent) => {
      if (event.persisted) clearPrivateState();
    };
    window.addEventListener('pageshow', invalidateBfcache);
    return () => window.removeEventListener('pageshow', invalidateBfcache);
  }, []);

  const runSearch = async (cursor: string | null = null) => {
    if (!privateStateCurrent) {
      clearPrivateState();
      return;
    }
    const completion = captureAdminPrivateCompletion(
      ++completionGenerationRef.current,
      authorizationRef.current,
    );
    if (!completion) {
      clearPrivateState();
      return;
    }
    setState('loading');
    try {
      const request =
        cursor && lastRequest
          ? { ...lastRequest, cursor }
          : buildAdminSearchRequest(visibleQuery, selectedKinds, cursor);
      const result = await props.onSearch(request);
      if (
        !isAdminPrivateCompletionCurrent(
          completion,
          completionGenerationRef.current,
          authorizationRef.current,
        )
      ) {
        return;
      }
      setPageSnapshot(bindAdminCredentialSnapshot(result, completion.credentialVersion));
      setLastRequestSnapshot(
        bindAdminCredentialSnapshot({ ...request, cursor: null }, completion.credentialVersion),
      );
      if (!cursor) props.onQueryCommitted?.(request.query);
      setActiveIndex(0);
      setState('idle');
    } catch {
      if (
        !isAdminPrivateCompletionCurrent(
          completion,
          completionGenerationRef.current,
          authorizationRef.current,
        )
      ) {
        return;
      }
      setPageSnapshot(bindAdminCredentialSnapshot(null, completion.credentialVersion));
      setState('error');
    }
  };
  const moveSelection = (direction: -1 | 1) => {
    const length = page?.results.length ?? 0;
    if (length === 0) return;
    setActiveIndex((index) => (index + direction + length) % length);
  };
  const resolveAndOpen = async (result: AdminSearchResult) => {
    const completion = captureAdminPrivateCompletion(
      ++completionGenerationRef.current,
      authorizationRef.current,
    );
    if (!completion) {
      clearPrivateState();
      return;
    }
    try {
      const resolution = await props.onResolveOpen(result, completion.credentialVersion);
      if (
        !isAdminPrivateCompletionCurrent(
          completion,
          completionGenerationRef.current,
          authorizationRef.current,
        )
      ) {
        return;
      }
      if (resolution.state === 'open') props.onNavigate(resolution.href);
      else clearPrivateState();
    } catch {
      if (
        isAdminPrivateCompletionCurrent(
          completion,
          completionGenerationRef.current,
          authorizationRef.current,
        )
      ) {
        clearPrivateState();
        setState('error');
      }
    }
  };

  if (props.authorization.state !== 'admin') {
    return (
      <section className="admin-global-search" aria-labelledby="admin-search-title">
        <h2 id="admin-search-title">Search operational records</h2>
        <V21StatePanel kind="error" title="Search unavailable">
          <p>Authorization no longer permits private Admin search.</p>
        </V21StatePanel>
      </section>
    );
  }

  return (
    <section className="admin-global-search" aria-labelledby="admin-search-title">
      <h2 id="admin-search-title">Search operational records</h2>
      <p>
        Search authorized real records. Private search terms stay in the request body and are not
        sent to analytics.
      </p>
      <form
        role="search"
        data-action-id="admin.search.query.form"
        onSubmit={(event) => {
          event.preventDefault();
          void runSearch();
        }}
      >
        <label>
          Search adults, households, Students, classes, content, questions, and tickets
          <input
            type="search"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="admin-search-results"
            aria-expanded={Boolean(page?.results.length)}
            aria-activedescendant={
              page?.results[activeIndex] ? resultOptionId(page.results[activeIndex]) : undefined
            }
            value={visibleQuery}
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
                visibleQuery.trim() === lastRequest?.query
              ) {
                event.preventDefault();
                void resolveAndOpen(page.results[activeIndex]);
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
        <button
          type="submit"
          disabled={visibleQuery.trim().length < 2 || selectedKinds.length === 0}
        >
          Search
        </button>
      </form>

      {recentQueries.length > 0 ? (
        <section aria-labelledby="recent-search-heading">
          <h2 id="recent-search-heading">Recent searches on this device</h2>
          <ul>
            {recentQueries.map((value) => (
              <li key={value}>{value}</li>
            ))}
          </ul>
          <button
            type="button"
            data-action-id="admin.search.recent.clear.button"
            onClick={props.onClearRecentQueries}
          >
            Clear recent searches
          </button>
        </section>
      ) : null}

      {visibleState === 'loading' ? (
        <V21StatePanel kind="loading" title="Searching authorized records">
          <p>Results will appear after server-side authorization.</p>
        </V21StatePanel>
      ) : visibleState === 'error' ? (
        <V21StatePanel kind="error" title="Search unavailable">
          <p>No fallback or cached private result is shown. Try again.</p>
        </V21StatePanel>
      ) : page && page.results.length === 0 ? (
        <V21StatePanel kind="empty" title="No authorized results">
          <p>Check the spelling or select more entity types.</p>
        </V21StatePanel>
      ) : page ? (
        <section aria-live="polite" aria-label="Authorized search results">
          <div id="admin-search-results" role="listbox" aria-label="Authorized search results">
            {[...grouped.entries()].map(([kind, results]) => (
              <section key={kind} role="group" aria-label={searchKindLabel(kind)}>
                <h2 aria-hidden="true">{searchKindLabel(kind)}</h2>
                <ul role="presentation">
                  {results.map((result) => {
                    const index = page.results.indexOf(result);
                    return (
                      <li key={`${result.kind}:${result.targetId}`} role="presentation">
                        <button
                          id={resultOptionId(result)}
                          type="button"
                          role="option"
                          aria-selected={index === activeIndex}
                          data-action-id="admin.search.result.open.button"
                          onFocus={() => setActiveIndex(index)}
                          onClick={() => void resolveAndOpen(result)}
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
          </div>
          {page.nextCursor && lastRequest ? (
            <button
              type="button"
              data-action-id="admin.search.next_page.button"
              onClick={() => void runSearch(page.nextCursor)}
            >
              Next page
            </button>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}

export function resultOptionId(result: Pick<AdminSearchResult, 'kind' | 'targetId'>) {
  const encodedTarget = Array.from(result.targetId, (character) =>
    character.codePointAt(0)!.toString(16).padStart(6, '0'),
  ).join('');
  return `admin-search-option-${result.kind}-${encodedTarget}`;
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
