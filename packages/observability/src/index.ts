import type { NextFunction, Request, Response } from 'express';
import pino from 'pino';
import {
  opsMetricEventSchema,
  type OpsMetricEvent,
  type OpsMetricName,
} from '../../contracts/src/ops/index.ts';

export * from './ops.ts';

export const logger = pino({
  name: 'onetime',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers.x-telegram-bot-api-secret-token',
      'telegram_bot_token',
      'telegram_webhook_secret',
      'webhook_secret',
      'bot_token',
      'token',
      'email',
      'phone',
      '*.email',
      '*.phone',
      '*.token',
      '*.bot_token',
      '*.webhook_secret',
    ],
    remove: true,
  },
});

export type RequestWithTrace = Request & {
  traceId?: string;
  timings?: { name: string; durationMs: number }[];
  exposeServerTiming?: boolean;
};

export function emitOpsMetricEvent(input: {
  name: OpsMetricName;
  value: number;
  unit: OpsMetricEvent['unit'];
  timestamp?: Date;
  accountKey?: string;
  productKey?: string;
  dimensions?: OpsMetricEvent['dimensions'];
  traceId?: string;
}) {
  const event = opsMetricEventSchema.parse({
    schema_version: 'ops.metric.v1',
    timestamp: (input.timestamp ?? new Date()).toISOString(),
    name: input.name,
    value: input.value,
    unit: input.unit,
    ...(input.accountKey ? { account_key: input.accountKey } : {}),
    ...(input.productKey ? { product_key: input.productKey } : {}),
    dimensions: input.dimensions ?? {},
    ...(input.traceId ? { trace_id: input.traceId } : {}),
  });
  logger.info({ metric: event }, 'ops_metric');
  return event;
}

export function traceMiddleware(req: RequestWithTrace, res: Response, next: NextFunction) {
  const started = performance.now();
  const incoming = req.header('x-request-id');
  req.traceId = incoming && incoming.length <= 128 ? incoming : crypto.randomUUID();
  req.timings = [];
  res.setHeader('x-request-id', req.traceId);
  const writeHead = res.writeHead.bind(res);
  res.writeHead = ((...args: Parameters<Response['writeHead']>) => {
    const total = performance.now() - started;
    if (req.exposeServerTiming) {
      const entries = [
        `app;dur=${total.toFixed(1)}`,
        ...(req.timings ?? []).map((entry) => `${entry.name};dur=${entry.durationMs.toFixed(1)}`),
      ];
      res.setHeader('Server-Timing', entries.join(', '));
    } else {
      res.removeHeader('Server-Timing');
    }
    return writeHead(...args);
  }) as Response['writeHead'];

  res.on('finish', () => {
    const total = performance.now() - started;
    const route = req.route?.path ?? req.path;
    const statusClass = `${Math.floor(res.statusCode / 100)}xx`;
    logger.info({
      trace_id: req.traceId,
      method: req.method,
      route,
      status: res.statusCode,
      duration_ms: Math.round(total),
    });
    emitOpsMetricEvent({
      name: 'http_request_latency_ms',
      value: Math.round(total),
      unit: 'milliseconds',
      ...(req.traceId ? { traceId: req.traceId } : {}),
      dimensions: {
        method: req.method,
        route: String(route).slice(0, 160),
        status_class: statusClass,
      },
    });
    if (res.statusCode >= 500) {
      emitOpsMetricEvent({
        name: 'http_request_error_count',
        value: 1,
        unit: 'count',
        ...(req.traceId ? { traceId: req.traceId } : {}),
        dimensions: {
          method: req.method,
          route: String(route).slice(0, 160),
          status: res.statusCode,
        },
      });
    }
  });

  next();
}

export function exposeServerTiming(req: RequestWithTrace) {
  req.exposeServerTiming = true;
}

export async function withTiming<T>(
  req: RequestWithTrace | undefined,
  name: string,
  run: () => Promise<T>,
) {
  const started = performance.now();
  try {
    return await run();
  } finally {
    req?.timings?.push({ name, durationMs: performance.now() - started });
  }
}

export function publicError(code: string, message: string, requestId?: string) {
  return {
    success: false,
    code,
    message,
    request_id: requestId,
  };
}
