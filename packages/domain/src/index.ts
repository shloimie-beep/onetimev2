export { campaignTicker } from './landing/campaign.ts';
export { campaign, landingContent, sharedNav } from './landing/content.ts';
export { captureLead, IdempotencyConflictError } from './lead/service.ts';
export {
  normalizeEmail,
  normalizePhone,
  selectedChannels,
  stableKey,
  successCopy,
} from './lead/normalize.ts';
export { processOutboxSink } from './outbox/sink.ts';
export {
  authenticateUser,
  activateTotpEnrollment,
  canAssignContacts,
  canEditContacts,
  createAccountUser,
  createLoginCsrf,
  createSession,
  getSessionByToken,
  provisionTotpEnrollment,
  resetAuthRateLimitForTests,
  replaceMfaRecoveryCodes,
  revokeMfaFactors,
  revokeSession,
  revokeUserSessions,
  rotateSessionCsrf,
  totpCode,
  verifyLoginCsrf,
  verifyMfaChallenge,
  verifyMfaRecoveryChallenge,
  verifySessionCsrf,
  type AuthenticatedSession,
} from './auth/service.ts';
export { consumeRateLimitBudgets } from './security/rate-limit.ts';
export {
  CrmDuplicateError,
  CrmVersionConflictError,
  createContact,
  getContactDetail,
  listAssignableUsers,
  listContacts,
  updateContact,
} from './crm/service.ts';
