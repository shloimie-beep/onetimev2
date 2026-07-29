import type {
  ContentPublicationRecord,
  ContentPublicationState,
} from '../../../../../../../../packages/contracts/src/content/publication/index.ts';

const ACTIONS: Record<
  ContentPublicationState,
  readonly ('approve' | 'publish' | 'unpublish' | 'attach_occurrence')[]
> = {
  received: ['attach_occurrence'],
  validating: ['attach_occurrence'],
  processing: ['attach_occurrence'],
  needs_review: ['approve', 'attach_occurrence'],
  approved: ['publish', 'attach_occurrence'],
  publishing: ['attach_occurrence'],
  published: ['unpublish', 'attach_occurrence'],
  failed: [],
  archived: [],
};

export function buildAdminPublicationProjection(record: ContentPublicationRecord) {
  return {
    contentId: record.contentId,
    title: record.title,
    state: record.state,
    approved: record.approval !== null,
    published: record.state === 'published',
    allowedActions: [...ACTIONS[record.state]],
    occurrenceCount: record.occurrenceRelations.length,
    providerReferencePresent: record.opaqueProviderAssetRef !== null,
  };
}
