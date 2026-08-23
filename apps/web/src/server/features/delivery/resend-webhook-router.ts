import express, { type Request, type Response } from 'express';
import type { AppConfig } from '../../../../../../packages/config/src/index.ts';
import {
  inTransaction,
  type DbPool,
  type Queryable,
} from '../../../../../../packages/db/src/index.ts';
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
        environment: providerEnvironment(deps.config),
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
  return inTransaction(pool, async (client) => {
    const disposition = await recordResendProviderEventWithClient(client, record);
    if (disposition !== 'digest_mismatch') {
      await reconcileLifecycleDelivery(client, record);
    }
    return disposition;
  });
}

async function recordResendProviderEventWithClient(
  client: Queryable,
  record: ProviderEventRecord,
): Promise<WebhookDisposition> {
  const svixRefHash = stringObjectRef(record, 'svix_message_ref_hash');
  if (svixRefHash) {
    const existingSvix = await client.query(
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

  const existingProviderEvent = await client.query(
    `SELECT payload_digest
       FROM onetime.provider_event_ledger
      WHERE provider = $1
        AND environment = $2
        AND provider_event_ref_hash = $3
        AND event_type = $4
      LIMIT 1`,
    [record.provider, record.environment, record.provider_event_ref_hash, record.event_type],
  );
  if (existingProviderEvent.rowCount) {
    return String(existingProviderEvent.rows[0]?.payload_digest) === record.payload_digest
      ? 'duplicated'
      : 'digest_mismatch';
  }

  const outOfOrder = await isOutOfOrderProviderEvent(client, record);
  const inserted = await client.query(
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

  const existingEvent = await client.query(
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

async function reconcileLifecycleDelivery(client: Queryable, record: ProviderEventRecord) {
  const messageRefHash = stringObjectRef(record, 'message_ref_hash');
  if (!messageRefHash) return;
  const state = lifecycleDeliveryState(record.canonical_state);
  if (!state) return;
  await client.query(
    `UPDATE onetime.account_lifecycle_delivery_outbox
        SET final_delivery_state = CASE
              WHEN $4 = 'complained' THEN 'complained'
              WHEN final_delivery_state = 'complained' THEN final_delivery_state
              WHEN $4 = 'suppressed' THEN 'suppressed'
              WHEN final_delivery_state = 'suppressed' THEN final_delivery_state
              WHEN $4 = 'bounced' THEN 'bounced'
              WHEN final_delivery_state = 'bounced' THEN final_delivery_state
              WHEN $4 = 'failed' THEN 'failed'
              WHEN final_delivery_state = 'failed' THEN final_delivery_state
              WHEN $4 = 'delivered' THEN 'delivered'
              WHEN final_delivery_state = 'delivered' THEN final_delivery_state
              ELSE $4
            END,
            delivered_at = CASE
              WHEN $4 = 'delivered'
                AND COALESCE(final_delivery_state, '') <> 'suppressed'
                THEN COALESCE(delivered_at, $5::timestamptz)
              ELSE delivered_at
            END,
            final_state_at = CASE
              WHEN (
                ($4 = 'complained' AND COALESCE(final_delivery_state, '') <> 'complained')
                OR (
                  $4 = 'suppressed'
                  AND COALESCE(final_delivery_state, '') NOT IN ('complained', 'suppressed')
                )
                OR (
                  $4 = 'bounced'
                  AND COALESCE(final_delivery_state, '') NOT IN ('suppressed', 'complained')
                  AND COALESCE(final_delivery_state, '') <> 'bounced'
                )
                OR (
                  $4 = 'failed'
                  AND COALESCE(final_delivery_state, '') NOT IN (
                    'complained', 'suppressed', 'bounced', 'failed'
                  )
                )
                OR ($4 = 'delivered' AND final_delivery_state IS NULL)
              )
                THEN $5::timestamptz
              ELSE final_state_at
            END,
            last_provider_event_at = CASE
              WHEN last_provider_event_at IS NULL OR last_provider_event_at <= $5::timestamptz
                THEN $5::timestamptz
              ELSE last_provider_event_at
            END,
            updated_at = CASE
              WHEN updated_at <= $5::timestamptz THEN $5::timestamptz
              ELSE updated_at
            END
      WHERE account_key = $1
        AND product_key = $2
        AND provider_message_ref_hash = $3
        AND state IN (
          'unknown', 'provider_accepted', 'provider_delivered'
        )`,
    [
      record.account_key,
      record.product_key,
      messageRefHash,
      state,
      record.provider_created_at ?? new Date().toISOString(),
    ],
  );
}

function lifecycleDeliveryState(state: ProviderEventRecord['canonical_state']) {
  if (
    state === 'delivered' ||
    state === 'bounced' ||
    state === 'complained' ||
    state === 'suppressed' ||
    state === 'failed'
  ) {
    return state;
  }
  return undefined;
}

async function isOutOfOrderProviderEvent(client: Queryable, record: ProviderEventRecord) {
  const messageRefHash = stringObjectRef(record, 'message_ref_hash');
  if (!messageRefHash || !record.provider_created_at) return false;
  const result = await client.query(
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

function providerEnvironment(config: AppConfig): 'test' | 'staging' | 'production' {
  if (config.oneTimeRuntimeEnvironment === 'production') return 'production';
  if (config.oneTimeRuntimeEnvironment === 'test') return 'test';
  return 'staging';
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
