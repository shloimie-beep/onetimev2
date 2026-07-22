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
      ...(req.header('x-one-time-key-id')
        ? { keyId: req.header('x-one-time-key-id') as string }
        : {}),
      ...(req.header('x-one-time-action-secret')
        ? { secret: req.header('x-one-time-action-secret') as string }
        : {}),
      payload: req.body,
    });
    res.status(result.status).json(result.body);
  });
  return router;
}
