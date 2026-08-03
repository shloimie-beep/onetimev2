import { describe, expect, it, vi } from 'vitest';
import {
  adoptCompleteVimeoCatalog,
  assertNoRawVimeoReference,
  authorizeVimeoCatalogPlayback,
  buildCatalogAggregateEvidence,
  buildCatalogRevision,
  catalogRevisionForReview,
  classifyCompleteVimeoCatalog,
  classifyVimeoCatalogVideo,
  inventoryCompleteVimeoCatalog,
  protectVimeoProviderReference,
  unprotectVimeoProviderReference,
  type PrivateVimeoCatalogVideo,
  type VimeoCatalogPage,
} from '../../../packages/domain/src/content/vimeo-mishnayos-catalog.ts';
import type { VimeoMishnayosCatalogRevision } from '../../../packages/contracts/src/content/vimeo-mishnayos-catalog.ts';
import {
  MISHNAYOS_MASECHTA_COUNT,
  MISHNAYOS_TAXONOMY,
} from '../../../packages/domain/src/content/vimeo-mishnayos-taxonomy.ts';

const referenceKey = Buffer.alloc(32, 7);

function video(
  providerIdentity: string,
  title: string,
  input: Partial<PrivateVimeoCatalogVideo> = {},
): PrivateVimeoCatalogVideo {
  return {
    providerIdentity,
    title,
    description: '',
    tags: [],
    folders: [],
    showcases: [],
    durationSeconds: 120,
    createdAt: '2020-01-01T00:00:00.000Z',
    modifiedAt: '2020-01-01T00:00:00.000Z',
    language: 'en',
    privacyView: 'nobody',
    privacyEmbed: 'whitelist',
    thumbnailAvailable: true,
    captionsAvailable: false,
    ...input,
  };
}

describe('Vimeo Mishnayos taxonomy and classifier', () => {
  it('contains all six Sedarim and all 63 unique Masechtos', () => {
    expect(MISHNAYOS_TAXONOMY.map((seder) => seder.canonicalName)).toEqual([
      'Zeraim',
      'Moed',
      'Nashim',
      'Nezikin',
      'Kodashim',
      'Tohorot',
    ]);
    expect(MISHNAYOS_MASECHTA_COUNT).toBe(63);
    expect(
      new Set(
        MISHNAYOS_TAXONOMY.flatMap((seder) => seder.masechtos.map((entry) => entry.canonicalName)),
      ).size,
    ).toBe(63);
  });

  it.each([
    ['One Time Mishnayos — Bava Kamma — Perek 4', 'Bava Kamma'],
    ['Mishna Bava Metzia Perek 4', 'Bava Metzia'],
    ['Mishnayos Bava Batra Perek 2', 'Bava Batra'],
    ['Mishnayos Bava Basra Perek 2', 'Bava Batra'],
    ['Mishnayos Makkos Perek 1', 'Makkot'],
    ['Mishnayos Shevuos Perek 3', 'Shevuot'],
    ['Mishnayos Eduyos Perek 4', 'Eduyot'],
    ['Mishnayos Pirkei Avos Perek 1', 'Avot'],
    ['Mishnayos Horiyos Perek 2', 'Horayot'],
  ])('includes proven Nezikin Mishnayos variant %s', (title, masechta) => {
    const item = video('/videos/fixture_nezikin', title);
    const result = classifyVimeoCatalogVideo(item);
    expect(result.status).toBe('include_mishnayos');
    expect(result.matchedTerms).toContain(`masechta:${masechta}`);
  });

  it.each([
    'Gemara Bava Kamma Daf 4',
    'Talmud Bava Metzia 12a',
    'Bava Basra Daf 7 Amud B',
    'Mishnayos Bava Metzia — Gemara sugya',
  ])('excludes Gemara/Daf/Amud content even when the Masechta is known: %s', (title) => {
    expect(classifyVimeoCatalogVideo(video('/videos/fixture_gemara', title)).status).toBe(
      'exclude_non_mishnayos',
    );
  });

  it('quarantines a bare Masechta and never infers Perek from a trailing number', async () => {
    const item = video('/videos/fixture_ambiguous', 'Bava Metzia 4');
    expect(classifyVimeoCatalogVideo(item).status).toBe('quarantine_ambiguous');
    const inventory = {
      providerTotal: 1,
      observedRows: 1,
      uniqueVideos: [item],
      duplicateCount: 0,
      completedAt: '2026-08-03T00:00:00.000Z',
    };
    const [classified] = await classifyCompleteVimeoCatalog({ inventory });
    expect(classified?.metadata.perek).toBeNull();
  });

  it.each([
    'Rabbi stories for children',
    'Weekly Parsha inspiration',
    'Navi course trailer',
    'Funny short promo',
    'Music and merchandise advertisement',
  ])('excludes unrelated catalog category: %s', (title) => {
    expect(classifyVimeoCatalogVideo(video('/videos/fixture_unrelated', title)).status).toBe(
      'exclude_non_mishnayos',
    );
  });

  it('uses transient caption evidence only to resolve an otherwise ambiguous item', async () => {
    const item = video('/videos/fixture_caption', 'Bava Kamma 4', { captionsAvailable: true });
    const readCaptionEvidence = vi.fn(async () => ({
      mishnahTermPresent: true,
      gemaraTermPresent: false,
    }));
    const [classified] = await classifyCompleteVimeoCatalog({
      inventory: {
        providerTotal: 1,
        observedRows: 1,
        uniqueVideos: [item],
        duplicateCount: 0,
        completedAt: '2026-08-03T00:00:00.000Z',
      },
      adapter: { readPage: vi.fn(), readCaptionEvidence },
    });
    expect(classified?.classification.status).toBe('include_mishnayos');
    expect(classified?.classification.captionEvidenceUsed).toBe(true);
    expect(JSON.stringify(classified)).not.toContain('transcript');
  });
});

