export const LEGACY_IMPORT_PROHIBITED_FIELDS = [
  'access',
  'access_grants',
  'attendance',
  'billing',
  'child',
  'child_profiles',
  'class_enrollments',
  'consent',
  'credentials',
  'login_codes',
  'parent_account',
  'password',
  'password_hash',
  'payment_status',
  'progress',
  'session',
  'sessions',
  'student',
  'student_accounts',
  'student_credentials',
  'tisha_event_consent',
  'tokens',
] as const;

const PROHIBITED_FIELD_SET = new Set<string>(LEGACY_IMPORT_PROHIBITED_FIELDS);

export type LegacyAdultSource = {
  email: string;
  displayEmail?: string | undefined;
  adultName?: string | undefined;
  adultPhone?: string | undefined;
  verifiedGhlContactId?: string | undefined;
  provenance: string;
  lifecycle:
    | 'eligible_service_migration'
    | 'marketing_with_separate_consent'
    | 'former_reactivation_review'
    | 'suppressed_denied'
    | 'identity_permission_review';
  explicitGeneralMarketingConsent?: boolean | undefined;
  suppressed?: boolean | undefined;
};

export type LegacyAdultReregistrationPlan = {
  normalizedEmail: string;
  localAccountAction: 'sign_up_again' | 'sign_in_or_reset';
  crmProjection:
    | { action: 'reuse_verified_link'; ghlContactId: string }
    | { action: 'update_exact_match'; ghlContactId: string }
    | { action: 'create_adult_contact_after_local_commit' }
    | { action: 'identity_review'; reason: 'ambiguous_exact_email' | 'conflicting_identifiers' }
    | { action: 'suppressed_no_campaign' };
  imports: {
    adultCrmContinuityOnly: true;
    password: false;
    sessions: false;
    parentOrStudentAccounts: false;
    childProfiles: false;
    billingOrPaymentState: false;
    productAccess: false;
    inferredConsent: false;
  };
};

export function normalizeAdultEmail(value: string): string {
  const normalized = value.trim().normalize('NFKC').toLowerCase();
  if (
    normalized.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized) ||
    normalized.split('@').length !== 2
  ) {
    throw new Error('A single syntactically valid adult email is required.');
  }
  return normalized;
}

export function assertLegacyImportBoundary(value: unknown): void {
  inspect(value, []);
}

export function planLegacyAdultReregistration(input: {
  source: LegacyAdultSource;
  activeLocalAdultExists: boolean;
  exactNormalizedEmailGhlContactIds: readonly string[];
  providerIdentifiersConflict: boolean;
}): LegacyAdultReregistrationPlan {
  assertLegacyImportBoundary(input.source);
  const normalizedEmail = normalizeAdultEmail(input.source.email);
  const localAccountAction = input.activeLocalAdultExists ? 'sign_in_or_reset' : 'sign_up_again';

  let crmProjection: LegacyAdultReregistrationPlan['crmProjection'];
  if (input.source.suppressed || input.source.lifecycle === 'suppressed_denied') {
    crmProjection = { action: 'suppressed_no_campaign' };
  } else if (input.providerIdentifiersConflict) {
    crmProjection = { action: 'identity_review', reason: 'conflicting_identifiers' };
  } else if (input.source.verifiedGhlContactId) {
    crmProjection = {
      action: 'reuse_verified_link',
      ghlContactId: requireProviderId(input.source.verifiedGhlContactId),
    };
  } else if (input.exactNormalizedEmailGhlContactIds.length === 1) {
    crmProjection = {
      action: 'update_exact_match',
      ghlContactId: requireProviderId(input.exactNormalizedEmailGhlContactIds[0] ?? ''),
    };
  } else if (input.exactNormalizedEmailGhlContactIds.length > 1) {
    crmProjection = { action: 'identity_review', reason: 'ambiguous_exact_email' };
  } else {
    crmProjection = { action: 'create_adult_contact_after_local_commit' };
  }

  return {
    normalizedEmail,
    localAccountAction,
    crmProjection,
    imports: {
      adultCrmContinuityOnly: true,
      password: false,
      sessions: false,
      parentOrStudentAccounts: false,
      childProfiles: false,
      billingOrPaymentState: false,
      productAccess: false,
      inferredConsent: false,
    },
  };
}

function inspect(value: unknown, path: readonly string[]): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => inspect(entry, [...path, String(index)]));
    return;
  }
  if (!value || typeof value !== 'object') return;

  for (const [key, entry] of Object.entries(value)) {
    const normalizedKey = key.trim().toLowerCase().replaceAll('-', '_');
    if (PROHIBITED_FIELD_SET.has(normalizedKey)) {
      throw new Error(`Prohibited legacy import field: ${[...path, key].join('.')}`);
    }
    inspect(entry, [...path, key]);
  }
}

function requireProviderId(value: string): string {
  const id = value.trim();
  if (!/^[a-z0-9][a-z0-9_-]{2,159}$/iu.test(id)) {
    throw new Error('A reviewed non-secret provider contact ID is required.');
  }
  return id;
}
