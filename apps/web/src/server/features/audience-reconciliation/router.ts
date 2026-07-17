import express, { type Request, type Response } from 'express';
import { ZodError } from 'zod';
import {
  legacyActivationCampaignApprovalRequestSchema,
  legacyActivationCampaignControlRequestSchema,
  legacyActivationCampaignPreviewRequestSchema,
  legacyActivationCampaignQueueRequestSchema,
  legacyAudienceApplyPlanRequestSchema,
  legacyAudienceConflictDecisionRequestSchema,
  legacyAudienceDryRunRequestSchema,
  legacyAudienceRollbackRequestSchema,
  legacyAudienceSourceInventoryManifestSchema,
  type LegacyActivationCampaignPreview,
  type LegacyActivationCampaignQueueResult,
  type LegacyAudienceDryRunReport,
} from '../../../../../../packages/contracts/src/audience-reconciliation/index.ts';
import {
  approveLegacyActivationCampaign,
  createLegacyActivationCampaignPreview,
  LegacyActivationCampaignApprovalError,
  queueLegacyActivationCampaignIntents,
  type LegacyActivationLifecyclePort,
} from '../../../../../../packages/domain/src/audience-reconciliation/activation-campaign.ts';
import {
  createLegacyAudienceApplyPlan,
  createLegacyAudienceDryRun,
  legacyAudienceGovernedTaxonomy,
  legacyAudienceSegmentContracts,
} from '../../../../../../packages/domain/src/audience-reconciliation/service.ts';
import {
  collectIdentityFilters,
  LegacyActivationCampaignNotFoundError,
  LegacyAudienceBatchNotFoundError,
  LegacyAudienceIdempotencyConflictError,
  type LegacyAudienceRepositoryActor,
  type createPostgresLegacyAudienceRepository,
} from '../../../../../../packages/db/src/audience-reconciliation/repository.ts';

export type Ot74AudienceSession = {
  sessionKey: string;
  actor: LegacyAudienceRepositoryActor & {
    role: string;
  };
};

export type Ot74AudienceGuards = {
  loadSession: (req: Request) => Promise<Ot74AudienceSession | null>;
  verifyCsrf: (req: Request, session: Ot74AudienceSession) => Promise<boolean>;
};

export type Ot74AudienceRepository = ReturnType<typeof createPostgresLegacyAudienceRepository>;

export type Ot74AudienceRouterDeps = {
  guards: Ot74AudienceGuards;
  repository: Ot74AudienceRepository;
  activationCampaignPolicy?: {
    protectedCanaryDestination?: string | undefined;
    whatsappEnabled?: boolean | undefined;
    lifecyclePort?: LegacyActivationLifecyclePort | undefined;
  };
};

