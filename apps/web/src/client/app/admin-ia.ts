export const ADMIN_PRIMARY_AREAS = [
  { id: 'dashboard', label: 'Dashboard', href: '/app/dashboard' },
  { id: 'contacts', label: 'Contacts', href: '/app/contacts' },
  { id: 'content', label: 'Content', href: '/app/content' },
  { id: 'classroom', label: 'Classroom', href: '/app/classroom/classes' },
  { id: 'communications', label: 'Communications', href: '/app/communications' },
  { id: 'billing-access', label: 'Billing & Access', href: '/app/billing-access' },
  { id: 'operations', label: 'Operations', href: '/app/operations' },
  { id: 'live-console', label: 'Live Console', href: '/app/live' },
] as const;

export type AdminPrimaryAreaId = (typeof ADMIN_PRIMARY_AREAS)[number]['id'];

export const DASHBOARD_SECTIONS = [
  { id: 'overview', label: 'Overview', href: '/app/dashboard' },
] as const;

export type DashboardSectionId = (typeof DASHBOARD_SECTIONS)[number]['id'];

export const CONTACTS_SECTIONS = [
  { id: 'people', label: 'People / Contacts', href: '/app/contacts' },
  { id: 'households', label: 'Households', href: '/app/households' },
  { id: 'users', label: 'Users', href: '/app/users' },
  { id: 'learners', label: 'Students', href: '/app/students' },
  { id: 'audit', label: 'Audit History', href: '/app/audit' },
] as const;

export type ContactsSectionId = 'people' | 'households' | 'users' | 'learners' | 'audit';

export const CONTENT_SECTIONS = [
  { id: 'library', label: 'Library', href: '/app/library' },
  { id: 'publication', label: 'Pipeline', href: '/app/content' },
  { id: 'factory', label: 'Upload', href: '/app/content/upload' },
] as const;

export type ContentSectionId =
  'library' | 'publication' | 'factory' | 'studio' | 'knowledge' | 'prompts';

export const CLASSROOM_SECTIONS = [
  { id: 'classes', label: 'Classes', href: '/app/classroom/classes' },
  { id: 'occurrences', label: 'Occurrences', href: '/app/classroom/occurrences' },
  { id: 'enrollments', label: 'Enrollments', href: '/app/classroom/enrollments' },
  { id: 'attendance', label: 'Attendance', href: '/app/classroom/attendance' },
  { id: 'recordings', label: 'Recordings', href: '/app/classroom/recordings' },
  { id: 'access', label: 'Access', href: '/app/classroom/access' },
  { id: 'questions', label: 'Questions', href: '/app/classroom/questions' },
] as const;

export type ClassroomSectionId =
  | 'classes'
  | 'occurrences'
  | 'enrollments'
  | 'attendance'
  | 'recordings'
  | 'access'
  | 'questions'
  | 'rewards';

export const LIVE_CONSOLE_SECTIONS = [
  {
    id: 'current-class',
    label: 'Current Class',
    href: '/app/live?section=current-class',
  },
  {
    id: 'questions',
    label: 'Questions',
    href: '/app/live?section=questions',
  },
  { id: 'zoom', label: 'Zoom', href: '/app/live?section=zoom' },
] as const;

export type LiveConsoleSectionId = (typeof LIVE_CONSOLE_SECTIONS)[number]['id'];

export function adminPrimaryNav(currentId: AdminPrimaryAreaId | null, liveConsoleReady: boolean) {
  return ADMIN_PRIMARY_AREAS.filter((item) => item.id !== 'live-console' || liveConsoleReady).map(
    (item) => ({
      ...item,
      current: item.id === currentId,
    }),
  );
}

export function rabbiPrimaryNav(currentId: AdminPrimaryAreaId | null, liveConsoleReady: boolean) {
  return ADMIN_PRIMARY_AREAS.filter(
    (item) =>
      ['dashboard', 'content', 'classroom'].includes(item.id) ||
      (item.id === 'live-console' && liveConsoleReady),
  ).map((item) => ({ ...item, current: item.id === currentId }));
}

export function dashboardSectionFromPath(_pathname: string): DashboardSectionId {
  return 'overview';
}

export function contactsSectionFromPath(pathname: string): ContactsSectionId {
  if (pathname === '/app/households' || pathname === '/app/crm/households') return 'households';
  if (pathname === '/app/users' || pathname === '/app/crm/users') return 'users';
  if (pathname === '/app/students' || pathname === '/app/crm/learners') return 'learners';
  if (pathname === '/app/audit' || pathname === '/app/crm/audit') return 'audit';
  return 'people';
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
  if (pathname === '/app/rewards' || pathname === '/app/classes/rewards') return 'rewards';
  if (pathname === '/app/classes/schedule' || pathname === '/app/classes/occurrences') {
    return 'occurrences';
  }
  if (pathname === '/app/classes/enrollments') return 'enrollments';
  if (pathname === '/app/classes/attendance') return 'attendance';
  if (pathname === '/app/classes/recordings') return 'recordings';
  if (pathname === '/app/classes/access') return 'access';
  if (pathname === '/app/classes/questions') return 'questions';
  return 'classes';
}

export function classroomOccurrenceFromLocation(pathname: string, search: string) {
  const fromQuery = new URLSearchParams(search).get('occurrence_key');
  if (fromQuery) return fromQuery;
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
  const base =
    CLASSROOM_SECTIONS.find((item) => item.id === section)?.href ?? '/app/classroom/classes';
  if (!occurrenceKey) return base;
  return `${base}?occurrence_key=${encodeURIComponent(occurrenceKey)}`;
}

export function liveConsoleSectionFromSearch(search: string): LiveConsoleSectionId {
  const section = new URLSearchParams(search).get('section');
  return section === 'questions' || section === 'zoom' ? section : 'current-class';
}

export function liveConsoleHref(section: LiveConsoleSectionId, occurrenceKey?: string | null) {
  const params = new URLSearchParams({ section });
  if (occurrenceKey) params.set('occurrence_key', occurrenceKey);
  return `/app/live?${params.toString()}`;
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
