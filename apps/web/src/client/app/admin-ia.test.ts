import { describe, expect, it } from 'vitest';
import {
  ADMIN_PRIMARY_AREAS,
  CONTACTS_SECTIONS,
  adminPrimaryNav,
  classroomSeriesFromLocation,
  contactsSectionFromPath,
} from './admin-ia.ts';

describe('Admin information architecture', () => {
  it('exposes the persistent production workspaces in the primary navigation', () => {
    expect(ADMIN_PRIMARY_AREAS.map(({ id }) => id)).toEqual([
      'dashboard',
      'contacts',
      'content',
      'classroom',
      'communications',
      'billing-access',
      'operations',
      'live-console',
    ]);
    expect(
      adminPrimaryNav('operations', false).find(({ id }) => id === 'operations'),
    ).toMatchObject({ current: true });
    expect(adminPrimaryNav(null, false).some(({ id }) => id === 'live-console')).toBe(false);
  });

  it('routes canonical and compatibility directory paths to the same real controls', () => {
    expect(CONTACTS_SECTIONS.map(({ id }) => id)).toEqual([
      'people',
      'households',
      'users',
      'learners',
      'audit',
    ]);
    expect(contactsSectionFromPath('/app/households')).toBe('households');
    expect(contactsSectionFromPath('/app/crm/households')).toBe('households');
    expect(contactsSectionFromPath('/app/users')).toBe('users');
    expect(contactsSectionFromPath('/app/students')).toBe('learners');
    expect(contactsSectionFromPath('/app/audit')).toBe('audit');
  });

  it('resolves canonical and compatibility Class Series detail locations', () => {
    expect(classroomSeriesFromLocation('/app/classes', '?class_series_key=class-one')).toBe(
      'class-one',
    );
    expect(classroomSeriesFromLocation('/app/classroom/classes/class%2Fone', '')).toBe('class/one');
    expect(classroomSeriesFromLocation('/app/classroom/classes', '')).toBeNull();
  });
});
