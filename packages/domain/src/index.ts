export { campaignTicker } from './landing/campaign.ts';
export { campaign, landingContent, sharedNav } from './landing/content.ts';
export { captureLead } from './lead/service.ts';
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
  canAssignContacts,
  canEditContacts,
  createAccountUser,
  createSession,
  getSessionByToken,
  resetAuthRateLimitForTests,
  revokeSession,
  rotateSessionCsrf,
  verifySessionCsrf,
  type AuthenticatedSession,
} from './auth/service.ts';
export {
  CrmDuplicateError,
  CrmVersionConflictError,
  createContact,
  getContactDetail,
  listContacts,
  updateContact,
} from './crm/service.ts';
