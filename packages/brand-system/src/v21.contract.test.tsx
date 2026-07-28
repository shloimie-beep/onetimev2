import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  ADMIN_PRIMARY_NAVIGATION,
  DESIGN_SYSTEM_CONTRACT_VERSION,
  formatEnglishDate,
  isAdminPrimaryNavigation,
} from './v21.ts';
import { V21AppShell, V21CalendarAgenda, V21Navigation, V21StatePanel } from './react-v21.tsx';

describe('v2.1 design-system contract', () => {
  it('keeps the exact Admin navigation and formats application dates in English', () => {
    expect(DESIGN_SYSTEM_CONTRACT_VERSION).toBe('2.1.0');
    expect(isAdminPrimaryNavigation(ADMIN_PRIMARY_NAVIGATION)).toBe(true);
    expect(formatEnglishDate('2026-09-14T12:00:00Z')).toContain('September');
  });

  it('renders skip navigation, an agenda equivalent, and explained unavailable controls', () => {
    const navigation = ADMIN_PRIMARY_NAVIGATION.map((item, index) => ({
      ...item,
      current: index === 0,
      ...(item.id === 'content' ? { disabledReason: 'Content is unavailable while your access is being refreshed.' } : {}),
    }));
    const html = renderToStaticMarkup(
      <V21AppShell role="admin" title="Dashboard" navigation={navigation} onNavigate={() => undefined}>
        <V21StatePanel kind="loading" title="Loading dashboard">Loading dashboard</V21StatePanel>
        <V21CalendarAgenda
          selectedDate="2026-09-14T12:00:00Z"
          items={[{ id: 'class-1', title: 'Next Class', startsAt: '2026-09-14T12:00:00Z' }]}
        />
      </V21AppShell>,
    );

    expect(html).toContain('Skip to main content');
    expect(html).toContain('Primary navigation');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('Content is unavailable while your access is being refreshed.');
    expect(html).toContain('Calendar');
    expect(html).toContain('1 event');
  });

  it('does not render a disabled link without its explanation', () => {
    const html = renderToStaticMarkup(
      <V21Navigation
        onNavigate={() => undefined}
        items={[{ id: 'admin', label: 'Admin', href: '/app/dashboard', disabledReason: 'Use a tablet or desktop.' }]}
      />,
    );
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('Use a tablet or desktop.');
  });
});
