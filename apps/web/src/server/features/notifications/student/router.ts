import express, { type Request, type Response } from 'express';
import { z, ZodError } from 'zod';
import type {
  StudentNotificationFilter,
  StudentNotificationPrincipal,
} from '../../../../../../../packages/contracts/src/notifications/student/index.ts';
import type { StudentNotificationService } from './service.ts';

const filterSchema = z.enum(['unread', 'read', 'all']);
const notificationIdSchema = z.string().trim().min(1).max(256);
const soundPreferenceSchema = z.object({ enabled: z.boolean() }).strict();

export type AuthenticatedStudentNotificationPrincipal = {
  principal: StudentNotificationPrincipal;
  sessionKey: string;
};

export function createStudentNotificationRouter(input: {
  service: StudentNotificationService;
  resolvePrincipal: (request: Request) => Promise<AuthenticatedStudentNotificationPrincipal | null>;
  verifyCsrf: (
    request: Request,
    authenticated: AuthenticatedStudentNotificationPrincipal,
  ) => Promise<boolean>;
  clock?: () => Date;
}) {
  const router = express.Router();
  const clock = input.clock ?? (() => new Date());

  router.use((_req, res, next) => {
    setPrivateNoStore(res);
    next();
  });

  router.get(
    '/',
    route(input, false, async (req, res, authenticated) => {
      const filter = filterSchema.parse(req.query.filter ?? 'unread') as StudentNotificationFilter;
      const snapshot = await input.service.center({
        principal: authenticated.principal,
        filter,
        now: clock(),
      });
      res.json({ success: true, data: { snapshot } });
    }),
  );

  router.post(
    '/:notificationId/read',
    route(input, true, async (req, res, authenticated) => {
      const data = await input.service.markRead({
        principal: authenticated.principal,
        notificationId: notificationIdSchema.parse(req.params.notificationId),
        now: clock(),
      });
      res.json({ success: true, data });
    }),
  );

  router.post(
    '/read-all',
    route(input, true, async (_req, res, authenticated) => {
      const data = await input.service.markAllRead({
        principal: authenticated.principal,
        now: clock(),
      });
      res.json({ success: true, data });
    }),
  );

  router.post(
    '/sound-preference',
    route(input, true, async (req, res, authenticated) => {
      const body = soundPreferenceSchema.parse(req.body);
      const data = await input.service.setSoundPreference({
        principal: authenticated.principal,
        enabled: body.enabled,
      });
      res.json({ success: true, data });
    }),
  );

  router.post(
    '/:notificationId/open',
    route(input, true, async (req, res, authenticated) => {
      const data = await input.service.openAction({
        principal: authenticated.principal,
        notificationId: notificationIdSchema.parse(req.params.notificationId),
        now: clock(),
      });
      res.json({ success: true, data });
    }),
  );

  return router;
}

function route(
  input: {
    resolvePrincipal: (
      request: Request,
    ) => Promise<AuthenticatedStudentNotificationPrincipal | null>;
    verifyCsrf: (
      request: Request,
      authenticated: AuthenticatedStudentNotificationPrincipal,
    ) => Promise<boolean>;
  },
  mutation: boolean,
  handler: (
    request: Request,
    response: Response,
    authenticated: AuthenticatedStudentNotificationPrincipal,
  ) => Promise<void>,
) {
  return async (request: Request, response: Response) => {
    try {
      const authenticated = await input.resolvePrincipal(request);
      if (!authenticated) {
        response.status(403).json(accessDenied());
        return;
      }
      if (mutation && !(await input.verifyCsrf(request, authenticated))) {
        response.status(403).json({
          success: false,
          code: 'CSRF_REQUIRED',
          message: 'Refresh the page and try again.',
        });
        return;
      }
      await handler(request, response, authenticated);
    } catch (error) {
      if (error instanceof ZodError) {
        response.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Check the notification request and try again.',
        });
        return;
      }
      response.status(500).json({
        success: false,
        code: 'STUDENT_NOTIFICATIONS_UNAVAILABLE',
        message: 'Notifications are temporarily unavailable.',
      });
    }
  };
}

function accessDenied() {
  return {
    success: false,
    code: 'STUDENT_NOTIFICATIONS_ACCESS_DENIED',
    message: 'Notifications are unavailable.',
  } as const;
}

function setPrivateNoStore(response: Response) {
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('Expires', '0');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.removeHeader('ETag');
}
