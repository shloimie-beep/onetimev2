import { describe, expect, it } from 'vitest';
import type {
  ContentPublicationPrincipal,
  ContentPublicationRecord,
  StudentContentEntitlement,
} from '../../../../contracts/src/content/publication/index.ts';
import { ContentPublicationError } from './errors.ts';
import {
  approveContent,
  attachOccurrence,
  authorizeStudentPlayback,
  recordPrivatePublication,
  requestPrivatePublication,
  saveStudentResume,
  searchStudentLibrary,
  unpublishContent,
} from './lifecycle.ts';

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

function content(overrides: Partial<ContentPublicationRecord> = {}): ContentPublicationRecord {
  return {
    contentId: 'content_one',
    version: 4,
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
    ...overrides,
  };
}

function binding(expectedVersion: number, digit = 'a') {
  return {
    idempotencyKey: `p21.operation.${expectedVersion}`,
    requestHash: hash(digit),
    expectedVersion,
    occurredAt: '2026-07-29T10:40:00.000Z',
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

describe('P21 publication lifecycle', () => {
  it('requires Admin approval and creates bounded private publish/revoke intents', () => {
    const draft = content();
    const attached = attachOccurrence({
      principal: admin,
      record: draft,
      occurrenceId: 'occurrence_two',
      binding: binding(4),
    });
    expect(attached.occurrenceIds).toEqual(['occurrence_one', 'occurrence_two']);
    expect(
      attachOccurrence({
        principal: admin,
        record: attached,
        occurrenceId: 'occurrence_two',
        binding: binding(5),
      }),
    ).toBe(attached);
    expect(() =>
      requestPrivatePublication({ principal: admin, record: draft, binding: binding(4) }),
    ).toThrowError(/approval is required/i);

    const approved = approveContent({
      principal: admin,
      record: draft,
      approvalId: 'approval_one',
      policyVersion: 'content-publication-v1',
      binding: binding(4),
    });
    const requested = requestPrivatePublication({
      principal: admin,
      record: approved,
      binding: binding(5, 'b'),
    });
    expect(requested.record).toMatchObject({
      state: 'publishing',
      publicationGeneration: 1,
      opaqueProviderAssetRef: null,
    });
    expect(requested.intent).toMatchObject({
      operation: 'publish_private',
      publicationGeneration: 1,
      state: 'pending',
    });

    const published = recordPrivatePublication({
      principal: admin,
      record: requested.record,
      publicationGeneration: 1,
      opaqueProviderAssetRef: 'asset_private_01',
      binding: binding(6, 'c'),
    });
    expect(published).toMatchObject({
      state: 'published',
      opaqueProviderAssetRef: 'asset_private_01',
    });
    expect(() =>
      recordPrivatePublication({
        principal: admin,
        record: requested.record,
        publicationGeneration: 1,
        opaqueProviderAssetRef: 'https://player.invalid/private',
        binding: binding(6, 'c'),
      }),
    ).toThrowError(/opaque and non-routable/i);

    const revoked = unpublishContent({
      principal: admin,
      record: published,
      binding: binding(7, 'd'),
    });
    expect(revoked.record.state).toBe('archived');
    expect(revoked.intent.operation).toBe('revoke_private');
  });

  it('grants only an entitled active Student a renewable five-minute internal bootstrap', () => {
    const published = content({
      state: 'published',
      opaqueProviderAssetRef: 'asset_private_01',
      approval: {
        approvalId: 'approval_one',
        approvedByAdminId: 'admin_one',
        approvedAt: '2026-07-29T10:40:00.000Z',
        policyVersion: 'content-publication-v1',
      },
      publicationGeneration: 1,
      publishedAt: '2026-07-29T10:42:00.000Z',
    });
    const grant = authorizeStudentPlayback({
      principal: student,
      record: published,
      entitlement: entitlement(),
      now: new Date('2026-07-29T10:45:00.000Z'),
      playbackSessionId: 'session_one',
    });
    expect(grant).toEqual({
      contentId: 'content_one',
      publicationVersion: 4,
      playbackSessionId: 'session_one',
      bootstrapPath: '/api/v1/student/library/content_one/playback',
      issuedAt: '2026-07-29T10:45:00.000Z',
      expiresAt: '2026-07-29T10:50:00.000Z',
      renewable: true,
    });
    expect(JSON.stringify(grant)).not.toMatch(/vimeo|https?:|asset_private/i);

    for (const denial of [
      { principal: parent, entitlement: entitlement() },
      { principal: student, entitlement: entitlement({ studentId: 'student_sibling' }) },
      { principal: student, entitlement: entitlement({ householdId: 'household_other' }) },
      { principal: student, entitlement: entitlement({ active: false }) },
      { principal: student, entitlement: entitlement({ occurrenceId: 'occurrence_other' }) },
      { principal: student, entitlement: null },
      { principal: { ...student, accessState: 'inactive' as const }, entitlement: entitlement() },
    ]) {
      expect(() =>
        authorizeStudentPlayback({
          principal: denial.principal,
          record: published,
          entitlement: denial.entitlement,
          now: new Date('2026-07-29T10:45:00.000Z'),
          playbackSessionId: 'session_one',
        }),
      ).toThrowError(ContentPublicationError);
    }
    expect(() =>
      authorizeStudentPlayback({
        principal: student,
        record: { ...published, state: 'archived' },
        entitlement: entitlement(),
        now: new Date('2026-07-29T10:45:00.000Z'),
        playbackSessionId: 'session_one',
      }),
    ).toThrowError(/unavailable/i);
  });

  it('searches only authorized published content and isolates resume by Student and version', () => {
    const published = content({
      state: 'published',
      opaqueProviderAssetRef: 'asset_private_01',
      approval: {
        approvalId: 'approval_one',
        approvedByAdminId: 'admin_one',
        approvedAt: '2026-07-29T10:40:00.000Z',
        policyVersion: 'content-publication-v1',
      },
      publicationGeneration: 1,
      publishedAt: '2026-07-29T10:42:00.000Z',
    });
    const saved = saveStudentResume({
      principal: student,
      record: published,
      entitlement: entitlement(),
      existing: null,
      positionMs: 125_000,
      occurredAt: '2026-07-29T10:46:00.000Z',
    });
    for (const query of [
      'Berachos Review',
      'evening shema',
      '2026-07-27',
      'Berachos',
      'Berachos 1:1',
    ]) {
      const results = searchStudentLibrary({
        principal: student,
        query,
        published: [published, { ...published, contentId: 'content_other', title: 'Other lesson' }],
        entitlements: new Map([
          ['content_one', entitlement()],
          ['content_other', entitlement({ contentId: 'content_other', active: false })],
        ]),
        resumes: new Map([['content_one', saved]]),
      });
      expect(results).toEqual([
        expect.objectContaining({
          contentId: 'content_one',
          resumePositionMs: 125_000,
          internalRoute: '/app/student/library/content_one',
        }),
      ]);
    }
    expect(
      searchStudentLibrary({
        principal: student,
        query: 'berachos 1:1',
        published: [published],
        entitlements: new Map([['content_one', entitlement()]]),
        resumes: new Map([
          ['content_one', { ...saved, studentId: 'student_sibling', positionMs: 999_000 }],
        ]),
      })[0]?.resumePositionMs,
    ).toBe(0);
    expect(() =>
      saveStudentResume({
        principal: student,
        record: published,
        entitlement: entitlement(),
        existing: { ...saved, studentId: 'student_sibling' },
        positionMs: 1,
        occurredAt: '2026-07-29T10:47:00.000Z',
      }),
    ).toThrowError(/another Student scope/i);
    expect(() =>
      saveStudentResume({
        principal: student,
        record: published,
        entitlement: entitlement(),
        existing: saved,
        positionMs: published.durationMs + 1,
        occurredAt: '2026-07-29T10:47:00.000Z',
      }),
    ).toThrowError(/outside the published media duration/i);
  });
});