describe('complete, resumable Vimeo inventory', () => {
  it('paginates to provider total, retries, deduplicates, and reconciles exact counts', async () => {
    const pages = new Map<number, VimeoCatalogPage>([
      [
        1,
        {
          page: 1,
          perPage: 2,
          providerTotal: 4,
          items: [
            video('/videos/fixture_1', 'Mishnayos Berakhot Perek 1'),
            video('/videos/fixture_2', 'Parsha'),
          ],
          nextPage: 2,
        },
      ],
      [
        2,
        {
          page: 2,
          perPage: 2,
          providerTotal: 4,
          items: [
            video('/videos/fixture_2', 'Parsha'),
            video('/videos/fixture_3', 'Bava Metzia 4'),
          ],
          nextPage: null,
        },
      ],
    ]);
    let transientFailure = true;
    const readPage = vi.fn(async (page: number) => {
      if (page === 2 && transientFailure) {
        transientFailure = false;
        throw Object.assign(new Error('rate limited'), { retryable: true, retryAfterMs: 1 });
      }
      return pages.get(page)!;
    });
    const checkpoints: unknown[] = [];
    const result = await inventoryCompleteVimeoCatalog({
      adapter: { readPage },
      perPage: 2,
      sleep: async () => undefined,
      saveCheckpoint: async (checkpoint) => void checkpoints.push(checkpoint),
      now: () => new Date('2026-08-03T00:00:00.000Z'),
    });
    expect(result).toMatchObject({ providerTotal: 4, observedRows: 4, duplicateCount: 1 });
    expect(result.uniqueVideos).toHaveLength(3);
    expect(readPage).toHaveBeenCalledTimes(3);
    expect(checkpoints).toHaveLength(2);
  });

  it('resumes from a saved page without omissions or replaying completed pages', async () => {
    const first = video('/videos/fixture_resume_1', 'Mishnayos Peah Perek 1');
    const second = video('/videos/fixture_resume_2', 'Mishnayos Demai Perek 1');
    const readPage = vi.fn(async () => ({
      page: 2,
      perPage: 1,
      providerTotal: 2,
      items: [second],
      nextPage: null,
    }));
    const result = await inventoryCompleteVimeoCatalog({
      adapter: { readPage },
      perPage: 1,
      checkpoint: {
        schemaVersion: '1.0.0',
        nextPage: 2,
        providerTotal: 2,
        observedRows: 1,
        videos: [first],
      },
    });
    expect(readPage).toHaveBeenCalledWith(2, 1, undefined);
    expect(result.uniqueVideos.map((item) => item.providerIdentity)).toEqual([
      '/videos/fixture_resume_1',
      '/videos/fixture_resume_2',
    ]);
  });

  it('replays a completed checkpoint without another provider request', async () => {
    const item = video('/videos/fixture_complete', 'Mishnayos Challah Perek 1');
    const readPage = vi.fn();
    const result = await inventoryCompleteVimeoCatalog({
      adapter: { readPage },
      checkpoint: {
        schemaVersion: '1.0.0',
        nextPage: 2,
        providerTotal: 1,
        observedRows: 1,
        videos: [item],
      },
    });
    expect(readPage).not.toHaveBeenCalled();
    expect(result.uniqueVideos).toEqual([item]);
  });
});

