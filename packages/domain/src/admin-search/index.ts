import {
  ADMIN_OPERATIONS_ERROR_CODES,
  ADMIN_QUICK_ACTIONS,
  ADMIN_OPERATIONAL_VIEWS,
  ADMIN_SEARCH_KINDS,
  type AdminDashboardSnapshot,
  type AdminOperationsActor,
  type AdminOperationsReadRepository,
  type AdminOperationsScope,
  type AdminNavigationRequest,
  type AdminNavigationResolution,
  type AdminSearchKind,
  type AdminSearchPage,
  type AdminSearchRequest,
  type AdminSearchResult,
} from '../../../contracts/src/admin/operations/index.ts';

const SAFE_TARGET_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,179}$/u;
const SAFE_STATUS = /^[A-Za-z0-9][A-Za-z0-9 _./:-]{0,119}$/u;
const SEARCH_KIND_SET = new Set<string>(ADMIN_SEARCH_KINDS);
const PRIVATE_OR_PROVIDER_VALUE =
  /(?:https?:\/\/|zoom\.us|vimeo\.com|(?:api|access|refresh|secret|token|bearer)[-_ ]?(?:key|token)?\s*[:=])/iu;

export class AdminOperationsError extends Error {
  constructor(
    public readonly code: (typeof ADMIN_OPERATIONS_ERROR_CODES)[keyof typeof ADMIN_OPERATIONS_ERROR_CODES],
    message: string,
  ) {
    super(message);
  }
}

export function assertAdminOperationsActor(
  actor: AdminOperationsActor,
  scope: AdminOperationsScope,
) {
  assertSameScope(actor, scope);
  if (
    actor.principal.role !== 'admin' ||
    actor.principal.household_id !== null ||
    actor.principal.student_id !== null ||
    !SAFE_TARGET_ID.test(actor.principal.human_account_id) ||
    !Number.isSafeInteger(actor.principal.credential_version) ||
    actor.principal.credential_version < 1
  ) {
    fail('accessDenied', 'A current server-validated Admin session is required.');
  }
}

export async function resolveAuthorizedAdminNavigation(input: {
  actor: AdminOperationsActor;
  request: AdminNavigationRequest;
  repository: AdminOperationsReadRepository;
}): Promise<AdminNavigationResolution> {
  assertAdminOperationsActor(input.actor, input.actor);
  assertSafeTarget(input.request.targetId);
  if (
    !SEARCH_KIND_SET.has(input.request.kind) ||
    input.request.selectedCredentialVersion !== input.actor.principal.credential_version
  ) {
    return unavailableNavigation();
  }
  const authorization = await input.repository.resolveTarget(input.actor, {
    kind: input.request.kind,
    targetId: input.request.targetId,
  });
  if (
    authorization.state !== 'authorized' ||
    authorization.kind !== input.request.kind ||
    authorization.targetId !== input.request.targetId
  ) {
    return unavailableNavigation();
  }
  return {
    state: 'open',
    href: canonicalDestination(input.request.kind, input.request.targetId),
    cache: 'no-store',
  };
}

export function normalizeAdminSearchRequest(input: AdminSearchRequest): AdminSearchRequest {
  const query = input.query.normalize('NFKC').replaceAll(/\s+/gu, ' ').trim();
  if (
    query.length < 2 ||
    query.length > 128 ||
    [...query].some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint <= 31 || codePoint === 127;
    })
  ) {
    fail('invalidQuery', 'Search requires 2-128 printable characters.');
  }
  const generatedAt = Date.parse(snapshot.generatedAt);
  const windowStart = Date.parse(snapshot.recentActivity.windowStartedAt);
  const windowEnd = Date.parse(snapshot.recentActivity.windowEndedAt);
  if (
    Number.isNaN(windowStart) ||
    Number.isNaN(windowEnd) ||
    windowEnd !== generatedAt ||
    windowStart >= windowEnd ||
    windowEnd - windowStart > 24 * 60 * 60 * 1000
  ) {
    fail('unsafeResult', 'Recent Activity must declare a bounded window ending at generation.');
  }
  if (!Number.isSafeInteger(input.pageSize) || input.pageSize < 1 || input.pageSize > 50) {
    fail('invalidQuery', 'Search page size must be between 1 and 50.');
  }
  const kinds = [...new Set(input.kinds)];
  if (kinds.length === 0 || kinds.some((kind) => !SEARCH_KIND_SET.has(kind))) {
    fail('invalidQuery', 'Search requires one or more supported entity kinds.');
  }
  if (
    input.cursor !== null &&
    (input.cursor.length < 1 ||
      input.cursor.length > 160 ||
      !/^[A-Za-z0-9_-]+$/u.test(input.cursor))
  ) {
    fail('invalidQuery', 'Search cursor is invalid.');
  }
  return { query, kinds, pageSize: input.pageSize, cursor: input.cursor };
}

