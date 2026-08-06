export const CLIENT_ROUTER_CONTRACT_VERSION = '2.1.0' as const;

export type CurrentClientRole = 'admin' | 'parent' | 'student';
export type CanonicalRouteAudience = CurrentClientRole | 'public' | 'authenticated';
export type ClientShellId = 'public' | 'auth' | 'admin' | 'parent' | 'student' | 'live';
export type ClientRouteMatch = 'exact' | 'template';
export type CanonicalRouteId =
  | `RT-PUB-${string}`
  | `RT-AUTH-${string}`
  | `RT-ADM-${string}`
  | `RT-PAR-${string}`
  | `RT-STU-${string}`;

export type ClientRouteDefinition = {
  routeId: CanonicalRouteId;
  contractVersion: typeof CLIENT_ROUTER_CONTRACT_VERSION;
  shell: ClientShellId;
  roles: readonly CanonicalRouteAudience[];
  pathname: `/${string}`;
  match: ClientRouteMatch;
  title: string;
  handler: string | null;
  readiness: 'ready' | 'isolated' | 'missing';
  handlerDisposition: 'mounted' | 'bounded-alias' | 'isolated' | 'missing';
  aliasOf?: CanonicalRouteId;
};

export type ClientRouteRegistry = {
  routes: readonly ClientRouteDefinition[];
  resolve: (pathname: string, role?: CurrentClientRole | undefined) => ClientRouteDefinition | null;
};

type RouteSeed = Omit<
  ClientRouteDefinition,
  'contractVersion' | 'match' | 'readiness' | 'handlerDisposition'
>;

const BOUNDED_ALIAS_ROUTE_IDS = new Set<CanonicalRouteId>([
  'RT-PUB-005',
  'RT-PUB-009',
  'RT-PUB-010',
  'RT-AUTH-003',
  'RT-AUTH-004',
  'RT-AUTH-006',
  'RT-AUTH-007',
  'RT-ADM-010',
  'RT-ADM-011',
  'RT-ADM-012',
  'RT-ADM-013',
  'RT-ADM-014',
  'RT-ADM-015',
  'RT-ADM-016',
  'RT-ADM-017',
  'RT-ADM-024',
  'RT-ADM-030',
  'RT-ADM-031',
  'RT-ADM-032',
  'RT-ADM-033',
  'RT-ADM-034',
  'RT-ADM-035',
  'RT-ADM-036',
  'RT-ADM-037',
  'RT-ADM-038',
  'RT-ADM-039',
  'RT-ADM-041',
  'RT-ADM-042',
  'RT-ADM-043',
  'RT-ADM-050',
  'RT-ADM-051',
  'RT-ADM-062',
  'RT-ADM-063',
  'RT-ADM-064',
  'RT-ADM-065',
  'RT-ADM-067',
  'RT-ADM-069',
  'RT-STU-020',
  'RT-STU-041',
  'RT-STU-042',
]);

const ISOLATED_ROUTE_IDS = new Set<CanonicalRouteId>([
  'RT-PUB-003',
  'RT-AUTH-005',
  'RT-AUTH-008',
  'RT-STU-071',
  'RT-STU-072',
  'RT-STU-012',
  'RT-ADM-040',
]);

const MISSING_ROUTE_IDS = new Set<CanonicalRouteId>();

const route = (definition: RouteSeed): ClientRouteDefinition => {
  const handlerDisposition = MISSING_ROUTE_IDS.has(definition.routeId)
    ? 'missing'
    : ISOLATED_ROUTE_IDS.has(definition.routeId)
      ? 'isolated'
      : BOUNDED_ALIAS_ROUTE_IDS.has(definition.routeId)
        ? 'bounded-alias'
        : 'mounted';
  const readiness =
    handlerDisposition === 'missing' || handlerDisposition === 'isolated'
      ? handlerDisposition
      : 'ready';
  return {
    ...definition,
    handler: readiness === 'ready' ? definition.handler : null,
    contractVersion: CLIENT_ROUTER_CONTRACT_VERSION,
    match: definition.pathname.includes('/:') ? 'template' : 'exact',
    readiness,
    handlerDisposition,
  };
};

const pub = (
  routeId: CanonicalRouteId,
  pathname: `/${string}`,
  title: string,
  handler: string,
): ClientRouteDefinition =>
  route({ routeId, pathname, title, handler, shell: 'public', roles: ['public'] });

const auth = (
  routeId: CanonicalRouteId,
  pathname: `/${string}`,
  title: string,
  audiences: readonly CanonicalRouteAudience[] = ['public'],
): ClientRouteDefinition =>
  route({
    routeId,
    pathname,
    title,
    shell: 'auth',
    roles: audiences,
    handler: `auth.${routeId.toLowerCase()}`,
  });

