export type OneTimeShellVariant =
  'public-marketing' | 'auth' | 'owner-admin' | 'parent' | 'student' | 'authenticated-support';

export type RouteRole = 'public' | 'auth' | 'owner-admin' | 'parent' | 'student' | 'authenticated';

export type RouteVisualState =
  | 'ready'
  | 'loading'
  | 'empty'
  | 'error'
  | 'denied'
  | 'offline'
  | 'session-expired'
  | 'slow'
  | 'not-found';

export type RouteBundle = 'public' | 'app-crm' | 'app-live' | 'app-portal';

export type RouteBranding = {
  route: string;
  shell: OneTimeShellVariant;
  role: RouteRole;
  bundle: RouteBundle;
  ticker: boolean;
  states: readonly RouteVisualState[];
  navigationLabel?: string;
  navigationGroup?: 'public' | 'owner-admin' | 'parent' | 'student' | 'support';
  evidenceSelector: string;
};

const publicStates = ['ready', 'error', 'not-found'] as const;
const authStates = ['ready', 'loading', 'error', 'denied', 'session-expired'] as const;
const appStates = [
  'ready',
  'loading',
  'empty',
  'error',
  'denied',
  'offline',
  'session-expired',
  'slow',
] as const;

const publicRoute = (route: string, navigationLabel?: string): RouteBranding => ({
  route,
  shell: 'public-marketing',
  role: 'public',
  bundle: 'public',
  ticker: route === '/',
  states: publicStates,
  ...(navigationLabel ? { navigationLabel, navigationGroup: 'public' as const } : {}),
  evidenceSelector: route === '/' ? 'main .hero' : '.simple-page, .signup-page',
});

const authRoute = (route: string, role: RouteRole = 'auth'): RouteBranding => ({
  route,
  shell: 'auth',
  role,
  bundle: 'public',
  ticker: false,
  states: authStates,
  evidenceSelector: '.login-page, .simple-page',
});

const appRoute = (
  route: string,
  role: Extract<RouteRole, 'owner-admin' | 'parent' | 'student'>,
  bundle: Extract<RouteBundle, 'app-crm' | 'app-live' | 'app-portal'>,
  navigationLabel?: string,
): RouteBranding => ({
  route,
  shell: role,
  role,
  bundle,
  ticker: false,
  states: appStates,
  ...(navigationLabel
    ? {
        navigationLabel,
        navigationGroup: role,
      }
    : {}),
  evidenceSelector:
    bundle === 'app-live' ? '#live-root' : bundle === 'app-portal' ? '#portal-root' : '#crm-root',
});

/** Only routes with mounted or bounded-alias behavior appear in branding. */
export const routeBranding: RouteBranding[] = [
  publicRoute('/', 'Home'),
  publicRoute('/signup', 'Sign Up'),
  publicRoute('/signup/received'),
  publicRoute('/school', 'School inquiry'),
  publicRoute('/school/received'),
  publicRoute('/privacy', 'Privacy'),
  publicRoute('/terms', 'Terms'),
  authRoute('/login', 'public'),
  authRoute('/forgot-password', 'public'),
  authRoute('/setup/:token', 'public'),
  authRoute('/reset-password/:token', 'public'),
  authRoute('/access-denied', 'authenticated'),
  authRoute('/session-ended', 'authenticated'),

  appRoute('/app/dashboard', 'owner-admin', 'app-crm', 'Dashboard'),
  appRoute('/app/contacts', 'owner-admin', 'app-crm', 'Contacts'),
  appRoute('/app/contacts/:contactId', 'owner-admin', 'app-crm'),
  appRoute('/app/households/:householdId', 'owner-admin', 'app-crm'),
  appRoute('/app/content', 'owner-admin', 'app-crm', 'Content'),
  appRoute('/app/content/upload', 'owner-admin', 'app-crm'),
  appRoute('/app/content/:contentId', 'owner-admin', 'app-crm'),
  appRoute('/app/library', 'owner-admin', 'app-crm'),
  appRoute('/app/classroom/classes', 'owner-admin', 'app-crm', 'Classroom'),
  appRoute('/app/classroom/occurrences', 'owner-admin', 'app-crm'),
  appRoute('/app/classroom/occurrences/:occurrenceId', 'owner-admin', 'app-crm'),
  appRoute('/app/classroom/enrollments', 'owner-admin', 'app-crm'),
  appRoute('/app/classroom/zoom', 'owner-admin', 'app-crm'),
  appRoute('/app/classroom/recordings', 'owner-admin', 'app-crm'),
  appRoute('/app/classroom/questions', 'owner-admin', 'app-live'),
  appRoute('/app/classroom/access', 'owner-admin', 'app-crm'),
  appRoute('/app/live', 'owner-admin', 'app-live', 'Live Console'),
  appRoute('/app/live/:occurrenceId', 'owner-admin', 'app-live'),
  appRoute('/app/audit', 'owner-admin', 'app-crm'),

  appRoute('/app/parent/students', 'parent', 'app-portal', 'Students'),
  appRoute('/app/parent/students/new', 'parent', 'app-portal'),
  appRoute('/app/parent/students/:studentId', 'parent', 'app-portal'),
  appRoute('/app/parent/support', 'parent', 'app-portal', 'Support'),
  appRoute('/app/parent/support/:ticketId', 'parent', 'app-portal'),

  appRoute('/app/student', 'student', 'app-portal', 'Today'),
  appRoute('/app/student/library', 'student', 'app-portal', 'Library'),
  appRoute('/app/student/questions', 'student', 'app-portal', 'Questions'),
  appRoute('/app/student/questions/new', 'student', 'app-portal'),
  appRoute('/app/student/questions/:questionId', 'student', 'app-portal'),
  appRoute('/app/student/updates', 'student', 'app-portal', 'Updates'),
  appRoute('/app/student/support', 'student', 'app-portal', 'Support'),
  appRoute('/app/student/support/:ticketId', 'student', 'app-portal'),
];

export const tickerAllowlist = new Set(
  routeBranding.filter((entry) => entry.ticker).map((entry) => entry.route),
);

export const requiredRouteTemplates = routeBranding.map((entry) => entry.route);

export function routeBrandingForPath(pathname: string): RouteBranding | null {
  return routeBranding.find((entry) => routeMatchesTemplate(entry.route, pathname)) ?? null;
}

export function shellForRoute(route: string): OneTimeShellVariant | null {
  return routeBrandingForPath(route)?.shell ?? null;
}

export function routeMatchesTemplate(template: string, pathname: string) {
  const templateSegments = normalizedSegments(template);
  const pathSegments = normalizedSegments(pathname);
  if (templateSegments.length !== pathSegments.length) return false;
  return templateSegments.every(
    (segment, index) => segment.startsWith(':') || segment === pathSegments[index],
  );
}

function normalizedSegments(route: string) {
  const pathOnly = route.split(/[?#]/, 1)[0] ?? '/';
  if (pathOnly === '/') return [''];
  return pathOnly.replace(/\/+$/u, '').split('/').filter(Boolean);
}
