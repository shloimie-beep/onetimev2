import { describe, expect, it, vi } from 'vitest';
import type {
  ContentPublicationOutboxIntent,
  ContentPublicationPrincipal,
  ContentPublicationReceipt,
  ContentPublicationRecord,
  ContentPublicationRepository,
  ContentPublicationUnitOfWork,
  StudentContentEntitlement,
  StudentContentResume,
} from '../../../../../../../packages/contracts/src/content/publication/index.ts';
import { ContentPublicationError } from '../../../../../../../packages/domain/src/content/publication/index.ts';
import { createContentPublicationService, publicationRequestHash } from './service.ts';

const hash = (digit: string) => digit.repeat(64);
const admin: ContentPublicationPrincipal = {
  actorId: 'admin_one',
  role: 'admin',
  productKey: 'one_time_mishnayos',
  householdId: 'admin_scope',
  studentId: null,
  accessState: 'active',
};
const student: ContentPublicationPrincipal = {
  actorId: 'account_student_one',
  role: 'student',
  productKey: 'one_time_mishnayos',
  householdId: 'household_one',
  studentId: 'student_one',
  accessState: 'active',
};
const parent: ContentPublicationPrincipal = {
  actorId: 'parent_one',
  role: 'parent',
  productKey: 'one_time_mishnayos',
  householdId: 'household_one',
  studentId: null,
  accessState: 'active',
};