const app = (
  routeId: CanonicalRouteId,
  pathname: `/${string}`,
  title: string,
  shell: Extract<ClientShellId, 'admin' | 'parent' | 'student' | 'live'>,
): ClientRouteDefinition =>
  route({
    routeId,
    pathname,
    title,
    shell,
    roles: [shell === 'live' ? 'admin' : shell],
    handler: `${shell}.${routeId.toLowerCase()}`,
  });

/**
 * Exact projection of locked source 05. Readiness is deliberately truthful:
 * a route is ready only when it reaches mounted behavior or a bounded,
 * semantically equivalent compatibility composition.
 */
export const CANONICAL_V21_ROUTES = [
  pub('RT-PUB-001', '/', 'Public landing', 'public.landing'),
  pub('RT-PUB-002', '/signup', 'Family signup', 'public.family-signup'),
  pub('RT-PUB-003', '/signup/received', 'Signup received', 'public.signup-received'),
  pub('RT-PUB-004', '/school', 'School inquiry', 'public.school-inquiry'),
  pub('RT-PUB-005', '/school/received', 'School acknowledgment', 'public.school-received'),
  pub('RT-PUB-006', '/privacy', 'Privacy notice', 'public.privacy'),
  pub('RT-PUB-007', '/terms', 'Terms', 'public.terms'),
  pub(
    'RT-PUB-008',
    '/cancellation-refund',
    'Cancellation and refund policy',
    'public.cancellation-refund',
  ),
  pub('RT-PUB-009', '/support', 'Public adult support', 'public.support'),
  route({
    routeId: 'RT-PUB-010',
    pathname: '/login',
    title: 'Login handoff',
    shell: 'auth',
    roles: ['public'],
    handler: 'auth.login',
    aliasOf: 'RT-AUTH-001',
  }),

  auth('RT-AUTH-001', '/login', 'Universal login'),
  auth('RT-AUTH-002', '/forgot-password', 'Forgot password'),
  auth('RT-AUTH-003', '/setup/:token', 'Account setup'),
  auth('RT-AUTH-004', '/reset-password/:token', 'Reset password'),
  auth('RT-AUTH-005', '/select-household', 'Household selector', ['parent']),
  auth('RT-AUTH-006', '/access-denied', 'Access denied', ['authenticated']),
  auth('RT-AUTH-007', '/session-ended', 'Session ended', ['public', 'authenticated']),
  auth('RT-AUTH-008', '/select-role', 'Role context selector', ['admin', 'parent']),

  app('RT-ADM-001', '/app/dashboard', 'Dashboard', 'admin'),
  app('RT-ADM-002', '/app/search', 'Global search', 'admin'),
  app('RT-ADM-010', '/app/contacts', 'Contacts', 'admin'),
  app('RT-ADM-011', '/app/contacts/:contactId', 'Contact detail', 'admin'),
  app('RT-ADM-012', '/app/households', 'Households', 'admin'),
  app('RT-ADM-013', '/app/households/:householdId', 'Household detail', 'admin'),
  app('RT-ADM-014', '/app/users', 'Users', 'admin'),
  app('RT-ADM-015', '/app/users/:userId', 'User detail', 'admin'),
  app('RT-ADM-016', '/app/students', 'Students', 'admin'),
  app('RT-ADM-017', '/app/students/:studentId', 'Student detail', 'admin'),
  app('RT-ADM-020', '/app/content', 'Content pipeline', 'admin'),
  app('RT-ADM-021', '/app/content/upload', 'Upload recording', 'admin'),
  app('RT-ADM-022', '/app/content/:contentId', 'Content detail', 'admin'),
  app('RT-ADM-023', '/app/content/:contentId/review', 'Content review', 'admin'),
  app('RT-ADM-024', '/app/library', 'Admin library', 'admin'),
  app('RT-ADM-030', '/app/classroom', 'Classroom overview', 'admin'),
  app('RT-ADM-031', '/app/classroom/calendar', 'Admin calendar', 'admin'),
  app('RT-ADM-032', '/app/classroom/classes', 'Class series', 'admin'),
  app('RT-ADM-033', '/app/classroom/classes/:classId', 'Class series detail', 'admin'),
  app('RT-ADM-034', '/app/classroom/occurrences', 'Occurrences', 'admin'),
  app('RT-ADM-035', '/app/classroom/occurrences/:occurrenceId', 'Occurrence workspace', 'admin'),
  app('RT-ADM-036', '/app/classroom/enrollments', 'Enrollments', 'admin'),
  app('RT-ADM-037', '/app/classroom/zoom', 'Zoom readiness', 'admin'),
  app('RT-ADM-038', '/app/classroom/attendance', 'Attendance', 'admin'),
  app('RT-ADM-039', '/app/classroom/recordings', 'Recordings', 'admin'),
  app('RT-ADM-040', '/app/classroom/questions', 'Question moderation', 'admin'),
  app('RT-ADM-041', '/app/classroom/progress', 'Progress and badges', 'admin'),
  app('RT-ADM-042', '/app/classroom/leaderboard', 'Leaderboards', 'admin'),
  app('RT-ADM-043', '/app/classroom/access', 'Access projection', 'admin'),
  app('RT-ADM-050', '/app/live', 'Live selection', 'live'),
  app('RT-ADM-051', '/app/live/:occurrenceId', 'Live Console', 'live'),
  app('RT-ADM-060', '/app/communications', 'Communications', 'admin'),
  app('RT-ADM-061', '/app/communications/:workflowId', 'Workflow readback', 'admin'),
  app('RT-ADM-062', '/app/tickets', 'Support queue', 'admin'),
  app('RT-ADM-063', '/app/tickets/:ticketId', 'Support ticket', 'admin'),
  app('RT-ADM-064', '/app/billing-access', 'Billing and access', 'admin'),
  app('RT-ADM-065', '/app/integrations', 'Integrations', 'admin'),
  app('RT-ADM-066', '/app/operations', 'Operations', 'admin'),
  app('RT-ADM-067', '/app/audit', 'Audit', 'admin'),
  app('RT-ADM-068', '/app/support', 'Admin support', 'admin'),
  app('RT-ADM-069', '/app/account', 'Admin account', 'admin'),

  app('RT-PAR-001', '/app/parent', 'Parent overview', 'parent'),
  app('RT-PAR-002', '/app/parent/students', 'Students', 'parent'),
  app('RT-PAR-003', '/app/parent/students/new', 'New Student', 'parent'),
  app('RT-PAR-004', '/app/parent/students/:studentId', 'Student management', 'parent'),
  app('RT-PAR-010', '/app/parent/calendar', 'Family calendar', 'parent'),
  app('RT-PAR-011', '/app/parent/classes/:occurrenceId', 'Parent class detail', 'parent'),
  app('RT-PAR-020', '/app/parent/progress', 'Progress summary', 'parent'),
  app('RT-PAR-021', '/app/parent/progress/:studentId', 'Student progress summary', 'parent'),
  app('RT-PAR-030', '/app/parent/billing', 'Billing and reactivation', 'parent'),
  app('RT-PAR-040', '/app/parent/updates', 'Household updates', 'parent'),
  app('RT-PAR-041', '/app/parent/newsletter', 'Newsletter archive', 'parent'),
  app('RT-PAR-050', '/app/parent/preferences', 'Reminder preferences', 'parent'),
  app('RT-PAR-060', '/app/parent/support', 'Parent support', 'parent'),
  app('RT-PAR-061', '/app/parent/support/:ticketId', 'Parent support detail', 'parent'),
  app('RT-PAR-070', '/app/parent/account', 'Parent account', 'parent'),
  app('RT-PAR-071', '/app/parent/privacy', 'Parent privacy', 'parent'),
  app('RT-PAR-072', '/app/parent/data-rights', 'Parent data rights', 'parent'),

  app('RT-STU-001', '/app/student', 'Student Today', 'student'),
  app('RT-STU-010', '/app/student/calendar', 'Student calendar', 'student'),
  app('RT-STU-011', '/app/student/classes/:occurrenceId', 'Student class detail', 'student'),
  app('RT-STU-012', '/app/student/class/:occurrenceId', 'Embedded classroom', 'student'),
  app('RT-STU-020', '/app/student/library', 'Student library', 'student'),
  app('RT-STU-021', '/app/student/library/:contentId', 'Playback and review', 'student'),
  app('RT-STU-030', '/app/student/progress', 'Student progress', 'student'),
  app('RT-STU-040', '/app/student/questions', 'Student questions', 'student'),
  app('RT-STU-041', '/app/student/questions/new', 'New question', 'student'),
  app('RT-STU-042', '/app/student/questions/:questionId', 'Question detail', 'student'),
  app('RT-STU-050', '/app/student/updates', 'Student updates', 'student'),
  app('RT-STU-051', '/app/student/notifications', 'Notifications', 'student'),
  app('RT-STU-060', '/app/student/support', 'Student support', 'student'),
  app('RT-STU-061', '/app/student/support/:ticketId', 'Student support detail', 'student'),
  app('RT-STU-070', '/app/student/account', 'Student account', 'student'),
  app('RT-STU-071', '/app/student/privacy', 'Student privacy', 'student'),
  app('RT-STU-072', '/app/student/data-rights', 'Student data rights', 'student'),
] as const satisfies readonly ClientRouteDefinition[];

