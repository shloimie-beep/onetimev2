import {
  STUDENT_CANONICAL_ROUTES,
  STUDENT_PORTAL_ERROR_CODES,
  type StudentNavigationItem,
  type StudentPortalPrincipal,
} from '../../../../contracts/src/portals/student/index.ts';
import { StudentPortalError } from './errors.ts';
import { assertActiveStudentPrincipal } from './isolation.ts';

const BASE_NAVIGATION: readonly StudentNavigationItem[] = [
  {
    id: 'today',
    label: 'Today',
    href: STUDENT_CANONICAL_ROUTES.today,
    placement: 'primary',
  },
  {
    id: 'calendar',
    label: 'Calendar',
    href: STUDENT_CANONICAL_ROUTES.calendar,
    placement: 'primary',
  },
  {
    id: 'library',
    label: 'Library',
    href: STUDENT_CANONICAL_ROUTES.library,
    placement: 'primary',
  },
  {
    id: 'progress',
    label: 'Progress',
    href: STUDENT_CANONICAL_ROUTES.progress,
    placement: 'primary',
  },
  {
    id: 'questions',
    label: 'Questions',
    href: STUDENT_CANONICAL_ROUTES.questions,
    placement: 'primary',
  },
  {
    id: 'updates',
    label: 'Updates',
    href: STUDENT_CANONICAL_ROUTES.updates,
    placement: 'primary',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    href: STUDENT_CANONICAL_ROUTES.notifications,
    placement: 'utility',
  },
  {
    id: 'support',
    label: 'Support',
    href: STUDENT_CANONICAL_ROUTES.support,
    placement: 'utility',
  },
  {
    id: 'account',
    label: 'Account',
    href: STUDENT_CANONICAL_ROUTES.account,
    placement: 'utility',
  },
];

export function studentNavigation(principal: StudentPortalPrincipal) {
  assertActiveStudentPrincipal(principal);
  if (principal.relationship !== 'self' || !principal.selfAdultOwnerVerified) {
    return BASE_NAVIGATION;
  }
  return [
    ...BASE_NAVIGATION,
    {
      id: 'privacy',
      label: 'Privacy',
      href: STUDENT_CANONICAL_ROUTES.privacy,
      placement: 'utility',
    },
    {
      id: 'data-rights',
      label: 'Data rights',
      href: STUDENT_CANONICAL_ROUTES.dataRights,
      placement: 'utility',
    },
  ] satisfies readonly StudentNavigationItem[];
}

const STATIC_ROUTES = new Set<string>([
  STUDENT_CANONICAL_ROUTES.today,
  STUDENT_CANONICAL_ROUTES.calendar,
  STUDENT_CANONICAL_ROUTES.library,
  STUDENT_CANONICAL_ROUTES.progress,
  STUDENT_CANONICAL_ROUTES.questions,
  STUDENT_CANONICAL_ROUTES.newQuestion,
  STUDENT_CANONICAL_ROUTES.updates,
  STUDENT_CANONICAL_ROUTES.notifications,
  STUDENT_CANONICAL_ROUTES.support,
  STUDENT_CANONICAL_ROUTES.account,
]);

function isOpaqueSegment(value: string) {
  return value.length > 0 && !value.includes('.') && !value.includes('/') && !value.includes('\\');
}

function isParameterizedStudentRoute(path: string) {
  const parts = path.split('/');
  return (
    (parts.length === 5 &&
      parts[1] === 'app' &&
      parts[2] === 'student' &&
      (parts[3] === 'classes' || parts[3] === 'class' || parts[3] === 'library') &&
      isOpaqueSegment(parts[4] ?? '')) ||
    (parts.length === 5 &&
      parts[1] === 'app' &&
      parts[2] === 'student' &&
      (parts[3] === 'questions' || parts[3] === 'support') &&
      isOpaqueSegment(parts[4] ?? ''))
  );
}

export function authorizeStudentRoute(principal: StudentPortalPrincipal, rawPath: string) {
  assertActiveStudentPrincipal(principal);
  const path = rawPath.split(/[?#]/, 1)[0] ?? '';
  const selfOnly =
    path === STUDENT_CANONICAL_ROUTES.privacy || path === STUDENT_CANONICAL_ROUTES.dataRights;
  if (
    (selfOnly && (principal.relationship !== 'self' || !principal.selfAdultOwnerVerified)) ||
    (!STATIC_ROUTES.has(path) && !selfOnly && !isParameterizedStudentRoute(path))
  ) {
    throw new StudentPortalError(
      STUDENT_PORTAL_ERROR_CODES.routeDenied,
      'This Student page is unavailable.',
    );
  }
  return { allowed: true as const, path };
}