describe('protected, idempotent catalog adoption', () => {
  it('performs one review-queue effect for an included fixture across exact replays', async () => {
    const item = video('/videos/fixture_adopt', 'Mishnayos Bava Metzia Perek 4');
    const classified = await classifyCompleteVimeoCatalog({
      inventory: {
        providerTotal: 1,
        observedRows: 1,
        uniqueVideos: [item],
        duplicateCount: 0,
        completedAt: '2026-08-03T00:00:00.000Z',
      },
    });
    const current = new Map<string, VimeoMishnayosCatalogRevision>();
    const revisions: VimeoMishnayosCatalogRevision[] = [];
    const reviewQueue: VimeoMishnayosCatalogRevision[] = [];
    const repository = {
      inTransaction: async <T>(run: (unit: never) => Promise<T>) =>
        run({
          getCurrent: async (_accountKey: string, digest: string) => {
            const revision = current.get(digest);
            return revision ? { revision, approved: false } : null;
          },
          insertRevision: async (revision: VimeoMishnayosCatalogRevision) =>
            void revisions.push(revision),
          setCurrent: async (revision: VimeoMishnayosCatalogRevision) =>
            void current.set(revision.providerIdentityDigest, revision),
          stageForCurrentReview: async (revision: VimeoMishnayosCatalogRevision) =>
            void reviewQueue.push(revision),
        } as never),
    };
    const first = await adoptCompleteVimeoCatalog({
      repository,
      accountKey: 'account_fixture',
      classified,
      referenceKey,
      now: '2026-08-03T00:00:00.000Z',
    });
    const replay = await adoptCompleteVimeoCatalog({
      repository,
      accountKey: 'account_fixture',
      classified,
      referenceKey,
      now: '2026-08-03T01:00:00.000Z',
    });
    expect(first).toMatchObject({ inserted: 1, replayed: 0, stagedForReview: 1 });
    expect(replay).toMatchObject({ inserted: 0, replayed: 1, stagedForReview: 0 });
    expect(revisions).toHaveLength(1);
    expect(reviewQueue).toHaveLength(1);
  });

  it('encrypts provider identity and omits it from review/API projections', async () => {
    const raw = '/videos/fixture_protected';
    const protectedReference = protectVimeoProviderReference(raw, referenceKey);
    expect(protectedReference).not.toContain(raw);
    expect(unprotectVimeoProviderReference(protectedReference, referenceKey)).toBe(raw);
    const item = video(raw, 'Mishnayos Bava Kamma Perek 4 Mishnah 1-3', {
      description: 'Archived at https://vimeo.com/123456 and /videos/private_fixture',
    });
    const [classified] = await classifyCompleteVimeoCatalog({
      inventory: {
        providerTotal: 1,
        observedRows: 1,
        uniqueVideos: [item],
        duplicateCount: 0,
        completedAt: '2026-08-03T00:00:00.000Z',
      },
    });
    const { revision } = buildCatalogRevision({
      accountKey: 'account_fixture',
      item: classified!,
      referenceKey,
      now: '2026-08-03T00:00:00.000Z',
    });
    const review = catalogRevisionForReview(revision);
    expect(review.rawProviderReferencePresent).toBe(false);
    expect(JSON.stringify(review)).not.toContain(raw);
    expect(JSON.stringify(review)).not.toContain('vimeo.com');
    expect(JSON.stringify(review)).not.toContain('/videos/private_fixture');
    expect(() => assertNoRawVimeoReference(review)).not.toThrow();
    expect(() => assertNoRawVimeoReference({ direct: raw })).toThrow();
  });

  it('replays exact metadata without duplicate effects and quarantines approved metadata changes', async () => {
    const initialVideo = video('/videos/fixture_replay', 'Mishnayos Bava Basra Perek 1');
    const classify = async (candidate: PrivateVimeoCatalogVideo) =>
      (
        await classifyCompleteVimeoCatalog({
          inventory: {
            providerTotal: 1,
            observedRows: 1,
            uniqueVideos: [candidate],
            duplicateCount: 0,
            completedAt: '2026-08-03T00:00:00.000Z',
          },
        })
      )[0]!;
    const first = buildCatalogRevision({
      accountKey: 'account_fixture',
      item: await classify(initialVideo),
      referenceKey,
      now: '2026-08-03T00:00:00.000Z',
    });
    const replay = buildCatalogRevision({
      accountKey: 'account_fixture',
      item: await classify(initialVideo),
      referenceKey,
      now: '2026-08-03T01:00:00.000Z',
      prior: first.revision,
    });
    expect(replay.replay).toBe(true);
    expect(replay.revision).toBe(first.revision);

    const changed = buildCatalogRevision({
      accountKey: 'account_fixture',
      item: await classify({ ...initialVideo, description: 'Provider metadata changed.' }),
      referenceKey,
      now: '2026-08-03T02:00:00.000Z',
      prior: first.revision,
      priorApproved: true,
    });
    expect(changed.replay).toBe(false);
    expect(changed.revision.publicationState).toBe('quarantined');
    expect(changed.revision.classification.reasonCodes).toEqual([
      'quarantined_provider_metadata_changed_after_review',
    ]);
  });

  it('emits only aggregate evidence whose status counts sum to every unique video', async () => {
    const inventory = {
      providerTotal: 3,
      observedRows: 3,
      uniqueVideos: [
        video('/videos/fixture_agg_1', 'Mishnayos Bava Kamma Perek 1'),
        video('/videos/fixture_agg_2', 'Gemara Bava Kamma Daf 1'),
        video('/videos/fixture_agg_3', 'Bava Kamma 1'),
      ],
      duplicateCount: 0,
      completedAt: '2026-08-03T00:00:00.000Z',
    };
    const aggregate = buildCatalogAggregateEvidence({
      inventory,
      classified: await classifyCompleteVimeoCatalog({ inventory }),
    });
    expect(aggregate.includeCount + aggregate.excludeCount + aggregate.quarantineCount).toBe(3);
    expect(aggregate.reconciled).toBe(true);
    expect(Object.keys(aggregate.countsBySeder)).toHaveLength(6);
    expect(Object.keys(aggregate.countsByMasechta)).toHaveLength(63);
    expect(Object.keys(aggregate.nezikinCounts)).toHaveLength(10);
    expect(aggregate.nezikinCounts['Bava Kamma']).toBe(1);
    expect(JSON.stringify(aggregate)).not.toContain('/videos/');
  });
});

