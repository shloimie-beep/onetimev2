export const VIMEO_MISHNAYOS_CATALOG_SCHEMA_VERSION = '1.0.0' as const;
export const VIMEO_MISHNAYOS_TAXONOMY_VERSION = 'mishnayos-taxonomy-1.0.0' as const;
export const VIMEO_MISHNAYOS_CLASSIFIER_VERSION = 'mishnayos-classifier-1.0.0' as const;
export const VIMEO_MISHNAYOS_PRODUCT_KEY = 'one_time_mishnayos' as const;
export const VIMEO_MISHNAYOS_CONTENT_FAMILY = 'mishnayos' as const;
export const VIMEO_MISHNAYOS_TEACHER = 'Rabbi Eli Scheller' as const;

export const VIMEO_MISHNAYOS_CLASSIFICATION_STATUSES = [
  'include_mishnayos',
  'exclude_non_mishnayos',
  'quarantine_ambiguous',
] as const;
export type VimeoMishnayosClassificationStatus =
  (typeof VIMEO_MISHNAYOS_CLASSIFICATION_STATUSES)[number];

export type MishnayosSederName = 'Zeraim' | 'Moed' | 'Nashim' | 'Nezikin' | 'Kodashim' | 'Tohorot';

export interface MishnayosMasechtaTaxon {
  canonicalName: string;
  variants: readonly string[];
}

export interface MishnayosSederTaxon {
  canonicalName: MishnayosSederName;
  variants: readonly string[];
  masechtos: readonly MishnayosMasechtaTaxon[];
}

export interface VimeoMishnayosClassificationEvidence {
  status: VimeoMishnayosClassificationStatus;
  reasonCodes: readonly string[];
  matchedTerms: readonly string[];
  trustedCollection: boolean;
  captionEvidenceUsed: boolean;
  classifierVersion: typeof VIMEO_MISHNAYOS_CLASSIFIER_VERSION;
  taxonomyVersion: typeof VIMEO_MISHNAYOS_TAXONOMY_VERSION;
}

export interface VimeoMishnayosCatalogMetadata {
  teacher: typeof VIMEO_MISHNAYOS_TEACHER;
  contentFamily: typeof VIMEO_MISHNAYOS_CONTENT_FAMILY;
  seder: MishnayosSederName | null;
  masechta: string | null;
  perek: number | null;
  mishnahRange: { start: number; end: number } | null;
  title: string;
  description: string;
  language: string | null;
  durationSeconds: number | null;
  thumbnailAvailable: boolean;
  captionsAvailable: boolean;
  privacyCompatible: boolean;
  embedCompatible: boolean;
  source: 'historical_vimeo_mishnayos_catalog';
}

export interface VimeoMishnayosCatalogRevision {
  revisionKey: string;
  contentId: string;
  contentVersionId: string;
  accountKey: string;
  productKey: typeof VIMEO_MISHNAYOS_PRODUCT_KEY;
  schemaVersion: typeof VIMEO_MISHNAYOS_CATALOG_SCHEMA_VERSION;
  providerIdentityDigest: string;
  metadataDigest: string;
  protectedProviderReference: string;
  classification: VimeoMishnayosClassificationEvidence;
  metadata: VimeoMishnayosCatalogMetadata;
  participantReviewState: 'pending';
  privacyReviewState: 'pending';
  publicationState: 'not_eligible' | 'quarantined' | 'needs_review';
  assignmentState: 'not_eligible' | 'blocked_pending_publication';
  revisionReason: 'initial_inventory' | 'provider_metadata_changed';
  createdAt: string;
}

export interface VimeoMishnayosCatalogAggregateEvidence {
  schemaVersion: typeof VIMEO_MISHNAYOS_CATALOG_SCHEMA_VERSION;
  taxonomyVersion: typeof VIMEO_MISHNAYOS_TAXONOMY_VERSION;
  classifierVersion: typeof VIMEO_MISHNAYOS_CLASSIFIER_VERSION;
  taxonomyDigest: string;
  classifierDigest: string;
  providerTotal: number;
  uniqueCount: number;
  duplicateCount: number;
  includeCount: number;
  excludeCount: number;
  quarantineCount: number;
  countsBySeder: Readonly<Record<string, number>>;
  countsByMasechta: Readonly<Record<string, number>>;
  nezikinCounts: Readonly<Record<string, number>>;
  exclusionReasonCounts: Readonly<Record<string, number>>;
  quarantineReasonCounts: Readonly<Record<string, number>>;
  reconciled: boolean;
}
