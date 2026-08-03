import { describe, expect, it } from 'vitest';
import type {
  CommercialBillingCommandResult,
  CommercialBillingProjection,
  CommercialBillingRepository,
} from '../../../../../../../packages/contracts/src/billing/commercial/index.ts';
import { FREE_PERIOD_POLICY } from '../../../../../../../packages/contracts/src/billing/commercial/index.ts';
import { createCommercialBillingService } from './service.ts';

const scope = {
  product: 'one_time_mishnayos',
  runtime_tier: 'isolated_staging',
  verification_environment_id: 'ci',
} as const;

const FREE_ACCESS_EXPIRES_AT = '2026-09-13T19:24:00+03:00';
const FIXED_FREE_PERIOD = { ...FREE_PERIOD_POLICY, endsAt: FREE_ACCESS_EXPIRES_AT };

const actor = {
  adultId: 'adult_owner',
  authorization: {
    humanAccountId: 'account_owner',
    memberships: ['parent'] as const,
    activeRole: 'parent' as const,
    activeHouseholdId: 'household_one',
    serverResolvedOwnedHouseholdIds: ['household_one'],
  },
};

function memoryRepository(): CommercialBillingRepository {
  const projections = new Map<string, CommercialBillingProjection>();
  const commands = new Map<
    string,
    { requestHash: string; result: CommercialBillingCommandResult }
  >();
  const signups = new Map<
    string,
    { requestHash: string; projection: CommercialBillingProjection }
  >();

  return {
    async load(householdId) {
      return projections.get(householdId) ?? null;
    },
    async replayCommand(input) {
      const key = `${input.actorRef}:${input.operationScope}:${input.idempotencyKey}`;
      const prior = commands.get(key);
      if (!prior) return null;
      if (prior.requestHash !== input.canonicalRequestHash) {
        throw new Error('job_command_idempotency_conflict');
      }
      return { ...prior.result, disposition: 'replayed' };
    },
    async createSignup(input) {
      const key = `${input.projection.ownerAdultId}:${input.idempotencyKey}`;
      const prior = signups.get(key);
      if (prior) {
        if (prior.requestHash !== input.canonicalRequestHash) {
          throw new Error('job_command_idempotency_conflict');
        }
        return { disposition: 'replayed', projection: prior.projection };
      }
      signups.set(key, {
        requestHash: input.canonicalRequestHash,
        projection: input.projection,
      });
      projections.set(input.projection.householdId, input.projection);
      return { disposition: 'applied', projection: input.projection };
    },
    async execute(input) {
      const result: CommercialBillingCommandResult = {
        disposition: 'applied',
        projection: input.nextProjection,
        intent: input.intent,
      };
      projections.set(input.nextProjection.householdId, input.nextProjection);
      commands.set(`${input.actorRef}:${input.operationScope}:${input.idempotencyKey}`, {
        requestHash: input.canonicalRequestHash,
        result,
      });
      return result;
    },
    async applyEvidence(_prior, _evidence, nextProjection) {
      projections.set(nextProjection.householdId, nextProjection);
      return { disposition: 'applied', projection: nextProjection };
    },
  };
}

describe('commercial billing service', () => {
  it('persists free signup idempotently without creating any provider intent', async () => {
    const service = createCommercialBillingService({
      repository: memoryRepository(),
      freeAccessExpiresAt: FREE_ACCESS_EXPIRES_AT,
    });
    const input = {
      householdId: 'household_one',
      ownerAdultId: 'adult_owner',
      activeStudentCount: 2,
      now: new Date('2026-08-01T12:00:00.000Z'),
      scope,
      idempotencyKey: 'signup-key-0001',
    };
    await expect(service.createFamilySignup(input)).resolves.toMatchObject({
      disposition: 'applied',
      projection: {
        accessState: 'free',
        subscriptionState: 'none',
        firstChargeAt: null,
      },
    });
    await expect(service.createFamilySignup(input)).resolves.toMatchObject({
      disposition: 'replayed',
      projection: { version: 1 },
    });
  });

  it('persists one GHL-hosted standard Checkout intent and replays resubmission', async () => {
    const repository = memoryRepository();
    const service = createCommercialBillingService({
      repository,
      freeAccessExpiresAt: FREE_ACCESS_EXPIRES_AT,
    });
    await service.createFamilySignup({
      householdId: 'household_one',
      ownerAdultId: 'adult_owner',
      activeStudentCount: 0,
      now: new Date('2026-08-01T12:00:00.000Z'),
      scope,
      idempotencyKey: 'signup-key-0001',
    });
    const command = {
      kind: 'request_hosted_checkout' as const,
      householdId: 'household_one',
      idempotencyKey: 'checkout-key-0001',
      expectedVersion: 1,
      scope,
      mode: 'standard' as const,
      requestedAt: '2026-08-01T12:00:00.000Z',
      consent: null,
    };
    const first = await service.execute({ actor, command });
    expect(first).toMatchObject({
      disposition: 'applied',
      projection: { version: 2, accessState: 'free' },
      intent: {
        provider: 'highlevel',
        financialProvider: 'stripe',
        providerMutationByOneTime: false,
        firstChargeAt: FIXED_FREE_PERIOD.endsAt,
        immediateChargeAmountCents: 0,
      },
    });
    const replay = await service.execute({ actor, command });
    expect(replay).toMatchObject({
      disposition: 'replayed',
      projection: { version: 2 },
      intent: { job_id: first.intent.job_id },
    });
    await expect(
      service.execute({
        actor,
        command: { ...command, idempotencyKey: 'checkout-key-0002', expectedVersion: 2 },
      }),
    ).rejects.toThrow(
      'A household with a paid or scheduled subscription cannot create another checkout.',
    );
  });

  it('does not activate access from mismatched financial evidence', async () => {
    const repository = memoryRepository();
    const service = createCommercialBillingService({
      repository,
      freeAccessExpiresAt: FREE_ACCESS_EXPIRES_AT,
    });
    await service.createFamilySignup({
      householdId: 'household_one',
      ownerAdultId: 'adult_owner',
      activeStudentCount: 0,
      now: new Date(FIXED_FREE_PERIOD.endsAt),
      scope,
      idempotencyKey: 'signup-key-0001',
    });
    await expect(
      service.ingestVerifiedEvidence({
        evidence: {
          evidenceId: 'provider-event-0001',
          evidenceDigest: 'c'.repeat(64),
          signatureVerified: true,
          provider: 'stripe',
          orchestratedBy: 'highlevel',
          householdId: 'another_household',
          amountCents: 6700,
          currency: 'USD',
          subscriptionState: 'active',
          firstChargeAt: FIXED_FREE_PERIOD.endsAt,
          currentPaidPeriodEndsAt: '2026-10-13T16:24:00.000Z',
          observedAt: '2026-09-13T16:24:01.000Z',
          scope,
        },
        now: new Date('2026-09-13T16:24:01.000Z'),
      }),
    ).rejects.toThrow('commercial_billing_household_not_found');
    await expect(service.summary('household_one')).resolves.toMatchObject({
      accessState: 'inactive',
      sourceEvidenceDigest: null,
    });
  });
});
