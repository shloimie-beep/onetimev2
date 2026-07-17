export type OneTimeShellVariant =
  'public-marketing' | 'auth' | 'owner-admin' | 'parent' | 'student' | 'authenticated-support';

export type RouteRole =
  'public' | 'auth' | 'owner-admin' | 'parent' | 'student' | 'authenticated' | 'redirect';

export type RouteVisualState =
  | 'ready'
  | 'loading'
  | 'empty'
  | 'error'
  | 'denied'
  | 'offline'
  | 'session-expired'
  | 'slow'
  | 'not-found'
  | 'redirect';

export type RouteBundle = 'public' | 'app-crm' | 'app-portal' | 'server-static';

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

export const routeBranding: RouteBranding[] = [
  {
    route: '/',
    shell: 'public-marketing',
    role: 'public',
    bundle: 'public',
    ticker: true,
    states: publicStates,
    navigationLabel: 'Home',
    navigationGroup: 'public',
    evidenceSelector: 'main .hero',
  },
  {
    route: '/signup',
    shell: 'auth',
    role: 'public',
    bundle: 'public',
    ticker: false,
    states: ['ready', 'loading', 'error', 'denied'],
    navigationLabel: 'Sign Up Now',
    navigationGroup: 'public',
    evidenceSelector: '.signup-page',
  },
  {
    route: '/login',
    shell: 'auth',
    role: 'auth',
    bundle: 'public',
    ticker: false,
    states: authStates,
    navigationLabel: 'Member Login',
    navigationGroup: 'public',
    evidenceSelector: '.login-page, .simple-page',
  },
  {
    route: '/activate',
    shell: 'auth',
    role: 'auth',
    bundle: 'public',
    ticker: false,
    states: authStates,
    evidenceSelector: '.login-page',
  },
  {
    route: '/forgot-password',
    shell: 'auth',
    role: 'auth',
    bundle: 'public',
    ticker: false,
    states: authStates,
    evidenceSelector: '.login-page',
  },
  {
    route: '/reset-password',
    shell: 'auth',
    role: 'auth',
    bundle: 'public',
    ticker: false,
    states: authStates,
    evidenceSelector: '.login-page',
  },
  {
    route: '/privacy',
    shell: 'public-marketing',
    role: 'public',
    bundle: 'public',
    ticker: false,
    states: publicStates,
    navigationLabel: 'Privacy',
    navigationGroup: 'public',
    evidenceSelector: '.simple-page',
  },
  {
    route: '/terms',
    shell: 'public-marketing',
    role: 'public',
    bundle: 'public',
    ticker: false,
    states: publicStates,
    navigationLabel: 'Terms',
    navigationGroup: 'public',
    evidenceSelector: '.simple-page',
  },
  {
    route: '/404.html',
    shell: 'public-marketing',
    role: 'public',
    bundle: 'public',
    ticker: false,
    states: ['not-found', 'ready'],
    evidenceSelector: '.simple-page',
  },
  {
    route: '/one-time',
    shell: 'public-marketing',
    role: 'redirect',
    bundle: 'server-static',
    ticker: false,
    states: ['redirect'],
    evidenceSelector: 'body',
  },
  {
    route: '/one-time/signup',
    shell: 'auth',
    role: 'redirect',
    bundle: 'server-static',
    ticker: false,
    states: ['redirect'],
    evidenceSelector: 'body',
  },
  {
    route: '/rabbi-member',
    shell: 'auth',
    role: 'redirect',
    bundle: 'server-static',
    ticker: false,
    states: ['redirect'],
    evidenceSelector: 'body',
  },
  {
    route: '/app/dashboard',
    shell: 'owner-admin',
    role: 'owner-admin',
    bundle: 'app-crm',
    ticker: false,
    states: appStates,
    navigationLabel: 'Dashboard',
    navigationGroup: 'owner-admin',
    evidenceSelector: '#crm-root, [data-ot-primitive="Header"]',
  },
  {
    route: '/app/crm',
    shell: 'owner-admin',
    role: 'owner-admin',
    bundle: 'app-crm',
    ticker: false,
    states: appStates,
    navigationLabel: 'CRM',
    navigationGroup: 'owner-admin',
    evidenceSelector: '#crm-root, [data-usable="crm-list"]',
  },
  {
    route: '/app/crm/contacts/:contactId',
    shell: 'owner-admin',
    role: 'owner-admin',
    bundle: 'app-crm',
    ticker: false,
    states: appStates,
    evidenceSelector: '#crm-root, [data-usable="crm-detail"]',
  },
  {
    route: '/app/crm/contacts/:contactId/communications',
    shell: 'owner-admin',
    role: 'owner-admin',
    bundle: 'app-crm',
    ticker: false,
    states: appStates,
    evidenceSelector: '#crm-root',
  },
  {
    route: '/app/classes',
    shell: 'owner-admin',
    role: 'owner-admin',
    bundle: 'app-crm',
    ticker: false,
    states: appStates,
    navigationLabel: 'Classes',
    navigationGroup: 'owner-admin',
    evidenceSelector: '#crm-root',
  },
  {
    route: '/app/content',
    shell: 'owner-admin',
    role: 'owner-admin',
    bundle: 'app-crm',
    ticker: false,
    states: appStates,
    navigationLabel: 'Content/Library',
    navigationGroup: 'owner-admin',
    evidenceSelector: '#crm-root',
  },
  {
    route: '/app/billing',
    shell: 'owner-admin',
    role: 'owner-admin',
    bundle: 'app-crm',
    ticker: false,
    states: appStates,
    navigationLabel: 'Products/Billing',
    navigationGroup: 'owner-admin',
    evidenceSelector: '#crm-root',
  },
  {
    route: '/app/rewards',
    shell: 'owner-admin',
    role: 'owner-admin',
    bundle: 'app-crm',
    ticker: false,
    states: appStates,
    navigationLabel: 'Learning Rewards',
    navigationGroup: 'owner-admin',
    evidenceSelector: '#crm-root, [data-gamification-admin]',
  },
  {
    route: '/app/billing/checkout/redirect/:redirectKey',
    shell: 'owner-admin',
    role: 'owner-admin',
    bundle: 'server-static',
    ticker: false,
    states: ['redirect', 'error', 'not-found'],
    evidenceSelector: 'body',
  },
  {
    route: '/app/billing/portal/redirect/:redirectKey',
    shell: 'owner-admin',
    role: 'owner-admin',
    bundle: 'server-static',
    ticker: false,
    states: ['redirect', 'error', 'not-found'],
    evidenceSelector: 'body',
  },
  {
    route: '/app/communications',
    shell: 'owner-admin',
    role: 'owner-admin',
    bundle: 'app-crm',
    ticker: false,
    states: appStates,
    navigationLabel: 'Communications',
    navigationGroup: 'owner-admin',
    evidenceSelector: '#crm-root',
  },
  {
    route: '/app/support',
    shell: 'authenticated-support',
    role: 'authenticated',
    bundle: 'app-crm',
    ticker: false,
    states: ['ready', 'loading', 'empty', 'error', 'denied', 'session-expired'],
    navigationLabel: 'Support',
    navigationGroup: 'support',
    evidenceSelector: '.support-workspace, .state-panel',
  },
  {
    route: '/app/support/receipts/:receiptId',
    shell: 'authenticated-support',
    role: 'authenticated',
    bundle: 'app-crm',
    ticker: false,
    states: ['ready', 'loading', 'error', 'denied', 'session-expired', 'not-found'],
    evidenceSelector: '.state-panel',
  },
  {
    route: '/app/parent',
    shell: 'parent',
    role: 'parent',
    bundle: 'app-portal',
    ticker: false,
    states: appStates,
    navigationLabel: 'Parent Portal',
    navigationGroup: 'parent',
    evidenceSelector: '#portal-root, [data-portal-role="parent"]',
  },
  {
    route: '/app/student',
    shell: 'student',
    role: 'student',
    bundle: 'app-portal',
    ticker: false,
    states: appStates,
    navigationLabel: 'Student Portal',
    navigationGroup: 'student',
    evidenceSelector: '#portal-root, [data-portal-role="student"]',
  },
  {
    route: '/classroom/launch/:grantKey/:secret',
    shell: 'student',
    role: 'student',
    bundle: 'app-crm',
    ticker: false,
    states: ['ready', 'loading', 'error', 'denied', 'session-expired', 'slow'],
    evidenceSelector: '#classroom-launch-root, .state-panel',
  },
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
  return pathOnly.replace(/\/+$/, '').split('/').filter(Boolean);
}
