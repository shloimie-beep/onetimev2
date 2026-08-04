import { createHash } from 'node:crypto';

export type GovernedCensusSha256 = string & { readonly __governedCensusSha256: unique symbol };
export type GovernedCensusDecision = 'include' | 'exclude' | 'review';
export type GovernedCensusReason =
  | 'eligible_inactive_adult'
  | 'active_or_current_subscriber'
  | 'student_or_minor'
  | 'school_contact'
  | 'duplicate_contact'
  | 'missing_email'
  | 'invalid_email'
  | 'email_dnd_or_unsubscribed'
  | 'provider_suppression'
  | 'ambiguous_identity'
  | 'unknown_consent';

export interface GovernedCensusSourceFacts {
  adultEvidenceState: 'proven' | 'not_proven' | 'conflicting';
  studentOrMinorState: 'absent' | 'present' | 'unknown';
  schoolContactState: 'absent' | 'present' | 'unknown';
  activeOrCurrentSubscriberState: 'absent' | 'present' | 'unknown';
  consentState: 'opted_in' | 'opted_out' | 'unknown';
  deliverabilityState: 'deliverable' | 'invalid' | 'missing' | 'unknown';
  providerSuppressionState: 'active' | 'suppressed' | 'unknown';
  identityMatchState: 'exact' | 'duplicate' | 'ambiguous' | 'missing';
  sourceJoinCount: number;
  sourceFactsHash: GovernedCensusSha256;
}

export interface ProtectedGovernedCensusProviderContact {
  providerContactRefHash: GovernedCensusSha256;
  normalizedEmailHash: GovernedCensusSha256 | null;
  consentState: GovernedCensusSourceFacts['consentState'];
  deliverabilityState: GovernedCensusSourceFacts['deliverabilityState'];
  providerSuppressionState: GovernedCensusSourceFacts['providerSuppressionState'];
}

export interface GovernedCensusDatabaseFacts {
  providerContactRefHash: GovernedCensusSha256;
  contactKey: string | null;
  adultEvidenceState: GovernedCensusSourceFacts['adultEvidenceState'];
  studentOrMinorState: GovernedCensusSourceFacts['studentOrMinorState'];
  schoolContactState: GovernedCensusSourceFacts['schoolContactState'];
  activeOrCurrentSubscriberState: GovernedCensusSourceFacts['activeOrCurrentSubscriberState'];
  consentState: GovernedCensusSourceFacts['consentState'];
  deliverabilityState: GovernedCensusSourceFacts['deliverabilityState'];
  providerSuppressionState: GovernedCensusSourceFacts['providerSuppressionState'];
  identityMatchState: GovernedCensusSourceFacts['identityMatchState'];
  sourceJoinCount: number;
}

export interface GovernedCensusDecisionHistory {
  providerContactRefHash: GovernedCensusSha256;
  maximumDecisionVersion: number;
  currentDecisionVersion: number | null;
  currentDecision: GovernedCensusDecision | null;
  currentPrimaryReason: GovernedCensusReason | null;
  currentSourceFactsHash: GovernedCensusSha256 | null;
  currentIdempotencyKey: string | null;
  currentRequestHash: GovernedCensusSha256 | null;
  currentSnapshotHash: GovernedCensusSha256 | null;
}

export interface GovernedCensusDecisionInput {
  decisionKey: string;
  providerContactRefHash: GovernedCensusSha256;
  contactKey: string | null;
  decision: GovernedCensusDecision;
  primaryReason: GovernedCensusReason;
  reasonCodes: readonly GovernedCensusReason[];
  sourceFacts: Readonly<GovernedCensusSourceFacts>;
  decisionVersion: number;
}

export interface GovernedCampaignCensusPlan {
  snapshotHash: GovernedCensusSha256;
  decisions: readonly GovernedCensusDecisionInput[];
  counts: {
    total: number;
    include: number;
    exclude: number;
    review: number;
    byPrimaryReason: Readonly<Record<GovernedCensusReason, number>>;
  };
  rawProviderContactIdentifiersIncluded: false;
  rawContactPiiIncluded: false;
  studentRecordsIncluded: false;
}

export class GovernedCampaignCensusError extends Error {
  constructor(
    readonly code:
      | 'INVALID_CENSUS_INPUT'
      | 'PROVIDER_CONTACT_CEILING'
      | 'DUPLICATE_PROVIDER_REFERENCE'
      | 'HISTORY_INCONSISTENT',
    message: string,
  ) {
    super(message);
    this.name = 'GovernedCampaignCensusError';
  }
}

