import { describe, expect, it } from 'vitest';
import {
  ADMIN_PRIMARY_AREAS,
  CLASSROOM_SECTIONS,
  CONTACTS_SECTIONS,
  adminPrimaryNav,
  classroomHref,
  classroomOccurrenceFromLocation,
  classroomSectionFromPath,
  classroomSeriesFromLocation,
  contactsSectionFromPath,
} from './admin-ia.ts';

describe('Admin information architecture', () => {
  it('exposes the persistent production workspaces in the primary navigation', () => {
    expect(ADMIN_PRIMARY_AREAS.map(({ id }) => id)).toEqual([
      'today',
      'learning',
      'people',
      'communications',
      'operations',
      'account',
    ]);
    expect(
      adminPrimaryNav('operations', false).find(({ id }) => id === 'operations'),
    ).toMatchObject({ current: true });
    expect(adminPrimaryNav(null, false).map(({ label }) => label)).toEqual([
      'Today',
      'Learning',
      'People',
      'Communications',
      'Operations',
      'Account',
    ]);
  });

  it('routes canonical and compatibility directory paths to the same real controls', () => {
    expect(CONTACTS_SECTIONS.map(({ id }) => id)).toEqual([
      'households',
      'users',
      'learners',
      'access',
      'audit',
    ]);
    expect(contactsSectionFromPath('/app/households')).toBe('households');
    expect(contactsSectionFromPath('/app/crm/households')).toBe('households');
    expect(contactsSectionFromPath('/app/crm/contacts')).toBe('people');
    expect(contactsSectionFromPath('/app/crm/contacts/contact-1')).toBe('people');
    expect(contactsSectionFromPath('/app/users')).toBe('users');
    expect(contactsSectionFromPath('/app/students')).toBe('learners');
    expect(contactsSectionFromPath('/app/audit')).toBe('audit');
  });

  it('keeps canonical and compatibility Classroom routes on the requested section', () => {
    expect(CLASSROOM_SECTIONS.map(({ label }) => label)).toEqual([
      'Classroom',
      'Library',
      'Questions',
      'Attendance',
      'Recordings',
    ]);
    expect(classroomSectionFromPath('/app/classroom/occurrences')).toBe('occurrences');
    expect(classroomSectionFromPath('/app/classes/occurrences')).toBe('occurrences');
    expect(classroomSectionFromPath('/app/classroom/enrollments')).toBe('enrollments');
    expect(classroomSectionFromPath('/app/classes/enrollments')).toBe('enrollments');
    expect(classroomSectionFromPath('/app/classroom/attendance')).toBe('attendance');
    expect(classroomSectionFromPath('/app/classroom/zoom')).toBe('live-console');
    const canonicalOccurrencePath = '/app/classroom/occurrences/occurrence%2Fone';
    expect(classroomOccurrenceFromLocation(canonicalOccurrencePath, '')).toBe('occurrence/one');
    expect(classroomOccurrenceFromLocation('/app/classroom/enrollments', '')).toBeNull();
    const liveConsoleUrl = classroomHref('live-console', 'occurrence/one');
    expect(liveConsoleUrl).toBe('/app/live?section=zoom&occurrence_key=occurrence%2Fone');
  });

  it('resolves canonical and compatibility Class Series detail locations', () => {
    expect(classroomSeriesFromLocation('/app/classes', '?class_series_key=class-one')).toBe(
      'class-one',
    );
    expect(classroomSeriesFromLocation('/app/classroom/classes/class%2Fone', '')).toBe('class/one');
    expect(classroomSeriesFromLocation('/app/classroom/classes', '')).toBeNull();
  });
});
