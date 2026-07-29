import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type {
  StudentNotificationCenterSnapshot,
  StudentNotificationRecord,
} from '../../../../../../../packages/contracts/src/notifications/student/index.ts';
import {
  StudentNotificationCenter,
  consumeForegroundNotificationCue,
  formatStudentNotificationTimestamp,
  handleStudentNotificationTabKey,
} from './StudentNotificationCenter.tsx';

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
    sourceFamily: 'class_occurrence',
    sourceEntityId: 'occurrence_one',
    sourceVersion: 1,
    currentForSource: true,
    dedupeKey: 'dedupe_one',
    title: 'Class begins in 30 minutes',
    body: 'Rabbi Eli\u2019s class begins at 3:00 PM.',
    action: {
      kind: 'open_class',
      label: 'Open class',
      route: '/app/student/classes/occurrence_one',
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
      studentTimeZone="Asia/Jerusalem"
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
    expect(markup).toContain('role="tablist"');
    expect(markup).toContain('role="tab"');
    expect(markup).toContain('aria-selected="true"');
    expect(markup).toContain('aria-controls="student-notifications-panel-unread"');
    expect(markup).toContain('role="tabpanel"');
    expect(markup).toContain('tabindex="-1"');
    expect(markup).toContain('Class begins in 30 minutes');
    expect(markup).toContain('Rabbi Eli\u2019s class begins at 3:00 PM.');
    expect(markup).toContain('Open class');
    expect(markup).toContain('aria-describedby="student_notice_one-description"');
    expect(markup).toMatch(/Aug 1, 2026.*GMT\+03:00/);
    expect(markup).not.toContain('2026-08-01T11:30:00.000Z</time>');
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
    expect(markup).toContain('aria-describedby="student-notification-sound-help"');
    expect(markup).not.toContain('checked=""');
    expect(markup).toContain('Sound is off by default');
    expect(markup).toContain('never plays in the background');
    expect(markup).toContain('No unread notifications');
  });

  it('consumes one opted-in foreground cue only after the unread visual notice is present', () => {
    const play = vi.fn();
    const played = new Set<string>();
    const snapshot: StudentNotificationCenterSnapshot = {
      filter: 'unread',
      unreadCount: 1,
      soundEnabled: true,
      notifications: [
        {
          notification: notification(),
          lifecycle: 'unread',
          actionEnabled: true,
          availabilityLabel: null,
        },
      ],
    };
    const candidate = {
      notificationId: 'student_notice_one',
      disposition: 'created' as const,
      portalVisibility: 'foreground' as const,
      browserInteractionPermitsAudio: true,
    };
    expect(
      consumeForegroundNotificationCue({
        snapshot,
        candidate,
        playedNotificationIds: played,
        play,
      }),
    ).toBe(true);
    expect(
      consumeForegroundNotificationCue({
        snapshot,
        candidate,
        playedNotificationIds: played,
        play,
      }),
    ).toBe(false);
    expect(play).toHaveBeenCalledTimes(1);
    expect(
      consumeForegroundNotificationCue({
        snapshot: { ...snapshot, notifications: [] },
        candidate: { ...candidate, notificationId: 'not-rendered' },
        playedNotificationIds: played,
        play,
      }),
    ).toBe(false);
  });

  it('formats timestamps in the Student timezone with an unambiguous offset', () => {
    expect(
      formatStudentNotificationTimestamp('2026-07-29T07:00:00.000Z', 'Asia/Jerusalem'),
    ).toMatch(/Jul 29, 2026.*GMT\+03:00/);
    expect(formatStudentNotificationTimestamp('invalid', 'Asia/Jerusalem')).toBe(
      'Time unavailable',
    );
  });

  it('moves tab selection and DOM focus with Arrow, Home, and End keys', () => {
    const preventDefault = vi.fn();
    const selectFilter = vi.fn();
    const focus = {
      unread: vi.fn(),
      read: vi.fn(),
      all: vi.fn(),
    };
    const run = (key: string, currentFilter: 'unread' | 'read' | 'all') =>
      handleStudentNotificationTabKey({
        key,
        currentFilter,
        preventDefault,
        selectFilter,
        focusFilter: (filter) => focus[filter](),
      });

    expect(run('ArrowRight', 'unread')).toBe(true);
    expect(selectFilter).toHaveBeenLastCalledWith('read');
    expect(focus.read).toHaveBeenCalledTimes(1);
    expect(run('ArrowRight', 'all')).toBe(true);
    expect(selectFilter).toHaveBeenLastCalledWith('unread');
    expect(focus.unread).toHaveBeenCalledTimes(1);
    expect(run('ArrowLeft', 'unread')).toBe(true);
    expect(selectFilter).toHaveBeenLastCalledWith('all');
    expect(focus.all).toHaveBeenCalledTimes(1);
    expect(run('Home', 'all')).toBe(true);
    expect(selectFilter).toHaveBeenLastCalledWith('unread');
    expect(focus.unread).toHaveBeenCalledTimes(2);
    expect(run('End', 'unread')).toBe(true);
    expect(selectFilter).toHaveBeenLastCalledWith('all');
    expect(focus.all).toHaveBeenCalledTimes(2);
    expect(run('Tab', 'read')).toBe(false);
    expect(preventDefault).toHaveBeenCalledTimes(5);
    expect(selectFilter).toHaveBeenCalledTimes(5);
  });
});
