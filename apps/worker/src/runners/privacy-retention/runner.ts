import type {
  DataRightsRequest,
  PrivacyRetentionRepository,
  RetentionWorkItem,
} from '../../../../../packages/contracts/src/privacy/index.ts';
import {
  createDeletionPurgeRecord,
  planRetentionWork,
} from '../../../../../packages/domain/src/privacy/index.ts';

export interface PrivacyRetentionPlanner {
  loadApprovedErasure(requestId: string): Promise<DataRightsRequest>;
  purgeRecordInput(
    work: RetentionWorkItem,
    request: DataRightsRequest,
  ): Omit<Parameters<typeof createDeletionPurgeRecord>[0], 'approved_request'>;
}

export async function runPrivacyRetentionPlanningBatch(input: {
  repository: PrivacyRetentionRepository;
  planner: PrivacyRetentionPlanner;
  scope: Parameters<PrivacyRetentionRepository['claimDue']>[0]['scope'];
  now: Date;
  limit: number;
}): Promise<{ claimed: number; planned: number; stale_fenced: number; failed_closed: number }> {
  const summary = { claimed: 0, planned: 0, stale_fenced: 0, failed_closed: 0 };
  const workItems = await input.repository.claimDue({
    scope: input.scope,
    now: input.now,
    limit: input.limit,
  });
  summary.claimed = workItems.length;
  for (const work of workItems) {
    try {
      const request = await input.planner.loadApprovedErasure(work.request_id);
      const purgeRecord = createDeletionPurgeRecord({
        approved_request: request,
        ...input.planner.purgeRecordInput(work, request),
      });
      const next = planRetentionWork(work, purgeRecord, input.now);
      const persisted = await input.repository.persistPlan({
        prior: work,
        next,
        purge_record: purgeRecord,
      });
      if (persisted) summary.planned += 1;
      else summary.stale_fenced += 1;
    } catch {
      summary.failed_closed += 1;
    }
  }
  return summary;
}
