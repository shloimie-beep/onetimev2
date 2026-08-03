import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import type {
  MishnayosMasechtaTaxon,
  MishnayosSederName,
  VimeoMishnayosCatalogAggregateEvidence,
  VimeoMishnayosCatalogMetadata,
  VimeoMishnayosCatalogRevision,
  VimeoMishnayosClassificationEvidence,
  VimeoMishnayosClassificationStatus,
} from '../../../contracts/src/content/vimeo-mishnayos-catalog.ts';
import {
  VIMEO_MISHNAYOS_CATALOG_SCHEMA_VERSION,
  VIMEO_MISHNAYOS_CLASSIFIER_VERSION,
  VIMEO_MISHNAYOS_CONTENT_FAMILY,
  VIMEO_MISHNAYOS_PRODUCT_KEY,
  VIMEO_MISHNAYOS_TAXONOMY_VERSION,
  VIMEO_MISHNAYOS_TEACHER,
} from '../../../contracts/src/content/vimeo-mishnayos-catalog.ts';
import { MISHNAYOS_TAXONOMY, MISHNAYOS_TAXONOMY_DIGEST } from './vimeo-mishnayos-taxonomy.ts';

export interface PrivateVimeoCatalogVideo {
  providerIdentity: string;
  title: string;
  description: string;
  tags: readonly string[];
  folders: readonly string[];
  showcases: readonly string[];
  durationSeconds: number | null;
  createdAt: string | null;
  modifiedAt: string | null;
  language: string | null;
  privacyView: string | null;
  privacyEmbed: string | null;
  thumbnailAvailable: boolean;
  captionsAvailable: boolean;
  captionEvidence?: {
    mishnahTermPresent: boolean;
    gemaraTermPresent: boolean;
  };
}

export interface VimeoCatalogPage {
  page: number;
  perPage: number;
  providerTotal: number;
  items: readonly PrivateVimeoCatalogVideo[];
  nextPage: number | null;
}

export interface VimeoCatalogReadAdapter {
  readPage(page: number, perPage: number, signal?: AbortSignal): Promise<VimeoCatalogPage>;
  readCaptionEvidence?(
    video: PrivateVimeoCatalogVideo,
    signal?: AbortSignal,
  ): Promise<{ mishnahTermPresent: boolean; gemaraTermPresent: boolean }>;
}

export interface PrivateVimeoInventoryCheckpoint {
  schemaVersion: typeof VIMEO_MISHNAYOS_CATALOG_SCHEMA_VERSION;
  nextPage: number;
  providerTotal: number | null;
  observedRows: number;
  videos: readonly PrivateVimeoCatalogVideo[];
}

export interface PrivateVimeoInventoryResult {
  providerTotal: number;
  observedRows: number;
  uniqueVideos: readonly PrivateVimeoCatalogVideo[];
  duplicateCount: number;
  completedAt: string;
}

export interface ClassifiedVimeoCatalogVideo {
  video: PrivateVimeoCatalogVideo;
  classification: VimeoMishnayosClassificationEvidence;
  metadata: VimeoMishnayosCatalogMetadata;
  metadataDigest: string;
}

export interface VimeoCatalogPlaybackPrincipal {
  role: 'admin' | 'parent' | 'student';
  accountKey: string;
  productKey: string;
  studentId: string | null;
  householdId: string;
  sessionId: string | null;
  sessionActive: boolean;
  accessState: 'active' | 'grace' | 'inactive' | 'archived';
}

export interface VimeoCatalogLibraryAssignment {
  contentId: string;
  contentVersionId: string;
  studentId: string;
  householdId: string;
  active: boolean;
  revoked: boolean;
}

export interface VimeoCatalogPublicationFacts {
  contentId: string;
  contentVersionId: string;
  classificationStatus: VimeoMishnayosClassificationStatus;
  publicationState: 'needs_review' | 'published' | 'unpublished' | 'archived';
  participantReviewState: 'pending' | 'complete';
  privacyReviewState: 'pending' | 'clear' | 'hold' | 'revoked';
  protectedProviderReferencePresent: boolean;
}