export function defineClientRoute(definition: ClientRouteDefinition): ClientRouteDefinition {
  validateClientRoutes([definition]);
  return freezeRoute(definition);
}

export function createClientRouteRegistry(
  definitions: readonly ClientRouteDefinition[],
): ClientRouteRegistry {
  validateClientRoutes(definitions);
  const routes = Object.freeze(definitions.map(freezeRoute));
  return Object.freeze({
    routes,
    resolve(pathname: string, role?: CurrentClientRole) {
      const matches = routes.filter(
        (candidate) =>
          matchesPath(candidate, pathname) &&
          (role === undefined ||
            candidate.roles.includes(role) ||
            candidate.roles.includes('authenticated')),
      );
      return (
        matches.sort((left, right) => {
          const leftAlias = left.aliasOf ? 1 : 0;
          const rightAlias = right.aliasOf ? 1 : 0;
          const leftParameters = normalizedSegments(left.pathname).filter((segment) =>
            segment.startsWith(':'),
          ).length;
          const rightParameters = normalizedSegments(right.pathname).filter((segment) =>
            segment.startsWith(':'),
          ).length;
          return (
            leftAlias - rightAlias ||
            leftParameters - rightParameters ||
            right.pathname.length - left.pathname.length
          );
        })[0] ?? null
      );
    },
  });
}