describe('canonical Student playback policy', () => {
  const assignment = {
    contentId: 'content_fixture',
    contentVersionId: 'version_fixture',
    studentId: 'student_one',
    householdId: 'household_one',
    active: true,
    revoked: false,
  };
  const publication = {
    contentId: 'content_fixture',
    contentVersionId: 'version_fixture',
    classificationStatus: 'include_mishnayos' as const,
    publicationState: 'published' as const,
    participantReviewState: 'complete' as const,
    privacyReviewState: 'clear' as const,
    protectedProviderReferencePresent: true,
  };
  const principal = {
    role: 'student' as const,
    accountKey: 'account_fixture',
    productKey: 'one_time_mishnayos',
    studentId: 'student_one',
    householdId: 'household_one',
    sessionId: 'session_one',
    sessionActive: true,
    accessState: 'active' as const,
  };

  it('grants entitled Student playback only through the first-party bootstrap', () => {
    const grant = authorizeVimeoCatalogPlayback({
      assignment,
      publication,
      principal,
      now: new Date('2026-08-03T00:00:00.000Z'),
    });
    expect(grant.bootstrapPath).toBe('/api/v1/student/library/content_fixture/playback');
    expect(() => assertNoRawVimeoReference(grant)).not.toThrow();
  });

  it.each([
    ['parent', { principal: { ...principal, role: 'parent' as const } }],
    ['sibling', { principal: { ...principal, studentId: 'student_sibling' } }],
    ['cross-household', { principal: { ...principal, householdId: 'household_other' } }],
    ['inactive', { principal: { ...principal, accessState: 'inactive' as const } }],
    ['archived', { principal: { ...principal, accessState: 'archived' as const } }],
    ['revoked', { assignment: { ...assignment, revoked: true } }],
    ['unpublished', { publication: { ...publication, publicationState: 'unpublished' as const } }],
    [
      'quarantined',
      { publication: { ...publication, classificationStatus: 'quarantine_ambiguous' as const } },
    ],
  ])('denies %s playback', (_label, override) => {
    const changes = override as Partial<{
      assignment: typeof assignment;
      publication: Parameters<typeof authorizeVimeoCatalogPlayback>[0]['publication'];
      principal: Parameters<typeof authorizeVimeoCatalogPlayback>[0]['principal'];
    }>;
    expect(() =>
      authorizeVimeoCatalogPlayback({
        assignment: changes.assignment ?? assignment,
        publication: changes.publication ?? publication,
        principal: changes.principal ?? principal,
        now: new Date('2026-08-03T00:00:00.000Z'),
      }),
    ).toThrow('CATALOG_PLAYBACK_UNAVAILABLE');
  });
});
