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
export { createOneTimeTelegramApplicationAdapter } from './telegram/application-adapter.ts';
export {
  SupportAttachmentError,
  normalizeSupportAttachments,
  type NormalizedSupportAttachment,
} from './support/attachments.ts';
export {
  OT89_ATTACHMENT_TARGET_PREFIX,
  OT89_EVENT_TARGET,
  OT89_STATUS_TARGET,
  createOt89Nonce,
  createOt89SignedHeaders,
  ot89CanonicalString,
  sha256Hex,
  signOt89Request,
  verifyOt89Signature,
} from './support/hmac.ts';
export { createSupportId, isOt89Id } from './support/ids.ts';
export { redactSupportText, supportPrivacy } from './support/redaction.ts';
export {
  SupportSubmissionError,
  attachmentRequestTarget,
  createSupportSubmission,
  getAuthorizedSupportAttachment,
  hasActiveSupportEntitlement,
  ingestMockBnaSupportEvent,
  isSupportSubmissionAvailable,
  readMockBnaStatus,
  readSupportReceipt,
  type SupportReceiptProjection,
} from './support/service.ts';
export {
  SUPPORT_CLAIM_BATCH_SQL,
  refreshSupportStatusProjection,
  requeueSupportDeadLetter,
  runSupportDeliveryBatch,
  type SupportDeliverySummary,
} from './support/worker.ts';
