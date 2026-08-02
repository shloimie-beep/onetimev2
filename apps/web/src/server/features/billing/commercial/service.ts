import type {
  CommercialBillingActor,
  CommercialBillingCommand,
  CommercialBillingProjection,
  CommercialBillingRepository,
  VerifiedCommercialBillingEvidence,
} from '../../../../../../../packages/contracts/src/billing/commercial/index.ts';
import type { JobScope } from '../../../../../../../packages/contracts/src/jobs/index.ts';
import {
  applyVerifiedCommercialEvidence,
  createFamilySignupProjection,
  freePeriodConfiguration,
  planHostedBillingCommand,
} from '../../../../../../../packages/domain/src/billing/commercial/index.ts';
import { canonicalRequestHash } from '../../../../../../../packages/domain/src/jobs/idempotency.ts';

export function createCommercialBillingService(deps: {
  repository: CommercialBillingRepository;
  freeAccessExpiresAt?: string;
}) {
  const configuration = freePeriodConfiguration(deps.freeAccessExpiresAt);

  return {
    async createFamilySignup(input: {
      householdId: string;
      ownerAdultId: string;
      activeStudentCount: number;
      now: Date;
      scope: JobScope;
      idempotencyKey: string;
    }) {
      const projection = createFamilySignupProjection({
        householdId: input.householdId,
        ownerAdultId: input.ownerAdultId,
        activeStudentCount: input.activeStudentCount,
        now: input.now,
        configuration,
      });
      return deps.repository.createSignup({
        idempotencyKey: input.idempotencyKey,
        canonicalRequestHash: canonicalRequestHash({
          kind: 'family_signup',
          householdId: input.householdId,
          ownerAdultId: input.ownerAdultId,
          activeStudentCount: input.activeStudentCount,
          occurredAt: input.now.toISOString(),
          freePeriodSourceKey: configuration.sourceKey,
        }),
        scope: input.scope,
        projection,
      });
    },

    async execute(input: { actor: CommercialBillingActor; command: CommercialBillingCommand }) {
      const operationScope = `billing.commercial.${input.command.kind}:${input.command.householdId}`;
      const requestHash = canonicalRequestHash(input.command);
      const replay = await deps.repository.replayCommand({
        actorRef: input.actor.adultId,
        operationScope,
        idempotencyKey: input.command.idempotencyKey,
        canonicalRequestHash: requestHash,
      });
      if (replay) return replay;
      const prior = await requiredProjection(deps.repository, input.command.householdId);
      const planned = planHostedBillingCommand({
        actor: input.actor,
        command: input.command,
        prior,
        configuration,
      });
      return deps.repository.execute({
        actorRef: input.actor.adultId,
        operationScope,
        idempotencyKey: input.command.idempotencyKey,
        canonicalRequestHash: planned.requestHash,
        expectedVersion: input.command.expectedVersion,
        scope: input.command.scope,
        nextProjection: planned.projection,
        intent: planned.intent,
      });
    },

    async ingestVerifiedEvidence(input: {
      evidence: VerifiedCommercialBillingEvidence;
      now: Date;
    }) {
      const prior = await requiredProjection(deps.repository, input.evidence.householdId);
      const next = applyVerifiedCommercialEvidence({
        prior,
        evidence: input.evidence,
        now: input.now,
      });
      if (next === prior) {
        return { disposition: 'replayed' as const, projection: prior };
      }
      return deps.repository.applyEvidence(prior, input.evidence, next);
    },

    async summary(householdId: string) {
      return requiredProjection(deps.repository, householdId);
    },
  };
}

async function requiredProjection(
  repository: CommercialBillingRepository,
  householdId: string,
): Promise<CommercialBillingProjection> {
  const projection = await repository.load(householdId);
  if (!projection) throw new Error('commercial_billing_household_not_found');
  return projection;
}