export function createOt74AudienceReconciliationRouter(deps: Ot74AudienceRouterDeps) {
  const router = express.Router();

  router.use((_req, res, next) => {
    setPrivateNoStore(res);
    next();
  });

  router.get(
    '/contracts',
    asyncHandler(async (req, res) => {
      const session = await requireSession(req, res, deps.guards);
      if (!session) return;
      if (!canRead(session.actor.role)) return forbidden(res);
      res.json({ success: true, segments: legacyAudienceSegmentContracts });
    }),
  );

  router.get(
    '/taxonomy',
    asyncHandler(async (req, res) => {
      const session = await requireSession(req, res, deps.guards);
      if (!session) return;
      if (!canRead(session.actor.role)) return forbidden(res);
      res.json({
        success: true,
        taxonomy: legacyAudienceGovernedTaxonomy,
        segments: legacyAudienceSegmentContracts,
        raw_values_included: false,
        production_side_effects: false,
      });
    }),
  );

  router.post(
    '/source-inventories',
    express.json({ limit: '1mb' }),
    asyncHandler(async (req, res) => {
      const session = await requireSession(req, res, deps.guards);
      if (!session) return;
      if (!canManage(session.actor.role)) return forbidden(res);
      if (!(await deps.guards.verifyCsrf(req, session))) {
        res.status(403).json(errorBody('CSRF_REQUIRED', 'Refresh the page and try again.'));
        return;
      }
      const manifest = legacyAudienceSourceInventoryManifestSchema.parse(req.body);
      const recorded = await deps.repository.recordSourceInventory({
        actor: session.actor,
        manifest,
      });
      res.json({
        success: true,
        replayed: recorded.replayed,
        inventory: safeInventory(recorded.manifest),
      });
    }),
  );

  router.post(
    '/dry-runs',
    express.json({ limit: '4mb' }),
    asyncHandler(async (req, res) => {
      const session = await requireSession(req, res, deps.guards);
      if (!session) return;
      if (!canManage(session.actor.role)) return forbidden(res);
      if (!(await deps.guards.verifyCsrf(req, session))) {
        res.status(403).json(errorBody('CSRF_REQUIRED', 'Refresh the page and try again.'));
        return;
      }
      const request = legacyAudienceDryRunRequestSchema.parse(req.body);
      const identities = collectIdentityFilters(request.rows);
      const existingContacts = await deps.repository.findContactsByIdentities(
        session.actor,
        identities,
      );
      const report = createLegacyAudienceDryRun({
        scope: session.actor,
        request,
        existingContacts,
      });
      const recorded = await deps.repository.recordDryRun({
        actor: session.actor,
        idempotencyKey: request.idempotency_key,
        report,
      });
      res.json({ success: true, replayed: recorded.replayed, report: safeReport(recorded.report) });
    }),
  );

  router.get(
    '/batches/:batchKey',
    asyncHandler(async (req, res) => {
      const session = await requireSession(req, res, deps.guards);
      if (!session) return;
      if (!canRead(session.actor.role)) return forbidden(res);
      const report = await deps.repository.getBatchReport(
        session.actor,
        String(req.params.batchKey),
      );
      if (!report) {
        res.status(404).json(errorBody('NOT_FOUND', 'Legacy audience batch was not found.'));
        return;
      }
      res.json({ success: true, report: safeReport(report) });
    }),
  );

  router.post(
    '/batches/:batchKey/rollback-requests',
    express.json({ limit: '16kb' }),
    asyncHandler(async (req, res) => {
      const session = await requireSession(req, res, deps.guards);
      if (!session) return;
      if (!canRollback(session.actor.role)) return forbidden(res);
      if (!(await deps.guards.verifyCsrf(req, session))) {
        res.status(403).json(errorBody('CSRF_REQUIRED', 'Refresh the page and try again.'));
        return;
      }
      const request = legacyAudienceRollbackRequestSchema.parse({
        ...req.body,
        batch_key: String(req.params.batchKey),
      });
      const rollback = await deps.repository.recordRollbackRequest(session.actor, request);
      res.json({ success: true, rollback });
    }),
  );

  router.post(
    '/batches/:batchKey/conflict-decisions',
    express.json({ limit: '16kb' }),
    asyncHandler(async (req, res) => {
      const session = await requireSession(req, res, deps.guards);
      if (!session) return;
      if (!canManage(session.actor.role)) return forbidden(res);
      if (!(await deps.guards.verifyCsrf(req, session))) {
        res.status(403).json(errorBody('CSRF_REQUIRED', 'Refresh the page and try again.'));
        return;
      }
      const request = legacyAudienceConflictDecisionRequestSchema.parse({
        ...req.body,
        batch_key: String(req.params.batchKey),
      });
      const decision = await deps.repository.recordConflictDecision(session.actor, request);
      res.json({ success: true, decision });
    }),
  );

  router.post(
    '/batches/:batchKey/apply-plans',
    express.json({ limit: '32kb' }),
    asyncHandler(async (req, res) => {
      const session = await requireSession(req, res, deps.guards);
      if (!session) return;
      if (!canRollback(session.actor.role)) return forbidden(res);
      if (!(await deps.guards.verifyCsrf(req, session))) {
        res.status(403).json(errorBody('CSRF_REQUIRED', 'Refresh the page and try again.'));
        return;
      }
      const request = legacyAudienceApplyPlanRequestSchema.parse({
        ...req.body,
        batch_key: String(req.params.batchKey),
      });
      const report = await deps.repository.getBatchReport(
        session.actor,
        String(req.params.batchKey),
      );
      if (!report) {
        res.status(404).json(errorBody('NOT_FOUND', 'Legacy audience batch was not found.'));
        return;
      }
      const result = createLegacyAudienceApplyPlan({ report, request });
      const recorded = await deps.repository.recordApplyPlan({
        actor: session.actor,
        request,
        result,
      });
      res.json({ success: true, replayed: recorded.replayed, apply_plan: recorded.result });
    }),
  );

  router.post(
    '/batches/:batchKey/campaign-previews',
    express.json({ limit: '64kb' }),
    asyncHandler(async (req, res) => {
      const session = await requireSession(req, res, deps.guards);
      if (!session) return;
      if (!canManage(session.actor.role)) return forbidden(res);
      if (!(await deps.guards.verifyCsrf(req, session))) {
        res.status(403).json(errorBody('CSRF_REQUIRED', 'Refresh the page and try again.'));
        return;
      }
      const request = legacyActivationCampaignPreviewRequestSchema.parse({
        ...req.body,
        batch_key: String(req.params.batchKey),
      });
      const report = await deps.repository.getBatchReport(
        session.actor,
        String(req.params.batchKey),
      );
      if (!report) {
        res.status(404).json(errorBody('NOT_FOUND', 'Legacy audience batch was not found.'));
        return;
      }
      const preview = createLegacyActivationCampaignPreview({
        scope: session.actor,
        report,
        request,
        whatsappEnabled: deps.activationCampaignPolicy?.whatsappEnabled === true,
      });
      const recorded = await deps.repository.recordCampaignPreview({
        actor: session.actor,
        idempotencyKey: request.idempotency_key,
        preview,
      });
      res.json({
        success: true,
        replayed: recorded.replayed,
        preview: safeCampaignPreview(recorded.preview),
      });
    }),
  );

  router.post(
    '/campaigns/:campaignKey/approvals',
    express.json({ limit: '32kb' }),
    asyncHandler(async (req, res) => {
      const session = await requireSession(req, res, deps.guards);
      if (!session) return;
      if (!canApproveCampaign(session.actor.role)) return forbidden(res);
      if (!(await deps.guards.verifyCsrf(req, session))) {
        res.status(403).json(errorBody('CSRF_REQUIRED', 'Refresh the page and try again.'));
        return;
      }
      const campaign = await deps.repository.getCampaignRecord(
        session.actor,
        String(req.params.campaignKey),
      );
      if (!campaign) {
        res.status(404).json(errorBody('NOT_FOUND', 'Legacy activation campaign was not found.'));
        return;
      }
      const request = legacyActivationCampaignApprovalRequestSchema.parse({
        ...req.body,
        campaign_key: String(req.params.campaignKey),
      });
      const approval = approveLegacyActivationCampaign({
        preview: campaign.preview,
        request,
      });
      const recorded = await deps.repository.approveCampaign({
        actor: session.actor,
        idempotencyKey: request.idempotency_key,
        approval,
      });
      res.json({ success: true, replayed: recorded.replayed, approval: recorded.approval });
    }),
  );

  router.post(
    '/campaigns/:campaignKey/send-intents',
    express.json({ limit: '32kb' }),
    asyncHandler(async (req, res) => {
      const session = await requireSession(req, res, deps.guards);
      if (!session) return;
      if (!canApproveCampaign(session.actor.role)) return forbidden(res);
      if (!(await deps.guards.verifyCsrf(req, session))) {
        res.status(403).json(errorBody('CSRF_REQUIRED', 'Refresh the page and try again.'));
        return;
      }
      const campaign = await deps.repository.getCampaignRecord(
        session.actor,
        String(req.params.campaignKey),
      );
      if (!campaign) {
        res.status(404).json(errorBody('NOT_FOUND', 'Legacy activation campaign was not found.'));
        return;
      }
      const request = legacyActivationCampaignQueueRequestSchema.parse({
        ...req.body,
        campaign_key: String(req.params.campaignKey),
      });
      const result = await queueLegacyActivationCampaignIntents({
        preview: campaign.preview,
        approval: campaign.approval,
        request,
        protectedCanaryDestination: deps.activationCampaignPolicy?.protectedCanaryDestination,
        whatsappEnabled: deps.activationCampaignPolicy?.whatsappEnabled === true,
        lifecyclePort: deps.activationCampaignPolicy?.lifecyclePort,
      });
      const recorded = await deps.repository.recordCampaignSendIntents({
        actor: session.actor,
        idempotencyKey: request.idempotency_key,
        result,
      });
      res.json({
        success: true,
        replayed: recorded.replayed,
        result: safeQueueResult(recorded.result),
      });
    }),
  );

  router.post(
    '/campaigns/:campaignKey/control',
    express.json({ limit: '16kb' }),
    asyncHandler(async (req, res) => {
      const session = await requireSession(req, res, deps.guards);
      if (!session) return;
      if (!canApproveCampaign(session.actor.role)) return forbidden(res);
      if (!(await deps.guards.verifyCsrf(req, session))) {
        res.status(403).json(errorBody('CSRF_REQUIRED', 'Refresh the page and try again.'));
        return;
      }
      const request = legacyActivationCampaignControlRequestSchema.parse(req.body);
      const control = await deps.repository.recordCampaignControl({
        actor: session.actor,
        campaignKey: String(req.params.campaignKey),
        request,
      });
      res.json({ success: true, control });
    }),
  );

  router.use((error: unknown, _req: Request, res: Response, _next: express.NextFunction) => {
    setPrivateNoStore(res);
    if (error instanceof ZodError) {
      res.status(400).json(errorBody('VALIDATION_ERROR', 'Please check the submitted fields.'));
      return;
    }
    if (error instanceof LegacyAudienceIdempotencyConflictError) {
      res.status(409).json(errorBody('IDEMPOTENCY_CONFLICT', error.message));
      return;
    }
    if (error instanceof LegacyAudienceBatchNotFoundError) {
      res.status(404).json(errorBody('NOT_FOUND', error.message));
      return;
    }
    if (error instanceof LegacyActivationCampaignNotFoundError) {
      res.status(404).json(errorBody('NOT_FOUND', error.message));
      return;
    }
    if (error instanceof LegacyActivationCampaignApprovalError) {
      res.status(409).json(errorBody('APPROVAL_MISMATCH', error.message));
      return;
    }
    res
      .status(500)
      .json(errorBody('SERVER_ERROR', 'Legacy audience reconciliation could not be completed.'));
  });

  return router;
}