export async function readAuthorizedAdminDashboard(input: {
  actor: AdminOperationsActor;
  repository: AdminOperationsReadRepository;
}): Promise<AdminDashboardSnapshot> {
  assertAdminOperationsActor(input.actor, input.actor);
  const snapshot = await input.repository.readDashboard(input.actor);
  assertDashboard(input.actor, snapshot);
  return snapshot;
}

export async function searchAuthorizedAdminOperations(input: {
  actor: AdminOperationsActor;
  request: AdminSearchRequest;
  repository: AdminOperationsReadRepository;
}): Promise<AdminSearchPage> {
  assertAdminOperationsActor(input.actor, input.actor);
  const request = normalizeAdminSearchRequest(input.request);
  const page = await input.repository.search(input.actor, request);
  if (
    page.source !== 'persistent_store' ||
    page.authorization !== 'runtime_admin' ||
    page.queryInUrl !== false ||
    page.analyticsAllowed !== false
  ) {
    fail('unsafeResult', 'Search did not return a private authorized persistent-store page.');
  }
  if (
    page.nextCursor !== null &&
    (page.nextCursor.length > 160 || !/^[A-Za-z0-9_-]+$/u.test(page.nextCursor))
  ) {
    fail('unsafeResult', 'Search returned an unsafe cursor.');
  }
  for (const result of page.results) assertSearchResult(input.actor, request.kinds, result);
  return page;
}

function assertDashboard(scope: AdminOperationsScope, snapshot: AdminDashboardSnapshot) {
  if (
    snapshot.source !== 'persistent_store' ||
    snapshot.authorization !== 'runtime_admin' ||
    Number.isNaN(Date.parse(snapshot.generatedAt))
  ) {
    fail('unsafeResult', 'Dashboard must be a timestamped, authorized persistent-store snapshot.');
  }
  const scoped = [
    ...snapshot.nowAndNext,
    snapshot.needsAttention,
    snapshot.contentPipeline,
    snapshot.peopleAndLearning,
    snapshot.recentActivity,
    ...snapshot.providerHealth,
  ];
  for (const value of scoped) {
    assertSameScope(scope, value);
    if (value.source !== 'persistent_store') {
      fail('unsafeResult', 'Dashboard fallback or synthetic data is forbidden.');
    }
  }
  if (
    snapshot.operationalViews.length !== ADMIN_OPERATIONAL_VIEWS.length ||
    snapshot.operationalViews.some(
      (view, index) =>
        view.id !== ADMIN_OPERATIONAL_VIEWS[index]?.id ||
        view.route !== ADMIN_OPERATIONAL_VIEWS[index]?.route,
    )
  ) {
    fail('unsafeResult', 'Dashboard operational views must use the canonical safe routes.');
  }
  if (
    snapshot.quickActions.length !== ADMIN_QUICK_ACTIONS.length ||
    snapshot.quickActions.some(
      (action, index) =>
        action.id !== ADMIN_QUICK_ACTIONS[index]?.id ||
        action.route !== ADMIN_QUICK_ACTIONS[index]?.route,
    )
  ) {
    fail('unsafeResult', 'Dashboard quick actions must use the locked canonical routes.');
  }
  assertSameScope(scope, snapshot.operations);
  if (snapshot.operations.source !== 'persistent_store') {
    fail('unsafeResult', 'Operational status must retain persistent provenance.');
  }
  for (const status of [
    snapshot.operations.releaseSource,
    snapshot.operations.webWorkerAgreement,
    snapshot.operations.databaseMigrations,
    snapshot.operations.queueHealth,
    snapshot.operations.providerDetail,
    snapshot.operations.backupRestore,
    snapshot.operations.recentRedactedFailures,
  ]) {
    if (Number.isNaN(Date.parse(status.observedAt))) {
      fail('unsafeResult', 'Operational status observation is invalid.');
    }
    if (status.state === 'available' && PRIVATE_OR_PROVIDER_VALUE.test(status.summary)) {
      fail('unsafeResult', 'Operational status contains protected provider material.');
    }
  }
  for (const provider of snapshot.providerHealth) {
    if (
      provider.observedRuntimeTier !== scope.runtimeTier ||
      provider.observedVerificationEnvironmentId !== scope.verificationEnvironmentId ||
      provider.sourceEnvironment !== providerEnvironment(scope.verificationEnvironmentId) ||
      PRIVATE_OR_PROVIDER_VALUE.test(provider.provider)
    ) {
      fail('crossScope', 'Provider readiness came from a different runtime environment.');
    }
  }
  for (const occurrence of snapshot.nowAndNext) {
    assertSafeTarget(occurrence.occurrenceId);
    assertSafeTarget(occurrence.classId);
    if (
      occurrence.title.trim().length < 1 ||
      occurrence.title.length > 180 ||
      Number.isNaN(Date.parse(occurrence.startsAt)) ||
      occurrence.liveConsoleDestination.route !== '/app/live/:occurrenceId' ||
      occurrence.liveConsoleDestination.targetId !== occurrence.occurrenceId
    ) {
      fail('unsafeResult', 'Occurrence destination is not safely bound.');
    }
  }
  for (const count of [
    ...Object.values(snapshot.needsAttention).filter((value) => typeof value === 'number'),
    ...Object.values(snapshot.contentPipeline).filter((value) => typeof value === 'number'),
    ...Object.values(snapshot.peopleAndLearning).filter((value) => typeof value === 'number'),
    snapshot.recentActivity.communications,
    snapshot.recentActivity.auditEvents,
  ]) {
    if (!Number.isSafeInteger(count) || count < 0) {
      fail('unsafeResult', 'Dashboard counts must be non-negative persistent values.');
    }
  }
}

