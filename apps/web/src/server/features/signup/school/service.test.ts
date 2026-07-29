import { describe, expect, it, vi } from 'vitest';
import {
  APPROVED_SCHOOL_CONFIGURATION_OPERATION,
  SCHOOL_INQUIRY_OPERATION,
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
  phone: null,
  note: null,
});

describe('P09 School signup service', () => {
  it('commits one local manual-sales lead and acknowledgment with no access or nurture', async () => {
    const commits: SchoolInquiryReceipt[] = [];
    const service = createSchoolSignupService({
      repository: repositoryFor({
        commitInquiry: async ({ receipt }) => {
          commits.push(receipt);
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
        sales_state: 'pending_manual_follow_up',
        product_access_granted: false,
      },
      acknowledgment: {
        kind: 'school_inquiry_acknowledgment',
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
        commitInquiry: async ({ receipt }) => {
          writes += 1;
          stored = receipt;
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

  it('persists explicit approved-school terms only after an exact Admin approval match', async () => {
    const committed = vi.fn();
    const service = createSchoolSignupService({
      repository: repositoryFor({
        readApprovedSchoolForUpdate: async () => approvedSchool(),
        commitApprovedSchoolConfiguration: committed,
      }),
      allocateLeadId: () => 'unused',
    });
    await expect(
      service.configureApprovedSchool({
        actor: { ...scope, role: 'admin', human_account_id: 'admin-1' },
        command: configurationCommand(),
      }),
    ).resolves.toMatchObject({
      account_model: 'parent_student',
      adult_account_manager_role: 'parent',
      student_account_role: 'student',
      school_role_created: false,
      school_portal_created: false,
      bulk_roster_created: false,
      automated_nurture_created: false,
    });
    expect(committed).toHaveBeenCalledWith(
      expect.objectContaining({
        scope,
        operation: APPROVED_SCHOOL_CONFIGURATION_OPERATION,
      }),
    );
  });

  it('performs no configuration write for a pending School or Parent caller', async () => {
    for (const invalid of [
      {
        actor: { ...scope, role: 'parent' as const, human_account_id: 'parent-1' },
        record: approvedSchool(),
      },
      {
        actor: { ...scope, role: 'admin' as const, human_account_id: 'admin-1' },
        record: { ...approvedSchool(), approval_state: 'pending' as const },
      },
    ]) {
      const commit = vi.fn();
      const service = createSchoolSignupService({
        repository: repositoryFor({
          readApprovedSchoolForUpdate: async () => invalid.record,
          commitApprovedSchoolConfiguration: commit,
        }),
        allocateLeadId: () => 'unused',
      });
      await expect(
        service.configureApprovedSchool({
          actor: invalid.actor,
          command: configurationCommand(),
        }),
      ).rejects.toThrow(/configuration/u);
      expect(commit).not.toHaveBeenCalled();
    }
  });
});

function repositoryFor(overrides: Partial<SchoolSignupTransaction>): SchoolSignupRepository {
  return {
    transaction: async (run) =>
      run({
        findInquiry: async () => null,
        commitInquiry: async () => undefined,
        readApprovedSchoolForUpdate: async () => null,
        commitApprovedSchoolConfiguration: async () => undefined,
        ...overrides,
      }),
  };
}

function approvedSchool(): ApprovedSchoolRecord {
  return {
    scope,
    approved_school_id: 'approved-school-1',
    approval_state: 'approved',
    adult_account_manager_id: 'adult-manager-1',
    household_id: 'household-1',
    configuration_version: 3,
  };
}

function configurationCommand(): ApprovedSchoolConfigurationCommand {
  return {
    approved_school_id: 'approved-school-1',
    adult_account_manager_id: 'adult-manager-1',
    household_id: 'household-1',
    seat_allowance: 75,
    price_minor_units: 125_000,
    currency: 'USD',
    billing_starts_at: '2026-09-01T00:00:00.000Z',
    terms_reference: 'terms/school-2026-v1',
    expected_configuration_version: 3,
  };
}
