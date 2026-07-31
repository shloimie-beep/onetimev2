import { describe, expect, it, vi } from 'vitest';
import {
  APPROVED_SCHOOL_CONFIGURATION_OPERATION,
  SCHOOL_INQUIRY_ACKNOWLEDGMENT_CONTENT_DIGEST,
  SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE,
  SCHOOL_INQUIRY_OPERATION,
  type ApprovedSchoolConfiguration,
  type ApprovedSchoolConfigurationCommand,
  type ApprovedSchoolRecord,
  type SchoolInquiryCommand,
  type SchoolInquiryReceipt,
  type SchoolSignupScope,
} from '../../../../../../../packages/contracts/src/signup/school/index.ts';
import {
  createSchoolSignupService,
  type SchoolSignupRepository,
  type SchoolSignupTransaction,
} from './service.ts';
import { canonicalizeApprovedSchoolConfiguration } from '../../../../../../../packages/domain/src/signup/school/index.ts';

const scope: SchoolSignupScope = {
  product: 'one_time_mishnayos',
  runtime_tier: 'isolated_staging',
  verification_environment_id: 'ci',
};
const command = (): SchoolInquiryCommand => ({
  school_name: 'Yeshiva One',
  contact_first_name: 'Ari',
  contact_last_name: 'Levi',
  email: ' Ari@Example.com ',
});