describe('P21 content publication service', () => {
  it('hashes semantic request objects canonically', () => {
    expect(publicationRequestHash({ contentId: 'content_one', positionMs: 125_000 })).toBe(
      publicationRequestHash({ positionMs: 125_000, contentId: 'content_one' }),
    );
    expect(publicationRequestHash({ positionMs: 125_001, contentId: 'content_one' })).not.toBe(
      publicationRequestHash({ positionMs: 125_000, contentId: 'content_one' }),
    );
  });

  it('persists idempotent approval, private publication, playback, resume, and revoke', async () => {
    const memory = new MemoryPublicationRepository();
    memory.records.set('content_one', draft());
    memory.entitlements.set('student_one:content_one', entitlement());
    const publishPrivate = vi.fn(async () => ({ opaqueProviderAssetRef: 'asset_private_01' }));
    const revokePrivate = vi.fn(async () => undefined);
    const service = createContentPublicationService({
      repository: memory,
      provider: { publishPrivate, revokePrivate },
      createId: () => 'session_001',
    });

    const approved = await service.approve({
      principal: admin,
      contentId: 'content_one',
      approvalId: 'approval_one',
      policyVersion: 'content-publication-v1',
      binding: command(1, 'approval.key', 'a'),
    });
    expect(approved).toMatchObject({ replay: false, record: { state: 'approved', version: 2 } });
    await expect(
      service.approve({
        principal: admin,
        contentId: 'content_one',
        approvalId: 'approval_one',
        policyVersion: 'content-publication-v1',
        binding: command(1, 'approval.key', 'a'),
      }),
    ).resolves.toMatchObject({ replay: true, record: { state: 'approved', version: 2 } });
    await expect(
      service.approve({
        principal: admin,
        contentId: 'content_one',
        approvalId: 'approval_one',
        policyVersion: 'content-publication-v1',
        binding: command(1, 'approval.key', 'f'),
      }),
    ).rejects.toThrowError(/different request/i);
    await expect(
      service.approve({
        principal: parent,
        contentId: 'content_one',
        approvalId: 'approval_one',
        policyVersion: 'content-publication-v1',
        binding: command(1, 'approval.key', 'a'),
      }),
    ).rejects.toThrowError(/Admin publication access is unavailable/i);

    await service.requestPublish({
      principal: admin,
      contentId: 'content_one',
      binding: command(2, 'publish.key', 'b'),
    });
    expect(memory.intents).toEqual([
      expect.objectContaining({ operation: 'publish_private', state: 'pending' }),
    ]);

    await service.dispatchPrivatePublish({
      principal: admin,
      contentId: 'content_one',
      binding: command(3, 'publish.complete.key', 'c'),
    });
    expect(publishPrivate).toHaveBeenCalledWith({
      contentId: 'content_one',
      publicationGeneration: 1,
      idempotencyKey: 'publish.complete.key',
      requestHash: hash('c'),
    });
    expect(memory.records.get('content_one')).toMatchObject({
      state: 'published',
      version: 4,
      opaqueProviderAssetRef: 'asset_private_01',
    });
    await expect(
      service.dispatchPrivatePublish({
        principal: admin,
        contentId: 'content_one',
        binding: command(3, 'publish.complete.key', 'c'),
      }),
    ).resolves.toMatchObject({ replay: true, record: { state: 'published', version: 4 } });
    expect(publishPrivate).toHaveBeenCalledTimes(1);

    const grant = await service.playback({
      principal: student,
      contentId: 'content_one',
      now: new Date('2026-07-29T10:45:00.000Z'),
    });
    expect(grant).toMatchObject({
      bootstrapPath: '/api/v1/student/library/content_one/playback',
      expiresAt: '2026-07-29T10:50:00.000Z',
    });
    expect(JSON.stringify(grant)).not.toMatch(/vimeo|asset_private|https?:/i);
    await expect(
      service.playback({
        principal: parent,
        contentId: 'content_one',
        now: new Date('2026-07-29T10:45:00.000Z'),
      }),
    ).rejects.toThrowError(ContentPublicationError);

    await service.saveResume({
      principal: student,
      contentId: 'content_one',
      positionMs: 125_000,
      binding: command(4, 'resume.key', 'd'),
    });
    await expect(service.library({ principal: student, query: 'Berachos 1:1' })).resolves.toEqual([
      expect.objectContaining({ contentId: 'content_one', resumePositionMs: 125_000 }),
    ]);
    await expect(service.library({ principal: parent, query: '' })).rejects.toThrowError(
      ContentPublicationError,
    );

    await service.unpublish({
      principal: admin,
      contentId: 'content_one',
      binding: command(4, 'unpublish.key', 'e'),
    });
    expect(memory.records.get('content_one')?.state).toBe('archived');
    expect(memory.intents.map((intent) => intent.operation)).toEqual([
      'publish_private',
      'revoke_private',
    ]);
    await expect(
      service.playback({
        principal: student,
        contentId: 'content_one',
        now: new Date('2026-07-29T10:50:00.000Z'),
      }),
    ).rejects.toThrowError(/unavailable/i);
    await expect(
      service.saveResume({
        principal: student,
        contentId: 'content_one',
        positionMs: 125_000,
        binding: command(4, 'resume.key', 'd'),
      }),
    ).rejects.toThrowError(/unavailable/i);
    expect(revokePrivate).not.toHaveBeenCalled();
  });

  it('fails closed for stale versions, sibling entitlements, and unsafe provider output', async () => {
    const memory = new MemoryPublicationRepository();
    memory.records.set('content_one', {
      ...draft(),
      version: 4,
      state: 'publishing',
      approval: {
        approvalId: 'approval_one',
        approvedByAdminId: 'admin_one',
        approvedAt: '2026-07-29T10:40:00.000Z',
        policyVersion: 'content-publication-v1',
      },
      publicationGeneration: 1,
    });
    memory.entitlements.set(
      'student_one:content_one',
      entitlement({ studentId: 'student_sibling' }),
    );
    const service = createContentPublicationService({
      repository: memory,
      provider: {
        publishPrivate: async () => ({
          opaqueProviderAssetRef: 'https://player.invalid/private',
        }),
        revokePrivate: async () => undefined,
      },
      createId: () => 'session_001',
    });

    await expect(
      service.dispatchPrivatePublish({
        principal: admin,
        contentId: 'content_one',
        binding: command(4, 'publish.complete.key', 'c'),
      }),
    ).rejects.toThrowError(/opaque and non-routable/i);
    await expect(
      service.playback({
        principal: student,
        contentId: 'content_one',
        now: new Date('2026-07-29T10:45:00.000Z'),
      }),
    ).rejects.toThrowError(ContentPublicationError);
    await expect(
      service.attachOccurrence({
        principal: admin,
        contentId: 'content_one',
        occurrenceId: 'occurrence_two',
        binding: command(3, 'attach.key', 'f'),
      }),
    ).rejects.toThrowError(/version changed/i);
  });
});

