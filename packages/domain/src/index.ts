export { campaignTicker } from './landing/campaign.ts';
export { campaign, landingContent, sharedNav } from './landing/content.ts';
export {
  LeadDuplicateIdentityError,
  LeadIdempotencyConflictError,
  captureLead,
} from './lead/service.ts';
export {
  PhoneNormalizationError,
  normalizeEmail,
  normalizePhone,
  selectedChannels,
  stableKey,
  successCopy,
} from './lead/normalize.ts';
export { processOutboxSink } from './outbox/sink.ts';
export {
  authenticateUser,
  canAssignContacts,
  canEditContacts,
  completeMfaChallenge,
  createLoginCsrf,
  createAccountUser,
  createSession,
  getSessionByToken,
  resetAuthRateLimitForTests,
  revokeSession,
  rotateSessionCsrf,
  verifyLoginCsrf,
  verifySessionCsrf,
  type AuthenticatedSession,
} from './auth/service.ts';
export {
  CrmAssigneeScopeError,
  CrmCursorError,
  CrmDuplicateError,
  CrmIdempotencyConflictError,
  CrmVersionConflictError,
  createContact,
  getContactDetail,
  listContacts,
  updateContact,
} from './crm/service.ts';
