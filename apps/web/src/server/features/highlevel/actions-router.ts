import { Router } from 'express';
import type { AppConfig } from '../../../../../../packages/config/src/index.ts';
import type { DbPool } from '../../../../../../packages/db/src/index.ts';
import { handleHighLevelAction } from '../../../../../../packages/domain/src/highlevel/actions.ts';

export function createHighLevelActionsRouter(input: { config: AppConfig; pool: DbPool }) {
  const router = Router();
  router.post('/', async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    const result = await handleHighLevelAction({
      pool: input.pool,
      config: input.config,
      headers: {
        ...(req.header('x-one-time-key-id')
          ? { keyId: req.header('x-one-time-key-id') as string }
          : {}),
        ...(req.header('x-one-time-action-timestamp')
          ? { timestamp: req.header('x-one-time-action-timestamp') as string }
          : {}),
        ...(req.header('x-one-time-action-nonce')
          ? { nonce: req.header('x-one-time-action-nonce') as string }
          : {}),
        ...(req.header('x-one-time-idempotency-key')
          ? { idempotencyKey: req.header('x-one-time-idempotency-key') as string }
          : {}),
        ...(req.header('x-one-time-action-signature')
          ? { signature: req.header('x-one-time-action-signature') as string }
          : {}),
      },
      rawBody: Buffer.isBuffer(req.body) ? req.body : Buffer.from(''),
    });
    res.status(result.status).json(result.body);
  });
  return router;
}
