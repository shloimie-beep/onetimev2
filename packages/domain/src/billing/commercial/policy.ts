import type { AdultAuthorizationContext } from '../../../../contracts/src/access/v21-household-authorization.ts';
import {
  FAMILY_PLAN,
  FIXED_FREE_PERIOD,
  type CommercialBillingActor,
  type CommercialBillingCommand,
  type CommercialBillingProjection,
  type HostedCommercialBillingIntent,
  type ImmediateChargeConsent,
  type RequestHostedCheckout,
  type VerifiedCommercialBillingEvidence,
} from '../../../../contracts/src/billing/commercial/index.ts';
import { authorizeAdultCapability } from '../../access/v21-household-authorization.ts';
import { canonicalRequestHash, sha256Hex } from '../../jobs/idempotency.ts';
import { CommercialBillingError } from './errors.ts';

export type FreePeriodConfiguration = {
  sourceKey: string;
  timeZone: 'Asia/Jerusalem';
  endsAt: string;
};

export const DEFAULT_FREE_PERIOD_CONFIGURATION: FreePeriodConfiguration = {
  sourceKey: FIXED_FREE_PERIOD.sourceKey,
  timeZone: FIXED_FREE_PERIOD.timeZone,
  endsAt: FIXED_FREE_PERIOD.endsAt,
};

export function freePeriodStatus(input: { now: Date; configuration: FreePeriodConfiguration }) {
  const nowMs = validTime(input.now, 'now');
  assertFreePeriodConfiguration(input.configuration);
  const endMs = Date.parse(input.configuration.endsAt);
  return {
    sourceKey: input.configuration.sourceKey,
    timeZone: input.configuration.timeZone,
    endsAt: input.configuration.endsAt,
    active: nowMs < endMs,
    remainingMilliseconds: Math.max(0, endMs - nowMs),
  };
}

export function createFamilySignupProjection(input: {
  householdId: string;
  ownerAdultId: string;
  activeStudentCount: number;
  now: Date;
  configuration: FreePeriodConfiguration;
}): CommercialBillingProjection {
  assertHouseholdIdentity(input.householdId, input.ownerAdultId);
  assertSeatCount(input.activeStudentCount);
  const freePeriod = freePeriodStatus({
    now: input.now,
    configuration: input.configuration,
  });
  return {
    householdId: input.householdId,
    ownerAdultId: input.ownerAdultId,
    accessState: freePeriod.active ? 'free' : 'inactive',
    subscriptionState: 'none',
    activeStudentCount: input.activeStudentCount,
    freePeriodEndsAt: input.configuration.endsAt,
    paidPeriodEndsAt: null,
    firstChargeAt: null,
    cancelAtPeriodEnd: false,
    sourceEvidenceDigest: null,
    version: 1,
  };
}

export function planHostedBillingCommand(input: {
  actor: CommercialBillingActor;
  command: CommercialBillingCommand;
  prior: CommercialBillingProjection;
  configuration: FreePeriodConfiguration;
}): {
  requestHash: string;
  projection: CommercialBillingProjection;
  intent: HostedCommercialBillingIntent;
} {
  assertCurrentProjection(input.command, input.prior);
  assertScope(input.command.scope);

  if (input.command.kind === 'request_refund_exception') {
    authorizeAdmin(input.actor.authorization);
  } else {
    authorizeParent(input.actor.authorization, input.command.householdId);
  }

  const requestHash = canonicalRequestHash(input.command);
  switch (input.command.kind) {
    case 'request_hosted_checkout':
      return planCheckout(input.command, input.prior, input.configuration, requestHash);
    case 'request_hosted_portal':
      if (
        input.prior.subscriptionState === 'none' ||
        input.prior.subscriptionState === 'checkout_requested'
      ) {
        throw new CommercialBillingError(
          'portal_not_available',
          'The hosted billing portal requires a verified subscription.',
        );
      }
      return {
        requestHash,
        projection: { ...input.prior, version: input.prior.version + 1 },
        intent: createIntent(
          input.command,
          requestHash,
          'billing.commercial.portal.request',
          null,
          null,
          0,
          null,
        ),
      };
    case 'request_period_end_cancellation':
      if (!input.prior.paidPeriodEndsAt || input.prior.accessState !== 'active') {
        throw new CommercialBillingError(
          'paid_period_required',
          'Cancellation requires a verified active paid period.',
        );
      }
      return {
        requestHash,
        projection: {
          ...input.prior,
          subscriptionState: 'cancellation_requested',
          version: input.prior.version + 1,
        },
        intent: createIntent(
          input.command,
          requestHash,
          'billing.commercial.cancel_at_period_end.request',
          null,
          null,
          0,
          null,
        ),
      };
    case 'request_refund_exception':
      if (
        input.command.amountCents < 1 ||
        input.command.amountCents > FAMILY_PLAN.amountCents ||
        !/^[a-f0-9]{64}$/.test(input.command.invoiceRefHash) ||
        input.command.reasonCode.trim() === ''
      ) {
        throw new CommercialBillingError(
          'invalid_refund',
          'A bounded amount, hashed invoice reference, and reason are required.',
        );
      }
      return {
        requestHash,
        projection: {
          ...input.prior,
          subscriptionState: 'refund_review',
          version: input.prior.version + 1,
        },
        intent: createIntent(
          input.command,
          requestHash,
          'billing.commercial.refund_exception.request',
          null,
          null,
          0,
          null,
        ),
      };
  }
}

