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
  canonicalizeSchoolInquiry,
  planApprovedSchoolConfiguration,
  planSchoolInquiry,
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
    const configuration = planApprovedSchoolConfiguration({
      actor: { ...scope, role: 'admin', human_account_id: 'admin-1' },
      command: configurationCommand(),
      approved_school: approvedSchool(),
    });
    expect(configuration).toMatchObject({
      seat_allowance: 75,
      price_minor_units: 125_000,
      currency: 'USD',
      terms_reference: 'terms/school-2026-v1',
      configuration_version: 4,
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
    const base = {
      actor: { ...scope, role: 'admin' as const, human_account_id: 'admin-1' },
      command: configurationCommand(),
      approved_school: approvedSchool(),
    };
    for (const invalid of [
      { ...base, actor: { ...base.actor, role: 'parent' as const } },
      {
        ...base,
        approved_school: { ...approvedSchool(), approval_state: 'pending' as const },
      },
      {
        ...base,
        approved_school: {
          ...approvedSchool(),
          scope: { ...scope, verification_environment_id: 'provider_sandbox' as const },
        },
      },
      {
        ...base,
        command: { ...configurationCommand(), household_id: 'different-household' },
      },
      {
        ...base,
        command: { ...configurationCommand(), expected_configuration_version: 2 },
      },
    ]) {
      expect(() => planApprovedSchoolConfiguration(invalid)).toThrow(/configuration/u);
    }
  });
});

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
