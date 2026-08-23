export const ADMIN_PRIMARY_AREAS = [
  { id: 'today', label: 'Today', href: '/app/today' },
  { id: 'learning', label: 'Learning', href: '/app/learning/classroom' },
  { id: 'live-console', label: 'Live Console', href: '/app/live-console?section=zoom' },
  { id: 'people', label: 'People', href: '/app/people/families' },
  { id: 'communications', label: 'Communications', href: '/app/communications' },
  { id: 'operations', label: 'Operations', href: '/app/operations' },
  { id: 'account', label: 'Account', href: '/app/account/profile' },
] as const;

/** Legacy ids remain accepted by route compatibility code while visible navigation is canonical. */
export type AdminPrimaryAreaId =
  | (typeof ADMIN_PRIMARY_AREAS)[number]['id']
  | 'dashboard'
  | 'contacts'
  | 'content'
  | 'classroom'
  | 'billing-access';

export const DASHBOARD_SECTIONS = [{ id: 'today', label: 'Today', href: '/app/today' }] as const;

export type DashboardSectionId = (typeof DASHBOARD_SECTIONS)[number]['id'];

export const CONTACTS_SECTIONS = [
  { id: 'households', label: 'Families', href: '/app/people/families' },
  { id: 'users', label: 'Parents', href: '/app/people/parents' },
  { id: 'learners', label: 'Students', href: '/app/people/students' },
  { id: 'access', label: 'Access', href: '/app/people/access' },
  { id: 'audit', label: 'Audit', href: '/app/people/audit' },
] as const;

export type ContactsSectionId = 'people' | 'households' | 'users' | 'learners' | 'access' | 'audit';

export const CONTENT_SECTIONS = [
  { id: 'library', label: 'Library', href: '/app/library' },
  { id: 'publication', label: 'Pipeline', href: '/app/content' },
  { id: 'factory', label: 'Upload', href: '/app/content/upload' },
] as const;

export type ContentSectionId =
  'library' | 'publication' | 'factory' | 'studio' | 'knowledge' | 'prompts';

export const CLASSROOM_SECTIONS = [
  { id: 'classes', label: 'Classroom', href: '/app/learning/classroom' },
  { id: 'occurrences', label: 'Library', href: '/app/learning/library' },
  { id: 'questions', label: 'Questions', href: '/app/learning/questions' },
  { id: 'attendance', label: 'Attendance', href: '/app/classroom/attendance' },
  { id: 'recordings', label: 'Recordings', href: '/app/classroom/recordings' },
] as const;

export type ClassroomSectionId =
  | 'classes'
  | 'occurrences'
  | 'enrollments'
  | 'attendance'
  | 'recordings'
  | 'access'
  | 'questions'
  | 'rewards'
  | 'live-console';

export const LIVE_CONSOLE_SECTIONS = [
  {
    id: 'current-class',
    label: 'Current Class',
    href: '/app/live-console?section=current-class',
  },
  {
    id: 'questions',
    label: 'Questions',
    href: '/app/live-console?section=questions',
  },
  { id: 'zoom', label: 'Zoom', href: '/app/live-console?section=zoom' },
] as const;

export const COMMUNICATIONS_SECTIONS = [
  { id: 'account-emails', label: 'Account Emails', href: '/app/communications' },
] as const;

export const ACCOUNT_SECTIONS = [
  { id: 'profile', label: 'Profile', href: '/app/account/profile' },
  { id: 'security', label: 'Sign-in & Security', href: '/app/account/security' },
  { id: 'privacy', label: 'Privacy', href: '/app/account/privacy' },
] as const;

export type LiveConsoleSectionId = (typeof LIVE_CONSOLE_SECTIONS)[number]['id'];

export function adminPrimaryNav(currentId: AdminPrimaryAreaId | null, _liveConsoleReady = false) {
  return ADMIN_PRIMARY_AREAS.map((item) => ({ ...item, current: item.id === currentId }));
}

export function rabbiPrimaryNav(currentId: AdminPrimaryAreaId | null, _liveConsoleReady = false) {
  return ADMIN_PRIMARY_AREAS.filter((item) =>
    ['today', 'learning', 'live-console', 'account'].includes(item.id),
  ).map((item) => ({ ...item, current: item.id === currentId }));
}

export function dashboardSectionFromPath(_pathname: string): DashboardSectionId {
  return 'today';
}

