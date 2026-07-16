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
    if (!isSupportSubmissionAvailable(input.config)) {
      res.status(200).type('html').send(supportLeadOnlyHtml('Subscriber support is unavailable'));
      return;
    }
    const session = await input.session.sessionFromRequest(req);
    if (!session) {
      res.status(200).type('html').send(supportLeadOnlyHtml('Sign in for subscriber support'));
      return;
    }
    const active = await hasActiveSupportEntitlement({
      target: input.pool,
      config: input.config,
      userKey: session.user.user_key,
    });
    if (!active) {
      res.status(200).type('html').send(supportLeadOnlyHtml('Subscriber support is unavailable'));
      return;
    }
    const csrfToken = await input.session.ensureSessionCsrfCookie(req, res, session);
    res.status(200).type('html').send(supportFormHtml(csrfToken, input.config));
  });

  input.app.get('/app/support/receipts/:receiptId', async (req: RequestWithTrace, res) => {
    input.session.setPrivateNoStore(res);
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    const session = await input.session.sessionFromRequest(req);
    if (!session) {
      res.status(200).type('html').send(supportLeadOnlyHtml('Sign in for subscriber support'));
      return;
    }
    const receipt = await readSupportReceipt({
      pool: input.pool,
      config: input.config,
      session,
      receiptId: String(req.params.receiptId),
    });
    if (!receipt) {
      res.status(404).type('html').send(supportLeadOnlyHtml('Support receipt not found'));
      return;
    }
    res.status(200).type('html').send(supportReceiptHtml(receipt));
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
          .json(publicError('SUPPORT_DISABLED', 'Subscriber support is unavailable.', req.traceId));
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
      <p>Subscriber support is available only after sign-in with an active One Time subscription.</p>
      <a class="button button-primary" href="/signup">Continue through the public WhatsApp lead path</a>
    </section>
  </main>
</body>
</html>`;
}

function supportFormHtml(csrfToken: string, config: AppConfig) {
  const categories = [
    'bug',
    'access_login',
    'class_zoom',
    'billing',
    'content',
    'complaint',
    'other',
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Subscriber Support | One Time Mishnayos</title>
  <meta name="robots" content="noindex, nofollow">
  <meta name="theme-color" content="#050505">
  <link rel="stylesheet" href="/assets/app-crm.css">
</head>
<body>
  <main class="app-workspace support-workspace">
    <section class="dashboard-section" aria-labelledby="support-heading">
      <h1 id="support-heading">Subscriber Support</h1>
      <form class="editor-form support-form" data-support-form action="/api/v1/support/tickets" method="post" enctype="multipart/form-data">
        <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}">
        <input type="hidden" name="idempotency_key" data-idempotency-key value="">
        <input type="hidden" name="app_release" value="${escapeHtml(config.appVersion)}">
        <div class="field">
          <label for="support-category">Category</label>
          <select id="support-category" name="category" required>
            ${categories.map((category) => `<option value="${category}">${categoryLabel(category)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label for="support-title-input">Title</label>
          <input id="support-title-input" name="title" minlength="5" maxlength="120" required>
        </div>
        <div class="field">
          <label for="support-message">Message</label>
          <textarea id="support-message" name="message" minlength="20" maxlength="6000" rows="7" required></textarea>
        </div>
        <div class="field">
          <label for="support-steps">Steps to reproduce</label>
          <textarea id="support-steps" name="steps_to_reproduce" maxlength="5000" rows="4"></textarea>
        </div>
        <div class="field-grid">
          <div class="field">
            <label for="support-expected">Expected behavior</label>
            <textarea id="support-expected" name="expected_behavior" maxlength="1500" rows="3"></textarea>
          </div>
          <div class="field">
            <label for="support-actual">Actual behavior</label>
            <textarea id="support-actual" name="actual_behavior" maxlength="1500" rows="3"></textarea>
          </div>
        </div>
        <div class="field-grid">
          <div class="field">
            <label for="support-occurrence">Occurrence</label>
            <select id="support-occurrence" name="occurrence">
              <option value="not_applicable">Not applicable</option>
              <option value="once">Once</option>
              <option value="intermittent">Intermittent</option>
              <option value="always">Always</option>
            </select>
          </div>
          <div class="field">
            <label for="support-provider">Provider area</label>
            <select id="support-provider" name="provider">
              <option value="none">None</option>
              <option value="authentication">Authentication</option>
              <option value="zoom">Zoom</option>
              <option value="payments">Payments</option>
              <option value="content_delivery">Content delivery</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        <div class="field-grid">
          <div class="field">
            <label for="support-error-code">Error code</label>
            <input id="support-error-code" name="error_code" maxlength="100" pattern="[A-Z0-9][A-Z0-9._:-]{0,99}">
          </div>
          <div class="field">
            <label for="support-reply">Reply preference</label>
            <select id="support-reply" name="reply_preference">
              <option value="in_app">In app</option>
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label for="support-attachments">Attachments</label>
          <input id="support-attachments" name="attachments" type="file" multiple accept="image/png,image/jpeg,image/webp,text/plain">
        </div>
        <button class="button button-primary" type="submit">Submit support request</button>
        <p class="form-status" role="status" tabindex="-1" data-support-status></p>
      </form>
    </section>
  </main>
  <script type="module" src="/assets/app-support.js"></script>
</body>
</html>`;
}

function supportReceiptHtml(receipt: {
  receipt_id: string;
  source_ticket_id: string;
  status: string;
  public_summary: string;
  delivery_state: string;
  status_version: number;
}) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Support Receipt | One Time Mishnayos</title>
  <meta name="robots" content="noindex, nofollow">
  <meta name="theme-color" content="#050505">
  <link rel="stylesheet" href="/assets/app-crm.css">
</head>
<body>
  <main class="app-workspace">
    <section class="state-panel" aria-labelledby="receipt-title">
      <h1 id="receipt-title">Support Receipt</h1>
      <dl>
        <dt>Receipt</dt><dd>${escapeHtml(receipt.receipt_id)}</dd>
        <dt>Status</dt><dd>${escapeHtml(receipt.status)}</dd>
        <dt>Delivery</dt><dd>${escapeHtml(receipt.delivery_state)}</dd>
        <dt>Version</dt><dd>${receipt.status_version}</dd>
      </dl>
      <p>${escapeHtml(receipt.public_summary)}</p>
      <a class="button" href="/app/support">Open support form</a>
    </section>
  </main>
</body>
</html>`;
}

function categoryLabel(category: string) {
  return category
    .split('_')
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