function safeReport(report: LegacyAudienceDryRunReport) {
  return {
    batch_key: report.batch_key,
    source: report.source,
    source_digest: report.source_digest,
    request_hash: report.request_hash,
    generated_at: report.generated_at,
    summary: report.summary,
    raw_row_contents_included: false,
    production_side_effects: false,
  };
}

function safeInventory(
  manifest: ReturnType<typeof legacyAudienceSourceInventoryManifestSchema.parse>,
) {
  return {
    inventory_key: manifest.inventory_key,
    generated_at: manifest.generated_at,
    source_roots: manifest.source_roots,
    summary: manifest.summary,
    manifest_sha256: manifest.manifest_sha256,
    files: manifest.files.map((file) => ({
      file_ref: file.file_ref,
      source_root_label: file.source_root_label,
      file_name: file.file_name,
      extension: file.extension,
      byte_size: file.byte_size,
      last_modified: file.last_modified,
      sha256: file.sha256,
      duplicate_of_sha256: file.duplicate_of_sha256,
      classification: file.classification,
      classification_reasons: file.classification_reasons,
      sheet_names: file.sheet_names,
      column_names_by_sheet: file.column_names_by_sheet,
      row_counts_by_sheet: file.row_counts_by_sheet,
      warnings: file.warnings,
      raw_values_included: false,
    })),
    raw_values_included: false,
    production_side_effects: false,
  };
}

