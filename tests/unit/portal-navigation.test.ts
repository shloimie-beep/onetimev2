import { describe, expect, it } from 'vitest';
import { portalNavigationFor } from '../../apps/web/src/client/app/portal-entry.tsx';

describe('canonical Parent and Student portal navigation', () => {
  it('keeps Parent primary navigation in canonical order and gates Billing', () => {
    const disabled = portalNavigationFor({
      role: 'parent',
      pathname: '/app/parent/account',
      search: '?tab=profile',
      billingEnabled: false,
    });
    expect(disabled.primary.map((item) => item.label)).toEqual([
      'Today',
      'Learning',
      'Family',
      'Updates',
      'Account',
    ]);
    expect(disabled.subcategories.map((item) => item.label)).toEqual([
      'Profile',
      'Sign-in & Security',
      'Privacy',
      'Preferences',
    ]);

    const enabled = portalNavigationFor({
      ...disabled,
      role: 'parent',
      pathname: '/app/parent/account',
      search: '?tab=profile',
      billingEnabled: true,
    });
    expect(enabled.subcategories.map((item) => item.label)).toContain('Billing');
  });

  it('keeps Student household, billing, and technical-support submission out of navigation', () => {
    const navigation = portalNavigationFor({
      role: 'student',
      pathname: '/app/student/questions',
      search: '',
      billingEnabled: false,
    });
    expect(navigation.primary.map((item) => item.label)).toEqual([
      'Today',
      'Learning',
      'Updates',
      'Account',
    ]);
    expect(navigation.subcategories.map((item) => item.label)).toEqual([
      'Classroom',
      'Library',
      'Progress',
      'Questions',
    ]);
  });

  it('separates Parent self progress from Family student progress', () => {
    const learning = portalNavigationFor({
      role: 'parent',
      pathname: '/app/parent/progress',
      search: '',
      billingEnabled: false,
    });
    const family = portalNavigationFor({
      role: 'parent',
      pathname: '/app/parent/progress',
      search: '?scope=students',
      billingEnabled: false,
    });
    expect(learning.activePrimary).toBe('Learning');
    expect(family.activePrimary).toBe('Family');
    expect(family.activeSubcategory).toBe('student-progress');
  });
});