const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const OPAQUE_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u;
const REASON_PRECEDENCE: readonly GovernedCensusReason[] = [
  'student_or_minor',
  'school_contact',
  'active_or_current_subscriber',
  'email_dnd_or_unsubscribed',
  'provider_suppression',
  'missing_email',
  'invalid_email',
  'duplicate_contact',
  'ambiguous_identity',
  'unknown_consent',
];

export function governedCampaignProviderContactRefHash(
  locationId: string,
  rawProviderContactId: string,
): GovernedCensusSha256 {
  if (!OPAQUE_KEY_PATTERN.test(locationId) || rawProviderContactId.trim() === '') {
    invalid('location and provider contact identifiers must be non-empty');
  }
  return sha256(`governed-ghl-contact-v1\u0000${locationId}\u0000${rawProviderContactId}`);
}

export function governedCampaignNormalizedEmailHash(normalizedEmail: string): GovernedCensusSha256 {
  if (
    normalizedEmail !== normalizedEmail.trim().toLowerCase() ||
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(normalizedEmail)
  ) {
    invalid('normalizedEmail must be a canonical valid email');
  }
  return sha256(normalizedEmail);
}

export function governedCampaignCensusDecisionKey(
  providerContactRefHash: GovernedCensusSha256,
  decisionVersion: number,
) {
  requireSha256(providerContactRefHash, 'providerContactRefHash');
  requirePositiveInteger(decisionVersion, 'decisionVersion');
  return `governed-campaign:${providerContactRefHash}:v${decisionVersion}`;
}

export function governedCampaignCanonicalSha256(value: unknown): GovernedCensusSha256 {
  return sha256(canonicalJson(value));
}

export function buildGovernedCampaignCensusPlan(input: {
  providerContacts: readonly ProtectedGovernedCensusProviderContact[];
  databaseFacts: ReadonlyMap<string, GovernedCensusDatabaseFacts>;
  history: ReadonlyMap<string, GovernedCensusDecisionHistory>;
  maximumProviderContacts: number;
  versionMode: 'new_request' | 'exact_replay_candidate';
}): GovernedCampaignCensusPlan {
  requirePositiveInteger(input.maximumProviderContacts, 'maximumProviderContacts');
  if (input.providerContacts.length === 0) invalid('provider census must contain at least one row');
  if (input.providerContacts.length > input.maximumProviderContacts) {
    throw new GovernedCampaignCensusError(
      'PROVIDER_CONTACT_CEILING',
      'provider contact count exceeds maximumProviderContacts',
    );
  }

  const protectedContacts = [...input.providerContacts].sort((left, right) =>
    left.providerContactRefHash.localeCompare(right.providerContactRefHash),
  );
  for (let index = 0; index < protectedContacts.length; index += 1) {
    const contact = protectedContacts[index]!;
    requireSha256(contact.providerContactRefHash, 'providerContactRefHash');
    validateProviderContact(contact);
    if (
      index > 0 &&
      protectedContacts[index - 1]!.providerContactRefHash === contact.providerContactRefHash
    ) {
      throw new GovernedCampaignCensusError(
        'DUPLICATE_PROVIDER_REFERENCE',
        'provider census contains a duplicate protected reference',
      );
    }
  }

  const decisions = protectedContacts.map((providerContact) => {
    const database =
      input.databaseFacts.get(providerContact.providerContactRefHash) ??
      unknownDatabaseFacts(providerContact.providerContactRefHash);
    validateDatabaseFacts(database, providerContact.providerContactRefHash);
    const sourceFacts = composeSourceFacts(providerContact, database);
    const classification = classify(sourceFacts);
    const history = input.history.get(providerContact.providerContactRefHash);
    const decisionVersion = nextDecisionVersion(
      history,
      providerContact.providerContactRefHash,
      classification,
      sourceFacts.sourceFactsHash,
      input.versionMode,
    );
    return {
      decisionKey: governedCampaignCensusDecisionKey(
        providerContact.providerContactRefHash,
        decisionVersion,
      ),
      providerContactRefHash: providerContact.providerContactRefHash,
      contactKey: database.contactKey,
      decision: classification.decision,
      primaryReason: classification.primaryReason,
      reasonCodes: classification.reasonCodes,
      sourceFacts,
      decisionVersion,
    } satisfies GovernedCensusDecisionInput;
  });

  const byPrimaryReason = Object.fromEntries(
    ['eligible_inactive_adult', ...REASON_PRECEDENCE].map((reason) => [reason, 0]),
  ) as Record<GovernedCensusReason, number>;
  let include = 0;
  let exclude = 0;
  let review = 0;
  for (const decision of decisions) {
    if (decision.decision === 'include') include += 1;
    if (decision.decision === 'exclude') exclude += 1;
    if (decision.decision === 'review') review += 1;
    byPrimaryReason[decision.primaryReason] += 1;
  }

  const snapshotHash = governedCampaignCanonicalSha256({
    schema: 'ot-live-002-governed-census-v1',
    decisions: decisions.map((decision) => ({
      providerContactRefHash: decision.providerContactRefHash,
      contactKey: decision.contactKey,
      decision: decision.decision,
      primaryReason: decision.primaryReason,
      reasonCodes: decision.reasonCodes,
      sourceFacts: decision.sourceFacts,
      decisionVersion: decision.decisionVersion,
      decisionKey: decision.decisionKey,
    })),
  });

  return {
    snapshotHash,
    decisions,
    counts: {
      total: decisions.length,
      include,
      exclude,
      review,
      byPrimaryReason,
    },
    rawProviderContactIdentifiersIncluded: false,
    rawContactPiiIncluded: false,
    studentRecordsIncluded: false,
  };
}