export const CURRENT_CLIENT_ROUTES = createClientRouteRegistry(CANONICAL_V21_ROUTES);

export function resolveCurrentClientRoute(
  pathname: string,
  role?: CurrentClientRole,
): ClientRouteDefinition | null {
  return CURRENT_CLIENT_ROUTES.resolve(pathname, role);
}

export function routePathParameters(
  routeDefinition: ClientRouteDefinition,
  pathname: string,
): Readonly<Record<string, string>> | null {
  const template = normalizedSegments(routeDefinition.pathname);
  const actual = normalizedSegments(pathname);
  if (template.length !== actual.length) return null;
  const output: Record<string, string> = {};
  for (const [index, segment] of template.entries()) {
    const value = actual[index];
    if (value === undefined) return null;
    if (segment.startsWith(':')) output[segment.slice(1)] = decodeURIComponent(value);
    else if (segment !== value) return null;
  }
  return output;
}

function validateClientRoutes(definitions: readonly ClientRouteDefinition[]): void {
  const ids = new Set<string>();
  const primaryPaths = new Set<string>();
  for (const definition of definitions) {
    if (!/^RT-(?:PUB|AUTH|ADM|PAR|STU)-\d{3}$/u.test(definition.routeId)) {
      throw new Error(`Invalid canonical route ID "${definition.routeId}".`);
    }
    if (definition.contractVersion !== CLIENT_ROUTER_CONTRACT_VERSION) {
      throw new Error(`Route "${definition.routeId}" has an unsupported contract.`);
    }
    if (!definition.pathname.startsWith('/') || definition.pathname.includes('*')) {
      throw new Error(`Route "${definition.routeId}" has a non-canonical pathname.`);
    }
    if (!definition.roles.length || new Set(definition.roles).size !== definition.roles.length) {
      throw new Error(`Route "${definition.routeId}" must name unique audiences.`);
    }
    if (!definition.title) throw new Error(`Route "${definition.routeId}" has no title.`);
    if (definition.readiness === 'ready' && !definition.handler?.trim()) {
      throw new Error(`Route "${definition.routeId}" lacks a route-specific ready handler.`);
    }
    if (definition.readiness !== 'ready' && definition.handler !== null) {
      throw new Error(`Route "${definition.routeId}" advertises a non-ready handler.`);
    }
    if (ids.has(definition.routeId)) throw new Error(`Duplicate route ID "${definition.routeId}".`);
    if (!definition.aliasOf && primaryPaths.has(definition.pathname)) {
      throw new Error(`Duplicate primary route pathname "${definition.pathname}".`);
    }
    ids.add(definition.routeId);
    if (!definition.aliasOf) primaryPaths.add(definition.pathname);
  }
  for (const definition of definitions) {
    if (definition.aliasOf && !ids.has(definition.aliasOf)) {
      throw new Error(`Route alias "${definition.routeId}" has no target.`);
    }
  }
}

function matchesPath(routeDefinition: ClientRouteDefinition, pathname: string): boolean {
  return routePathParameters(routeDefinition, pathname) !== null;
}

function normalizedSegments(pathname: string): string[] {
  const pathOnly = pathname.split(/[?#]/u, 1)[0] ?? '/';
  if (pathOnly === '/') return [];
  return pathOnly.replace(/\/+$/u, '').split('/').filter(Boolean);
}

function freezeRoute(definition: ClientRouteDefinition): ClientRouteDefinition {
  return Object.freeze({ ...definition, roles: Object.freeze([...definition.roles]) });
}
