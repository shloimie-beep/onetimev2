export const ADMIN_PRIMARY_AREAS = [
  { id: 'dashboard', label: 'Dashboard', href: '/app/dashboard' },
  { id: 'contacts', label: 'Contacts', href: '/app/crm' },
  { id: 'content', label: 'Content', href: '/app/content' },
  { id: 'classroom', label: 'Classroom', href: '/app/classes' },
  { id: 'live-console', label: 'Live Console', href: '/app/live-console' },
] as const;

export type AdminPrimaryAreaId = (typeof ADMIN_PRIMARY_AREAS)[number]['id'];

export const DASHBOARD_SECTIONS = [
  { id: 'overview', label: 'Overview', href: '/app/dashboard' },
  {
    id: 'internal-tasks',
    label: 'Internal Tasks',
    href: '/app/dashboard/internal-tasks',
  },
] as const;

export type DashboardSectionId = (typeof DASHBOARD_SECTIONS)[number]['id'];

export const CONTACTS_SECTIONS = [
  { id: 'parents', label: 'Parents', href: '/app/crm' },
  { id: 'students', label: 'Students', href: '/app/crm/students' },
  {
    id: 'internal-tasks',
    label: 'Internal Tasks',
    href: '/app/crm/internal-tasks',
  },
] as const;

export type ContactsSectionId = (typeof CONTACTS_SECTIONS)[number]['id'];

export const CONTENT_SECTIONS = [
  { id: 'library', label: 'Library', href: '/app/content' },
  { id: 'factory', label: 'Factory', href: '/app/content/factory' },
  { id: 'studio', label: 'Studio', href: '/app/content/studio' },
  { id: 'knowledge', label: 'Knowledge', href: '/app/content/knowledge' },
  { id: 'prompts', label: 'Prompts', href: '/app/content/prompts' },
] as const;

export type ContentSectionId = (typeof CONTENT_SECTIONS)[number]['id'];

export const CLASSROOM_SECTIONS = [
  { id: 'overview', label: 'Overview', href: '/app/classes' },
  { id: 'schedule', label: 'Schedule', href: '/app/classes/schedule' },
  { id: 'questions', label: 'Questions', href: '/app/classes/questions' },
  { id: 'rewards', label: 'Rewards', href: '/app/classes/rewards' },
] as const;

export type ClassroomSectionId = (typeof CLASSROOM_SECTIONS)[number]['id'];

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

export type LiveConsoleSectionId = (typeof LIVE_CONSOLE_SECTIONS)[number]['id'];

export function adminPrimaryNav(currentId: AdminPrimaryAreaId | null, liveConsoleReady: boolean) {
  return ADMIN_PRIMARY_AREAS.filter((item) => item.id !== 'live-console' || liveConsoleReady).map(
    (item) => ({
      ...item,
      current: item.id === currentId,
    }),
  );
}

export function dashboardSectionFromPath(pathname: string): DashboardSectionId {
  return pathname === '/app/dashboard/internal-tasks' ? 'internal-tasks' : 'overview';
}

export function contactsSectionFromPath(pathname: string): ContactsSectionId {
  if (pathname === '/app/crm/students') return 'students';
  if (pathname === '/app/crm/internal-tasks') return 'internal-tasks';
  return 'parents';
}

export function contentSectionFromPath(pathname: string): ContentSectionId {
  const segments = pathSegments(pathname, '/app/content');
  const first = segments[0] ?? '';
  if (first === 'factory') return 'factory';
  if (['studio', 'create', 'social'].includes(first)) return 'studio';
  if (first === 'knowledge') return 'knowledge';
  if (first === 'prompts') return 'prompts';
  return 'library';
}

export function classroomSectionFromPath(pathname: string): ClassroomSectionId {
  if (pathname === '/app/rewards' || pathname === '/app/classes/rewards') return 'rewards';
  if (pathname === '/app/classes/schedule') return 'schedule';
  if (pathname === '/app/classes/questions') return 'questions';
  return 'overview';
}

export function classroomOccurrenceFromLocation(pathname: string, search: string) {
  const fromQuery = new URLSearchParams(search).get('occurrence_key');
  if (fromQuery) return fromQuery;
  const segments = pathSegments(pathname, '/app/classes');
  const first = segments[0] ?? '';
  return ['schedule', 'questions', 'rewards'].includes(first) ? null : first || null;
}

export function classroomHref(section: ClassroomSectionId, occurrenceKey?: string | null) {
  const base = CLASSROOM_SECTIONS.find((item) => item.id === section)?.href ?? '/app/classes';
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
