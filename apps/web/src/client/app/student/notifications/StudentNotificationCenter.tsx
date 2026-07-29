import React from 'react';
import type {
  StudentNotificationCenterSnapshot,
  StudentNotificationFilter,
  StudentNotificationView,
} from '../../../../../../../packages/contracts/src/notifications/student/index.ts';
import { V21StatePanel } from '../../../../../../../packages/brand-system/src/react-v21.tsx';

const FILTERS: { id: StudentNotificationFilter; label: string }[] = [
  { id: 'unread', label: 'Unread' },
  { id: 'read', label: 'Read' },
  { id: 'all', label: 'All' },
];

export function StudentNotificationCenter({
  snapshot,
  onFilterChange,
  onMarkRead,
  onMarkAllRead,
  onOpenAction,
  onSoundPreferenceChange,
}: {
  snapshot: StudentNotificationCenterSnapshot;
  onFilterChange: (filter: StudentNotificationFilter) => void;
  onMarkRead: (notificationId: string) => void;
  onMarkAllRead: () => void;
  onOpenAction: (notificationId: string) => void;
  onSoundPreferenceChange: (enabled: boolean) => void;
}) {
  return (
    <section aria-labelledby="student-notifications-heading">
      <header>
        <h2 id="student-notifications-heading">Notifications</h2>
        <p role="status" aria-live="polite" aria-atomic="true">
          {snapshot.unreadCount} unread{' '}
          {snapshot.unreadCount === 1 ? 'notification' : 'notifications'}
        </p>
      </header>

      <nav aria-label="Notification filters">
        {FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            aria-pressed={snapshot.filter === filter.id}
            onClick={() => onFilterChange(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </nav>

      <div>
        <button type="button" disabled={snapshot.unreadCount === 0} onClick={onMarkAllRead}>
          Mark all as read
        </button>
        <label>
          <input
            type="checkbox"
            checked={snapshot.soundEnabled}
            onChange={(event) => onSoundPreferenceChange(event.currentTarget.checked)}
          />
          Play a sound for new notifications while this portal is open
        </label>
        <p id="student-notification-sound-help">
          Sound is off by default and never plays in the background or before browser interaction.
        </p>
      </div>

      {snapshot.notifications.length === 0 ? (
        <V21StatePanel kind="empty" title={`No ${snapshot.filter} notifications`}>
          <p>New updates will appear here.</p>
        </V21StatePanel>
      ) : (
        <ol aria-label={`${labelForFilter(snapshot.filter)} notifications`}>
          {snapshot.notifications.map((view) => (
            <NotificationItem
              key={view.notification.id}
              view={view}
              onMarkRead={onMarkRead}
              onOpenAction={onOpenAction}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function NotificationItem({
  view,
  onMarkRead,
  onOpenAction,
}: {
  view: StudentNotificationView;
  onMarkRead: (notificationId: string) => void;
  onOpenAction: (notificationId: string) => void;
}) {
  const { notification } = view;
  return (
    <li>
      <article
        aria-labelledby={`${notification.id}-title`}
        data-notification-category={notification.category}
        data-notification-state={view.lifecycle}
      >
        <h3 id={`${notification.id}-title`}>{notification.title}</h3>
        <p>{notification.body}</p>
        <time dateTime={notification.createdAt}>{notification.createdAt}</time>

        {view.lifecycle === 'unread' ? (
          <button type="button" onClick={() => onMarkRead(notification.id)}>
            Mark as read
          </button>
        ) : null}

        {notification.action ? (
          <button
            type="button"
            disabled={!view.actionEnabled}
            onClick={() => onOpenAction(notification.id)}
          >
            {notification.action.label}
          </button>
        ) : null}

        {view.availabilityLabel ? (
          <p role="status" aria-live="polite">
            {view.availabilityLabel}
          </p>
        ) : null}
      </article>
    </li>
  );
}

function labelForFilter(filter: StudentNotificationFilter) {
  return FILTERS.find((candidate) => candidate.id === filter)?.label ?? 'All';
}
