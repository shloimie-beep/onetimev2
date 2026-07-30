import { randomUUID } from 'node:crypto';
import express, { type NextFunction, type Request, type RequestHandler } from 'express';
import { z, ZodError } from 'zod';
import type { AppConfig } from '../../../../../../../packages/config/src/index.ts';
import {
  SCHOOL_INQUIRY_COPY,
  type SchoolInquiryCommand,
  type SchoolInquiryResult,
  type SchoolSignupScope,
} from '../../../../../../../packages/contracts/src/signup/school/index.ts';
import { VERIFICATION_RUNTIME_TIER } from '../../../../../../../packages/contracts/src/state/index.ts';
import type { DbPool } from '../../../../../../../packages/db/src/index.ts';
import {
  createPostgresSchoolSignupRepository,
  PostgresSchoolSignupRepositoryError,
} from '../../../../../../../packages/db/src/signup/school/repository.ts';
import { SchoolSignupError } from '../../../../../../../packages/domain/src/signup/school/index.ts';
import {
  publicError,
  type RequestWithTrace,
} from '../../../../../../../packages/observability/src/index.ts';
import { leadRateLimit } from '../../../rate-limit.ts';
import {
  defineServerFeature,
  SERVER_FEATURE_REGISTRY_CONTRACT_VERSION,
} from '../../registry/index.ts';
import { createSchoolSignupService } from './service.ts';

const schoolInquiryPayloadSchema = z
  .object({
    school_name: z.string().min(1).max(180),
    contact_first_name: z.string().min(1).max(100),
    contact_last_name: z.string().min(1).max(100),
    email: z.string().min(1).max(254),
    phone: z.string().min(1).max(40).nullable().optional(),
    note: z.string().max(1000).nullable().optional(),
  })
  .strict();

export type SchoolInquirySubmitter = {
  submit(input: {
    scope: SchoolSignupScope;
    command: SchoolInquiryCommand;
  }): Promise<SchoolInquiryResult>;
};

export type SchoolInquiryRouterInput = {
  config: AppConfig;
  pool: DbPool;
  runtimeBinding?: SchoolSignupScope | undefined;
  submitter?: SchoolInquirySubmitter | undefined;
  rateLimit?: RequestHandler | false | undefined;
  allocateLeadId?: (() => string) | undefined;
};

export function createSchoolInquiryRouter(input: SchoolInquiryRouterInput): express.Router {
  const router = express.Router();
  const scope = input.runtimeBinding ?? resolveSchoolSignupScope(input.config);
  const writesAllowed = scope.verification_environment_id !== 'production_read_only';
  const submitter = input.submitter ?? defaultSubmitter(input.pool, input.allocateLeadId);
  const mutationRateLimit =
    input.rateLimit === false
      ? (_req: Request, _res: express.Response, next: NextFunction) => next()
      : (input.rateLimit ?? leadRateLimit(input.config, input.pool));

  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.removeHeader('ETag');
    next();
  });

  router.post(
    '/',
    (req: RequestWithTrace, res, next) => {
      try {
        res.locals.schoolInquiryCommand = schoolInquiryPayloadSchema.parse(
          req.body,
        ) as SchoolInquiryCommand;
        if (!writesAllowed) {
          res
            .status(403)
            .json(
              publicError(
                'VERIFICATION_ENVIRONMENT_READ_ONLY',
                'School inquiry writes are disabled in this verification environment.',
                req.traceId,
              ),
            );
          return;
        }
        next();
      } catch (error) {
        if (error instanceof ZodError) {
          res.status(400).json({
            ...publicError(
              'VALIDATION_ERROR',
              'Please check the School inquiry form.',
              req.traceId,
            ),
            field_errors: Object.fromEntries(
              error.issues
                .filter((issue) => typeof issue.path[0] === 'string')
                .map((issue) => [String(issue.path[0]), issue.message]),
            ),
          });
          return;
        }
        next(error);
      }
    },
    mutationRateLimit,
    async (req: RequestWithTrace, res) => {
      try {
        const result = await submitter.submit({
          scope,
          command: res.locals.schoolInquiryCommand as SchoolInquiryCommand,
        });
        res.status(result.disposition === 'created' ? 201 : 200).json({
          success: true,
          code:
            result.disposition === 'created'
              ? 'SCHOOL_INQUIRY_ACCEPTED'
              : 'SCHOOL_INQUIRY_DEDUPLICATED',
          disposition: result.disposition,
          sales_state: result.sales_state,
          acknowledgment_state: 'pending',
          manual_follow_up_required: true,
          provider_effects_completed_inline: result.provider_effects_completed_inline,
          product_accounts_created: result.product_accounts_created,
          households_created: result.households_created,
          student_accounts_created: result.student_accounts_created,
          subscriptions_created: result.subscriptions_created,
          access_grants_created: result.access_grants_created,
          nurture_workflow_intent_ids: result.nurture_workflow_intent_ids,
          message: result.safe_message,
        });
      } catch (error) {
        if (error instanceof SchoolSignupError) {
          const conflict = error.code === 'school_inquiry_conflict';
          res
            .status(conflict ? 409 : 400)
            .json(
              publicError(
                conflict ? 'SCHOOL_INQUIRY_CONFLICT' : 'VALIDATION_ERROR',
                conflict
                  ? 'This email already has a different School inquiry.'
                  : 'Please check the School inquiry form.',
                req.traceId,
              ),
            );
          return;
        }
        if (
          error instanceof PostgresSchoolSignupRepositoryError &&
          error.code === 'read_only_environment'
        ) {
          res
            .status(403)
            .json(
              publicError(
                'VERIFICATION_ENVIRONMENT_READ_ONLY',
                'School inquiry writes are disabled in this verification environment.',
                req.traceId,
              ),
            );
          return;
        }
        res
          .status(500)
          .json(
            publicError('SERVER_ERROR', 'We could not save that School inquiry yet.', req.traceId),
          );
      }
    },
  );

  return router;
}

