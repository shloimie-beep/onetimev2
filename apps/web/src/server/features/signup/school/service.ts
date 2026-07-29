import {
  APPROVED_SCHOOL_CONFIGURATION_OPERATION,
  SCHOOL_INQUIRY_OPERATION,
  type ApprovedSchoolConfiguration,
  type ApprovedSchoolConfigurationCommand,
  type ApprovedSchoolRecord,
  type SchoolInquiryCommand,
  type SchoolInquiryReceipt,
  type SchoolInquiryRequestBinding,
  type SchoolInquiryResult,
  type SchoolSignupScope,
} from '../../../../../../../packages/contracts/src/signup/school/index.ts';
import {
  canonicalizeSchoolInquiry,
  planApprovedSchoolConfiguration,
  planSchoolInquiry,
  type CanonicalSchoolInquiry,
  type SchoolConfigurationActor,
} from '../../../../../../../packages/domain/src/signup/school/index.ts';

export interface SchoolSignupTransaction {
  findInquiry(input: {
    scope: SchoolSignupScope;
    operation: typeof SCHOOL_INQUIRY_OPERATION;
    normalized_email: string;
  }): Promise<SchoolInquiryReceipt | null>;
  commitInquiry(input: {
    request_binding: SchoolInquiryRequestBinding;
    request: CanonicalSchoolInquiry;
    receipt: SchoolInquiryReceipt;
  }): Promise<void>;
  readApprovedSchoolForUpdate(input: {
    scope: SchoolSignupScope;
    operation: typeof APPROVED_SCHOOL_CONFIGURATION_OPERATION;
    approved_school_id: string;
  }): Promise<ApprovedSchoolRecord | null>;
  commitApprovedSchoolConfiguration(input: {
    scope: SchoolSignupScope;
    operation: typeof APPROVED_SCHOOL_CONFIGURATION_OPERATION;
    configuration: ApprovedSchoolConfiguration;
  }): Promise<void>;
}

export interface SchoolSignupRepository {
  transaction<T>(run: (transaction: SchoolSignupTransaction) => Promise<T>): Promise<T>;
}

export function createSchoolSignupService(dependencies: {
  repository: SchoolSignupRepository;
  allocateLeadId: () => string;
}) {
  return {
    async submitInquiry(input: {
      scope: SchoolSignupScope;
      command: SchoolInquiryCommand;
    }): Promise<SchoolInquiryResult> {
      const canonical = canonicalizeSchoolInquiry(input.scope, input.command);
      return dependencies.repository.transaction(async (transaction) => {
        const existingReceipt = await transaction.findInquiry({
          scope: input.scope,
          operation: SCHOOL_INQUIRY_OPERATION,
          normalized_email: canonical.request.normalized_email,
        });
        const plan = planSchoolInquiry({
          scope: input.scope,
          command: input.command,
          request_binding: canonical.request_binding,
          canonical_request: canonical.request,
          proposed_lead_id: existingReceipt ? '' : dependencies.allocateLeadId(),
          existing_receipt: existingReceipt,
        });
        if (plan.local_write_required) {
          await transaction.commitInquiry({
            request_binding: canonical.request_binding,
            request: canonical.request,
            receipt: plan.receipt,
          });
        }
        return plan.result;
      });
    },

    async configureApprovedSchool(input: {
      actor: SchoolConfigurationActor;
      command: ApprovedSchoolConfigurationCommand;
    }): Promise<ApprovedSchoolConfiguration> {
      return dependencies.repository.transaction(async (transaction) => {
        const scope: SchoolSignupScope = {
          product: input.actor.product,
          runtime_tier: input.actor.runtime_tier,
          verification_environment_id: input.actor.verification_environment_id,
        };
        const current = await transaction.readApprovedSchoolForUpdate({
          scope,
          operation: APPROVED_SCHOOL_CONFIGURATION_OPERATION,
          approved_school_id: input.command.approved_school_id,
        });
        const configuration = planApprovedSchoolConfiguration({
          actor: input.actor,
          command: input.command,
          approved_school: current,
        });
        await transaction.commitApprovedSchoolConfiguration({
          scope,
          operation: APPROVED_SCHOOL_CONFIGURATION_OPERATION,
          configuration,
        });
        return configuration;
      });
    },
  };
}