describe('P09 School signup service', () => {
  it('commits one local manual-sales lead and acknowledgment with no access or nurture', async () => {
    const commits: SchoolInquiryReceipt[] = [];
    const service = createSchoolSignupService({
      repository: repositoryFor({
        createInquiryOrReadExisting: async ({ receipt }) => {
          commits.push(receipt);
          return { disposition: 'created', receipt };
        },
      }),
      allocateLeadId: () => 'school-lead-1',
    });
    const result = await service.submitInquiry({ scope, command: command() });
    expect(result).toMatchObject({
      disposition: 'created',
      sales_state: 'pending_manual_follow_up',
      provider_effects_completed_inline: 0,
      product_accounts_created: 0,
      households_created: 0,
      student_accounts_created: 0,
      subscriptions_created: 0,
      access_grants_created: 0,
      nurture_workflow_intent_ids: [],
    });
    expect(commits).toHaveLength(1);
    expect(commits[0]).toMatchObject({
      request_binding: {
        operation: SCHOOL_INQUIRY_OPERATION,
        normalized_email: 'ari@example.com',
      },
      lead: {
        adult_contact_kind: 'adult',
        phone: null,
        note: null,
        sales_state: 'pending_manual_follow_up',
        product_access_granted: false,
      },
      acknowledgment: {
        kind: 'school_inquiry_acknowledgment',
        notification: {
          ...SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE,
          content_digest: SCHOOL_INQUIRY_ACKNOWLEDGMENT_CONTENT_DIGEST,
        },
        delivery_state: 'pending',
      },
    });
  });

  it('deduplicates an exact normalized-email retry without allocating or writing', async () => {
    let stored: SchoolInquiryReceipt | null = null;
    let allocations = 0;
    let writes = 0;
    const service = createSchoolSignupService({
      repository: repositoryFor({
        findInquiry: async () => stored,
        createInquiryOrReadExisting: async ({ receipt }) => {
          writes += 1;
          stored = receipt;
          return { disposition: 'created', receipt };
        },
      }),
      allocateLeadId: () => {
        allocations += 1;
        return 'school-lead-1';
      },
    });
    await expect(service.submitInquiry({ scope, command: command() })).resolves.toMatchObject({
      disposition: 'created',
    });
    await expect(
      service.submitInquiry({
        scope,
        command: { ...command(), email: 'ari@example.com' },
      }),
    ).resolves.toMatchObject({ disposition: 'deduplicated' });
    expect({ allocations, writes }).toEqual({ allocations: 1, writes: 1 });
  });

  it('recovers the normalized-email uniqueness race with one lead and acknowledgment', async () => {
    let stored: SchoolInquiryReceipt | null = null;
    let persisted = 0;
    let allocations = 0;
    const repository = repositoryFor({
      findInquiry: async () => null,
      createInquiryOrReadExisting: async ({ receipt }) => {
        await Promise.resolve();
        if (stored) return { disposition: 'existing', receipt: stored };
        stored = receipt;
        persisted += 1;
        return { disposition: 'created', receipt };
      },
    });
    const service = createSchoolSignupService({
      repository,
      allocateLeadId: () => {
        allocations += 1;
        return `school-lead-${allocations}`;
      },
    });

    const results = await Promise.all([
      service.submitInquiry({ scope, command: command() }),
      service.submitInquiry({
        scope,
        command: { ...command(), email: 'ari@example.com' },
      }),
    ]);

    expect(results.map((result) => result.disposition).sort()).toEqual(['created', 'deduplicated']);
    expect(persisted).toBe(1);
    expect(stored).not.toBeNull();
    expect(new Set(results.map((result) => result.acknowledgment_intent_id)).size).toBe(1);
  });

  it('persists explicit approved-school terms only after an exact Admin approval match', async () => {
    let committed: ApprovedSchoolConfiguration | null = null;
    const service = createSchoolSignupService({
      repository: repositoryFor({
        readApprovedSchoolForUpdate: async () => approvedSchool(),
        commitApprovedSchoolConfiguration: async ({ configuration }) => {
          committed = configuration;
        },
        readApprovedSchool: async () => (committed ? recordOf(committed) : null),
      }),
      allocateLeadId: () => 'unused',
    });
    await expect(
      service.configureApprovedSchool({
        actor: { ...scope, role: 'admin', human_account_id: 'admin-1' },
        authorized_at: '2026-07-31T14:00:00.000Z',
        command: configurationCommand(),
      }),
    ).resolves.toMatchObject({
      disposition: 'updated',
      configuration: {
        account_model: 'parent_student',
        adult_account_manager_role: 'parent',
        student_account_role: 'student',
        school_role_created: false,
        school_portal_created: false,
        bulk_roster_created: false,
        automated_nurture_created: false,
      },
      provider_effects_completed_inline: 0,
    });
    expect(committed).toMatchObject({
      request_binding: { scope, operation: APPROVED_SCHOOL_CONFIGURATION_OPERATION },
      configuration_version: 4,
    });
  });

  it('returns exact idempotency replay and rejects same-key hash mismatch with zero writes', async () => {
    const existing = approvedSchool();
    const commit = vi.fn();
    const service = createSchoolSignupService({
      repository: repositoryFor({
        findApprovedSchoolByIdempotencyKey: async () => existing,
        commitApprovedSchoolConfiguration: commit,
      }),
      allocateLeadId: () => 'unused',
    });
    const replayCommand = commandForRecord(existing);
    const replay = await service.configureApprovedSchool({
      actor: { ...scope, role: 'admin', human_account_id: 'admin-1' },
      authorized_at: '2026-07-31T15:00:00.000Z',
      command: replayCommand,
    });
    expect(replay).toMatchObject({ disposition: 'replayed', configuration: existing });
    await expect(
      service.configureApprovedSchool({
        actor: { ...scope, role: 'admin', human_account_id: 'admin-1' },
        authorized_at: '2026-07-31T15:01:00.000Z',
        command: { ...replayCommand, seat_allowance: replayCommand.seat_allowance + 1 },
      }),
    ).rejects.toThrow('school_configuration_mismatch');
    expect(commit).not.toHaveBeenCalled();
  });

  it('denies Parent and production_read_only callers before opening a repository transaction', async () => {
    const transaction = vi.fn();
    const service = createSchoolSignupService({
      repository: { transaction },
      allocateLeadId: () => 'unused',
    });
    await expect(
      service.configureApprovedSchool({
        actor: { ...scope, role: 'parent', human_account_id: 'parent-1' },
        authorized_at: '2026-07-31T14:00:00.000Z',
        command: configurationCommand(),
      }),
    ).rejects.toThrow('school_configuration_denied');
    await expect(
      service.configureApprovedSchool({
        actor: {
          product: 'one_time_mishnayos',
          runtime_tier: 'production',
          verification_environment_id: 'production_read_only',
          role: 'admin',
          human_account_id: 'admin-1',
        },
        authorized_at: '2026-07-31T14:00:00.000Z',
        command: configurationCommand(),
      }),
    ).rejects.toThrow('school_configuration_denied');
    expect(transaction).not.toHaveBeenCalled();
  });
});