export const schoolInquiryFeatureRegistration = defineServerFeature({
  featureId: 'onetime.signup-school-inquiry',
  contractVersion: SERVER_FEATURE_REGISTRY_CONTRACT_VERSION,
  mountPath: '/api/v2.1/signup/school-inquiry',
  createRouter: ({ config, pool }) => createSchoolInquiryRouter({ config, pool }),
});

export function resolveSchoolSignupScope(config: AppConfig): SchoolSignupScope {
  const fallback =
    config.oneTimeRuntimeEnvironment === 'production'
      ? ({
          runtime_tier: 'production',
          verification_environment_id: 'production_read_only',
        } as const)
      : config.oneTimeRuntimeEnvironment === 'isolated_staging'
        ? ({
            runtime_tier: 'isolated_staging',
            verification_environment_id: 'persistent_staging',
          } as const)
        : ({
            runtime_tier: 'isolated_staging',
            verification_environment_id: 'ci',
          } as const);
  const centrallyBound = config as AppConfig & {
    oneTimeRuntimeTier?: unknown;
    oneTimeVerificationEnvironmentId?: unknown;
  };
  const runtimeTier = centrallyBound.oneTimeRuntimeTier ?? fallback.runtime_tier;
  const verificationEnvironmentId =
    centrallyBound.oneTimeVerificationEnvironmentId ?? fallback.verification_environment_id;
  if (
    (runtimeTier !== 'isolated_staging' && runtimeTier !== 'production') ||
    typeof verificationEnvironmentId !== 'string' ||
    !Object.hasOwn(VERIFICATION_RUNTIME_TIER, verificationEnvironmentId) ||
    VERIFICATION_RUNTIME_TIER[
      verificationEnvironmentId as keyof typeof VERIFICATION_RUNTIME_TIER
    ] !== runtimeTier
  ) {
    throw new Error('School inquiry requires an exact verification-environment runtime binding.');
  }
  return {
    product: 'one_time_mishnayos',
    runtime_tier: runtimeTier,
    verification_environment_id:
      verificationEnvironmentId as SchoolSignupScope['verification_environment_id'],
  };
}

function defaultSubmitter(
  pool: DbPool,
  allocateLeadId: (() => string) | undefined,
): SchoolInquirySubmitter {
  const service = createSchoolSignupService({
    repository: createPostgresSchoolSignupRepository(pool),
    allocateLeadId: allocateLeadId ?? (() => `school-lead-${randomUUID()}`),
  });
  return {
    submit: ({ scope, command }) => service.submitInquiry({ scope, command }),
  };
}

export const SCHOOL_INQUIRY_ROUTE_COPY = SCHOOL_INQUIRY_COPY;
