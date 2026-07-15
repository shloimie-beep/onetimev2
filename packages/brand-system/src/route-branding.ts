export type OneTimeShellVariant =
  'public-marketing' | 'auth' | 'owner-admin' | 'parent' | 'student';

export type RouteBranding = {
  route: string;
  shell: OneTimeShellVariant;
  ticker: boolean;
};

export const routeBranding: RouteBranding[] = [
  { route: '/', shell: 'public-marketing', ticker: true },
  { route: '/signup', shell: 'auth', ticker: false },
  { route: '/login', shell: 'auth', ticker: false },
  { route: '/privacy', shell: 'public-marketing', ticker: false },
  { route: '/terms', shell: 'public-marketing', ticker: false },
  { route: '/404.html', shell: 'public-marketing', ticker: false },
  { route: '/app/crm', shell: 'owner-admin', ticker: false },
  { route: '/app/dashboard', shell: 'owner-admin', ticker: false },
  { route: '/app/classes', shell: 'owner-admin', ticker: false },
  { route: '/app/content', shell: 'owner-admin', ticker: false },
  { route: '/app/billing', shell: 'owner-admin', ticker: false },
  { route: '/app/parent', shell: 'parent', ticker: false },
  { route: '/app/student', shell: 'student', ticker: false },
];

export const tickerAllowlist = new Set(
  routeBranding.filter((entry) => entry.ticker).map((entry) => entry.route),
);

export function shellForRoute(route: string): OneTimeShellVariant | null {
  return routeBranding.find((entry) => entry.route === route)?.shell ?? null;
}
