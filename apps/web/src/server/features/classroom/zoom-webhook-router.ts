import express from 'express';
import {
  processZoomWebhook,
  type ZoomWebhookProcessResult,
} from '../../../../../../packages/domain/src/providers/zoom-webhook.ts';

export type ZoomWebhookRouterDeps = {
  secretToken: string;
  seenEventKeys?: Set<string> | undefined;
  onAccepted?:
    ((result: Extract<ZoomWebhookProcessResult, { status: 202 }>) => Promise<void>) | undefined;
};

export function createZoomWebhookRouter(deps: ZoomWebhookRouterDeps) {
  const router = express.Router();
  router.post('/', express.raw({ type: 'application/json', limit: '128kb' }), async (req, res) => {
    const result = processZoomWebhook({
      rawBody: Buffer.isBuffer(req.body) ? req.body : Buffer.from(''),
      headers: {
        signature: req.header('x-zm-signature'),
        timestamp: req.header('x-zm-request-timestamp'),
        requestId: req.header('x-zm-request-id'),
      },
      secretToken: deps.secretToken,
      seenEventKeys: deps.seenEventKeys,
    });
    if (result.status === 202) await deps.onAccepted?.(result);
    res.status(result.status).json(result.body);
  });
  return router;
}
