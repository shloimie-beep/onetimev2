import {
  APPROVED_SCHOOL_CONFIGURATION_OPERATION,
  SCHOOL_INQUIRY_OPERATION,
  type ApprovedSchoolConfiguration,
  type ApprovedSchoolConfigurationCommand,
  type ApprovedSchoolConfigurationResult,
  type ApprovedSchoolRecord,
  type SchoolInquiryCommand,
  type SchoolInquiryReceipt,
  type SchoolInquiryRequestBinding,
  type SchoolInquiryResult,
  type SchoolSignupScope,
} from '../../../../../../../packages/contracts/src/signup/school/index.ts';
import {
  canonicalizeApprovedSchoolConfiguration,
  canonicalizeSchoolInquiry,
  planApprovedSchoolConfiguration,
  planSchoolInquiry,
  validateApprovedSchoolConfigurationReadback,
  validateApprovedSchoolConfigurationReplay,
  type CanonicalSchoolInquiry,
  type SchoolConfigurationActor,
} from '../../../../../../../packages/domain/src/signup/school/index.ts';

export interface SchoolSignupTransaction {
  findInquiry(input: {
    scope: SchoolSignupScope;
    operation: typeof SCHOOL_INQUIRY_OPERATION;
    normalized_email: string;
  }): Promise<SchoolInquiryReceipt | null>;
  /**
   * Atomically creates the exact scope/operation/normalized-email key or
   * returns the receipt that won the unique-key race. Implementations must not
   * overwrite the winning receipt.
   */
  createInquiryOrReadExisting(input: {
    request_binding: SchoolInquiryRequestBinding;
    request: CanonicalSchoolInquiry;
    receipt: SchoolInquiryReceipt;
  }): Promise<
    | { disposition: 'created'; receipt: SchoolInquiryReceipt }
    | { disposition: 'existing'; receipt: SchoolInquiryReceipt }
  >;
  findApprovedSchoolByIdempotencyKey(input: {
    scope: SchoolSignupScope;
    operation: typeof APPROVED_SCHOOL_CONFIGURATION_OPERATION;
    idempotency_key: string;
  }): Promise<ApprovedSchoolRecord | null>;
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
  readApprovedSchool(input: {
    scope: SchoolSignupScope;
    operation: typeof APPROVED_SCHOOL_CONFIGURATION_OPERATION;
    approved_school_id: string;
  }): Promise<ApprovedSchoolRecord | null>;
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
        if (!plan.local_write_required) return plan.result;
        const persisted = await transaction.createInquiryOrReadExisting({
          request_binding: canonical.request_binding,
          request: canonical.request,
          receipt: plan.receipt,
        });
        const validated = planSchoolInquiry({
          scope: input.scope,
          command: input.command,
          request_binding: canonical.request_binding,
          canonical_request: canonical.request,
          proposed_lead_id: '',
          existing_receipt: persisted.receipt,
        });
        return {
          ...validated.result,
          disposition: persisted.disposition === 'created' ? 'created' : 'deduplicated',
        };
      });
    },

    async configureApprovedSchool(input: {
      actor: SchoolConfigurationActor;
      authorized_at: string;
      command: ApprovedSchoolConfigurationCommand;
    }): Promise<ApprovedSchoolConfigurationResult> {
      const canonical = canonicalizeApprovedSchoolConfiguration(input);
      return dependencies.repository.transaction(async (transaction) => {
        const scope = canonical.authorization.scope;
        const replay = await transaction.findApprovedSchoolByIdempotencyKey({
          scope,
          operation: APPROVED_SCHOOL_CONFIGURATION_OPERATION,
          idempotency_key: canonical.request_binding.idempotency_key,
        });
        if (replay) {
          return configurationResult(
            'replayed',
            validateApprovedSchoolConfigurationReplay(canonical, replay),
          );
        }
        const current = await transaction.readApprovedSchoolForUpdate({
          scope,
          operation: APPROVED_SCHOOL_CONFIGURATION_OPERATION,
          approved_school_id: canonical.command.approved_school_id,
        });
        const configuration = planApprovedSchoolConfiguration({
          canonical,
          approved_school: current,
        });
        await transaction.commitApprovedSchoolConfiguration({
          scope,
          operation: APPROVED_SCHOOL_CONFIGURATION_OPERATION,
          configuration,
        });
        const readback = await transaction.readApprovedSchool({
          scope,
          operation: APPROVED_SCHOOL_CONFIGURATION_OPERATION,
          approved_school_id: configuration.approved_school_id,
        });
        if (!readback) throw new Error('Approved School configuration readback was missing.');
        return configurationResult(
          current ? 'updated' : 'created',
          validateApprovedSchoolConfigurationReadback(configuration, readback),
        );
      });
    },

    async readApprovedSchool(input: {
      actor: SchoolConfigurationActor;
      approved_school_id: string;
    }): Promise<ApprovedSchoolConfiguration | null> {
      if (input.actor.role !== 'admin') return null;
      const scope: SchoolSignupScope = {
        product: input.actor.product,
        runtime_tier: input.actor.runtime_tier,
        verification_environment_id: input.actor.verification_environment_id,
      };
      return dependencies.repository.transaction(async (transaction) => {
        const record = await transaction.readApprovedSchool({
          scope,
          operation: APPROVED_SCHOOL_CONFIGURATION_OPERATION,
          approved_school_id: input.approved_school_id,
        });
        if (!record) return null;
        return validateApprovedSchoolConfigurationReplay(
          {
            authorization: {
              scope,
              authorized_by_human_account_id: record.authorized_by_human_account_id,
              authorized_at: record.authorized_at,
            },
            request_binding: record.request_binding,
            command: {
              approved_school_id: record.approved_school_id,
              adult_account_manager_id: record.adult_account_manager_id,
              household_id: record.household_id,
              seat_allowance: record.seat_allowance,
              price_minor_units: record.price_minor_units,
              currency: record.currency,
              billing_starts_at: record.billing_starts_at,
              terms_reference: record.terms_reference,
              immutable_contract_reference: record.immutable_contract_reference,
              authorization_reason: record.authorization_reason,
              idempotency_key: record.request_binding.idempotency_key,
              expected_configuration_version: record.expected_prior_version,
              audit_ref: record.audit_ref,
            },
          },
          record,
        );
      });
    },
  };
}

function configurationResult(
  disposition: ApprovedSchoolConfigurationResult['disposition'],
  configuration: ApprovedSchoolConfiguration,
): ApprovedSchoolConfigurationResult {
  return {
    disposition,
    configuration,
    provider_effects_completed_inline: 0,
    product_accounts_created: 0,
    households_created: 0,
    student_accounts_created: 0,
    access_grants_created: 0,
    subscriptions_created: 0,
    nurture_workflow_intent_ids: [],
  };
}
