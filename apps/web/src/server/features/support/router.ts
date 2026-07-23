import { readFile } from 'node:fs/promises';
import path from 'node:path';
import express, { type Request, type Response } from 'express';
import type { AppConfig } from '../../../../../../packages/config/src/index.ts';
import type { DbPool } from '../../../../../../packages/db/src/index.ts';
import type { AuthenticatedSession } from '../../../../../../packages/domain/src/index.ts';
import {
  attachmentRequestTarget,
  createSupportSubmission,
  getAuthorizedSupportAttachment,
  hasActiveSupportEntitlement,
  ingestMockBnaSupportEvent,
  isSupportSubmissionAvailable,
  readMockBnaStatus,
  readSupportReceipt,
  SupportSubmissionError,
} from '../../../../../../packages/domain/src/index.ts';
import { consumeRateLimitBudgets } from '../../../../../../packages/domain/src/security/rate-limit.ts';
import {
  publicError,
  type RequestWithTrace,
} from '../../../../../../packages/observability/src/index.ts';

type SupportSessionPorts = {
  sessionFromRequest: (req: Request) => Promise<AuthenticatedSession | null>;
  ensureSessionCsrfCookie: (
    req: Request,
    res: Response,
    session: AuthenticatedSession,
  ) => Promise<string>;
  requireSessionCsrf: (
    req: RequestWithTrace,
    res: Response,
    session: AuthenticatedSession,
  ) => Promise<boolean>;
  setPrivateNoStore: (res: Response) => void;
};

