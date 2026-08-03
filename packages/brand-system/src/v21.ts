/**
 * The v2.1 design contract is intentionally additive. Existing feature roots
 * can migrate one surface at a time without changing the central client
 * composer or silently changing a role's navigation.
 */
export const DESIGN_SYSTEM_CONTRACT_VERSION = '2.1.0' as const;

export const oneTimeV21Tokens = {
  color: {
    brandBlack: '#090909',
    brandYellow: '#FFD400',
    brandYellowHover: '#E6BF00',
    brandCyan: '#67E8F9',
    brandWhite: '#FFFFFF',
    surfaceRaised: '#151515',
    surfaceOverlay: '#202020',
    surfaceLight: '#FFFFFF',
    surfaceLightMuted: '#F5F5F2',
    borderDark: '#3B3B3B',
    borderLight: '#D4D4CF',
    textOnDark: '#FFFFFF',
    textMutedOnDark: '#B8B8B8',
    textOnLight: '#111111',
    textMutedOnLight: '#565656',
    success: '#5CE18A',
    warning: '#FFD166',
    danger: '#FF6B6B',
    info: '#67E8F9',
    focus: '#67E8F9',
  },
  space: {
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
    16: '64px',
  },
  radius: { sm: '6px', md: '10px', lg: '14px', xl: '20px' },
  layout: {
    contentMax: '1440px',
    readingMax: '720px',
    mobile: '639px',
    tablet: '1023px',
    desktop: '1024px',
  },
  focus: { width: '3px', offset: '2px' },
  touchTarget: '44px',
} as const;

export const ADMIN_PRIMARY_NAVIGATION = [
  { id: 'dashboard', label: 'Dashboard', href: '/app/dashboard' },
  { id: 'contacts', label: 'Contacts', href: '/app/contacts' },
  { id: 'content', label: 'Content', href: '/app/content' },
  { id: 'classroom', label: 'Classroom', href: '/app/classroom/classes' },
  { id: 'live-console', label: 'Live Console', href: '/app/live' },
] as const;

export type V21Role = 'admin' | 'parent' | 'student';
export type V21StateKind = 'loading' | 'empty' | 'error' | 'denied' | 'offline' | 'session-expired';

export type V21NavigationItem = {
  id: string;
  label: string;
  href: string;
  current?: boolean;
  disabledReason?: string;
};

export type V21CalendarItem = {
  id: string;
  title: string;
  startsAt: string | Date;
  detail?: string;
};

/** Formats product dates in English while leaving names to local dir="auto" rendering. */
export function formatEnglishDate(value: string | Date, options: Intl.DateTimeFormatOptions = {}) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    ...options,
  }).format(date);
}

export function disabledControlDescription(reason?: string) {
  return reason?.trim() || 'This action is unavailable in the current state.';
}

export function isAdminPrimaryNavigation(items: readonly Pick<V21NavigationItem, 'label'>[]) {
  return (
    items.map((item) => item.label).join('|') ===
    ADMIN_PRIMARY_NAVIGATION.map((item) => item.label).join('|')
  );
}