export interface VimeoCatalogAdoptionUnit {
  getCurrent(
    accountKey: string,
    providerIdentityDigest: string,
  ): Promise<{ revision: VimeoMishnayosCatalogRevision; approved: boolean } | null>;
  insertRevision(revision: VimeoMishnayosCatalogRevision): Promise<void>;
  setCurrent(revision: VimeoMishnayosCatalogRevision): Promise<void>;
  stageForCurrentReview(revision: VimeoMishnayosCatalogRevision): Promise<void>;
}

export interface VimeoCatalogAdoptionRepository {
  inTransaction<T>(run: (unit: VimeoCatalogAdoptionUnit) => Promise<T>): Promise<T>;
}

export interface VimeoCatalogRetryError extends Error {
  retryable?: boolean;
  retryAfterMs?: number;
}

const CLASSIFIER_SIGNATURE = [
  'strong-exclusions-first',
  'explicit-mishnah-or-trusted-collection-or-seder-masechta-perek',
  'bare-masechta-quarantine',
  'explicit-perek-and-mishnah-range-only',
].join('|');
export const VIMEO_MISHNAYOS_CLASSIFIER_DIGEST = createHash('sha256')
  .update(CLASSIFIER_SIGNATURE)
  .digest('hex');

const STRONG_EXCLUSIONS: readonly [string, RegExp][] = [
  ['gemara', /\b(?:gemara|talmud|sugya)\b/i],
  ['daf', /\bdaf\s*[a-z]?\d*\b/i],
  ['amud', /\bamud\s*[ab12]?\b/i],
  ['navi', /\b(?:navi|neviim|haftarah|haftorah)\b/i],
  ['parsha', /\b(?:parsha|parashah|parshah|sedra)\b/i],
  ['story', /\b(?:story|stories|film|movie|interview)\b/i],
  ['promo', /\b(?:promo|advertisement|advert|trailer|commercial)\b/i],
  ['short', /\b(?:shorts?|reel|clip)\b/i],
  ['music', /\b(?:music|song|concert)\b/i],
  ['merchandise', /\b(?:merchandise|merch|store|shirt|hoodie)\b/i],
  ['joke', /\b(?:joke|comedy|funny)\b/i],
  ['course', /\b(?:course|masterclass|webinar)\b/i],
];

const MISHNAH_TERM = /\b(?:mishnah|mishna|mishnayos|mishnayot|mishnayois|mishnaios)\b/i;
const PEREK_TERM = /\b(?:perek|chapter)\s*(\d{1,3})\b/i;
const MISHNAH_RANGE =
  /\b(?:mishnah|mishna|mishnayot?)\s*(\d{1,3})(?:\s*(?:-|–|—|to)\s*(\d{1,3}))?\b/i;

export async function inventoryCompleteVimeoCatalog(input: {
  adapter: VimeoCatalogReadAdapter;
  checkpoint?: PrivateVimeoInventoryCheckpoint;
  perPage?: number;
  maxAttempts?: number;
  baseRetryMs?: number;
  now?: () => Date;
  sleep?: (milliseconds: number) => Promise<void>;
  saveCheckpoint?: (checkpoint: PrivateVimeoInventoryCheckpoint) => Promise<void>;
  signal?: AbortSignal;
}): Promise<PrivateVimeoInventoryResult> {
  const perPage = Math.min(Math.max(input.perPage ?? 100, 1), 100);
  const maxAttempts = Math.max(input.maxAttempts ?? 5, 1);
  const sleep =
    input.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  let page = input.checkpoint?.nextPage ?? 1;
  let providerTotal = input.checkpoint?.providerTotal ?? null;
  let observedRows = input.checkpoint?.observedRows ?? 0;
  const videos = [...(input.checkpoint?.videos ?? [])];

  while (providerTotal === null || observedRows < providerTotal) {
    if (input.signal?.aborted) throw new Error('Vimeo catalog inventory aborted.');
    const result = await retryRead(
      () => input.adapter.readPage(page, perPage, input.signal),
      maxAttempts,
      input.baseRetryMs ?? 250,
      sleep,
    );
    if (result.page !== page || result.providerTotal < 0) {
      throw new Error('Vimeo catalog page reconciliation failed.');
    }
    if (providerTotal !== null && providerTotal !== result.providerTotal) {
      throw new Error(
        'Vimeo catalog provider total changed during inventory; resume from a fresh run.',
      );
    }
    providerTotal = result.providerTotal;
    observedRows += result.items.length;
    videos.push(...result.items);
    const nextPage = result.nextPage ?? page + 1;
    await input.saveCheckpoint?.({
      schemaVersion: VIMEO_MISHNAYOS_CATALOG_SCHEMA_VERSION,
      nextPage,
      providerTotal,
      observedRows,
      videos,
    });
    if (observedRows >= providerTotal && result.nextPage === null) break;
    if (result.nextPage === null && observedRows < providerTotal) {
      throw new Error('Vimeo catalog ended before the provider total was exhausted.');
    }
    page = result.nextPage ?? page + 1;
  }

  const byIdentity = new Map<string, PrivateVimeoCatalogVideo>();
  for (const video of videos) {
    assertCanonicalProviderIdentity(video.providerIdentity);
    byIdentity.set(video.providerIdentity, video);
  }
  if (observedRows !== providerTotal) {
    throw new Error('Vimeo catalog observed row count does not equal the provider total.');
  }
  return {
    providerTotal,
    observedRows,
    uniqueVideos: [...byIdentity.values()],
    duplicateCount: observedRows - byIdentity.size,
    completedAt: (input.now?.() ?? new Date()).toISOString(),
  };
}

