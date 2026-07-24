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
} from '../../apps/web/src/client/app/admin-ia.ts';

describe('OT-LAUNCH-01 Admin information architecture', () => {
  it('keeps exactly five primary Admin areas in the governed order', () => {
    expect(ADMIN_PRIMARY_AREAS).toEqual([
      { id: 'dashboard', label: 'Dashboard', href: '/app/dashboard' },
      { id: 'contacts', label: 'Contacts', href: '/app/crm' },
      { id: 'content', label: 'Content', href: '/app/content' },
      { id: 'classroom', label: 'Classroom', href: '/app/classes' },
      { id: 'live-console', label: 'Live Console', href: '/app/live-console' },
    ]);
    expect(adminPrimaryNav('content').filter((item) => item.current)).toEqual([
      { id: 'content', label: 'Content', href: '/app/content', current: true },
    ]);
  });

  it('defines one canonical section model for each focused workspace', () => {
    expect(DASHBOARD_SECTIONS.map((item) => item.label)).toEqual(['Overview', 'Internal Tasks']);
    expect(CONTACTS_SECTIONS.map((item) => item.label)).toEqual([
      'Parents',
      'Students',
      'Internal Tasks',
    ]);
    expect(CONTENT_SECTIONS.map((item) => item.label)).toEqual([
      'Library',
      'Factory',
      'Studio',
      'Knowledge',
      'Prompts',
    ]);
    expect(CLASSROOM_SECTIONS.map((item) => item.label)).toEqual([
      'Overview',
      'Schedule',
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
    expect(dashboardSectionFromPath('/app/dashboard/internal-tasks')).toBe('internal-tasks');
    expect(contactsSectionFromPath('/app/crm/students')).toBe('students');
    expect(contentSectionFromPath('/app/content/create')).toBe('studio');
    expect(contentSectionFromPath('/app/content/social')).toBe('studio');
    expect(contentSectionFromPath('/app/content/processing')).toBe('library');
    expect(contentSectionFromPath('/app/content/activity')).toBe('library');
    expect(classroomSectionFromPath('/app/rewards')).toBe('rewards');
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
