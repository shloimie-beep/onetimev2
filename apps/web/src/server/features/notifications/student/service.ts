import type {
  StudentNotificationActionDecision,
  StudentNotificationCenterSnapshot,
  StudentNotificationEvent,
  StudentNotificationFilter,
  StudentNotificationPrincipal,
  StudentNotificationRecord,
  StudentNotificationRepository,
} from '../../../../../../../packages/contracts/src/notifications/student/index.ts';
import {
  buildStudentNotification,
  canOpenStudentNotificationAction,
  projectStudentNotification,
  shouldPlayForegroundNotificationSound,
} from '../../../../../../../packages/domain/src/notifications/student/index.ts';

export function createStudentNotificationService(deps: {
  repository: StudentNotificationRepository;
  authorizeAction: (input: {
    principal: StudentNotificationPrincipal;
    notification: StudentNotificationRecord;
  }) => Promise<boolean>;
}) {
  return {
    async deliver(input: {
      event: StudentNotificationEvent;
      deliveryContext: {
        portalVisibility: 'foreground' | 'background';
        browserInteractionPermitsAudio: boolean;
        visualNoticeRendered: boolean;
      };
    }) {
      const planned = buildStudentNotification(input.event);
      const delivered = await deps.repository.deliver(planned);
      const soundEnabled = await deps.repository.getSoundPreference(input.event.recipientStudentId);
      return {
        ...delivered,
        playForegroundSound: shouldPlayForegroundNotificationSound({
          preferenceEnabled: soundEnabled,
          disposition: delivered.disposition,
          notificationUnread: delivered.notification.readAt === null,
          portalVisibility: input.deliveryContext.portalVisibility,
          browserInteractionPermitsAudio: input.deliveryContext.browserInteractionPermitsAudio,
          visualNoticeRendered: input.deliveryContext.visualNoticeRendered,
        }),
      };
    },

    async center(input: {
      principal: StudentNotificationPrincipal;
      filter: StudentNotificationFilter;
      now: Date;
    }): Promise<StudentNotificationCenterSnapshot> {
      const nowIso = validNow(input.now);
      await deps.repository.refreshLifecycle(input.principal.studentId, nowIso);
      const records = await deps.repository.listVisible(input.principal.studentId);
      const views = (
        await Promise.all(
          records.map(async (notification) => {
            assertOwned(input.principal, notification);
            return projectStudentNotification({
              notification,
              now: input.now,
              actionAuthorized: await deps.authorizeAction({
                principal: input.principal,
                notification,
              }),
            });
          }),
        )
      ).filter((view) => view !== null);
      const unreadCount = views.filter((view) => view.lifecycle === 'unread').length;
      const notifications = views.filter((view) => {
        if (input.filter === 'all') return true;
        return view.lifecycle === input.filter;
      });
      return {
        filter: input.filter,
        unreadCount,
        soundEnabled: await deps.repository.getSoundPreference(input.principal.studentId),
        notifications,
      };
    },

    async markRead(input: {
      principal: StudentNotificationPrincipal;
      notificationId: string;
      now: Date;
    }) {
      const nowIso = validNow(input.now);
      await deps.repository.refreshLifecycle(input.principal.studentId, nowIso);
      const notification = await deps.repository.markRead(
        input.principal.studentId,
        input.notificationId,
        nowIso,
      );
      return { disposition: notification ? ('applied' as const) : ('unavailable' as const) };
    },

    async markAllRead(input: { principal: StudentNotificationPrincipal; now: Date }) {
      const nowIso = validNow(input.now);
      await deps.repository.refreshLifecycle(input.principal.studentId, nowIso);
      const changedCount = await deps.repository.markAllRead(input.principal.studentId, nowIso);
      return { changedCount };
    },

    async setSoundPreference(input: { principal: StudentNotificationPrincipal; enabled: boolean }) {
      await deps.repository.setSoundPreference(input.principal.studentId, input.enabled);
      return { soundEnabled: input.enabled };
    },

    async openAction(input: {
      principal: StudentNotificationPrincipal;
      notificationId: string;
      now: Date;
    }): Promise<StudentNotificationActionDecision> {
      const nowIso = validNow(input.now);
      await deps.repository.refreshLifecycle(input.principal.studentId, nowIso);
      const notification = await deps.repository.findVisibleById(
        input.principal.studentId,
        input.notificationId,
      );
      if (!notification) return unavailable();
      assertOwned(input.principal, notification);
      const actionAuthorized = await deps.authorizeAction({
        principal: input.principal,
        notification,
      });
      if (
        !canOpenStudentNotificationAction({
          notification,
          principalStudentId: input.principal.studentId,
          now: input.now,
          actionAuthorized,
        })
      ) {
        return unavailable();
      }
      return {
        status: 'allowed',
        route: notification.action?.route ?? null,
        message: null,
      };
    },
  };
}

function assertOwned(
  principal: StudentNotificationPrincipal,
  notification: StudentNotificationRecord,
) {
  if (
    notification.recipientStudentId !== principal.studentId ||
    notification.scope.studentId !== principal.studentId
  ) {
    throw new Error('student_notification_scope_denied');
  }
}

function validNow(now: Date) {
  if (!Number.isFinite(now.getTime())) throw new Error('student_notification_invalid_time');
  return now.toISOString();
}

function unavailable(): StudentNotificationActionDecision {
  return {
    status: 'unavailable',
    route: null,
    message: 'No longer available',
  };
}
