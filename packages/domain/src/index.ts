export { campaignTicker } from './landing/campaign.ts';
export { campaign, landingContent, sharedNav } from './landing/content.ts';
export {
  communicationConsentNotice,
  legalPolicyMetadata,
  parentGuardianStudentDataNotice,
  privacyDataCategories,
  privacyNotice,
  termsOfUse,
} from './legal/index.ts';
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
  communicationHistorySourceTruthMatrix,
  dryRunCommunicationHistoryBackfill,
  unavailableProviderHistoryReport,
  type CommunicationHistoryDryRunInput,
  type CommunicationHistoryDryRunReport,
  type CommunicationHistorySourceTruthRow,
} from './communications/history-ingestion.ts';
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
export { createClassroomReminderJob } from './classroom/reminders.ts';
export {
  ZoomApiError,
  assertNoZoomSecretLeak,
  createLearnerZoomSdkSignature,
  createZoomRestClient,
  registrantTokenFromJoinUrl,
  resolveZoomOccurrenceForLocalDate,
} from './providers/zoom-rest.ts';
export {
  processZoomWebhook,
  projectZoomWebhookAttendance,
  verifyZoomWebhookSignature,
  zoomWebhookSignature,
  zoomWebhookUrlValidationToken,
} from './providers/zoom-webhook.ts';
export {
  ContentIdempotencyConflictError,
  admitContentOutcome,
  createContentPortalAccessAdapter,
  getContentItemDetail,
  listContentLibrary,
  redactProviderMetadata,
} from './content/service.ts';
export {
  Ot110aContentWorkspaceError,
  activateOt110aPromptVersion,
  createOt110aGeneratedArtifact,
  createOt110aIntegratedProviderPorts,
  createOt110aProviderOffPorts,
  createOt110aPromptPatch,
  getOt110aContentCreateWorkspace,
  getOt110aContentProcessingQueue,
  getOt110aContentSourceDetail,
  getOt110aContentWorkspaceOverview,
  grantOt110aContentAdminCapability,
  hasOt110aContentCapability,
  listOt110aActivity,
  listOt110aKnowledgeWorkspace,
  listOt110aPromptTemplates,
  listOt110aSocialWorkspace,
  performOt110aContentAction,
  previewOt110aPromptPatch,
  resolveOt110aContentAdminActor,
  rollbackOt110aPromptVersion,
  type Ot110aContentAdminActor,
  type Ot110aProviderPorts,
} from './content/admin-workspace.ts';
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
  OT104R_ACCOUNT_KEY,
  OT104R_PRODUCT_KEY,
  OT104R_TRANSCRIPT_MAX_BYTES,
  OT104R_WEBHOOK_MAX_BYTES,
  Ot104rVimeoRuntimeError,
  createOt104rRealVimeoAdapter,
  createOt104rSinkVimeoAdapter,
  createOt104rUnconfiguredVimeoAdapter,
  importOt104rVimeoTextTrack,
  inspectOt104rVimeoReadinessFromEnv,
  projectOt104rPlaybackAccess,
  receiveOt104rVimeoWebhook,
  reconcileNextOt104rVimeoSource,
  registerOt104rVimeoSource,
  retryOt104rVimeoSource,
  sanitizeOt104rProviderError,
  signOt104rVimeoWebhook,
  type Ot104rVimeoAdapter,
  type Ot104rVimeoTextTrackDownload,
  type Ot104rVimeoTextTrackSummary,
  type Ot104rVimeoUploadIntent,
  type Ot104rVimeoVideoInspection,
  type Ot104rVimeoWebhookReceiptResult,
} from './content/vimeo-private-runtime.ts';
export {
  OT109_SCOPE,
  Ot109PublisherError,
  approveOt109TranscriptAndGenerateDrafts,
  createDisabledOt109TranscriptionPort,
  createDisabledOt109VimeoPort,
  publishOt109ApprovedArtifacts,
  registerOt109Source,
  retrieveOt109HelperKnowledge,
  revokeOt109Publication,
  reviewOt109Artifact,
  runOt109PublisherWorkerOnce,
  type Ot109TranscriptionPort,
  type Ot109VimeoPort,
  type Ot109VimeoProcessingState,
  type Ot109VimeoReference,
  type Ot109VimeoStatus,
} from './content/publisher.ts';
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
  Ot106BufferRuntimeError,
  cancelOt106Manifest,
  canonicalOt106Json,
  createOt106BufferGraphqlAdapter,
  createOt106SinkAdapter,
  inspectOt106BufferReadiness,
  loadOt106RuntimeConfigFromEnv,
  parseBufferGraphqlCreatePostResponse,
  parseOt106BufferChannelAliases,
  processOt106BufferQueueOnce,
  receiveOt106PublicationManifest,
  sanitizeOt106ProviderError,
  signOt106Manifest,
  validateOt106ManifestChecksum,
  withOt106ManifestChecksum,
  type Ot106BufferAdapter,
  type Ot106ProviderPostInput,
  type Ot106ProviderResult,
  type Ot106ReceiveResult,
  type Ot106RuntimeConfig,
  type Ot106SigningSecret,
} from './social/buffer-runtime.ts';
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
  decryptAuthEmailChallengeDeliveryPayloadForTests,
  resendEmailChallenge,
  getSessionUserByKey,
  getSessionByToken,
  provisionTotpEnrollment,
  resetAuthRateLimitForTests,
  replaceMfaRecoveryCodes,
  revokeTrustedDevice,
  revokeMfaFactors,
  revokeSession,
  revokeUserSessions,
  runAuthEmailChallengeDeliveryOutboxBatch,
  rotateSessionCsrf,
  totpCode,
  verifyEmailChallengeCode,
  verifyEmailChallengeLink,
  verifyLoginCsrf,
  verifyMfaChallenge,
  verifyMfaRecoveryChallenge,
  verifyRecentEmailAssurance,
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
  createGamificationService,
  createPortalGamificationAdapter,
  emptyGamificationSummary,
  type GamificationEventRow,
  type GamificationLearnerSnapshot,
  type GamificationRepository,
  type GamificationService,
} from './gamification/service.ts';
export {
  STUDENT_CLASS_HELPER_NO_SOURCE,
  STUDENT_CLASS_HELPER_OUTSIDE_SCOPE,
  STUDENT_CLASS_HELPER_POLICY,
  createInMemoryStudentClassHelperRateLimitStore,
  createStudentClassHelperAdapter,
  type StudentClassHelperProviderPort,
  type StudentClassHelperRateLimitStore,
} from './portals/student-class-helper.ts';
export {
  CrmDuplicateError,
  CrmReplyError,
  CrmVersionConflictError,
  appendContactNote,
  archiveContact,
  assignCrmTag,
  confirmSingleRecipientReply,
  createContact,
  createCrmTag,
  getContactDetail,
  listCrmTags,
  listAssignableUsers,
  listContacts,
  previewSingleRecipientReply,
  removeCrmTag,
  updateContact,
} from './crm/service.ts';
export { createOneTimeTelegramApplicationAdapter } from './telegram/application-adapter.ts';
export { createOneTimeTelegramAdminRuntime } from './telegram/runtime.ts';
export {
  OneTimeTelegramTransportAdapter,
  TelegramBotApiSendMessageClient,
  telegramTransportReadiness,
  type TelegramProtectedChatDirectory,
  type TelegramSendMessageClient,
} from './telegram/transport.ts';
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
  buildWhatsAppPublicAssistantStatus,
  digestForTests as whatsappDigestForTests,
  evaluateWhatsAppCanaryReadiness,
  ingestWhatsAppProviderEvents,
  processPendingWhatsAppInbox,
  processQueuedWhatsAppOutbox,
  receiveWhatsAppWebhook,
  verifyWhatsAppWebhookChallenge,
} from './whatsapp/service.ts';
export {
  WHATSAPP_ASSISTANT_COPY,
  W12_06_WHATSAPP_ASSISTANT_COPY_VERSION,
} from './whatsapp/copy.ts';
export {
  MetaWhatsAppCloudAdapter,
  OT100_META_GRAPH_VERSION,
  OT100_STAGING_ENVIRONMENT_FINGERPRINT,
  SinkWhatsAppProviderAdapter,
  WhatsAppProviderSendError,
  createMetaWhatsAppCloudAdapterFromEnv,
  inspectMetaWhatsAppCloudReadiness,
  loadMetaWhatsAppCloudAdapterOptions,
} from './whatsapp/provider.ts';
export { compileWhatsAppIntent } from './whatsapp/intent.ts';
