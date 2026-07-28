import {
  ZOOM_PREPARATION_ERROR_CODES,
  type ConfirmZoomPreparationCommand,
  type OccurrenceRosterSnapshot,
  type PrepareZoomPreviewCommand,
  type ZoomPreparationRepository,
  type ZoomPreparationSaga,
} from '../../../../../../../packages/contracts/src/classroom/zoom-preparation/index.ts';
import type { ClassOccurrenceRecord } from '../../../../../../../packages/contracts/src/classes/core/index.ts';
import {
  ZoomPreparationError,
  buildPreparationPreview,
  buildRosterSnapshot,
  confirmPreparation,
  createPreparationDraft,
  createProvisioningPlan,
} from '../../../../../../../packages/domain/src/classroom/zoom-preparation/index.ts';

export class ZoomPreparationService {
  constructor(private readonly repository: ZoomPreparationRepository) {}

  async preparePreview(command: PrepareZoomPreviewCommand): Promise<{
    saga: ZoomPreparationSaga;
    roster: OccurrenceRosterSnapshot;
    replayed: boolean;
  }> {
    assertPrepareActor(command);
    const draft = createPreparationDraft({
      scope: command.scope,
      occurrence: command.occurrence,
      rosterVersion: command.rosterVersion,
      trigger: command.trigger,
      occurredAt: command.occurredAt,
    });
    const roster = buildRosterSnapshot({
      scope: command.scope,
      occurrence: command.occurrence,
      rosterVersion: command.rosterVersion,
      students: command.students,
      generatedAt: command.occurredAt,
    });
    const previewed = buildPreparationPreview({
      saga: draft,
      occurrence: command.occurrence,
      roster,
      occurredAt: command.occurredAt,
    });
    return this.repository.inTransaction(async (unit) => {
      const receipt = await unit.getReceipt(command.scope, command.idempotencyKey);
      if (receipt) {
        assertReplay(receipt.requestHash, command.requestHash);
        const prior = await unit.getSaga(command.scope, receipt.resultRef);
        if (!prior) throw invalidState('Preparation receipt has no matching saga.');
        const priorRoster = prior.preview
          ? await unit.getRoster(command.scope, prior.preview.rosterSnapshotId)
          : null;
        if (!priorRoster) throw invalidState('Preparation receipt has no matching roster.');
        return { saga: prior, roster: priorRoster, replayed: true };
      }
      await unit.saveRoster(roster);
      await unit.saveSaga(previewed.saga);
      await unit.saveReceipt({
        accountKey: command.scope.accountKey,
        productKey: command.scope.productKey,
        idempotencyKey: command.idempotencyKey,
        requestHash: command.requestHash,
        operation: 'prepare_preview',
        resultRef: previewed.saga.id,
        resultVersion: previewed.saga.version,
        committedAt: command.occurredAt,
      });
      return { saga: previewed.saga, roster, replayed: false };
    });
  }

  async confirm(
    command: ConfirmZoomPreparationCommand,
    occurrence: ClassOccurrenceRecord,
  ): Promise<{ saga: ZoomPreparationSaga; replayed: boolean }> {
    return this.repository.inTransaction(async (unit) => {
      const receipt = await unit.getReceipt(command.actor, command.idempotencyKey);
      if (receipt) {
        assertReplay(receipt.requestHash, command.requestHash);
        const prior = await unit.getSaga(command.actor, receipt.resultRef);
        if (!prior) throw invalidState('Confirmation receipt has no matching saga.');
        return { saga: prior, replayed: true };
      }
      const current = await unit.getSaga(command.actor, command.sagaId);
      if (!current?.preview) throw invalidState('Preparation preview was not found.');
      const roster = await unit.getRoster(command.actor, current.preview.rosterSnapshotId);
      if (!roster) throw invalidState('Preparation roster was not found.');
      const confirmed = confirmPreparation({
        actor: command.actor,
        saga: current,
        expectedVersion: command.expectedVersion,
        previewDigest: command.previewDigest,
        occurredAt: command.occurredAt,
      });
      const plan = createProvisioningPlan({
        saga: confirmed,
        occurrence,
        roster,
        binding: command.providerBinding,
        occurredAt: command.occurredAt,
      });
      const existing = await unit.getClassroomResource(command.actor, occurrence.id);
      if (existing && existing.id !== plan.resource.id) {
        throw new ZoomPreparationError(
          ZOOM_PREPARATION_ERROR_CODES.conflict,
          'Occurrence already has a different current classroom resource.',
        );
      }
      await unit.saveClassroomResource(plan.resource);
      for (const registrant of plan.registrants) await unit.saveRegistrant(registrant);
      for (const operation of plan.operations) await unit.saveProviderOperation(operation);
      await unit.saveSaga(plan.saga);
      await unit.saveReceipt({
        accountKey: command.actor.accountKey,
        productKey: command.actor.productKey,
        idempotencyKey: command.idempotencyKey,
        requestHash: command.requestHash,
        operation: 'confirm_preparation',
        resultRef: plan.saga.id,
        resultVersion: plan.saga.version,
        committedAt: command.occurredAt,
      });
      return { saga: plan.saga, replayed: false };
    });
  }
}

function assertReplay(prior: string, current: string) {
  if (prior !== current) {
    throw new ZoomPreparationError(
      ZOOM_PREPARATION_ERROR_CODES.conflict,
      'Idempotency key was already used for another request.',
    );
  }
}

function invalidState(message: string) {
  return new ZoomPreparationError(ZOOM_PREPARATION_ERROR_CODES.invalidState, message);
}

function assertPrepareActor(command: PrepareZoomPreviewCommand) {
  if (
    (command.trigger === 'automatic_24h' && command.actor.role !== 'scheduler') ||
    (command.trigger === 'admin_manual' &&
      (command.actor.role !== 'admin' ||
        command.actor.accountKey !== command.scope.accountKey ||
        command.actor.productKey !== command.scope.productKey))
  ) {
    throw new ZoomPreparationError(
      ZOOM_PREPARATION_ERROR_CODES.accessDenied,
      'Automatic preparation requires the scheduler; early preparation requires scoped Admin.',
    );
  }
}
