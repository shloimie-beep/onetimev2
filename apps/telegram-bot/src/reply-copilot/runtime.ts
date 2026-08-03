import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ReplyCopilotService } from '../../../../packages/domain/src/telegram/reply-copilot/service.ts';
import { replyCopilotReadiness, type ReplyCopilotRuntimeConfig } from './config.ts';
import {
  createGhlReplyCopilotWebhookHandler,
  createReplyCopilotTelegramWebhookHandler,
} from './http.ts';

export const REPLY_COPILOT_HTTP_ROUTES = {
  health: '/health',
  ready: '/ready',
  workflowInbound: '/webhooks/ghl/customer-replied',
  oauthInbound: '/webhooks/ghl/inbound-message',
  telegram: '/webhooks/telegram/one-time-rabbi',
} as const;

export function createReplyCopilotHttpRuntime(input: {
  config: ReplyCopilotRuntimeConfig;
  service?: ReplyCopilotService;
}) {
  const workflow = input.service
    ? createGhlReplyCopilotWebhookHandler({
        service: input.service,
        ingressKind: 'workflow_shared_secret',
        enabled: input.config.enabled && input.config.workflowIngressEnabled,
        allowedLocationId: input.config.allowedLocationId,
        ...(input.config.workflowSharedSecret
          ? { workflowSharedSecret: input.config.workflowSharedSecret }
          : {}),
      })
    : null;
  const oauth = input.service
    ? createGhlReplyCopilotWebhookHandler({
        service: input.service,
        ingressKind: 'oauth_ed25519',
        enabled: input.config.enabled && input.config.oauthIngressEnabled,
        allowedLocationId: input.config.allowedLocationId,
      })
    : null;
  const telegram =
    input.service && input.config.telegramWebhookSecret
      ? createReplyCopilotTelegramWebhookHandler({
          service: input.service,
          enabled: input.config.enabled && input.config.telegramDeliveryEnabled,
          webhookSecret: input.config.telegramWebhookSecret,
        })
      : null;

  return async (req: IncomingMessage, res: ServerResponse) => {
    const path = requestPath(req);
    if (req.method === 'GET' && path === REPLY_COPILOT_HTTP_ROUTES.health) {
      return json(res, 200, {
        ok: true,
        service: 'one-time-rabbi-reply-copilot',
        loopEnabled: input.config.enabled,
      });
    }
    if (req.method === 'GET' && path === REPLY_COPILOT_HTTP_ROUTES.ready) {
      const readiness = replyCopilotReadiness(input.config);
      return json(res, readiness.ready && input.service ? 200 : 503, {
        ok: readiness.ready && Boolean(input.service),
        status: readiness.status,
        customerDeliveryAuthorized: readiness.customerDeliveryAuthorized,
        tokenPresence: readiness.tokenPresence,
        rabbiMappingPresence: readiness.rabbiMappingPresence,
        shloimieMappingPresence: readiness.shloimieMappingPresence,
        blockers: input.service
          ? readiness.blockers
          : [...readiness.blockers, 'persistent_store_absent'],
      });
    }
    if (path === REPLY_COPILOT_HTTP_ROUTES.workflowInbound) {
      if (!workflow) return runtimeUnavailable(res, input.config.workflowIngressEnabled);
      return workflow(req, res);
    }
    if (path === REPLY_COPILOT_HTTP_ROUTES.oauthInbound) {
      if (!oauth) return runtimeUnavailable(res, input.config.oauthIngressEnabled);
      return oauth(req, res);
    }
    if (path === REPLY_COPILOT_HTTP_ROUTES.telegram) {
      if (!telegram) return runtimeUnavailable(res, input.config.telegramDeliveryEnabled);
      return telegram(req, res);
    }
    return json(res, 404, { ok: false, code: 'NOT_FOUND' });
  };
}

function requestPath(req: IncomingMessage) {
  try {
    return new URL(req.url ?? '/', 'http://reply-copilot.invalid').pathname;
  } catch {
    return '/';
  }
}

function runtimeUnavailable(res: ServerResponse, configuredEnabled: boolean) {
  return json(
    res,
    configuredEnabled ? 503 : 404,
    configuredEnabled
      ? { ok: false, code: 'PERSISTENT_RUNTIME_UNAVAILABLE' }
      : { ok: false, code: 'FEATURE_DISABLED' },
  );
}

function json(res: ServerResponse, status: number, payload: Record<string, unknown>) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(payload));
}
