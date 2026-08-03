import express, { type Request } from 'express';
import {
  defineServerFeature,
  SERVER_FEATURE_REGISTRY_CONTRACT_VERSION,
} from '../registry/index.ts';
import { tishaBavEndedEventHtml } from './ended-event.ts';
import {
  classifyDomainTransitionPath,
  decideDomainTransition,
  type DomainTransitionMode,
  type DomainTransitionPathClass,
} from './policy.ts';

export function createDomainTransitionRouter(input?: {
  mode?: DomainTransitionMode | undefined;
}): express.Router {
  const router = express.Router();
  const mode = input?.mode ?? 'pre_cutover_read_only';

  router.use((req, res, next) => {
    const rawPath = req.originalUrl || req.url;
    const pathClass = classifyDomainTransitionPath(rawPath);
    const decision = decideDomainTransition({
      host: req.header('host') ?? '',
      method: req.method,
      path: rawPath,
      query: requestQuery(req),
      mode,
    });

    if (decision.action === 'pass_through') {
      if (isControlledPassThrough(pathClass)) setTransitionResponseHeaders(res);
      next();
      return;
    }
    setTransitionResponseHeaders(res);
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

function isControlledPassThrough(pathClass: DomainTransitionPathClass): boolean {
  return (
    pathClass === 'legacy_login' ||
    pathClass === 'legacy_marketing' ||
    pathClass === 'legacy_signup'
  );
}

function setTransitionResponseHeaders(response: express.Response): void {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Content-Type-Options', 'nosniff');
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
