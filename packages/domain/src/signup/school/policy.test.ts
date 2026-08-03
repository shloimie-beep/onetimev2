import { describe, expect, it } from 'vitest';
import type {
  ApprovedSchoolConfigurationCommand,
  ApprovedSchoolRecord,
  SchoolInquiryCommand,
  SchoolSignupScope,
} from '../../../../contracts/src/signup/school/index.ts';
import {
  SCHOOL_INQUIRY_ACKNOWLEDGMENT_CONTENT_DIGEST,
  SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE,
} from '../../../../contracts/src/signup/school/index.ts';
import {
  canonicalizeApprovedSchoolConfiguration,
  canonicalizeSchoolInquiry,
  planApprovedSchoolConfiguration,
  planSchoolInquiry,
  validateApprovedSchoolConfigurationReadback,
  validateApprovedSchoolConfigurationReplay,
} from './policy.ts';

const scope: SchoolSignupScope = {
  product: 'one_time_mishnayos',
  runtime_tier: 'isolated_staging',
  verification_environment_id: 'ci',
};
const command = (): SchoolInquiryCommand => ({
  school_name: '  Yeshiva One ',
  contact_first_name: ' Ari ',
  contact_last_name: ' Levi ',
  email: ' ARI@Example.com ',
  phone: null,
  note: null,
});