export function contactsSectionFromPath(pathname: string): ContactsSectionId {
  if (pathname === '/app/crm' || /^\/app\/crm\/contacts(?:\/|$)/u.test(pathname)) {
    return 'people';
  }
  if (pathname === '/app/people/access') return 'access';
  if (
    pathname === '/app/people/audit' ||
    pathname === '/app/audit' ||
    pathname === '/app/crm/audit'
  )
    return 'audit';
  if (
    pathname === '/app/people/students' ||
    pathname === '/app/students' ||
    pathname === '/app/crm/learners'
  )
    return 'learners';
  if (
    pathname === '/app/people/parents' ||
    pathname === '/app/users' ||
    pathname === '/app/crm/users'
  )
    return 'users';
  return 'households';
}

export function contentSectionFromPath(pathname: string): ContentSectionId {
  const segments = pathSegments(pathname, '/app/content');
  const first = segments[0] ?? '';
  if (first === 'publication') return 'publication';
  if (first === 'factory' || first === 'upload') return 'factory';
  if (['studio', 'create', 'social'].includes(first)) return 'studio';
  if (first === 'knowledge') return 'knowledge';
  if (first === 'prompts') return 'prompts';
  return 'library';
}

export function classroomSectionFromPath(pathname: string): ClassroomSectionId {
  if (pathname === '/app/rewards') return 'rewards';
  if (pathname.startsWith('/app/learning')) {
    const section = pathSegments(pathname, '/app/learning')[0] ?? 'classroom';
    if (section === 'library') return 'occurrences';
    if (section === 'questions') return 'questions';
    if (section === 'attendance') return 'attendance';
    if (section === 'recordings') return 'recordings';
    return 'classes';
  }
  const prefix = pathname.startsWith('/app/classroom') ? '/app/classroom' : '/app/classes';
  const first = pathSegments(pathname, prefix)[0] ?? '';
  if (first === 'schedule' || first === 'calendar' || first === 'occurrences') {
    return 'occurrences';
  }
  if (first === 'enrollments') return 'enrollments';
  if (first === 'attendance') return 'attendance';
  if (first === 'recordings') return 'recordings';
  if (first === 'access') return 'access';
  if (first === 'questions') return 'questions';
  if (first === 'rewards') return 'rewards';
  if (first === 'zoom') return 'live-console';
  return 'classes';
}

export function classroomOccurrenceFromLocation(pathname: string, search: string) {
  const fromQuery = new URLSearchParams(search).get('occurrence_key');
  if (fromQuery) return fromQuery;
  if (pathname.startsWith('/app/classroom')) {
    const segments = pathSegments(pathname, '/app/classroom');
    if (segments[0] === 'occurrences' && segments[1]) {
      return decodeURIComponent(segments[1]);
    }
    return null;
  }
  if (pathname.startsWith('/app/learning')) return null;
  const segments = pathSegments(pathname, '/app/classes');
  const first = segments[0] ?? '';
  return [
    'schedule',
    'occurrences',
    'enrollments',
    'attendance',
    'recordings',
    'access',
    'questions',
    'rewards',
  ].includes(first)
    ? null
    : first || null;
}

export function classroomSeriesFromLocation(pathname: string, search: string) {
  const fromQuery = new URLSearchParams(search).get('class_series_key');
  if (fromQuery) return fromQuery;
  const match = pathname.match(/^\/app\/classroom\/classes\/([^/]+)$/u);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function classroomHref(section: ClassroomSectionId, occurrenceKey?: string | null) {
  if (section === 'live-console') {
    return liveConsoleHref('zoom', occurrenceKey);
  }
  const base =
    CLASSROOM_SECTIONS.find((item) => item.id === section)?.href ?? '/app/classroom/classes';
  if (!occurrenceKey) return base;
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}occurrence_key=${encodeURIComponent(occurrenceKey)}`;
}

export function liveConsoleSectionFromSearch(search: string): LiveConsoleSectionId {
  const section = new URLSearchParams(search).get('section');
  return section === 'questions' || section === 'zoom' ? section : 'current-class';
}

export function liveConsoleHref(section: LiveConsoleSectionId, occurrenceKey?: string | null) {
  const params = new URLSearchParams({ section });
  if (occurrenceKey) params.set('occurrence_key', occurrenceKey);
  return `/app/live-console?${params.toString()}`;
}

function pathSegments(pathname: string, prefix: string) {
  return (
    pathname
      .split(/[?#]/, 1)[0]
      ?.replace(new RegExp(`^${prefix}/?`), '')
      .split('/')
      .filter(Boolean) ?? []
  );
}