export function applyVerifiedCommercialEvidence(input: {
  prior: CommercialBillingProjection;
  evidence: VerifiedCommercialBillingEvidence;
  now: Date;
}): CommercialBillingProjection {
  const { prior, evidence } = input;
  validTime(input.now, 'now');
  if (!evidence.signatureVerified) {
    throw new CommercialBillingError(
      'unverified_evidence',
      'Only verified signed financial evidence may change access.',
    );
  }
  if (
    evidence.provider !== 'stripe' ||
    evidence.orchestratedBy !== 'highlevel' ||
    evidence.householdId !== prior.householdId ||
    evidence.amountCents !== FAMILY_PLAN.amountCents ||
    evidence.currency !== FAMILY_PLAN.currency ||
    !/^[a-f0-9]{64}$/.test(evidence.evidenceDigest)
  ) {
    throw new CommercialBillingError(
      'evidence_mismatch',
      'Financial evidence does not match the household commercial contract.',
    );
  }
  if (prior.sourceEvidenceDigest === evidence.evidenceDigest) return prior;

  const accessState =
    evidence.subscriptionState === 'active' || evidence.subscriptionState === 'cancel_at_period_end'
      ? 'active'
      : freePeriodStatus({
            now: input.now,
            configuration: {
              sourceKey: FIXED_FREE_PERIOD.sourceKey,
              timeZone: FIXED_FREE_PERIOD.timeZone,
              endsAt: prior.freePeriodEndsAt,
            },
          }).active
        ? 'free'
        : 'inactive';

  return {
    ...prior,
    accessState,
    subscriptionState: evidence.subscriptionState,
    firstChargeAt: evidence.firstChargeAt,
    paidPeriodEndsAt: evidence.currentPaidPeriodEndsAt,
    cancelAtPeriodEnd: evidence.subscriptionState === 'cancel_at_period_end',
    sourceEvidenceDigest: evidence.evidenceDigest,
    version: prior.version + 1,
  };
}

function planCheckout(
  command: RequestHostedCheckout,
  prior: CommercialBillingProjection,
  configuration: FreePeriodConfiguration,
  requestHash: string,
) {
  if (prior.subscriptionState !== 'none') {
    throw new CommercialBillingError(
      'checkout_not_allowed',
      'A household with a paid or scheduled subscription cannot create another checkout.',
    );
  }
  const requestedAt = new Date(command.requestedAt);
  const freePeriod = freePeriodStatus({ now: requestedAt, configuration });
  let firstChargeAt: string | null = null;
  let immediateChargeAmountCents = 0;
  let explicitConsentDigest: string | null = null;
  let chargeMode: HostedCommercialBillingIntent['chargeMode'];

  if (command.mode === 'standard') {
    if (command.consent !== null) {
      throw new CommercialBillingError(
        'consent_mismatch',
        'Standard checkout cannot bundle immediate-charge consent.',
      );
    }
    firstChargeAt = freePeriod.active ? configuration.endsAt : command.requestedAt;
    chargeMode = freePeriod.active ? 'scheduled_at_free_period_end' : 'at_hosted_checkout';
  } else {
    const consent = command.consent;
    assertImmediateChargeConsent(command, consent);
    firstChargeAt = consent.displayedChargeAt;
    immediateChargeAmountCents = FAMILY_PLAN.amountCents;
    explicitConsentDigest = canonicalRequestHash(consent);
    chargeMode = 'explicit_immediate_exception';
  }

  return {
    requestHash,
    projection: {
      ...prior,
      subscriptionState: 'checkout_requested' as const,
      firstChargeAt,
      version: prior.version + 1,
    },
    intent: createIntent(
      command,
      requestHash,
      'billing.commercial.checkout.request',
      chargeMode,
      firstChargeAt,
      immediateChargeAmountCents,
      explicitConsentDigest,
    ),
  };
}

function assertImmediateChargeConsent(
  command: RequestHostedCheckout,
  consent: ImmediateChargeConsent | null,
): asserts consent is ImmediateChargeConsent {
  if (!consent || !consent.affirmativelyAccepted) {
    throw new CommercialBillingError(
      'consent_required',
      'Immediate charge requires separate affirmative Parent consent.',
    );
  }
  if (
    consent.householdId !== command.householdId ||
    consent.displayedAmountCents !== FAMILY_PLAN.amountCents ||
    consent.displayedCurrency !== FAMILY_PLAN.currency ||
    consent.actorAdultId.trim() === '' ||
    consent.displayedChargeAt !== command.requestedAt ||
    !Number.isFinite(Date.parse(consent.acceptedAt)) ||
    !Number.isFinite(Date.parse(command.requestedAt)) ||
    Date.parse(consent.acceptedAt) > Date.parse(command.requestedAt)
  ) {
    throw new CommercialBillingError(
      'consent_mismatch',
      'Immediate-charge consent must bind the displayed amount, time, actor, and household.',
    );
  }
}