function composeSourceFacts(
  provider: ProtectedGovernedCensusProviderContact,
  database: GovernedCensusDatabaseFacts,
): GovernedCensusSourceFacts {
  if (database.sourceJoinCount >= Number.MAX_SAFE_INTEGER) {
    invalid('sourceJoinCount cannot be incremented safely');
  }
  const factsWithoutHash = {
    adultEvidenceState: database.adultEvidenceState,
    studentOrMinorState: database.studentOrMinorState,
    schoolContactState: database.schoolContactState,
    activeOrCurrentSubscriberState: database.activeOrCurrentSubscriberState,
    consentState: combineConsent(provider.consentState, database.consentState),
    deliverabilityState: combineDeliverability(
      provider.deliverabilityState,
      database.deliverabilityState,
    ),
    providerSuppressionState: combineSuppression(
      provider.providerSuppressionState,
      database.providerSuppressionState,
    ),
    identityMatchState: database.identityMatchState,
    sourceJoinCount: database.sourceJoinCount + 1,
  } as const;
  return {
    ...factsWithoutHash,
    sourceFactsHash: governedCampaignCanonicalSha256({
      providerContactRefHash: provider.providerContactRefHash,
      contactKey: database.contactKey,
      ...factsWithoutHash,
    }),
  };
}

function classify(facts: GovernedCensusSourceFacts): {
  decision: GovernedCensusDecision;
  primaryReason: GovernedCensusReason;
  reasonCodes: readonly GovernedCensusReason[];
} {
  const reasons = new Set<GovernedCensusReason>();
  if (facts.studentOrMinorState === 'present') reasons.add('student_or_minor');
  if (facts.schoolContactState === 'present') reasons.add('school_contact');
  if (facts.activeOrCurrentSubscriberState === 'present') {
    reasons.add('active_or_current_subscriber');
  }
  if (facts.consentState === 'opted_out') reasons.add('email_dnd_or_unsubscribed');
  if (facts.providerSuppressionState === 'suppressed') reasons.add('provider_suppression');
  if (facts.deliverabilityState === 'missing') reasons.add('missing_email');
  if (facts.deliverabilityState === 'invalid') reasons.add('invalid_email');
  if (facts.identityMatchState === 'duplicate') reasons.add('duplicate_contact');
  if (
    facts.identityMatchState === 'ambiguous' ||
    facts.identityMatchState === 'missing' ||
    facts.adultEvidenceState !== 'proven'
  ) {
    reasons.add('ambiguous_identity');
  }
  if (facts.consentState === 'unknown') reasons.add('unknown_consent');
  if (
    facts.studentOrMinorState === 'unknown' ||
    facts.schoolContactState === 'unknown' ||
    facts.activeOrCurrentSubscriberState === 'unknown' ||
    facts.deliverabilityState === 'unknown' ||
    facts.providerSuppressionState === 'unknown'
  ) {
    reasons.add('ambiguous_identity');
  }

  const orderedReasons = REASON_PRECEDENCE.filter((reason) => reasons.has(reason));
  const exclusionReasons = new Set<GovernedCensusReason>([
    'student_or_minor',
    'school_contact',
    'active_or_current_subscriber',
    'email_dnd_or_unsubscribed',
    'provider_suppression',
    'missing_email',
    'invalid_email',
    'duplicate_contact',
  ]);
  const primaryExclusion = orderedReasons.find((reason) => exclusionReasons.has(reason));
  if (primaryExclusion) {
    return { decision: 'exclude', primaryReason: primaryExclusion, reasonCodes: orderedReasons };
  }
  if (orderedReasons.length > 0) {
    return {
      decision: 'review',
      primaryReason: orderedReasons[0]!,
      reasonCodes: orderedReasons,
    };
  }
  return {
    decision: 'include',
    primaryReason: 'eligible_inactive_adult',
    reasonCodes: ['eligible_inactive_adult'],
  };
}

