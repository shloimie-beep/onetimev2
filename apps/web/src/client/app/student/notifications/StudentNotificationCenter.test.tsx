import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type {
  StudentNotificationCenterSnapshot,
  StudentNotificationRecord,
} from '../../../../../../../packages/contracts/src/notifications/student/index.ts';
import { StudentNotificationCenter } from './StudentNotificationCenter.tsx';

function notification(
  overrides: Partial<StudentNotificationRecord> = {},
): StudentNotificationRecord {
  return {
    id: 'student_notice_one',
    recipientStudentId: 'student_one',
    scope: {
      product: 'one_time_mishnayos',
      studentId: 'student_one',
      householdId: 'household_one',
    },
    category: 'class_reminder',
    eventType: 'class_reminder',
    sourceEntityId: 'occurrence_one',
    sourceVersion: 1,
    dedupeKey: 'dedupe_one',
    title: 'Class begins in 30 minutes',
    body: 'Rabbi Eli\u2019s class begins at 3:00 PM.',
    action: {
      kind: 'open_class',
      label: 'Open class',
      route: '/student/classes/occurrence_one',
    },
    createdAt: '2026-08-01T11:30:00.000Z',
    expiresAt: '2026-08-01T13:00:00.000Z',
    retainUntil: '2026-08-31T13:00:00.000Z',
    readAt: null,
    expiredAt: null,
    archivedAt: null,
    supersededAt: null,
    ...overrides,
  };
}

function render(snapshot: StudentNotificationCenterSnapshot) {
  return renderToStaticMarkup(
    <StudentNotificationCenter
      snapshot={snapshot}
      onFilterChange={vi.fn()}
      onMarkRead={vi.fn()}
      onMarkAllRead={vi.fn()}
      onOpenAction={vi.fn()}
      onSoundPreferenceChange={vi.fn()}
    />,
  );
}

describe('StudentNotificationCenter', () => {
  it('renders accessible unread state, filter controls, exact copy, and internal action buttons', () => {
    const markup = render({
      filter: 'unread',
      unreadCount: 1,
      soundEnabled: false,
      notifications: [
        {
          notification: notification(),
          lifecycle: 'unread',
          actionEnabled: true,
          availabilityLabel: null,
        },
      ],
    });
    expect(markup).toContain('aria-labelledby="student-notifications-heading"');
    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('Class begins in 30 minutes');
    expect(markup).toContain('Rabbi Eli\u2019s class begins at 3:00 PM.');
    expect(markup).toContain('Open class');
    expect(markup).not.toContain('href="https://');
    expect(markup).not.toContain('zoom.us');
    expect(markup).not.toContain('vimeo.com');
  });

  it('shows expired notices only as unavailable actions in All', () => {
    const markup = render({
      filter: 'all',
      unreadCount: 0,
      soundEnabled: false,
      notifications: [
        {
          notification: notification({
            expiredAt: '2026-08-01T13:00:00.000Z',
          }),
          lifecycle: 'expired',
          actionEnabled: false,
          availabilityLabel: 'No longer available',
        },
      ],
    });
    expect(markup).toContain('data-notification-state="expired"');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('No longer available');
    expect(markup).not.toContain('Mark as read');
  });

  it('keeps foreground sound visibly optional and off by default', () => {
    const markup = render({
      filter: 'unread',
      unreadCount: 0,
      soundEnabled: false,
      notifications: [],
    });
    expect(markup).toContain('type="checkbox"');
    expect(markup).not.toContain('checked=""');
    expect(markup).toContain('Sound is off by default');
    expect(markup).toContain('never plays in the background');
    expect(markup).toContain('No unread notifications');
  });
});
