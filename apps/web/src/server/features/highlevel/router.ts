import express, { type Request, type Response } from 'express';
import type { AppConfig } from '../../../../../../packages/config/src/index.ts';
import type { DbPool } from '../../../../../../packages/db/src/index.ts';
import {
  recordHighLevelWebhookInbox,
  verifyHighLevelWebhook,
} from '../../../../../../packages/domain/src/highlevel/webhook.ts';

type HighLevelWebhookRouterDeps = {
  config: AppConfig;
  pool: DbPool;
  clock?: (() => Date) | undefined;
  onAsyncError?: ((error: unknown) => void) | undefined;
};

type RequestWithTrace = Request & { traceId?: string | undefined };

export function createHighLevelWebhookRouter(deps: HighLevelWebhookRouterDeps) {
  const router = express.Router();

  router.post(
    '/webhooks/highlevel',
    express.raw({ type: 'application/json', limit: '128kb' }),
    (req: RequestWithTrace, res) => {
      setPrivateNoStore(res);
      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      const result = verifyHighLevelWebhook({
        config: deps.config,
        rawBody,
        headers: {
          contentType: req.header('content-type') ?? undefined,
          signature:
            req.header('x-highlevel-signature') ?? req.header('x-ghl-signature') ?? undefined,
          timestamp:
            req.header('x-highlevel-timestamp') ?? req.header('x-ghl-timestamp') ?? undefined,
          eventId: req.header('x-highlevel-event-id') ?? req.header('x-ghl-event-id') ?? undefined,
        },
        now: deps.clock?.(),
      });

      if (!result.ok) {
        res.status(result.status).json({
          success: false,
          code: result.code,
          request_id: req.traceId,
        });
        return;
      }

      res.status(202).json({
        success: true,
        code: 'HIGHLEVEL_WEBHOOK_ACK',
        disposition: 'accepted',
        request_id: req.traceId,
      });

      void recordHighLevelWebhookInbox({
        target: deps.pool,
        payload: result.payload,
        payloadDigest: result.digest,
        receivedAt: deps.clock?.() ?? new Date(),
      }).catch((error) => deps.onAsyncError?.(error));
    },
  );

  return router;
}

function setPrivateNoStore(res: Response) {
  res.setHeader('Cache-Control', 'private, no-store');
}