function nextDecisionVersion(
  history: GovernedCensusDecisionHistory | undefined,
  expectedProviderHash: GovernedCensusSha256,
  classification: {
    decision: GovernedCensusDecision;
    primaryReason: GovernedCensusReason;
  },
  sourceFactsHash: GovernedCensusSha256,
  versionMode: 'new_request' | 'exact_replay_candidate',
) {
  if (!history) return 1;
  requireSha256(history.providerContactRefHash, 'history.providerContactRefHash');
  if (history.providerContactRefHash !== expectedProviderHash) {
    throw new GovernedCampaignCensusError('HISTORY_INCONSISTENT', 'history provider hash mismatch');
  }
  const currentValues = [
    history.currentDecisionVersion,
    history.currentDecision,
    history.currentPrimaryReason,
    history.currentSourceFactsHash,
    history.currentIdempotencyKey,
    history.currentRequestHash,
    history.currentSnapshotHash,
  ];
  const currentAllNull = currentValues.every((value) => value === null);
  const currentAllPresent = currentValues.every((value) => value !== null);
  if (
    !Number.isSafeInteger(history.maximumDecisionVersion) ||
    history.maximumDecisionVersion < 1 ||
    (!currentAllNull && !currentAllPresent) ||
    (history.currentDecisionVersion !== null &&
      (!Number.isSafeInteger(history.currentDecisionVersion) ||
        history.currentDecisionVersion <= 0 ||
        history.currentDecisionVersion > history.maximumDecisionVersion))
  ) {
    throw new GovernedCampaignCensusError('HISTORY_INCONSISTENT', 'decision history is invalid');
  }
  if (currentAllPresent) {
    requireSha256(history.currentSourceFactsHash!, 'history.currentSourceFactsHash');
    requireSha256(history.currentRequestHash!, 'history.currentRequestHash');
    requireSha256(history.currentSnapshotHash!, 'history.currentSnapshotHash');
    if (!OPAQUE_KEY_PATTERN.test(history.currentIdempotencyKey!)) {
      throw new GovernedCampaignCensusError(
        'HISTORY_INCONSISTENT',
        'history idempotency key is invalid',
      );
    }
    if (!isDecision(history.currentDecision) || !isReason(history.currentPrimaryReason)) {
      throw new GovernedCampaignCensusError('HISTORY_INCONSISTENT', 'history enums are invalid');
    }
  }
  if (
    versionMode === 'exact_replay_candidate' &&
    history.currentDecisionVersion !== null &&
    history.currentSourceFactsHash === sourceFactsHash &&
    history.currentDecision === classification.decision &&
    history.currentPrimaryReason === classification.primaryReason
  ) {
    return history.currentDecisionVersion;
  }
  if (history.maximumDecisionVersion === Number.MAX_SAFE_INTEGER) {
    throw new GovernedCampaignCensusError(
      'HISTORY_INCONSISTENT',
      'decision version would overflow',
    );
  }
  return history.maximumDecisionVersion + 1;
}

function validateDatabaseFacts(
  facts: GovernedCensusDatabaseFacts,
  expectedHash: GovernedCensusSha256,
) {
  if (facts.providerContactRefHash !== expectedHash) invalid('database fact hash mismatch');
  if (facts.contactKey !== null && !OPAQUE_KEY_PATTERN.test(facts.contactKey)) {
    invalid('contactKey must be an opaque non-PII key');
  }
  if (!Number.isSafeInteger(facts.sourceJoinCount) || facts.sourceJoinCount < 0) {
    invalid('sourceJoinCount must be a non-negative safe integer');
  }
  requireEnum(
    facts.adultEvidenceState,
    ['proven', 'not_proven', 'conflicting'],
    'adultEvidenceState',
  );
  requireEnum(facts.studentOrMinorState, ['absent', 'present', 'unknown'], 'studentOrMinorState');
  requireEnum(facts.schoolContactState, ['absent', 'present', 'unknown'], 'schoolContactState');
  requireEnum(
    facts.activeOrCurrentSubscriberState,
    ['absent', 'present', 'unknown'],
    'activeOrCurrentSubscriberState',
  );
  requireEnum(facts.consentState, ['opted_in', 'opted_out', 'unknown'], 'database.consentState');
  requireEnum(
    facts.deliverabilityState,
    ['deliverable', 'invalid', 'missing', 'unknown'],
    'database.deliverabilityState',
  );
  requireEnum(
    facts.providerSuppressionState,
    ['active', 'suppressed', 'unknown'],
    'database.providerSuppressionState',
  );
  requireEnum(
    facts.identityMatchState,
    ['exact', 'duplicate', 'ambiguous', 'missing'],
    'identityMatchState',
  );
}