function command(expectedVersion: number, idempotencyKey: string, digit: string) {
  return {
    expectedVersion,
    idempotencyKey,
    requestHash: hash(digit),
    occurredAt: '2026-07-29T10:44:00.000Z',
  };
}

function draft(): ContentPublicationRecord {
  return {
    contentId: 'content_one',
    version: 1,
    state: 'needs_review',
    title: 'Berachos Review',
    englishTranscriptText: 'The class discusses the first Mishnah and evening Shema.',
    classTopic: 'Berachos',
    mishnahReferences: ['Berachos 1:1'],
    occurredAt: '2026-07-27T16:00:00.000Z',
    updatedAt: '2026-07-27T16:00:00.000Z',
    durationMs: 3_600_000,
    approval: null,
    publicationGeneration: 0,
    opaqueProviderAssetRef: null,
    publishedAt: null,
    archivedAt: null,
    occurrenceIds: ['occurrence_one'],
  };
}

function entitlement(
  overrides: Partial<StudentContentEntitlement> = {},
): StudentContentEntitlement {
  return {
    contentId: 'content_one',
    studentId: 'student_one',
    householdId: 'household_one',
    occurrenceId: 'occurrence_one',
    active: true,
    ...overrides,
  };
}

class MemoryPublicationRepository
  implements ContentPublicationRepository, ContentPublicationUnitOfWork
{
  readonly records = new Map<string, ContentPublicationRecord>();
  readonly entitlements = new Map<string, StudentContentEntitlement>();
  readonly resumes = new Map<string, StudentContentResume>();
  readonly receipts = new Map<string, ContentPublicationReceipt>();
  readonly intents: ContentPublicationOutboxIntent[] = [];

  async inTransaction<T>(work: (unit: ContentPublicationUnitOfWork) => Promise<T>) {
    return work(this);
  }

  async getContent(contentId: string) {
    return this.records.get(contentId) ?? null;
  }

  async saveContent(record: ContentPublicationRecord, expectedVersion: number) {
    if (this.records.get(record.contentId)?.version !== expectedVersion) {
      throw new Error('optimistic_conflict');
    }
    this.records.set(record.contentId, record);
  }

  async findReceipt(operation: ContentPublicationReceipt['operation'], idempotencyKey: string) {
    return this.receipts.get(`${operation}:${idempotencyKey}`) ?? null;
  }

  async saveReceipt(receipt: ContentPublicationReceipt) {
    this.receipts.set(`${receipt.operation}:${receipt.idempotencyKey}`, receipt);
  }

  async saveOutboxIntent(intent: ContentPublicationOutboxIntent) {
    this.intents.push(intent);
  }

  async listPublishedContent() {
    return [...this.records.values()].filter((record) => record.state === 'published');
  }

  async getEntitlement(studentId: string, contentId: string) {
    return this.entitlements.get(`${studentId}:${contentId}`) ?? null;
  }

  async getResume(studentId: string, contentId: string) {
    return this.resumes.get(`${studentId}:${contentId}`) ?? null;
  }

  async saveResume(resume: StudentContentResume, expectedVersion: number | null) {
    const current = this.resumes.get(`${resume.studentId}:${resume.contentId}`);
    if ((current?.version ?? null) !== expectedVersion) throw new Error('resume_conflict');
    this.resumes.set(`${resume.studentId}:${resume.contentId}`, resume);
  }
}