function repositoryFor(overrides: Partial<SchoolSignupTransaction>): SchoolSignupRepository {
  return {
    transaction: async (run) =>
      run({
        findInquiry: async () => null,
        createInquiryOrReadExisting: async ({ receipt }) => ({
          disposition: 'created',
          receipt,
        }),
        findApprovedSchoolByIdempotencyKey: async () => null,
        readApprovedSchoolForUpdate: async () => null,
        commitApprovedSchoolConfiguration: async () => undefined,
        readApprovedSchool: async () => null,
        ...overrides,
      }),
  };
}

function approvedSchool(): ApprovedSchoolRecord {
  const command = configurationCommand({
    seat_allowance: 50,
    price_minor_units: 100_000,
    billing_starts_at: '2026-08-01T00:00:00.000Z',
    terms_reference: 'terms/school-2025-v1',
    authorization_reason: 'Initial approved School terms',
    idempotency_key: 'school-config-3',
    expected_configuration_version: 2,
    audit_ref: 'approved-school:school-config-3',
  });
  const canonicalHash = canonicalHashFor(command);
  return {
    request_binding: {
      scope,
      operation: APPROVED_SCHOOL_CONFIGURATION_OPERATION,
      idempotency_key: command.idempotency_key,
      canonical_request_hash: canonicalHash,
    },
    approved_school_id: 'approved-school-1',
    adult_account_manager_id: 'adult-manager-1',
    household_id: 'household-1',
    seat_allowance: command.seat_allowance,
    price_minor_units: command.price_minor_units,
    currency: 'USD',
    billing_starts_at: command.billing_starts_at,
    terms_reference: command.terms_reference,
    immutable_contract_reference: 'contract/school-1',
    authorization_reason: command.authorization_reason,
    authorized_by_human_account_id: 'admin-1',
    authorized_at: '2026-07-31T14:00:00.000Z',
    expected_prior_version: 2,
    configuration_version: 3,
    audit_ref: command.audit_ref,
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-07-31T14:00:00.000Z',
  };
}

function configurationCommand(
  overrides: Partial<ApprovedSchoolConfigurationCommand> = {},
): ApprovedSchoolConfigurationCommand {
  return {
    approved_school_id: 'approved-school-1',
    adult_account_manager_id: 'adult-manager-1',
    household_id: 'household-1',
    seat_allowance: 75,
    price_minor_units: 125_000,
    currency: 'USD',
    billing_starts_at: '2026-09-01T00:00:00.000Z',
    terms_reference: 'terms/school-2026-v1',
    immutable_contract_reference: 'contract/school-1',
    authorization_reason: 'Renewed approved School terms',
    idempotency_key: 'school-config-4',
    expected_configuration_version: 3,
    audit_ref: 'approved-school:school-config-4',
    ...overrides,
  };
}

function recordOf(configuration: ApprovedSchoolConfiguration): ApprovedSchoolRecord {
  return {
    request_binding: configuration.request_binding,
    approved_school_id: configuration.approved_school_id,
    adult_account_manager_id: configuration.adult_account_manager_id,
    household_id: configuration.household_id,
    seat_allowance: configuration.seat_allowance,
    price_minor_units: configuration.price_minor_units,
    currency: configuration.currency,
    billing_starts_at: configuration.billing_starts_at,
    terms_reference: configuration.terms_reference,
    immutable_contract_reference: configuration.immutable_contract_reference,
    authorization_reason: configuration.authorization_reason,
    authorized_by_human_account_id: configuration.authorized_by_human_account_id,
    authorized_at: configuration.authorized_at,
    expected_prior_version: configuration.expected_prior_version,
    configuration_version: configuration.configuration_version,
    audit_ref: configuration.audit_ref,
    created_at: configuration.created_at,
    updated_at: configuration.updated_at,
  };
}

function commandForRecord(record: ApprovedSchoolRecord): ApprovedSchoolConfigurationCommand {
  return {
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
  };
}

function canonicalHashFor(command: ApprovedSchoolConfigurationCommand): string {
  return canonicalizeApprovedSchoolConfiguration({
    actor: { ...scope, role: 'admin', human_account_id: 'admin-1' },
    authorized_at: '2026-07-31T14:00:00.000Z',
    command,
  }).request_binding.canonical_request_hash;
}
