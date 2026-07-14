import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import { ZodError } from 'zod';
import type { AppConfig } from '../../../../packages/config/src/index.ts';
import type { DbPool } from '../../../../packages/db/src/index.ts';
import { leadPayloadSchema, publicFieldErrors } from '../../../../packages/contracts/src/index.ts';
import { captureLead } from '../../../../packages/domain/src/index.ts';
import { publicError, traceMiddleware, withTiming, type RequestWithTrace } from '../../../../packages/observability/src/index.ts';
import { leadRateLimit } from './rate-limit.ts';

type AppDeps = {
  config: AppConfig;
  pool: DbPool;
  distDir?: string;
};

export function createApp({ config, pool, distDir = path.resolve(process.cwd(), 'dist/apps/web/public') }: AppDeps) {
  const app = express();
  app.set('trust proxy', true);
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );
  app.use(traceMiddleware);
  app.use(express.json({ limit: '32kb' }));
  app.use(express.urlencoded({ extended: false, limit: '32kb' }));
  app.use(express.static(distDir, { extensions: ['html'], maxAge: config.isProduction ? '1h' : 0 }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'onetime-web' });
  });

  app.get('/ready', async (req: RequestWithTrace, res) => {
    try {
      await withTiming(req, 'db', () => pool.query('SELECT 1'));
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  app.get('/version', (_req, res) => {
    res.json({
      version: config.appVersion,
      commit_sha: config.commitSha,
      target_app: 'one-time',
    });
  });

  app.get('/one-time', (_req, res) => res.redirect(301, '/'));
  app.get('/one-time/signup', (_req, res) => res.redirect(301, '/signup'));
  app.get('/rabbi-member', (_req, res) => res.redirect(301, '/login'));

  const handleLeadPost = async (req: RequestWithTrace, res: express.Response) => {
    try {
      const payload = leadPayloadSchema.parse(req.body);
      const result = await withTiming(req, 'lead_txn', () => captureLead({ pool, config, payload }));
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Please check the signup form.',
          field_errors: publicFieldErrors(error),
          request_id: req.traceId,
        });
        return;
      }
      res.status(500).json(publicError('SERVER_ERROR', 'We could not save that signup yet.', req.traceId));
    }
  };

  app.post('/api/v1/leads', leadRateLimit(config), handleLeadPost);
  app.post('/api/one-time/interest', leadRateLimit(config), handleLeadPost);

  app.use((_req, res) => {
    res.status(404).sendFile(path.join(distDir, '404.html'));
  });

  return app;
}
