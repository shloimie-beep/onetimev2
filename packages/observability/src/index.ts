import type { NextFunction, Request, Response } from 'express';
import pino from 'pino';

export const logger = pino({
  name: 'onetime',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'email',
      'phone',
      '*.email',
      '*.phone',
    ],
    remove: true,
  },
});

export type RequestWithTrace = Request & {
  traceId?: string;
  timings?: { name: string; durationMs: number }[];
  exposeServerTiming?: boolean;
};

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
    logger.info({
      trace_id: req.traceId,
      method: req.method,
      route: req.route?.path ?? req.path,
      status: res.statusCode,
      duration_ms: Math.round(total),
    });
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
