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
  CLASSROOM_HOST_POLICY_VERSION,
  CLASSROOM_POLICY_VERSION,
  createClassroomPortalAccessAdapter,
  createClassroomService,
  type ClassroomRepository,
  type ClassroomService,
} from './classroom/service.ts';
export {
  ContentIdempotencyConflictError,
  admitContentOutcome,
  createContentPortalAccessAdapter,
  getContentItemDetail,
  listContentLibrary,
  redactProviderMetadata,
} from './content/service.ts';
export {
  OT86_ALLOWED_TRANSITIONS,
  Ot86ContentPipelineError,
  applyNextOt86Publication,
  approveOt86ContentVersion,
  canonicalJson,
  createOt86CandidateVersion,
  createOt86ContentItem,
  emitOt86ApprovedForSocialEvent,
  inspectOt86VimeoReadinessFromEnv,
  receiveOt86PublicationManifest,
  recordOt86ProviderEventReceipt,
  retrieveOt86ApprovedContent,
  sanitizeOt86ProviderError,
  signOt86Manifest,
  stableOt86Key,
  transitionOt86ContentState,
  validateOt86ManifestChecksum,
  withOt86ManifestChecksum,
  type Ot86PublishReceiptResult,
  type Ot86SigningSecret,
} from './content/pipeline.ts';
export {
  OT86B_ALLOWED_TRANSITIONS,
  Ot86bSocialPublishingError,
  approveAndScheduleOt86bDraft,
  createUnconfiguredBufferAdapter,
  dispatchNextOt86bSocialEvent,
  editOt86bDraftRevision,
  generateNextOt86bDraftJob,
  inspectOt86bBufferReadinessFromEnv,
  listOt86bSocialDrafts,
  receiveOt86bSocialEvent,
  requestOt86bRetraction,
  runOt86bSchedulerOnce,
  sanitizeOt86bProviderError,
  validateOt86bDraftRevisionChecksum,
  validateOt86bPublishCommand,
  validateOt86bSocialEventChecksum,
  withOt86bSocialDraftRevisionChecksum,
  type Ot86bBufferAdapter,
  type Ot86bProviderResult,
  type Ot86bSocialEventReceiptResult,
} from './social/publishing.ts';
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
  inspectAccountLifecycleToken,
  requestPasswordReset,
  restoreStudentIdentity,
  revokeStudentIdentitySessions,
  suspendStudentIdentity,
  type AccountLifecycleTokenInspection,
} from './accounts/lifecycle.ts';
export {
  decryptLifecycleDeliveryPayloadForTests,
  runLifecycleDeliveryOutboxBatch,
  type LifecycleDeliveryBatchSummary,
} from './accounts/lifecycle-delivery.ts';
export {
  authenticateUser,
  activateTotpEnrollment,
  canAssignContacts,
  canEditContacts,
  createAccountUser,
  createLoginCsrf,
  createPostActivationMfaHandoff,
  createSession,
  consumePostActivationMfaHandoff,
  getSessionUserByKey,
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
  billingConfigSnapshot,
  defaultBillingFeatureConfig,
  parseBillingFeatureConfig,
  parseOt87StripeTestBillingConfig,
  readOt87StripeRuntimeSecrets,
  type BillingConfigSource,
} from './billing/config.ts';
export {
  BILLING_POLICY_VERSION,
  OT87_BILLING_POLICY_VERSION,
  OT87_BILLING_POLICY_VERSION as OT105_STRIPE_TEST_POLICY_VERSION,
  OT87_OFFER_KEY,
  OT87_PLAN_TRUTH_TEXT,
  OT87_POLICY_ID,
  evaluateBillingEntitlement,
} from './billing/policy.ts';
export {
  OT87_PLAN_TRUTH,
  loadOt87CommercialPolicy,
  ot87CommercialPolicySchema,
  type Ot87CommercialPolicy,
} from './billing/commercial-policy.ts';
export { createBillingServices } from './billing/service.ts';
export { createOfficialStripeTestClient } from './billing/stripe-official-client.ts';
export {
  createStripeTestBillingProviderAdapter,
  type StripeRedirectVault,
  type StripeTestClient,
  type StripeTestEvent,
} from './billing/stripe-test-adapter.ts';
export {
  createFixtureBillingProviderAdapter,
  fixtureWebhookSignature,
  type FixtureBillingProviderAdapter,
} from './billing/fixture-adapter.ts';
export { buildBillingReturnPaths, isRejectedReturnPath } from './billing/return-paths.ts';
export { householdHasLearningAccess } from './billing/portal-access.ts';
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
