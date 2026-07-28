import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { StudentPortalBootstrap } from '../../../../../../../packages/contracts/src/portals/student/index.ts';
import { StudentToday } from '../home/StudentToday.tsx';
import { StudentShell } from './StudentShell.tsx';

const bootstrap: StudentPortalBootstrap = {
  contractVersion: '2.1.0',
  profile: {
    studentId: 'student-1',
    actualName: 'Student One',
    displayName: 'One',
    username: 'student.one',
    relationship: 'dependent',
  },
  today: {
    nextClassLabel: 'Sunday class',
    nextClassTimeLabel: '7:00 PM EDT',
    join: {
      state: 'join',
      occurrenceId: 'occurrence-1',
      action: 'open_student_class',
    },
    latestLessonTitle: 'Mishnah lesson',
    latestLessonContentId: 'content-1',
    questionStatus: 'answered',
    unreadNoticeCount: 2,
    nextBadgeLabel: 'Five classes',
    nextBadgeProgressPercent: 80,
  },
  account: {
    username: 'student.one',
    credentialManagedBy: 'parent_or_admin',
    canChangePassword: false,
    canViewCurrentPassword: false,
    credentialHelp: 'Ask your account owner for help.',
    canLogout: true,
  },
  navigation: [
    { id: 'today', label: 'Today', href: '/app/student', placement: 'primary' },
    {
      id: 'calendar',
      label: 'Calendar',
      href: '/app/student/calendar',
      placement: 'primary',
    },
    {
      id: 'library',
      label: 'Library',
      href: '/app/student/library',
      placement: 'primary',
    },
    {
      id: 'questions',
      label: 'Questions',
      href: '/app/student/questions',
      placement: 'primary',
    },
    {
      id: 'account',
      label: 'Account',
      href: '/app/student/account',
      placement: 'utility',
    },
  ],
  preferredTimeZone: 'America/New_York',
};

describe('P14 Student shell and Today view', () => {
  it('renders a separate accessible Student shell with self-only Today priority', () => {
    const markup = renderToStaticMarkup(
      <StudentShell bootstrap={bootstrap} currentPath="/app/student" onNavigate={vi.fn()}>
        <StudentToday profile={bootstrap.profile} today={bootstrap.today} onNavigate={vi.fn()} />
      </StudentShell>,
    );
    expect(markup).toContain('Skip to main content');
    expect(markup).toContain('aria-label="Student shortcuts"');
    expect(markup).toContain('Join Class');
    expect(markup).toContain('<progress');
    expect(markup).toContain('America/New_York');
    expect(markup).not.toMatch(/parent|admin|billing|email|provider/i);
  });
});
