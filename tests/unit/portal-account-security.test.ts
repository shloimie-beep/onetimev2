import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ParentPortalDashboard } from '../../packages/contracts/src/portals/index.ts';
import {
  PARENT_PORTAL_SECTIONS,
  ParentPortalFeature,
  STUDENT_PORTAL_SECTIONS,
} from '../../apps/web/src/client/features/portals/PortalFeatures.tsx';

describe('Parent and Student portal navigation and account security', () => {
  it('publishes only the required real portal navigation categories', () => {
    expect(PARENT_PORTAL_SECTIONS.map((section) => section.label)).toEqual([
      'Learners',
      'Classes & materials',
      'Progress & rewards',
      'Billing',
      'Updates',
    ]);
    expect(STUDENT_PORTAL_SECTIONS.map((section) => section.label)).toEqual([
      'Today',
      'Library',
      'Progress',
      'Questions',
      'Updates',
    ]);
  });

  it('renders account security even when a Parent household has no learners yet', () => {
    const dashboard: ParentPortalDashboard = {
      household: {
        household_key: 'household_empty',
        display_name: 'Empty Family',
        active_learner_count: 0,
        max_active_learners: 3,
        consent_status: 'not_required',
        learner_limit_reached: false,
        version: 1,
      },
      learners: [],
      student_access: [],
      upcoming_classes: {},
      rewards: {},
      updates: {},
      helper: {
        available: false,
        reason: 'No approved material yet.',
        scope_label: 'Class Helper',
      },
      billing: { enabled: false, summary_label: null },
    };
    const markup = renderToStaticMarkup(
      React.createElement(ParentPortalFeature, {
        viewState: 'ready',
        dashboard,
        activeSection: 'learners',
        actorFingerprint: 'parent-empty-account',
        accountSecurity: React.createElement(
          'form',
          { 'aria-label': 'Change password' },
          'Password form',
        ),
      }),
    );

    expect(markup).toContain('aria-label="Change password"');
    expect(markup).toContain('No learners yet');
  });

  it('does not render synthetic demo lessons in the real portal library', () => {
    const source = readFileSync('apps/web/src/client/features/portals/PortalFeatures.tsx', 'utf8');
    expect(source).toContain(
      'const visibleItems = items.filter((item) => !item.content_factory?.is_demo);',
    );
    expect(source).not.toContain('approved synthetic lesson data');
  });

  it('wires the portal password API and sends CSRF on every application logout', () => {
    const portalApi = readFileSync('apps/web/src/client/app/portal-api.ts', 'utf8');
    const portalEntry = readFileSync('apps/web/src/client/app/portal-entry.tsx', 'utf8');
    const liveEntry = readFileSync('apps/web/src/client/app/live-entry.tsx', 'utf8');

    expect(portalApi).toContain("'/api/v1/auth/password'");
    expect(portalApi).toContain("'x-csrf-token': input.csrfToken");
    expect(portalEntry).toContain('<AccountSecurityPanel');
    expect(portalEntry).toContain('autoComplete="current-password"');
    expect(portalEntry).toContain('autoComplete="new-password"');
    expect(portalEntry).toContain("if (role === 'student')");
    expect(portalEntry).toContain('Student PINs and legacy credentials are managed by a Parent or Administrator.');
    expect(portalEntry).toContain('<span>Six-digit Student PIN</span>');
    expect(portalEntry).toContain('inputMode="numeric"');
    expect(portalEntry).toContain('pattern="[0-9]{6}"');
    expect(liveEntry).toContain("headers: { 'x-csrf-token': csrfToken }");
  });

  it('advertises mounted role-specific support routes without a learner-scoped Parent callback', () => {
    const portalEntry = readFileSync('apps/web/src/client/app/portal-entry.tsx', 'utf8');
    const portalFeatures = readFileSync(
      'apps/web/src/client/features/portals/PortalFeatures.tsx',
      'utf8',
    );

    expect(portalEntry).toContain("window.location.assign('/app/student/support')");
    expect(portalEntry).toContain(
      "basePath={portalRole === 'parent' ? '/app/parent/support' : '/app/student/support'}",
    );
    expect(portalEntry).toContain("href: '/app/parent/support'");
    expect(portalEntry).not.toContain("window.location.assign('/app/support')");
    expect(portalEntry).toContain("href: '/app/student/questions'");
    expect(portalEntry).toContain("href: '/app/student/updates'");
    expect(portalEntry).not.toContain('Support remains available while learning access is paused.');
    expect(portalFeatures).not.toContain('onPreviewSupport(selectedLearner.learner_key)');
  });
});
