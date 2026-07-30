import express, { type Request } from 'express';
import {
  defineServerFeature,
  SERVER_FEATURE_REGISTRY_CONTRACT_VERSION,
} from '../registry/index.ts';
import { tishaBavEndedEventHtml } from './ended-event.ts';
import { decideDomainTransition, type DomainTransitionMode } from './policy.ts';

const LEGACY_ROUTE_PATHS = [
  '/join',
  '/login',
  '/one-time',
  '/one-time/login',
  '/one-time/signup',
  '/rabbi-member',
  '/signup',
] as const;
const TISHA_ROUTE_PATHS = [
  '/tisha-bav',
  '/tisha-bav.html',
  '/tisha-bav/live',
  '/tisha-bav/success',
  '/api/v1/events/tisha-bav-2026/register',
  '/api/v1/events/tisha-bav-2026/join',
  '/api/v1/events/tisha-bav-2026/redirect',
] as const;

export function createDomainTransitionRouter(input?: {
  mode?: DomainTransitionMode | undefined;
}): express.Router {
  const router = express.Router();
  const mode = input?.mode ?? 'pre_cutover_read_only';

  router.all([...LEGACY_ROUTE_PATHS, ...TISHA_ROUTE_PATHS], (req, res, next) => {
    const decision = decideDomainTransition({
      host: req.header('host') ?? '',
      method: req.method,
      path: req.path,
      query: requestQuery(req),
      mode,
    });

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (decision.action === 'pass_through') {
      next();
      return;
    }
    if (decision.action === 'redirect') {
      res.redirect(decision.status, decision.location);
      return;
    }
    if (decision.action === 'gone' && decision.reason === 'tisha_bav_archived') {
      if (req.method === 'GET' || req.method === 'HEAD') {
        res
          .status(410)
          .type('html')
          .send(tishaBavEndedEventHtml(requestQuery(req)));
      } else {
        res.status(410).json({
          code: 'EVENT_ENDED',
          message: 'This event has ended and no registration was recorded.',
        });
      }
      return;
    }
    if (decision.action === 'gone') {
      res.status(410).json({
        code: 'LEGACY_MUTATION_RETIRED',
        message: 'This legacy action is no longer available.',
      });
      return;
    }
    res.status(404).type('text').send('Not found.');
  });

  return router;
}

export const domainTransitionFeatureRegistration = defineServerFeature({
  featureId: 'onetime.domain-transition',
  contractVersion: SERVER_FEATURE_REGISTRY_CONTRACT_VERSION,
  mountPath: '/',
  createRouter: () => createDomainTransitionRouter(),
});

function requestQuery(
  req: Request,
): Readonly<Record<string, string | readonly string[] | undefined>> {
  const query: Record<string, string | readonly string[] | undefined> = {};
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === 'string') query[key] = value;
    else if (Array.isArray(value)) {
      query[key] = value.filter((entry): entry is string => typeof entry === 'string');
    }
  }
  return query;
}
