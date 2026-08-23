import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AppShell, roleSwitchFailureMessage } from './AppShell.tsx';

function render(availableRoles: readonly ('admin' | 'parent')[]) {
  return renderToStaticMarkup(
    <AppShell
      user={{ displayName: 'Dual role adult', email: 'adult@example.test', roleLabel: 'Parent' }}
      navItems={[]}
      title="Content"
      onNavigate={vi.fn()}
      roleContext={{ activeRole: 'parent', availableRoles, csrfToken: 'csrf-test' }}
    >
      <p>Parent workspace</p>
    </AppShell>,
  );
}

describe('AppShell account context', () => {
  it('advertises only roles returned by the active server session', () => {
    const parentOnly = render(['parent']);
    expect(parentOnly).not.toContain('Switch account role');
    expect(parentOnly).not.toContain('>Admin</button>');

    const dualRole = render(['admin', 'parent']);
    expect(dualRole).toContain('Switch account role');
    expect(dualRole).toContain('>Admin</button>');
    expect(dualRole).toContain('>Parent</button>');
  });

  it('keeps a rejected switch message available to an accessible alert', () => {
    expect(
      roleSwitchFailureMessage(new Error('That role is not available for this account.')),
    ).toBe('That role is not available for this account.');
    expect(roleSwitchFailureMessage(null)).toContain('Role switching is unavailable');
  });
});