export function registerSupportRoutes(input: {
  app: express.Express;
  config: AppConfig;
  pool: DbPool;
  session: SupportSessionPorts;
  distDir?: string | undefined;
}) {
  input.app.post(
    '/api/internal/integrations/onetime/support-events/v1',
    express.raw({ type: 'application/json', limit: '128kb' }),
    async (req: RequestWithTrace, res) => {
      input.session.setPrivateNoStore(res);
      const result = await ingestMockBnaSupportEvent({
        pool: input.pool,
        config: input.config,
        headers: signingHeaders(req),
        rawBody: Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0),
      });
      res.status(result.status).json(result.body);
    },
  );

  input.app.post(
    '/api/internal/integrations/onetime/support-ticket-status/v1',
    express.raw({ type: 'application/json', limit: '32kb' }),
    async (req: RequestWithTrace, res) => {
      input.session.setPrivateNoStore(res);
      const result = await readMockBnaStatus({
        pool: input.pool,
        config: input.config,
        headers: signingHeaders(req),
        rawBody: Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0),
      });
      res.status(result.status).json(result.body);
    },
  );

  input.app.get(
    '/api/internal/support/attachments/v1/:attachmentId',
    async (req: RequestWithTrace, res) => {
      input.session.setPrivateNoStore(res);
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      const attachmentId = String(req.params.attachmentId);
      const attachment = await getAuthorizedSupportAttachment({
        pool: input.pool,
        config: input.config,
        attachmentId,
        requestTarget: attachmentRequestTarget(attachmentId),
        headers: signingHeaders(req),
      });
      if (!attachment) {
        res.status(404).json(publicError('NOT_FOUND', 'Attachment was not found.', req.traceId));
        return;
      }
      res.setHeader('Content-Type', attachment.mediaType);
      res.setHeader('Content-Length', String(attachment.bytes.length));
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${attachment.filename.replaceAll('"', '')}"`,
      );
      res.setHeader('X-OT89-Content-SHA256', attachment.sha256);
      res.status(200).send(attachment.bytes);
    },
  );

  input.app.get('/app/support', async (req: RequestWithTrace, res) => {
    input.session.setPrivateNoStore(res);
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    const session = await input.session.sessionFromRequest(req);
    if (!session) {
      res.status(200).type('html').send(supportLeadOnlyHtml('Sign in for learning support'));
      return;
    }
    await input.session.ensureSessionCsrfCookie(req, res, session);
    await sendSupportShell(input, res);
  });

  input.app.get('/app/support/receipts/:receiptId', async (req: RequestWithTrace, res) => {
    input.session.setPrivateNoStore(res);
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    const session = await input.session.sessionFromRequest(req);
    if (!session) {
      res.status(200).type('html').send(supportLeadOnlyHtml('Sign in for learning support'));
      return;
    }
    await input.session.ensureSessionCsrfCookie(req, res, session);
    await sendSupportShell(input, res);
  });

  input.app.get('/api/v1/support/eligibility', async (req: RequestWithTrace, res) => {
    input.session.setPrivateNoStore(res);
    const session = await input.session.sessionFromRequest(req);
    if (!session) {
      res.status(401).json(publicError('UNAUTHENTICATED', 'Please log in again.', req.traceId));
      return;
    }
    const active = await hasActiveSupportEntitlement({
      target: input.pool,
      config: input.config,
      userKey: session.user.user_key,
      role: session.user.role,
    });
    const available = isSupportSubmissionAvailable(input.config);
    res.json({
      success: true,
      available,
      can_create_ticket: available && active,
      reason: !available
        ? 'support_unavailable'
        : active
          ? 'authorized'
          : 'learning_access_required',
      csrf_token: await input.session.ensureSessionCsrfCookie(req, res, session),
      categories: supportCategories(),
    });
  });

  input.app.get('/api/v1/support/tickets', async (req: RequestWithTrace, res) => {
    input.session.setPrivateNoStore(res);
    const session = await input.session.sessionFromRequest(req);
    if (!session) {
      res.status(401).json(publicError('UNAUTHENTICATED', 'Please log in again.', req.traceId));
      return;
    }
    const result = await input.pool.query(
      `SELECT receipt_id, status, delivery_state, public_summary, updated_at
         FROM onetime.support_status_projection
        WHERE account_key = $1
          AND product_key = $2
          AND actor_user_key = $3
        ORDER BY updated_at DESC
        LIMIT 25`,
      [input.config.accountKey, input.config.productKey, session.user.user_key],
    );
    res.json({
      success: true,
      tickets: result.rows.map((row) => ({
        receipt_id: String(row.receipt_id),
        status: String(row.status),
        delivery_state: String(row.delivery_state),
        public_summary: String(row.public_summary),
        updated_at:
          row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
      })),
    });
  });

  input.app.get(
    '/api/v1/support/receipts/:receiptId/status',
    async (req: RequestWithTrace, res) => {
      input.session.setPrivateNoStore(res);
      const session = await input.session.sessionFromRequest(req);
      if (!session) {
        res.status(401).json(publicError('UNAUTHENTICATED', 'Please log in again.', req.traceId));
        return;
      }
      const receipt = await readSupportReceipt({
        pool: input.pool,
        config: input.config,
        session,
        receiptId: String(req.params.receiptId),
      });
      if (!receipt) {
        res
          .status(404)
          .json(publicError('NOT_FOUND', 'Support receipt was not found.', req.traceId));
        return;
      }
      res.json({ success: true, receipt });
    },
  );

  input.app.post(
    '/api/v1/support/tickets',
    express.json({ limit: '15mb' }),
    express.urlencoded({ extended: false, limit: '256kb' }),
    async (req: RequestWithTrace, res) => {
      input.session.setPrivateNoStore(res);
      const session = await input.session.sessionFromRequest(req);
      if (!session) {
        res.status(401).json(publicError('UNAUTHENTICATED', 'Please log in again.', req.traceId));
        return;
      }
      if (!isSupportSubmissionAvailable(input.config)) {
        res
          .status(503)
          .json(publicError('SUPPORT_DISABLED', 'Member support is unavailable.', req.traceId));
        return;
      }
      if (!(await input.session.requireSessionCsrf(req, res, session))) return;
      const limited = await consumeSupportRateLimit({
        req,
        res,
        pool: input.pool,
        config: input.config,
        userKey: session.user.user_key,
      });
      if (!limited) return;
      try {
        const receipt = await createSupportSubmission({
          pool: input.pool,
          config: input.config,
          session,
          payload: normalizeSupportRequestBody(req.body, input.config, req.path),
          requestId: req.traceId ?? 'req_support_local',
          correlationId: req.header('x-correlation-id') ?? undefined,
        });
        res.status(202).json(receipt);
      } catch (error) {
        if (error instanceof SupportSubmissionError) {
          res.status(error.status).json({
            success: false,
            code: error.code,
            message: error.message,
            request_id: req.traceId,
            ...(error.fieldErrors ? { field_errors: error.fieldErrors } : {}),
          });
          return;
        }
        res
          .status(500)
          .json(publicError('SERVER_ERROR', 'Support request could not be saved.', req.traceId));
      }
    },
  );
}