function providerEnvironment(
  environment: AdminOperationsScope['verificationEnvironmentId'],
): 'test' | 'staging' | 'production' {
  if (environment === 'ci') return 'test';
  if (environment === 'provider_sandbox' || environment === 'persistent_staging') return 'staging';
  return 'production';
}

function assertSearchResult(
  scope: AdminOperationsScope,
  allowedKinds: readonly AdminSearchKind[],
  result: AdminSearchResult,
) {
  assertSameScope(scope, result);
  if (result.source !== 'persistent_store' || !allowedKinds.includes(result.kind)) {
    fail('unsafeResult', 'Search returned an unauthorized entity kind or data source.');
  }
  assertSafeTarget(result.targetId);
  if (
    result.destination.targetId !== result.targetId ||
    result.label.trim().length < 1 ||
    result.label.length > 180 ||
    result.distinguishingMetadata.length > 220 ||
    !SAFE_STATUS.test(result.status)
  ) {
    fail('unsafeResult', 'Search returned unsafe distinguishing metadata.');
  }
  if (
    PRIVATE_OR_PROVIDER_VALUE.test(result.label) ||
    PRIVATE_OR_PROVIDER_VALUE.test(result.distinguishingMetadata) ||
    PRIVATE_OR_PROVIDER_VALUE.test(result.status)
  ) {
    fail('unsafeResult', 'Search returned protected provider or secret material.');
  }
  const expectedRoute: Record<AdminSearchKind, AdminSearchResult['destination']['route']> = {
    adult: '/app/contacts/:contactId',
    household: '/app/households/:householdId',
    student: '/app/students/:studentId',
    class: '/app/classroom/classes/:classId',
    occurrence: '/app/classroom/occurrences/:occurrenceId',
    content: '/app/content/:contentId',
    question: '/app/classroom/questions',
    ticket: '/app/tickets/:ticketId',
  };
  if (result.destination.route !== expectedRoute[result.kind]) {
    fail('unsafeResult', 'Search result route does not match its authorized entity kind.');
  }
}

function canonicalDestination(kind: AdminSearchKind, targetId: string): string {
  const encoded = encodeURIComponent(targetId);
  const routes: Record<AdminSearchKind, string> = {
    adult: `/app/contacts/${encoded}`,
    household: `/app/households/${encoded}`,
    student: `/app/students/${encoded}`,
    class: `/app/classroom/classes/${encoded}`,
    occurrence: `/app/classroom/occurrences/${encoded}`,
    content: `/app/content/${encoded}`,
    question: '/app/classroom/questions',
    ticket: `/app/tickets/${encoded}`,
  };
  return routes[kind];
}

function unavailableNavigation(): AdminNavigationResolution {
  return { state: 'unavailable', reason: 'missing_or_unauthorized', cache: 'no-store' };
}

function assertSameScope(left: AdminOperationsScope, right: AdminOperationsScope) {
  if (
    left.product !== right.product ||
    left.runtimeTier !== right.runtimeTier ||
    left.verificationEnvironmentId !== right.verificationEnvironmentId
  ) {
    fail('crossScope', 'Cross-product, runtime, or verification-environment data was denied.');
  }
}

function assertSafeTarget(value: string) {
  if (!SAFE_TARGET_ID.test(value) || value.includes('://')) {
    fail('unsafeResult', 'Search returned an unsafe target identifier.');
  }
}

function fail(key: keyof typeof ADMIN_OPERATIONS_ERROR_CODES, message: string): never {
  throw new AdminOperationsError(ADMIN_OPERATIONS_ERROR_CODES[key], message);
}
