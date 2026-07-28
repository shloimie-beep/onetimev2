export { domainTransitionFeatureRegistration, createDomainTransitionRouter } from './router.ts';
export {
  CANONICAL_APPLICATION_HOST,
  CANONICAL_APPLICATION_ORIGIN,
  CANONICAL_MARKETING_HOSTS,
  CANONICAL_TRANSITION_HOST,
  CANONICAL_TRANSITION_ORIGIN,
  HOST_ONLY_SESSION_REQUIREMENTS,
  classifyDomain,
  decideDomainTransition,
  evaluateCutoverGate,
  safeAttributionQuery,
  type DomainRole,
  type DomainTransitionMode,
  type TransitionDecision,
} from './policy.ts';
export {
  LEGACY_IMPORT_PROHIBITED_FIELDS,
  assertLegacyImportBoundary,
  normalizeAdultEmail,
  planLegacyAdultReregistration,
  type LegacyAdultReregistrationPlan,
  type LegacyAdultSource,
} from './legacy-adult.ts';
export { tishaBavEndedEventHtml } from './ended-event.ts';
