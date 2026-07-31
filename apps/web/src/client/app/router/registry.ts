export const CLIENT_ROUTER_CONTRACT_VERSION = '1.0.0' as const;

export type CurrentClientRole = 'admin' | 'parent' | 'student';
export type ClientShellId = 'admin' | 'parent' | 'student' | 'live';
export type ClientRouteMatch = 'exact' | 'prefix';

export type ClientRouteDefinition = {
  routeId: string;
  contractVersion: typeof CLIENT_ROUTER_CONTRACT_VERSION;
  shell: ClientShellId;
  roles: readonly CurrentClientRole[];
  pathname: `/${string}`;
  match: ClientRouteMatch;
};

export type ClientRouteRegistry = {
  routes: readonly ClientRouteDefinition[];
  resolve: (pathname: string, role?: CurrentClientRole | undefined) => ClientRouteDefinition | null;
};

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
        (route) =>
          matchesPath(route, pathname) && (role === undefined || route.roles.includes(role)),
      );
      return (
        matches.sort(
          (left, right) =>
            right.pathname.length - left.pathname.length ||
            Number(right.match === 'exact') - Number(left.match === 'exact'),
        )[0] ?? null
      );
    },
  });
}

export const CURRENT_CLIENT_ROUTES = createClientRouteRegistry([
  {
    routeId: 'onetime.live.console',
    contractVersion: CLIENT_ROUTER_CONTRACT_VERSION,
    shell: 'live',
    roles: ['admin'],
    pathname: '/app/live-console',
    match: 'prefix',
  },
  {
    routeId: 'onetime.parent.household.students-new',
    contractVersion: CLIENT_ROUTER_CONTRACT_VERSION,
    shell: 'parent',
    roles: ['parent'],
    pathname: '/app/parent/students/new',
    match: 'exact',
  },
  {
    routeId: 'onetime.parent.household.students',
    contractVersion: CLIENT_ROUTER_CONTRACT_VERSION,
    shell: 'parent',
    roles: ['parent'],
    pathname: '/app/parent/students',
    match: 'exact',
  },
  {
    routeId: 'onetime.parent.household.student',
    contractVersion: CLIENT_ROUTER_CONTRACT_VERSION,
    shell: 'parent',
    roles: ['parent'],
    pathname: '/app/parent/students',
    match: 'prefix',
  },
  {
    routeId: 'onetime.parent.portal',
    contractVersion: CLIENT_ROUTER_CONTRACT_VERSION,
    shell: 'parent',
    roles: ['parent'],
    pathname: '/app/parent',
    match: 'prefix',
  },
  {
    routeId: 'onetime.student.portal',
    contractVersion: CLIENT_ROUTER_CONTRACT_VERSION,
    shell: 'student',
    roles: ['student'],
    pathname: '/app/student',
    match: 'prefix',
  },
  {
    routeId: 'onetime.student.classroom',
    contractVersion: CLIENT_ROUTER_CONTRACT_VERSION,
    shell: 'student',
    roles: ['student'],
    pathname: '/app/classroom',
    match: 'prefix',
  },
  ...[
    'dashboard',
    'crm',
    'classes',
    'content',
    'billing',
    'communications',
    'rewards',
    'support',
    'operations',
  ].map((segment): ClientRouteDefinition => ({
    routeId: `onetime.admin.${segment}`,
    contractVersion: CLIENT_ROUTER_CONTRACT_VERSION,
    shell: 'admin',
    roles: ['admin'],
    pathname: `/app/${segment}`,
    match: 'prefix',
  })),
]);

export function resolveCurrentClientRoute(
  pathname: string,
  role?: CurrentClientRole,
): ClientRouteDefinition | null {
  return CURRENT_CLIENT_ROUTES.resolve(pathname, role);
}

function validateClientRoutes(definitions: readonly ClientRouteDefinition[]): void {
  const ids = new Set<string>();
  const routeKeys = new Set<string>();
  for (const definition of definitions) {
    if (!/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/u.test(definition.routeId)) {
      throw new Error(
        `Invalid client route ID "${definition.routeId}"; use a namespaced lowercase ID.`,
      );
    }
    if (definition.contractVersion !== CLIENT_ROUTER_CONTRACT_VERSION) {
      throw new Error(
        `Client route "${definition.routeId}" requires unsupported contract ${definition.contractVersion}.`,
      );
    }
    if (
      definition.pathname !== '/' &&
      (definition.pathname.endsWith('/') || definition.pathname.includes('*'))
    ) {
      throw new Error(`Client route "${definition.routeId}" has a non-canonical pathname.`);
    }
    if (
      definition.roles.length === 0 ||
      new Set(definition.roles).size !== definition.roles.length
    ) {
      throw new Error(`Client route "${definition.routeId}" must name unique current roles.`);
    }
    const routeKey = `${definition.pathname}:${definition.match}`;
    if (ids.has(definition.routeId)) {
      throw new Error(`Duplicate client route ID "${definition.routeId}".`);
    }
    if (routeKeys.has(routeKey)) {
      throw new Error(`Duplicate client route matcher "${routeKey}".`);
    }
    ids.add(definition.routeId);
    routeKeys.add(routeKey);
  }
}

function matchesPath(route: ClientRouteDefinition, pathname: string): boolean {
  if (route.match === 'exact') return pathname === route.pathname;
  return pathname === route.pathname || pathname.startsWith(`${route.pathname}/`);
}

function freezeRoute(definition: ClientRouteDefinition): ClientRouteDefinition {
  return Object.freeze({
    ...definition,
    roles: Object.freeze([...definition.roles]),
  });
}
