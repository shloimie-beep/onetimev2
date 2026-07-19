import express, { type Request, type Response } from 'express';
import type { AppConfig } from '../../../../../../packages/config/src/index.ts';
import type { DbPool } from '../../../../../../packages/db/src/index.ts';
import type { ProviderEventRecord } from '../../../../../../packages/contracts/src/providers/events.ts';
import {
  ProviderWebhookConformanceError,
  verifyAndNormalizeResendWebhookEvent,
  type WebhookDisposition,
} from '../../../../../worker/src/delivery/provider-webhooks.ts';

type ResendWebhookRouterDeps = {
  config: AppConfig;
  pool: DbPool;
  clock?: (() => Date) | undefined;
};

type ResendWebhookRequest = Request & { traceId?: string | undefined };

export function createResendWebhookRouter(deps: ResendWebhookRouterDeps) {
  const router = express.Router();

  router.post('/webhook', express.raw({ type: '*/*', limit: '128kb' }), async (req, res) => {
    setPrivateNoStore(res);
    if (!deps.config.resendWebhookEnabled || !deps.config.resendWebhookSecret) {
      res.status(503).json({
        success: false,
        code: 'RESEND_WEBHOOK_DISABLED',
        message: 'Resend webhook intake is not enabled.',
        request_id: requestId(req),
      });
      return;
    }

    try {
      const normalized = verifyAndNormalizeResendWebhookEvent({
        accountKey: deps.config.accountKey,
        productKey: deps.config.productKey,
        rawBody: req.body,
        contentType: req.header('content-type') ?? undefined,
        headers: {
          id: req.header('svix-id') ?? undefined,
          timestamp: req.header('svix-timestamp') ?? undefined,
          signature: req.header('svix-signature') ?? undefined,
        },
        webhookSecret: deps.config.resendWebhookSecret,
        now: deps.clock?.(),
      });
      const disposition = await recordResendProviderEvent(deps.pool, normalized.record);
      respond(res, disposition, requestId(req));
    } catch (error) {
      respondWithWebhookError(res, error, requestId(req));
    }
  });

  return router;
}

async function recordResendProviderEvent(
  pool: DbPool,
  record: ProviderEventRecord,
): Promise<WebhookDisposition> {
  const svixRefHash = stringObjectRef(record, 'svix_message_ref_hash');
  if (svixRefHash) {
    const existingSvix = await pool.query(
      `SELECT payload_digest
         FROM onetime.provider_event_ledger
        WHERE provider = $1
          AND environment = $2
          AND object_refs->>'svix_message_ref_hash' = $3
        LIMIT 1`,
      [record.provider, record.environment, svixRefHash],
    );
    if (existingSvix.rowCount) {
      return String(existingSvix.rows[0]?.payload_digest) === record.payload_digest
        ? 'replayed'
        : 'digest_mismatch';
    }
  }

  const outOfOrder = await isOutOfOrderProviderEvent(pool, record);
  const inserted = await pool.query(
    `INSERT INTO onetime.provider_event_ledger
     (event_key, account_key, product_key, provider, environment, provider_event_ref_hash,
      event_type, canonical_state, provider_created_at, payload_digest, object_refs, minimized_payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb)
     ON CONFLICT (provider, environment, provider_event_ref_hash, event_type) DO NOTHING
     RETURNING event_key`,
    [
      record.event_key,
      record.account_key,
      record.product_key,
      record.provider,
      record.environment,
      record.provider_event_ref_hash,
      record.event_type,
      record.canonical_state,
      record.provider_created_at,
      record.payload_digest,
      JSON.stringify(record.object_refs),
      JSON.stringify(record.minimized_payload),
    ],
  );
  if (inserted.rowCount) return outOfOrder ? 'out_of_order' : 'accepted';

  const existingEvent = await pool.query(
    `SELECT payload_digest
       FROM onetime.provider_event_ledger
      WHERE provider = $1
        AND environment = $2
        AND provider_event_ref_hash = $3
        AND event_type = $4
      LIMIT 1`,
    [record.provider, record.environment, record.provider_event_ref_hash, record.event_type],
  );
  return String(existingEvent.rows[0]?.payload_digest) === record.payload_digest
    ? 'duplicated'
    : 'digest_mismatch';
}

async function isOutOfOrderProviderEvent(pool: DbPool, record: ProviderEventRecord) {
  const messageRefHash = stringObjectRef(record, 'message_ref_hash');
  if (!messageRefHash || !record.provider_created_at) return false;
  const result = await pool.query(
    `SELECT 1
       FROM onetime.provider_event_ledger
      WHERE provider = $1
        AND environment = $2
        AND object_refs->>'message_ref_hash' = $3
        AND provider_created_at > $4::timestamptz
      LIMIT 1`,
    [record.provider, record.environment, messageRefHash, record.provider_created_at],
  );
  return Boolean(result.rowCount);
}

function respond(res: Response, disposition: WebhookDisposition, requestId: string | undefined) {
  const status = dispositionStatus(disposition);
  res.status(status).json({
    success: status < 400,
    code:
      disposition === 'digest_mismatch' ? 'RESEND_WEBHOOK_DIGEST_MISMATCH' : 'RESEND_WEBHOOK_ACK',
    disposition,
    request_id: requestId,
  });
}

function respondWithWebhookError(res: Response, error: unknown, requestId: string | undefined) {
  if (error instanceof ProviderWebhookConformanceError) {
    res.status(error.status).json({
      success: false,
      code: error.code,
      request_id: requestId,
    });
    return;
  }
  if (error instanceof SyntaxError) {
    res.status(400).json({
      success: false,
      code: 'invalid_json',
      request_id: requestId,
    });
    return;
  }
  res.status(500).json({
    success: false,
    code: 'RESEND_WEBHOOK_INTERNAL_ERROR',
    request_id: requestId,
  });
}

function dispositionStatus(disposition: WebhookDisposition) {
  if (disposition === 'accepted' || disposition === 'out_of_order') return 202;
  if (disposition === 'duplicated' || disposition === 'replayed') return 200;
  return 409;
}

function stringObjectRef(record: ProviderEventRecord, key: string) {
  const value = record.object_refs[key];
  return typeof value === 'string' && value ? value : undefined;
}

function requestId(req: ResendWebhookRequest) {
  return req.traceId;
}

function setPrivateNoStore(res: Response) {
  res.setHeader('Cache-Control', 'private, no-store');
}