describe('P09 School inquiry and approved-school policy', () => {
  it('creates only a manual adult sales lead and one durable acknowledgment', () => {
    const canonical = canonicalizeSchoolInquiry(scope, command());
    const plan = planSchoolInquiry({
      scope,
      command: command(),
      request_binding: canonical.request_binding,
      canonical_request: canonical.request,
      proposed_lead_id: 'school-lead-1',
      existing_receipt: null,
    });
    expect(plan.receipt.lead).toMatchObject({
      adult_contact_kind: 'adult',
      normalized_email: 'ari@example.com',
      sales_state: 'pending_manual_follow_up',
      product_account_created: false,
      parent_login_created: false,
      passwordless_claim_created: false,
      household_created: false,
      student_accounts_created: 0,
      subscription_created: false,
      product_access_granted: false,
    });
    expect(plan.receipt.acknowledgment).toMatchObject({
      kind: 'school_inquiry_acknowledgment',
      notification: {
        ...SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE,
        content_digest: SCHOOL_INQUIRY_ACKNOWLEDGMENT_CONTENT_DIGEST,
      },
      delivery_state: 'pending',
      local_commit_required: true,
    });
    expect(plan.result).toMatchObject({
      disposition: 'created',
      provider_effects_completed_inline: 0,
      product_accounts_created: 0,
      subscriptions_created: 0,
      access_grants_created: 0,
      nurture_workflow_intent_ids: [],
    });
  });

  it('accepts exactly four required fields and canonicalizes absent optionals to null', () => {
    const minimum: SchoolInquiryCommand = {
      school_name: 'Yeshiva One',
      contact_first_name: 'Ari',
      contact_last_name: 'Levi',
      email: 'ari@example.com',
    };
    expect(canonicalizeSchoolInquiry(scope, minimum).request).toEqual({
      school_name: 'Yeshiva One',
      contact_first_name: 'Ari',
      contact_last_name: 'Levi',
      normalized_email: 'ari@example.com',
      phone: null,
      note: null,
    });
    for (const required of ['school_name', 'contact_first_name', 'contact_last_name', 'email']) {
      const missing = { ...minimum } as Record<string, unknown>;
      delete missing[required];
      expect(() =>
        canonicalizeSchoolInquiry(scope, missing as unknown as SchoolInquiryCommand),
      ).toThrow('invalid_school_inquiry');
    }
    expect(() =>
      canonicalizeSchoolInquiry(scope, {
        ...minimum,
        unexpected: 'rejected',
      } as unknown as SchoolInquiryCommand),
    ).toThrow('invalid_school_inquiry');
  });

  it('rejects replay when the durable acknowledgment template binding drifts', () => {
    const canonical = canonicalizeSchoolInquiry(scope, command());
    const created = planSchoolInquiry({
      scope,
      command: command(),
      request_binding: canonical.request_binding,
      canonical_request: canonical.request,
      proposed_lead_id: 'school-lead-1',
      existing_receipt: null,
    });
    expect(() =>
      planSchoolInquiry({
        scope,
        command: command(),
        request_binding: canonical.request_binding,
        canonical_request: canonical.request,
        proposed_lead_id: 'unused',
        existing_receipt: {
          ...created.receipt,
          acknowledgment: {
            ...created.receipt.acknowledgment,
            notification: {
              ...created.receipt.acknowledgment.notification,
              template_version: 'stale',
            } as unknown as typeof created.receipt.acknowledgment.notification,
          },
        },
      }),
    ).toThrow('school_inquiry_conflict');
  });

  it('deduplicates an exact normalized-email retry and rejects changed or extra fields', () => {
    const canonical = canonicalizeSchoolInquiry(scope, command());
    const created = planSchoolInquiry({
      scope,
      command: command(),
      request_binding: canonical.request_binding,
      canonical_request: canonical.request,
      proposed_lead_id: 'school-lead-1',
      existing_receipt: null,
    });
    const retry = planSchoolInquiry({
      scope,
      command: { ...command(), email: 'ari@example.com' },
      request_binding: canonical.request_binding,
      canonical_request: canonical.request,
      proposed_lead_id: 'unused',
      existing_receipt: created.receipt,
    });
    expect(retry.result.disposition).toBe('deduplicated');
    expect(retry.local_write_required).toBe(false);

    const changed = canonicalizeSchoolInquiry(scope, {
      ...command(),
      school_name: 'Different School',
    });
    expect(() =>
      planSchoolInquiry({
        scope,
        command: { ...command(), school_name: 'Different School' },
        request_binding: changed.request_binding,
        canonical_request: changed.request,
        proposed_lead_id: 'unused',
        existing_receipt: created.receipt,
      }),
    ).toThrow('school_inquiry_conflict');
    const extra = { ...command(), password: 'forbidden' };
    expect(() => canonicalizeSchoolInquiry(scope, extra as SchoolInquiryCommand)).toThrow(
      'invalid_school_inquiry',
    );
  });

  it('configures explicit approved-school allowance and terms on Parent/Student accounts', () => {
    const canonical = canonicalConfiguration();
    const configuration = planApprovedSchoolConfiguration({
      canonical,
      approved_school: approvedSchool(),
    });
    expect(configuration).toMatchObject({
      seat_allowance: 75,
      price_minor_units: 125_000,
      currency: 'USD',
      terms_reference: 'terms/school-2026-v1',
      configuration_version: 4,
      expected_prior_version: 3,
      authorized_by_human_account_id: 'admin-1',
      audit_ref: 'approved-school:school-config-4',
      account_model: 'parent_student',
      adult_account_manager_role: 'parent',
      student_account_role: 'student',
      school_role_created: false,
      school_portal_created: false,
      bulk_roster_created: false,
      automated_nurture_created: false,
    });
  });

  it('fails closed on role, approval, scope, identity, and configuration-version mismatches', () => {
    expect(() =>
      canonicalizeApprovedSchoolConfiguration({
        actor: { ...scope, role: 'parent', human_account_id: 'parent-1' },
        authorized_at: '2026-07-31T14:00:00.000Z',
        command: configurationCommand(),
      }),
    ).toThrow('school_configuration_denied');
    expect(() =>
      canonicalizeApprovedSchoolConfiguration({
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
    ).toThrow('school_configuration_denied');
    for (const command of [
      { ...configurationCommand(), household_id: 'different-household' },
      { ...configurationCommand(), expected_configuration_version: 2 },
      { ...configurationCommand(), immutable_contract_reference: 'contract/different' },
    ]) {
      expect(() =>
        planApprovedSchoolConfiguration({
          canonical: canonicalConfiguration(command),
          approved_school: approvedSchool(),
        }),
      ).toThrow('school_configuration_mismatch');
    }
  });

  it('creates version one, accepts exact replay, and rejects a reused key with another hash', () => {
    const canonical = canonicalConfiguration({ expected_configuration_version: 0 });
    const created = planApprovedSchoolConfiguration({ canonical, approved_school: null });
    expect(created).toMatchObject({
      expected_prior_version: 0,
      configuration_version: 1,
      created_at: '2026-07-31T14:00:00.000Z',
      updated_at: '2026-07-31T14:00:00.000Z',
    });
    expect(validateApprovedSchoolConfigurationReadback(created, recordOf(created))).toEqual(
      created,
    );
    expect(validateApprovedSchoolConfigurationReplay(canonical, recordOf(created))).toEqual(
      created,
    );
    const mismatch = canonicalConfiguration({
      expected_configuration_version: 0,
      seat_allowance: 76,
    });
    expect(() => validateApprovedSchoolConfigurationReplay(mismatch, recordOf(created))).toThrow(
      'school_configuration_mismatch',
    );
  });
});

function approvedSchool(): ApprovedSchoolRecord {
  return {
    request_binding: {
      scope,
      operation: 'admin_approved_school_configuration',
      idempotency_key: 'school-config-3',
      canonical_request_hash: 'a'.repeat(64),
    },
    approved_school_id: 'approved-school-1',
    adult_account_manager_id: 'adult-manager-1',
    household_id: 'household-1',
    seat_allowance: 50,
    price_minor_units: 100_000,
    currency: 'USD',
    billing_starts_at: '2026-08-01T00:00:00.000Z',
    terms_reference: 'terms/school-2025-v1',
    immutable_contract_reference: 'contract/school-1',
    authorization_reason: 'Initial approval',
    authorized_by_human_account_id: 'admin-1',
    authorized_at: '2026-07-01T00:00:00.000Z',
    expected_prior_version: 2,
    configuration_version: 3,
    audit_ref: 'approved-school:school-config-3',
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
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

function canonicalConfiguration(overrides: Partial<ApprovedSchoolConfigurationCommand> = {}) {
  return canonicalizeApprovedSchoolConfiguration({
    actor: { ...scope, role: 'admin', human_account_id: 'admin-1' },
    authorized_at: '2026-07-31T14:00:00.000Z',
    command: configurationCommand(overrides),
  });
}

function recordOf(configuration: ReturnType<typeof planApprovedSchoolConfiguration>) {
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
