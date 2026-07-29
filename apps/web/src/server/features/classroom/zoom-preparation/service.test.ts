import { describe, expect, it } from 'vitest';

import type {
  OccurrenceRosterSnapshot,
  PrepareZoomPreviewCommand,
  ZoomPreparationCommandReceipt,
  ZoomPreparationRepository,
  ZoomPreparationSaga,
  ZoomPreparationUnitOfWork,
} from '../../../../../../../packages/contracts/src/classroom/zoom-preparation/index.ts';
import { prepareZoomPreviewRequestHash } from '../../../../../../../packages/domain/src/classroom/zoom-preparation/index.ts';
import { ZoomPreparationService } from './service.ts';

class MemoryRepository implements ZoomPreparationRepository {
  sagas = new Map<string, ZoomPreparationSaga>();
  rosters = new Map<string, OccurrenceRosterSnapshot>();
  receipts = new Map<string, ZoomPreparationCommandReceipt>();

  async inTransaction<T>(run: (unit: ZoomPreparationUnitOfWork) => Promise<T>) {
    return run({
      getSaga: async (_scope, id) => this.sagas.get(id) ?? null,
      saveSaga: async (value) => {
        this.sagas.set(value.id, structuredClone(value));
      },
      getRoster: async (_scope, id) => this.rosters.get(id) ?? null,
      saveRoster: async (value) => {
        this.rosters.set(value.id, structuredClone(value));
      },
      getClassroomResource: async () => null,
      saveClassroomResource: async () => undefined,
      listRegistrants: async () => [],
      saveRegistrant: async () => undefined,
      saveProviderOperation: async () => undefined,
      saveLaunchGrant: async () => undefined,
      getLiveSession: async () => null,
      saveLiveSession: async () => undefined,
      getReceipt: async (_scope, key) => this.receipts.get(key) ?? null,
      saveReceipt: async (value) => {
        this.receipts.set(value.idempotencyKey, structuredClone(value));
      },
    });
  }
}

function commandFixture(): PrepareZoomPreviewCommand {
  const scope = { accountKey: 'account-1', productKey: 'one-time' };
  const now = '2026-07-29T16:00:00.000Z';
  const command: PrepareZoomPreviewCommand = {
    actor: { role: 'scheduler', principalId: 'scheduler-1' },
    scope,
    occurrence: {
      ...scope,
      id: 'occurrence-1',
      seriesId: 'canonical-class',
      localClassDate: '2026-07-30',
      startsAt: '2026-07-30T16:00:00.000Z',
      scheduledEndsAt: '2026-07-30T17:00:00.000Z',
      joinOpensAt: '2026-07-30T15:50:00.000Z',
      joinClosesAt: '2026-07-30T17:15:00.000Z',
      state: 'scheduled',
      scheduleVersion: 1,
      version: 1,
      createdAt: now,
      updatedAt: now,
    },
    students: [
      {
        student: {
          ...scope,
          studentId: 'student-1',
          householdId: 'household-1',
          state: 'active',
          version: 1,
        },
        enrollment: {
          ...scope,
          id: 'enrollment-1',
          seriesId: 'canonical-class',
          studentId: 'student-1',
          householdId: 'household-1',
          state: 'active',
          source: 'student_activation',
          effectiveAt: now,
          idempotencyKey: 'enrollment-1',
          auditRef: 'audit-1',
          version: 1,
        },
        householdAccess: 'active',
        serviceAccountConsent: 'accepted',
        serviceAccountConsentVersion: 1,
        recordingParticipationConsent: 'accepted',
        recordingParticipationConsentVersion: 1,
        memberRecognitionConsent: 'accepted',
        memberRecognitionConsentVersion: 1,
        approvedClassroomName: 'Student One',
      },
    ],
    trigger: 'automatic_24h',
    rosterVersion: 1,
    idempotencyKey: 'prepare-1',
    requestHash: '',
    occurredAt: now,
  };
  return { ...command, requestHash: prepareZoomPreviewRequestHash(command) };
}

describe('P17 Zoom preparation server service', () => {
  it('commits preview, roster, and receipt once and replays without duplication', async () => {
    const repository = new MemoryRepository();
    const service = new ZoomPreparationService(repository);
    const command = commandFixture();
    const first = await service.preparePreview(command);
    const replay = await service.preparePreview(command);
    expect(first).toMatchObject({ replayed: false, saga: { state: 'preview_ready' } });
    expect(replay).toMatchObject({ replayed: true, saga: { id: first.saga.id } });
    expect(repository.sagas.size).toBe(1);
    expect(repository.rosters.size).toBe(1);
    expect(repository.receipts.size).toBe(1);
  });

  it('rejects an Admin-only trigger from the scheduler', async () => {
    const command = { ...commandFixture(), trigger: 'admin_manual' as const };
    await expect(
      new ZoomPreparationService(new MemoryRepository()).preparePreview(command),
    ).rejects.toThrow('requires scoped Admin');
  });

  it('rejects a request hash not recomputed from the canonical command', async () => {
    const command = commandFixture();
    await expect(
      new ZoomPreparationService(new MemoryRepository()).preparePreview({
        ...command,
        rosterVersion: command.rosterVersion + 1,
      }),
    ).rejects.toThrow('canonical validated command');
  });
});
