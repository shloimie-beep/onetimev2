import { describe, expect, it } from 'vitest';
import {
  ADMIN_PRIMARY_AREAS,
  CLASSROOM_SECTIONS,
  CONTACTS_SECTIONS,
  CONTENT_SECTIONS,
  DASHBOARD_SECTIONS,
  LIVE_CONSOLE_SECTIONS,
  adminPrimaryNav,
  classroomHref,
  classroomOccurrenceFromLocation,
  classroomSectionFromPath,
  contactsSectionFromPath,
  contentSectionFromPath,
  dashboardSectionFromPath,
  liveConsoleHref,
  liveConsoleSectionFromSearch,
  rabbiPrimaryNav,
} from '../../apps/web/src/client/app/admin-ia.ts';

describe('OT-LAUNCH-01 Admin information architecture', () => {
  it('keeps five canonical Admin areas and gates Live Console by server readiness', () => {
    expect(ADMIN_PRIMARY_AREAS).toEqual([
      { id: 'dashboard', label: 'Dashboard', href: '/app/dashboard' },
      { id: 'contacts', label: 'Contacts', href: '/app/crm' },
      { id: 'content', label: 'Content', href: '/app/content' },
      { id: 'classroom', label: 'Classroom', href: '/app/classes' },
      { id: 'live-console', label: 'Live Console', href: '/app/live-console' },
    ]);
    expect(adminPrimaryNav('content', true).filter((item) => item.current)).toEqual([
      { id: 'content', label: 'Content', href: '/app/content', current: true },
    ]);
    expect(adminPrimaryNav('content', false).map((item) => item.label)).toEqual([
      'Dashboard',
      'Contacts',
      'Content',
      'Classroom',
    ]);
    expect(rabbiPrimaryNav('classroom', true).map((item) => item.label)).toEqual([
      'Dashboard',
      'Content',
      'Classroom',
      'Live Console',
    ]);
    expect(rabbiPrimaryNav('classroom', true).some((item) => item.id === 'contacts')).toBe(false);
  });

  it('defines one canonical section model for each focused workspace', () => {
    expect(DASHBOARD_SECTIONS.map((item) => item.label)).toEqual(['Overview']);
    expect(CONTACTS_SECTIONS.map((item) => item.label)).toEqual([
      'People / Contacts',
      'Households',
      'Users & Roles',
      'Learners',
      'Audit History',
    ]);
    expect(CONTENT_SECTIONS.map((item) => item.label)).toEqual([
      'Library',
      'Factory',
      'Studio',
      'Knowledge',
      'Prompts',
    ]);
    expect(CLASSROOM_SECTIONS.map((item) => item.label)).toEqual([
      'Classes',
      'Occurrences',
      'Enrollments',
      'Recordings',
      'Access',
      'Questions',
      'Rewards',
    ]);
    expect(LIVE_CONSOLE_SECTIONS.map((item) => item.label)).toEqual([
      'Current Class',
      'Questions',
      'Zoom',
    ]);
  });

  it('maps legacy and deep URLs into safe focused destinations', () => {
    expect(dashboardSectionFromPath('/app/dashboard/internal-tasks')).toBe('overview');
    expect(contactsSectionFromPath('/app/crm/households')).toBe('households');
    expect(contactsSectionFromPath('/app/crm/users')).toBe('users');
    expect(contactsSectionFromPath('/app/crm/audit')).toBe('audit');
    expect(contactsSectionFromPath('/app/crm/learners')).toBe('learners');
    expect(contactsSectionFromPath('/app/crm/contacts/contact-1')).toBe('people');
    expect(contentSectionFromPath('/app/content/create')).toBe('studio');
    expect(contentSectionFromPath('/app/content/social')).toBe('studio');
    expect(contentSectionFromPath('/app/content/processing')).toBe('library');
    expect(contentSectionFromPath('/app/content/activity')).toBe('library');
    expect(classroomSectionFromPath('/app/rewards')).toBe('rewards');
    expect(classroomSectionFromPath('/app/classes/schedule')).toBe('occurrences');
    expect(classroomSectionFromPath('/app/classes/enrollments')).toBe('enrollments');
    expect(classroomSectionFromPath('/app/classes/recordings')).toBe('recordings');
    expect(classroomSectionFromPath('/app/classes/access')).toBe('access');
    expect(classroomSectionFromPath('/app/classes/questions')).toBe('questions');
    expect(classroomOccurrenceFromLocation('/app/classes/occurrence-1', '')).toBe('occurrence-1');
    expect(
      classroomOccurrenceFromLocation('/app/classes/questions', '?occurrence_key=occurrence-2'),
    ).toBe('occurrence-2');
    expect(classroomHref('rewards', 'occurrence / 2')).toBe(
      '/app/classes/rewards?occurrence_key=occurrence%20%2F%202',
    );
    expect(liveConsoleSectionFromSearch('?section=zoom')).toBe('zoom');
    expect(liveConsoleSectionFromSearch('?section=unknown')).toBe('current-class');
    expect(liveConsoleHref('questions', 'occurrence / 2')).toBe(
      '/app/live-console?section=questions&occurrence_key=occurrence+%2F+2',
    );
  });
});