async function consumeSupportRateLimit(input: {
  req: Request;
  res: Response;
  pool: DbPool;
  config: AppConfig;
  userKey: string;
}) {
  const result = await consumeRateLimitBudgets({
    pool: input.pool,
    config: input.config,
    budgets: [
      {
        scope: 'support_user',
        subject: input.userKey,
        limit: input.config.supportRateLimitMax,
        windowMs: input.config.supportRateLimitWindowMs,
      },
      {
        scope: 'support_account_product',
        subject: `${input.config.accountKey}:${input.config.productKey}`,
        limit: input.config.supportAccountRateLimitMax,
        windowMs: input.config.supportRateLimitWindowMs,
      },
      {
        scope: 'support_ip',
        subject: input.req.ip ?? 'unknown',
        limit: input.config.supportRateLimitMax * 2,
        windowMs: input.config.supportRateLimitWindowMs,
      },
    ],
  });
  if (result.allowed) return true;
  input.res.setHeader('Retry-After', String(result.retryAfterSeconds ?? 1));
  input.res
    .status(429)
    .json(publicError('RATE_LIMITED', 'Too many support requests. Please try again soon.'));
  return false;
}

function normalizeSupportRequestBody(body: unknown, config: AppConfig, routeTemplate: string) {
  if (body && typeof body === 'object' && !Array.isArray(body) && 'issue_details' in body) {
    return body;
  }
  const form = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  return {
    category: form.category,
    title: form.title,
    message: form.message,
    reply_preference: form.reply_preference ?? 'in_app',
    issue_details: {
      steps_to_reproduce:
        typeof form.steps_to_reproduce === 'string'
          ? form.steps_to_reproduce
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean)
          : [],
      expected_behavior:
        typeof form.expected_behavior === 'string' && form.expected_behavior.trim()
          ? form.expected_behavior
          : null,
      actual_behavior:
        typeof form.actual_behavior === 'string' && form.actual_behavior.trim()
          ? form.actual_behavior
          : null,
      occurrence: form.occurrence ?? 'not_applicable',
      first_observed_at: null,
      error_code:
        typeof form.error_code === 'string' && form.error_code.trim() ? form.error_code : null,
      provider: form.provider ?? 'none',
    },
    client_context: {
      route_template: routeTemplate,
      app_release: config.appVersion,
      locale: 'en-US',
      timezone: 'Asia/Jerusalem',
    },
    attachments: [],
    idempotency_key: form.idempotency_key,
  };
}

function signingHeaders(req: Request): {
  keyId?: string | undefined;
  timestamp?: string | undefined;
  nonce?: string | undefined;
  signature?: string | undefined;
  eventId?: string | undefined;
} {
  return {
    keyId: req.header('x-ot89-key-id'),
    timestamp: req.header('x-ot89-timestamp'),
    nonce: req.header('x-ot89-nonce'),
    signature: req.header('x-ot89-signature'),
    eventId: req.header('x-ot89-event-id'),
  };
}

function supportLeadOnlyHtml(title: string) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} | One Time Mishnayos</title>
  <meta name="robots" content="noindex, nofollow">
  <meta name="theme-color" content="#050505">
  <link rel="stylesheet" href="/assets/app-crm.css">
</head>
<body>
  <main class="app-workspace">
    <section class="state-panel" aria-labelledby="support-title">
      <h1 id="support-title">${escapeHtml(title)}</h1>
      <p>Support is available after sign-in with current One Time learning access.</p>
      <a class="button button-primary" href="/signup">Continue to signup and help</a>
    </section>
  </main>
</body>
</html>`;
}

async function sendSupportShell(
  input: { config: AppConfig; distDir?: string | undefined },
  res: Response,
) {
  try {
    const html = await readFile(path.join(supportDistDir(input), 'app', 'crm.html'), 'utf8');
    res.status(200).type('html').send(html);
    return;
  } catch {
    if (input.config.nodeEnv === 'test') {
      res.status(200).type('html').send(supportTestShellHtml());
      return;
    }
    res
      .status(500)
      .type('text')
      .send('Built support app shell is unavailable. Run npm run build before serving support.');
  }
}

function supportTestShellHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Support | One Time Mishnayos</title>
  <meta name="robots" content="noindex, nofollow">
</head>
<body>
  <main id="crm-root" data-surface="support"></main>
</body>
</html>`;
}

function supportDistDir(input: { distDir?: string | undefined }) {
  return input.distDir ?? path.resolve(process.cwd(), 'dist/apps/web/public');
}

function supportCategories() {
  return [
    { value: 'access_login', label: 'Access/login' },
    { value: 'class_zoom', label: 'Class/Zoom' },
    { value: 'billing', label: 'Billing' },
    { value: 'content', label: 'Content' },
    { value: 'technical_bug', label: 'Technical bug' },
    { value: 'account_family', label: 'Account/family' },
    { value: 'other', label: 'Other' },
  ];
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