function validateProviderContact(contact: ProtectedGovernedCensusProviderContact) {
  if (contact.normalizedEmailHash !== null) {
    requireSha256(contact.normalizedEmailHash, 'provider.normalizedEmailHash');
  }
  requireEnum(contact.consentState, ['opted_in', 'opted_out', 'unknown'], 'provider.consentState');
  requireEnum(
    contact.deliverabilityState,
    ['deliverable', 'invalid', 'missing', 'unknown'],
    'provider.deliverabilityState',
  );
  requireEnum(
    contact.providerSuppressionState,
    ['active', 'suppressed', 'unknown'],
    'provider.providerSuppressionState',
  );
}

function unknownDatabaseFacts(
  providerContactRefHash: GovernedCensusSha256,
): GovernedCensusDatabaseFacts {
  return {
    providerContactRefHash,
    contactKey: null,
    adultEvidenceState: 'not_proven',
    studentOrMinorState: 'unknown',
    schoolContactState: 'unknown',
    activeOrCurrentSubscriberState: 'unknown',
    consentState: 'unknown',
    deliverabilityState: 'unknown',
    providerSuppressionState: 'unknown',
    identityMatchState: 'missing',
    sourceJoinCount: 0,
  };
}

function combineConsent(
  provider: GovernedCensusSourceFacts['consentState'],
  database: GovernedCensusSourceFacts['consentState'],
): GovernedCensusSourceFacts['consentState'] {
  if (provider === 'opted_out' || database === 'opted_out') return 'opted_out';
  if (provider === 'opted_in' && database === 'opted_in') return 'opted_in';
  return 'unknown';
}

function combineSuppression(
  provider: GovernedCensusSourceFacts['providerSuppressionState'],
  database: GovernedCensusSourceFacts['providerSuppressionState'],
): GovernedCensusSourceFacts['providerSuppressionState'] {
  if (provider === 'suppressed' || database === 'suppressed') return 'suppressed';
  if (provider === 'active' && database === 'active') return 'active';
  return 'unknown';
}

function combineDeliverability(
  provider: GovernedCensusSourceFacts['deliverabilityState'],
  database: GovernedCensusSourceFacts['deliverabilityState'],
): GovernedCensusSourceFacts['deliverabilityState'] {
  if (provider === 'missing' || database === 'missing') return 'missing';
  if (provider === 'invalid' || database === 'invalid') return 'invalid';
  if (provider === 'deliverable' && database === 'deliverable') return 'deliverable';
  return 'unknown';
}

function requireSha256(value: string, field: string) {
  if (!SHA256_PATTERN.test(value)) invalid(`${field} must be a full lowercase SHA-256`);
}

function requirePositiveInteger(value: number, field: string) {
  if (!Number.isSafeInteger(value) || value <= 0) invalid(`${field} must be positive`);
}

function requireEnum(value: string, allowed: readonly string[], field: string) {
  if (!allowed.includes(value)) invalid(`${field} is invalid`);
}

function isDecision(value: unknown): value is GovernedCensusDecision {
  return value === 'include' || value === 'exclude' || value === 'review';
}

function isReason(value: unknown): value is GovernedCensusReason {
  return (
    value === 'eligible_inactive_adult' || REASON_PRECEDENCE.includes(value as GovernedCensusReason)
  );
}

function invalid(message: string): never {
  throw new GovernedCampaignCensusError('INVALID_CENSUS_INPUT', message);
}

function sha256(value: string): GovernedCensusSha256 {
  return createHash('sha256').update(value).digest('hex') as GovernedCensusSha256;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map(
        (key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
      )
      .join(',')}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) invalid('undefined is not canonical census data');
  return encoded;
}