export async function classifyCompleteVimeoCatalog(input: {
  inventory: PrivateVimeoInventoryResult;
  adapter?: VimeoCatalogReadAdapter;
  signal?: AbortSignal;
}): Promise<readonly ClassifiedVimeoCatalogVideo[]> {
  const classified: ClassifiedVimeoCatalogVideo[] = [];
  for (const original of input.inventory.uniqueVideos) {
    let video = original;
    let classification = classifyVimeoCatalogVideo(video);
    if (
      classification.status === 'quarantine_ambiguous' &&
      video.captionsAvailable &&
      !video.captionEvidence &&
      input.adapter?.readCaptionEvidence
    ) {
      const captionEvidence = await input.adapter.readCaptionEvidence(video, input.signal);
      video = { ...video, captionEvidence };
      classification = classifyVimeoCatalogVideo(video);
    }
    const metadata = normalizeCatalogMetadata(video, classification);
    classified.push({
      video,
      classification,
      metadata,
      metadataDigest: sha256(
        canonicalJson({
          classification,
          metadata,
          providerMetadata: providerMetadataForDigest(video),
        }),
      ),
    });
  }
  if (classified.length !== input.inventory.uniqueVideos.length) {
    throw new Error('Every unique Vimeo video must receive exactly one classification.');
  }
  return classified;
}

export function classifyVimeoCatalogVideo(
  video: PrivateVimeoCatalogVideo,
): VimeoMishnayosClassificationEvidence {
  const searchable = searchableMetadata(video);
  const reasonCodes: string[] = [];
  const matchedTerms: string[] = [];
  const exclusion = STRONG_EXCLUSIONS.find(([, pattern]) => pattern.test(searchable));
  if (exclusion || video.captionEvidence?.gemaraTermPresent) {
    reasonCodes.push(exclusion ? `excluded_${exclusion[0]}` : 'excluded_caption_gemara');
    return evidence('exclude_non_mishnayos', reasonCodes, matchedTerms, false, video);
  }

  const match = matchTaxonomy(searchable);
  if (match.masechta) matchedTerms.push(`masechta:${match.masechta.canonicalName}`);
  if (match.seder) matchedTerms.push(`seder:${match.seder}`);
  const explicitMishnah =
    MISHNAH_TERM.test(searchable) || video.captionEvidence?.mishnahTermPresent;
  const trustedCollection = [...video.folders, ...video.showcases].some((value) =>
    MISHNAH_TERM.test(value),
  );
  const explicitPerek = PEREK_TERM.test(searchable);
  const structuredPositive = Boolean(match.seder && match.masechta && explicitPerek);

  if ((explicitMishnah || trustedCollection || structuredPositive) && match.masechta) {
    if (explicitMishnah) reasonCodes.push('included_explicit_mishnah_term');
    if (trustedCollection) reasonCodes.push('included_trusted_mishnayos_collection');
    if (structuredPositive) reasonCodes.push('included_explicit_seder_masechta_perek');
    if (!privacyCompatible(video) || !embedCompatible(video)) {
      reasonCodes.push('quarantined_privacy_or_embed_incompatible');
      return evidence('quarantine_ambiguous', reasonCodes, matchedTerms, trustedCollection, video);
    }
    return evidence('include_mishnayos', reasonCodes, matchedTerms, trustedCollection, video);
  }
  if (match.masechta) {
    reasonCodes.push('quarantined_bare_or_unproven_masechta');
    return evidence('quarantine_ambiguous', reasonCodes, matchedTerms, trustedCollection, video);
  }
  if (explicitMishnah || trustedCollection) {
    reasonCodes.push('quarantined_mishnah_without_proven_masechta');
    return evidence('quarantine_ambiguous', reasonCodes, matchedTerms, trustedCollection, video);
  }
  reasonCodes.push('excluded_unrelated_metadata');
  return evidence('exclude_non_mishnayos', reasonCodes, matchedTerms, trustedCollection, video);
}

