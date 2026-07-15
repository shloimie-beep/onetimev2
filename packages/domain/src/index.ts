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
  ONE_TIME_CLASS_SERIES_KEY,
  ONE_TIME_CLASS_TITLE,
  createClassPortalAccessAdapter,
  getClassOccurrenceDetail,
  listClassOccurrences,
  resolveDailyClassWindow,
  scheduleClassFulfillmentForLead,
} from './classes/service.ts';
export {
  ContentIdempotencyConflictError,
  admitContentOutcome,
  createContentPortalAccessAdapter,
  getContentItemDetail,
  listContentLibrary,
  redactProviderMetadata,
} from './content/service.ts';
export {
  AccountLifecycleError,
  acceptOwnerAdminInvitation,
  acceptParentActivation,
  acceptStudentSetup,
  completePasswordReset,
  completeStudentReset,
  createOwnerAdminInvitation,
  createParentActivation,
  createStudentReset,
  createStudentSetup,
  requestPasswordReset,
  restoreStudentIdentity,
  revokeStudentIdentitySessions,
  suspendStudentIdentity,
} from './accounts/lifecycle.ts';
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
export { createAccountLifecycleCredentialAdapter } from './portals/account-lifecycle-adapter.ts';
export { buildOwnerDashboard, ownerAdminVisibleActions } from './dashboard/service.ts';
export {
  PortalServiceError,
  createParentPortalService,
  createRewardService,
  createStudentPortalService,
  fingerprint as portalFingerprint,
  type PortalServiceDeps,
} from './portals/services.ts';
export {
  CrmDuplicateError,
  CrmVersionConflictError,
  createContact,
  getContactDetail,
  listAssignableUsers,
  listContacts,
  updateContact,
} from './crm/service.ts';
export {
  consumeWhatsAppAccountLink,
  digestForTests as whatsappDigestForTests,
  evaluateWhatsAppCanaryReadiness,
  ingestWhatsAppProviderEvents,
  processPendingWhatsAppInbox,
  processQueuedWhatsAppOutbox,
  receiveWhatsAppWebhook,
  verifyWhatsAppWebhookChallenge,
} from './whatsapp/service.ts';
export { MetaWhatsAppCloudAdapter, SinkWhatsAppProviderAdapter } from './whatsapp/provider.ts';
export { compileWhatsAppIntent } from './whatsapp/intent.ts';