function createIntent(
  command: CommercialBillingCommand,
  requestHash: string,
  operationType: HostedCommercialBillingIntent['operation_type'],
  chargeMode: HostedCommercialBillingIntent['chargeMode'],
  firstChargeAt: string | null,
  immediateChargeAmountCents: number,
  explicitConsentDigest: string | null,
): HostedCommercialBillingIntent {
  const payloadDigest = sha256Hex(
    [
      command.householdId,
      operationType,
      chargeMode ?? 'none',
      requestHash,
      FAMILY_PLAN.planKey,
      String(FAMILY_PLAN.amountCents),
      FAMILY_PLAN.currency,
      firstChargeAt ?? 'none',
      String(immediateChargeAmountCents),
      explicitConsentDigest ?? 'none',
    ].join('\n'),
  );
  return {
    job_id: `p25_${sha256Hex(`${command.householdId}\0${command.idempotencyKey}`).slice(0, 32)}`,
    operation_type: operationType,
    aggregate_ref: command.householdId,
    source_version: command.expectedVersion + 1,
    provider: 'highlevel',
    scope: command.scope,
    idempotency_key: command.idempotencyKey,
    canonical_request_hash: requestHash,
    payload_ref: `commercial_billing:${payloadDigest}`,
    payload_digest: payloadDigest,
    compensation_for_job_id: null,
    financialProvider: 'stripe',
    providerMutationByOneTime: false,
    householdId: command.householdId,
    planKey: FAMILY_PLAN.planKey,
    planAmountCents: FAMILY_PLAN.amountCents,
    planCurrency: FAMILY_PLAN.currency,
    planInterval: FAMILY_PLAN.interval,
    chargeMode,
    firstChargeAt,
    immediateChargeAmountCents,
    explicitConsentDigest,
  };
}

function authorizeParent(context: AdultAuthorizationContext, householdId: string) {
  const decision = authorizeAdultCapability({
    context,
    requiredRole: 'parent',
    capability: 'parent:read_billing',
    householdId,
  });
  if (!decision.allowed) {
    throw new CommercialBillingError(
      decision.reason === 'cross_household_denied'
        ? 'cross_household_denied'
        : 'authorization_denied',
      'An active Parent owner context is required for this household billing action.',
    );
  }
}

function authorizeAdmin(context: AdultAuthorizationContext) {
  const decision = authorizeAdultCapability({
    context,
    requiredRole: 'admin',
    capability: 'admin:operate_accounts',
  });
  if (!decision.allowed) {
    throw new CommercialBillingError(
      'admin_approval_required',
      'Refund exceptions require an active Admin approval context.',
    );
  }
}

function assertCurrentProjection(
  command: CommercialBillingCommand,
  prior: CommercialBillingProjection,
) {
  if (command.householdId !== prior.householdId) {
    throw new CommercialBillingError(
      'cross_household_denied',
      'Billing commands cannot cross household scope.',
    );
  }
  if (command.expectedVersion !== prior.version) {
    throw new CommercialBillingError('stale_version', 'The billing projection is stale.');
  }
  assertSeatCount(prior.activeStudentCount);
}

function assertFreePeriodConfiguration(configuration: FreePeriodConfiguration) {
  if (
    configuration.sourceKey.trim() === '' ||
    configuration.timeZone !== FIXED_FREE_PERIOD.timeZone ||
    configuration.endsAt !== FIXED_FREE_PERIOD.endsAt ||
    !Number.isFinite(Date.parse(configuration.endsAt))
  ) {
    throw new CommercialBillingError(
      'invalid_configuration',
      'The locked Jerusalem free-period configuration is required.',
    );
  }
}

function assertScope(scope: CommercialBillingCommand['scope']) {
  const tierByEnvironment = {
    ci: 'isolated_staging',
    provider_sandbox: 'isolated_staging',
    persistent_staging: 'isolated_staging',
    production_read_only: 'production',
    production_operator_canary: 'production',
    production_broad: 'production',
  } as const;
  if (
    scope.product !== 'one_time_mishnayos' ||
    tierByEnvironment[scope.verification_environment_id] !== scope.runtime_tier
  ) {
    throw new CommercialBillingError(
      'invalid_scope',
      'Commercial billing requires the canonical product and environment scope.',
    );
  }
}

function assertSeatCount(count: number) {
  if (!Number.isInteger(count) || count < 0 || count > FAMILY_PLAN.householdSeatLimit) {
    throw new CommercialBillingError(
      'seat_limit_exceeded',
      'The Family plan permits at most three active Students.',
    );
  }
}

function assertHouseholdIdentity(householdId: string, adultId: string) {
  if (householdId.trim() === '' || adultId.trim() === '') {
    throw new CommercialBillingError(
      'invalid_scope',
      'Household and adult identities must be opaque and nonempty.',
    );
  }
}

function validTime(value: Date, field: string) {
  const time = value.getTime();
  if (!Number.isFinite(time)) {
    throw new CommercialBillingError('invalid_time', `${field} must be a valid instant.`);
  }
  return time;
}