async function requireSession(
  req: Request,
  res: Response,
  guards: Ot74AudienceGuards,
): Promise<Ot74AudienceSession | null> {
  const session = await guards.loadSession(req);
  if (!session) {
    res.status(401).json(errorBody('UNAUTHENTICATED', 'Please log in again.'));
    return null;
  }
  return session;
}

function canRead(role: string) {
  return ['owner', 'admin', 'crm_agent', 'viewer'].includes(role);
}

function canManage(role: string) {
  return ['owner', 'admin', 'crm_agent'].includes(role);
}

function canRollback(role: string) {
  return ['owner', 'admin'].includes(role);
}

function canApproveCampaign(role: string) {
  return ['owner', 'admin'].includes(role);
}

function forbidden(res: Response) {
  res.status(403).json(errorBody('FORBIDDEN', 'You do not have permission for this action.'));
}

function safeCampaignPreview(preview: LegacyActivationCampaignPreview) {
  const { recipient_row_keys: recipientRowKeys, ...safe } = preview;
  return {
    ...safe,
    recipient_row_key_count: recipientRowKeys.length,
    raw_recipient_list_included: false,
    message_body_included: false,
    production_side_effects: false,
  };
}

function safeQueueResult(result: LegacyActivationCampaignQueueResult) {
  return {
    campaign_key: result.campaign_key,
    status: result.status,
    mode: result.mode,
    requested_count: result.requested_count,
    queued_count: result.queued_count,
    blocked_reasons: result.blocked_reasons,
    intent_refs: result.intents.slice(0, 5).map((intent) => intent.intent_key),
    provider_acceptance_is_delivery: false,
    external_send_performed: false,
    raw_recipient_list_included: false,
    raw_token_included: false,
  };
}

function setPrivateNoStore(res: Response) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Vary', 'Cookie, Authorization');
}

function errorBody(code: string, message: string) {
  return { success: false, code, message };
}

function asyncHandler(
  handler: (req: Request, res: Response, next: express.NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: express.NextFunction) => {
    handler(req, res, next).catch(next);
  };
}