export function normalizeCatalogMetadata(
  video: PrivateVimeoCatalogVideo,
  _classification: VimeoMishnayosClassificationEvidence,
): VimeoMishnayosCatalogMetadata {
  const searchable = searchableMetadata(video);
  const match = matchTaxonomy(searchable);
  const perekMatch = PEREK_TERM.exec(searchable);
  const rangeMatch = MISHNAH_RANGE.exec(searchable);
  const rangeStart = rangeMatch ? Number(rangeMatch[1]) : null;
  const rangeEnd = rangeMatch ? Number(rangeMatch[2] ?? rangeMatch[1]) : null;
  return {
    teacher: VIMEO_MISHNAYOS_TEACHER,
    contentFamily: VIMEO_MISHNAYOS_CONTENT_FAMILY,
    seder: match.seder,
    masechta: match.masechta?.canonicalName ?? null,
    perek: perekMatch ? Number(perekMatch[1]) : null,
    mishnahRange:
      rangeStart && rangeEnd && rangeEnd >= rangeStart
        ? { start: rangeStart, end: rangeEnd }
        : null,
    title: safeText(video.title, 240),
    description: safeText(video.description, 2_000),
    language: video.language ? safeText(video.language, 40) : null,
    durationSeconds: video.durationSeconds,
    thumbnailAvailable: video.thumbnailAvailable,
    captionsAvailable: video.captionsAvailable,
    privacyCompatible: privacyCompatible(video),
    embedCompatible: embedCompatible(video),
    source: 'historical_vimeo_mishnayos_catalog',
  };
}

export function protectVimeoProviderReference(providerIdentity: string, key: Buffer): string {
  assertReferenceKey(key);
  assertCanonicalProviderIdentity(providerIdentity);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(VIMEO_MISHNAYOS_CATALOG_SCHEMA_VERSION));
  const ciphertext = Buffer.concat([cipher.update(providerIdentity, 'utf8'), cipher.final()]);
  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

