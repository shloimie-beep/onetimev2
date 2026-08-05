import React from 'react';
import type {
  StudentNotificationCenterSnapshot,
  StudentNotificationFilter,
  StudentNotificationView,
} from '../../../../../../../packages/contracts/src/notifications/student/index.ts';
import { V21StatePanel } from '../../../../../../../packages/brand-system/src/react-v21.tsx';
import { shouldPlayForegroundNotificationSound } from '../../../../../../../packages/domain/src/notifications/student/foreground-sound.ts';

const FILTERS: { id: StudentNotificationFilter; label: string }[] = [
  { id: 'unread', label: 'Unread' },
  { id: 'read', label: 'Read' },
  { id: 'all', label: 'All' },
];

export function StudentNotificationCenter({
  snapshot,
  studentTimeZone,
  newlyRenderedNotice,
  onFilterChange,
  onMarkRead,
  onMarkAllRead,
  onOpenAction,
  onSoundPreferenceChange,
  onPlayForegroundCue,
}: {
  snapshot: StudentNotificationCenterSnapshot;
  studentTimeZone: string;
  newlyRenderedNotice?: ForegroundCueCandidate | null;
  onFilterChange: (filter: StudentNotificationFilter) => void;
  onMarkRead: (notificationId: string) => void;
  onMarkAllRead: () => void;
  onOpenAction: (notificationId: string) => void;
  onSoundPreferenceChange: (enabled: boolean) => void;
  onPlayForegroundCue?: () => void;
}) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const tabRefs = React.useRef<
    Partial<Record<StudentNotificationFilter, HTMLButtonElement | null>>
  >({});
  const priorFilterRef = React.useRef(snapshot.filter);
  const keepTabFocusRef = React.useRef(false);
  const playedNoticeIdsRef = React.useRef(new Set<string>());

  React.useEffect(() => {
    if (priorFilterRef.current !== snapshot.filter) {
      if (keepTabFocusRef.current) {
        keepTabFocusRef.current = false;
      } else {
        panelRef.current?.focus();
      }
      priorFilterRef.current = snapshot.filter;
    }
  }, [snapshot.filter]);

  React.useEffect(() => {
    if (!newlyRenderedNotice || !onPlayForegroundCue) return;
    consumeForegroundNotificationCue({
      snapshot,
      candidate: newlyRenderedNotice,
      playedNotificationIds: playedNoticeIdsRef.current,
      play: onPlayForegroundCue,
    });
  }, [newlyRenderedNotice, onPlayForegroundCue, snapshot]);

  return (
    <section aria-labelledby="student-notifications-heading">
      <header>
        <h2 id="student-notifications-heading">Notifications</h2>
        <p role="status" aria-live="polite" aria-atomic="true">
          {snapshot.unreadCount} unread{' '}
          {snapshot.unreadCount === 1 ? 'notification' : 'notifications'}
        </p>
      </header>

      <div role="tablist" aria-label="Notification filters">
        {FILTERS.map((filter) => (
          <button
            key={filter.id}
            id={`student-notifications-tab-${filter.id}`}
            ref={(element) => {
              tabRefs.current[filter.id] = element;
            }}
            type="button"
            role="tab"
            aria-selected={snapshot.filter === filter.id}
            aria-controls={`student-notifications-panel-${filter.id}`}
            tabIndex={snapshot.filter === filter.id ? 0 : -1}
            onClick={() => onFilterChange(filter.id)}
            onKeyDown={(event) => {
              handleStudentNotificationTabKey({
                key: event.key,
                currentFilter: filter.id,
                preventDefault: () => event.preventDefault(),
                selectFilter: (nextFilter) => {
                  keepTabFocusRef.current = nextFilter !== snapshot.filter;
                  onFilterChange(nextFilter);
                },
                focusFilter: (nextFilter) => tabRefs.current[nextFilter]?.focus(),
              });
            }}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div>
        <button type="button" disabled={snapshot.unreadCount === 0} onClick={onMarkAllRead}>
          Mark all as read
        </button>
        <label>
          <input
            type="checkbox"
            checked={snapshot.soundEnabled}
            aria-describedby="student-notification-sound-help"
            onChange={(event) => onSoundPreferenceChange(event.currentTarget.checked)}
          />
          Play a sound for new notifications while this portal is open
        </label>
        <p id="student-notification-sound-help">
          Sound is off by default and never plays in the background or before browser interaction.
        </p>
      </div>

      <div
        ref={panelRef}
        id={`student-notifications-panel-${snapshot.filter}`}
        role="tabpanel"
        tabIndex={-1}
        aria-labelledby={`student-notifications-tab-${snapshot.filter}`}
      >
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
                studentTimeZone={studentTimeZone}
                onMarkRead={onMarkRead}
                onOpenAction={onOpenAction}
              />
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function NotificationItem({
  view,
  studentTimeZone,
  onMarkRead,
  onOpenAction,
}: {
  view: StudentNotificationView;
  studentTimeZone: string;
  onMarkRead: (notificationId: string) => void;
  onOpenAction: (notificationId: string) => void;
}) {
  const { notification } = view;
  const descriptionId = `${notification.id}-description`;
  const availabilityId = `${notification.id}-availability`;
  return (
    <li>
      <article
        aria-labelledby={`${notification.id}-title`}
        data-notification-category={notification.category}
        data-notification-state={view.lifecycle}
      >
        <h3 id={`${notification.id}-title`}>{notification.title}</h3>
        <p id={descriptionId}>{notification.body}</p>
        <time dateTime={notification.createdAt}>
          {formatStudentNotificationTimestamp(notification.createdAt, studentTimeZone)}
        </time>

        {view.lifecycle === 'unread' ? (
          <button type="button" onClick={() => onMarkRead(notification.id)}>
            Mark as read
          </button>
        ) : null}

        {notification.action ? (
          <button
            type="button"
            disabled={!view.actionEnabled}
            aria-describedby={
              view.availabilityLabel ? `${descriptionId} ${availabilityId}` : descriptionId
            }
            onClick={() => onOpenAction(notification.id)}
          >
            {notification.action.label}
          </button>
        ) : null}

        {view.availabilityLabel ? (
          <p id={availabilityId} role="status" aria-live="polite">
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

export function handleStudentNotificationTabKey(input: {
  key: string;
  currentFilter: StudentNotificationFilter;
  preventDefault: () => void;
  selectFilter: (filter: StudentNotificationFilter) => void;
  focusFilter: (filter: StudentNotificationFilter) => void;
}) {
  const currentIndex = FILTERS.findIndex((filter) => filter.id === input.currentFilter);
  let nextIndex: number;
  switch (input.key) {
    case 'ArrowLeft':
      nextIndex = (currentIndex - 1 + FILTERS.length) % FILTERS.length;
      break;
    case 'ArrowRight':
      nextIndex = (currentIndex + 1) % FILTERS.length;
      break;
    case 'Home':
      nextIndex = 0;
      break;
    case 'End':
      nextIndex = FILTERS.length - 1;
      break;
    default:
      return false;
  }
  const nextFilter = FILTERS[nextIndex]?.id;
  if (!nextFilter) return false;
  input.preventDefault();
  input.selectFilter(nextFilter);
  input.focusFilter(nextFilter);
  return true;
}

export interface ForegroundCueCandidate {
  notificationId: string;
  disposition: 'created' | 'replayed' | 'stale';
  portalVisibility: 'foreground' | 'background';
  browserInteractionPermitsAudio: boolean;
}

export function consumeForegroundNotificationCue(input: {
  snapshot: StudentNotificationCenterSnapshot;
  candidate: ForegroundCueCandidate;
  playedNotificationIds: Set<string>;
  play: () => void;
}) {
  if (input.playedNotificationIds.has(input.candidate.notificationId)) return false;
  const visualNotice = input.snapshot.notifications.find(
    (view) =>
      view.notification.id === input.candidate.notificationId && view.lifecycle === 'unread',
  );
  const allowed = shouldPlayForegroundNotificationSound({
    preferenceEnabled: input.snapshot.soundEnabled,
    disposition: input.candidate.disposition,
    notificationUnread: visualNotice !== undefined,
    portalVisibility: input.candidate.portalVisibility,
    browserInteractionPermitsAudio: input.candidate.browserInteractionPermitsAudio,
    visualNoticeRendered: visualNotice !== undefined,
  });
  if (!allowed) return false;
  input.playedNotificationIds.add(input.candidate.notificationId);
  input.play();
  return true;
}

export function formatStudentNotificationTimestamp(instant: string, timeZone: string) {
  const value = new Date(instant);
  if (!Number.isFinite(value.getTime())) return 'Time unavailable';
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'longOffset',
    }).format(value);
  } catch {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'longOffset',
    }).format(value);
  }
}
