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
  it('keeps Live Console directly reachable in the canonical Admin and Rabbi areas', () => {
    expect(ADMIN_PRIMARY_AREAS).toEqual([
      { id: 'today', label: 'Today', href: '/app/today' },
      { id: 'learning', label: 'Learning', href: '/app/learning/classroom' },
      {
        id: 'live-console',
        label: 'Live Console',
        href: '/app/live-console?section=zoom',
      },
      { id: 'people', label: 'People', href: '/app/people/families' },
      { id: 'communications', label: 'Communications', href: '/app/communications' },
      { id: 'operations', label: 'Operations', href: '/app/operations' },
      { id: 'account', label: 'Account', href: '/app/account/profile' },
    ]);
    expect(adminPrimaryNav('learning', true).filter((item) => item.current)).toEqual([
      { id: 'learning', label: 'Learning', href: '/app/learning/classroom', current: true },
    ]);
    expect(adminPrimaryNav('learning', false).map((item) => item.label)).toEqual([
      'Today',
      'Learning',
      'Live Console',
      'People',
      'Communications',
      'Operations',
      'Account',
    ]);
    expect(rabbiPrimaryNav('learning', true).map((item) => item.label)).toEqual([
      'Today',
      'Learning',
      'Live Console',
      'Account',
    ]);
    expect(rabbiPrimaryNav('learning', true).some((item) => item.id === 'people')).toBe(false);
  });

  it('defines one canonical section model for each focused workspace', () => {
    expect(DASHBOARD_SECTIONS.map((item) => item.label)).toEqual(['Today']);
    expect(CONTACTS_SECTIONS.map((item) => item.label)).toEqual([
      'Families',
      'Parents',
      'Students',
      'Access',
      'Audit',
    ]);
    expect(CONTENT_SECTIONS.map((item) => item.label)).toEqual(['Library', 'Pipeline', 'Upload']);
    expect(CLASSROOM_SECTIONS.map((item) => item.label)).toEqual([
      'Classroom',
      'Library',
      'Questions',
      'Attendance',
      'Recordings',
    ]);
    expect(LIVE_CONSOLE_SECTIONS.map((item) => item.label)).toEqual([
      'Current Class',
      'Questions',
      'Zoom',
    ]);
  });

  it('maps legacy and deep URLs into safe focused destinations', () => {
    expect(dashboardSectionFromPath('/app/dashboard/internal-tasks')).toBe('today');
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
    expect(classroomSectionFromPath('/app/classes/attendance')).toBe('attendance');
    expect(classroomSectionFromPath('/app/classes/recordings')).toBe('recordings');
    expect(classroomSectionFromPath('/app/classes/access')).toBe('access');
    expect(classroomSectionFromPath('/app/classes/questions')).toBe('questions');
    expect(classroomSectionFromPath('/app/classroom/questions')).toBe('questions');
    expect(classroomOccurrenceFromLocation('/app/classes/occurrence-1', '')).toBe('occurrence-1');
    expect(
      classroomOccurrenceFromLocation('/app/classes/questions', '?occurrence_key=occurrence-2'),
    ).toBe('occurrence-2');
    expect(classroomHref('rewards', 'occurrence / 2')).toBe(
      '/app/classroom/classes?occurrence_key=occurrence%20%2F%202',
    );
    expect(liveConsoleSectionFromSearch('?section=zoom')).toBe('zoom');
    expect(liveConsoleSectionFromSearch('?section=unknown')).toBe('current-class');
    expect(liveConsoleHref('questions', 'occurrence / 2')).toBe(
      '/app/live-console?section=questions&occurrence_key=occurrence+%2F+2',
    );
  });
});