export function unprotectVimeoProviderReference(protectedReference: string, key: Buffer): string {
  assertReferenceKey(key);
  const [version, iv, tag, ciphertext] = protectedReference.split('.');
  if (version !== 'v1' || !iv || !tag || !ciphertext)
    throw new Error('Invalid protected Vimeo reference.');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAAD(Buffer.from(VIMEO_MISHNAYOS_CATALOG_SCHEMA_VERSION));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function providerIdentityDigest(providerIdentity: string, key: Buffer): string {
  assertReferenceKey(key);
  assertCanonicalProviderIdentity(providerIdentity);
  return createHmac('sha256', key).update(providerIdentity).digest('hex');
}

export function buildCatalogRevision(input: {
  accountKey: string;
  item: ClassifiedVimeoCatalogVideo;
  referenceKey: Buffer;
  now: string;
  prior?: VimeoMishnayosCatalogRevision | null;
  priorApproved?: boolean;
}): { revision: VimeoMishnayosCatalogRevision; replay: boolean } {
  const identityDigest = providerIdentityDigest(
    input.item.video.providerIdentity,
    input.referenceKey,
  );
  if (input.prior?.metadataDigest === input.item.metadataDigest) {
    return { revision: input.prior, replay: true };
  }
  const changedApproved = Boolean(input.prior && input.priorApproved);
  const classification = changedApproved
    ? {
        ...input.item.classification,
        status: 'quarantine_ambiguous' as const,
        reasonCodes: ['quarantined_provider_metadata_changed_after_review'],
      }
    : input.item.classification;
  const contentId = stableId('vimeo_catalog_content', identityDigest);
  const contentVersionId = stableId(
    'vimeo_catalog_version',
    `${identityDigest}:${input.item.metadataDigest}`,
  );
  const revisionKey = stableId(
    'vimeo_catalog_revision',
    `${identityDigest}:${input.item.metadataDigest}`,
  );
  const status = classification.status;
  return {
    replay: false,
    revision: {
      revisionKey,
      contentId,
      contentVersionId,
      accountKey: input.accountKey,
      productKey: VIMEO_MISHNAYOS_PRODUCT_KEY,
      schemaVersion: VIMEO_MISHNAYOS_CATALOG_SCHEMA_VERSION,
      providerIdentityDigest: identityDigest,
      metadataDigest: input.item.metadataDigest,
      protectedProviderReference: protectVimeoProviderReference(
        input.item.video.providerIdentity,
        input.referenceKey,
      ),
      classification,
      metadata: input.item.metadata,
      participantReviewState: 'pending',
      privacyReviewState: 'pending',
      publicationState:
        status === 'include_mishnayos'
          ? 'needs_review'
          : status === 'quarantine_ambiguous'
            ? 'quarantined'
            : 'not_eligible',
      assignmentState:
        status === 'include_mishnayos' ? 'blocked_pending_publication' : 'not_eligible',
      revisionReason: input.prior ? 'provider_metadata_changed' : 'initial_inventory',
      createdAt: input.now,
    },
  };
}

export async function adoptCompleteVimeoCatalog(input: {
  repository: VimeoCatalogAdoptionRepository;
  accountKey: string;
  classified: readonly ClassifiedVimeoCatalogVideo[];
  referenceKey: Buffer;
  now: string;
}) {
  return input.repository.inTransaction(async (unit) => {
    let inserted = 0;
    let replayed = 0;
    let stagedForReview = 0;
    let quarantined = 0;
    let excluded = 0;
    for (const item of input.classified) {
      const identityDigest = providerIdentityDigest(
        item.video.providerIdentity,
        input.referenceKey,
      );
      const prior = await unit.getCurrent(input.accountKey, identityDigest);
      const result = buildCatalogRevision({
        accountKey: input.accountKey,
        item,
        referenceKey: input.referenceKey,
        now: input.now,
        ...(prior ? { prior: prior.revision, priorApproved: prior.approved } : {}),
      });
      if (result.replay) {
        replayed += 1;
        continue;
      }
      await unit.insertRevision(result.revision);
      await unit.setCurrent(result.revision);
      inserted += 1;
      if (result.revision.publicationState === 'needs_review') {
        await unit.stageForCurrentReview(result.revision);
        stagedForReview += 1;
      } else if (result.revision.publicationState === 'quarantined') {
        quarantined += 1;
      } else {
        excluded += 1;
      }
    }
    return { inserted, replayed, stagedForReview, quarantined, excluded };
  });
}

export function buildCatalogAggregateEvidence(input: {
  inventory: PrivateVimeoInventoryResult;
  classified: readonly ClassifiedVimeoCatalogVideo[];
}): VimeoMishnayosCatalogAggregateEvidence {
  const statuses = countBy(input.classified, (item) => item.classification.status);
  const included = input.classified.filter(
    (item) => item.classification.status === 'include_mishnayos',
  );
  const countsBySeder = countByWithKeys(
    included,
    MISHNAYOS_TAXONOMY.map((seder) => seder.canonicalName),
    (item) => item.metadata.seder ?? 'unproven',
  );
  const countsByMasechta = countByWithKeys(
    included,
    MISHNAYOS_TAXONOMY.flatMap((seder) => seder.masechtos.map((entry) => entry.canonicalName)),
    (item) => item.metadata.masechta ?? 'unproven',
  );
  const nezikin = MISHNAYOS_TAXONOMY.find((seder) => seder.canonicalName === 'Nezikin')!;
  const nezikinCounts = countByWithKeys(
    included.filter((item) => item.metadata.seder === 'Nezikin'),
    nezikin.masechtos.map((entry) => entry.canonicalName),
    (item) => item.metadata.masechta ?? 'unproven',
  );
  return {
    schemaVersion: VIMEO_MISHNAYOS_CATALOG_SCHEMA_VERSION,
    taxonomyVersion: VIMEO_MISHNAYOS_TAXONOMY_VERSION,
    classifierVersion: VIMEO_MISHNAYOS_CLASSIFIER_VERSION,
    taxonomyDigest: MISHNAYOS_TAXONOMY_DIGEST,
    classifierDigest: VIMEO_MISHNAYOS_CLASSIFIER_DIGEST,
    providerTotal: input.inventory.providerTotal,
    uniqueCount: input.inventory.uniqueVideos.length,
    duplicateCount: input.inventory.duplicateCount,
    includeCount: statuses.include_mishnayos ?? 0,
    excludeCount: statuses.exclude_non_mishnayos ?? 0,
    quarantineCount: statuses.quarantine_ambiguous ?? 0,
    countsBySeder,
    countsByMasechta,
    nezikinCounts,
    exclusionReasonCounts: countReasons(input.classified, 'exclude_non_mishnayos'),
    quarantineReasonCounts: countReasons(input.classified, 'quarantine_ambiguous'),
    reconciled:
      input.inventory.providerTotal === input.inventory.observedRows &&
      (statuses.include_mishnayos ?? 0) +
        (statuses.exclude_non_mishnayos ?? 0) +
        (statuses.quarantine_ambiguous ?? 0) ===
        input.inventory.uniqueVideos.length,
  };
}

export function authorizeVimeoCatalogPlayback(input: {
  principal: VimeoCatalogPlaybackPrincipal;
  assignment: VimeoCatalogLibraryAssignment;
  publication: VimeoCatalogPublicationFacts;
  now: Date;
  ttlMs?: number;
}) {
  const { principal, assignment, publication } = input;
  const allowed =
    principal.role === 'student' &&
    principal.productKey === VIMEO_MISHNAYOS_PRODUCT_KEY &&
    principal.studentId === assignment.studentId &&
    principal.householdId === assignment.householdId &&
    Boolean(principal.sessionId) &&
    principal.sessionActive &&
    (principal.accessState === 'active' || principal.accessState === 'grace') &&
    assignment.active &&
    !assignment.revoked &&
    assignment.contentId === publication.contentId &&
    assignment.contentVersionId === publication.contentVersionId &&
    publication.classificationStatus === 'include_mishnayos' &&
    publication.publicationState === 'published' &&
    publication.participantReviewState === 'complete' &&
    publication.privacyReviewState === 'clear' &&
    publication.protectedProviderReferencePresent;
  if (!allowed) throw new Error('CATALOG_PLAYBACK_UNAVAILABLE');
  const issuedAt = input.now.toISOString();
  const expiresAt = new Date(input.now.getTime() + (input.ttlMs ?? 5 * 60_000)).toISOString();
  return {
    contentId: publication.contentId,
    contentVersionId: publication.contentVersionId,
    studentId: assignment.studentId,
    bootstrapPath: `/api/v1/student/library/${encodeURIComponent(publication.contentId)}/playback`,
    issuedAt,
    expiresAt,
    renewable: true as const,
  };
}

export function catalogRevisionForReview(revision: VimeoMishnayosCatalogRevision) {
  const safe = Object.fromEntries(
    Object.entries(revision).filter(
      ([key]) => key !== 'protectedProviderReference' && key !== 'providerIdentityDigest',
    ),
  );
  return { ...safe, rawProviderReferencePresent: false as const };
}

export function assertNoRawVimeoReference(value: unknown) {
  const serialized = JSON.stringify(value);
  if (
    /https?:\/\/(?:player\.)?vimeo\.com/i.test(serialized) ||
    /\/videos\/[A-Za-z0-9_-]+/.test(serialized)
  ) {
    throw new Error('Raw Vimeo provider reference escaped protected storage.');
  }
}

async function retryRead<T>(
  read: () => Promise<T>,
  maxAttempts: number,
  baseRetryMs: number,
  sleep: (milliseconds: number) => Promise<void>,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await read();
    } catch (error) {
      lastError = error;
      const retryError = error as VimeoCatalogRetryError;
      if (!retryError.retryable || attempt === maxAttempts) throw error;
      await sleep(retryError.retryAfterMs ?? baseRetryMs * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}

function evidence(
  status: VimeoMishnayosClassificationStatus,
  reasonCodes: readonly string[],
  matchedTerms: readonly string[],
  trustedCollection: boolean,
  video: PrivateVimeoCatalogVideo,
): VimeoMishnayosClassificationEvidence {
  return {
    status,
    reasonCodes: [...new Set(reasonCodes)],
    matchedTerms: [...new Set(matchedTerms)],
    trustedCollection,
    captionEvidenceUsed: Boolean(video.captionEvidence),
    classifierVersion: VIMEO_MISHNAYOS_CLASSIFIER_VERSION,
    taxonomyVersion: VIMEO_MISHNAYOS_TAXONOMY_VERSION,
  };
}

function matchTaxonomy(searchable: string): {
  seder: MishnayosSederName | null;
  masechta: MishnayosMasechtaTaxon | null;
} {
  const normalized = normalizeSearch(searchable);
  for (const seder of MISHNAYOS_TAXONOMY) {
    for (const entry of seder.masechtos) {
      const matched = [...entry.variants]
        .sort((left, right) => right.length - left.length)
        .some((variant) => containsPhrase(normalized, normalizeSearch(variant)));
      if (matched) return { seder: seder.canonicalName, masechta: entry };
    }
  }
  const seder = MISHNAYOS_TAXONOMY.find((entry) =>
    entry.variants.some((variant) => containsPhrase(normalized, normalizeSearch(variant))),
  );
  return { seder: seder?.canonicalName ?? null, masechta: null };
}

function searchableMetadata(video: PrivateVimeoCatalogVideo) {
  return [video.title, video.description, ...video.tags, ...video.folders, ...video.showcases].join(
    ' | ',
  );
}

function normalizeSearch(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function containsPhrase(haystack: string, needle: string) {
  return ` ${haystack} `.includes(` ${needle} `);
}

function privacyCompatible(video: PrivateVimeoCatalogVideo) {
  const value = normalizeSearch(video.privacyView ?? '');
  return Boolean(value) && ['nobody', 'unlisted', 'disable', 'private'].includes(value);
}

function embedCompatible(video: PrivateVimeoCatalogVideo) {
  const value = normalizeSearch(video.privacyEmbed ?? '');
  return Boolean(value) && !['nowhere', 'none', 'disabled'].includes(value);
}

function safeText(value: string, max: number) {
  return value
    .replace(/https?:\/\/(?:player\.)?vimeo\.com\/[^\s]+/gi, '[provider-link-redacted]')
    .replace(/\/videos\/[A-Za-z0-9_-]+/g, '[provider-reference-redacted]')
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function providerMetadataForDigest(video: PrivateVimeoCatalogVideo) {
  return {
    title: safeText(video.title, 240),
    description: safeText(video.description, 2_000),
    tags: video.tags.map((value) => safeText(value, 120)).sort(),
    folders: video.folders.map((value) => safeText(value, 240)).sort(),
    showcases: video.showcases.map((value) => safeText(value, 240)).sort(),
    durationSeconds: video.durationSeconds,
    createdAt: video.createdAt,
    modifiedAt: video.modifiedAt,
    language: video.language,
    privacyView: video.privacyView,
    privacyEmbed: video.privacyEmbed,
    thumbnailAvailable: video.thumbnailAvailable,
    captionsAvailable: video.captionsAvailable,
    captionEvidence: video.captionEvidence ?? null,
  };
}

function assertCanonicalProviderIdentity(value: string) {
  if (!/^\/videos\/[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error('Vimeo provider identity is not canonical.');
  }
}

function assertReferenceKey(key: Buffer) {
  if (key.length !== 32) throw new Error('Vimeo catalog reference key must contain 32 bytes.');
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function stableId(prefix: string, material: string) {
  return `${prefix}_${sha256(material).slice(0, 32)}`;
}

function countBy<T>(items: readonly T[], selector: (item: T) => string) {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = selector(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function countByWithKeys<T>(
  items: readonly T[],
  requiredKeys: readonly string[],
  selector: (item: T) => string,
) {
  const counts = Object.fromEntries(requiredKeys.map((key) => [key, 0])) as Record<string, number>;
  for (const [key, value] of Object.entries(countBy(items, selector))) counts[key] = value;
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function countReasons(
  items: readonly ClassifiedVimeoCatalogVideo[],
  status: VimeoMishnayosClassificationStatus,
) {
  return countBy(
    items
      .filter((item) => item.classification.status === status)
      .flatMap((item) => item.classification.reasonCodes),
    (reason) => reason,
  );
}
