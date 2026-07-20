export type HighLevelAdminCrmProjection = {
  contactKey: string;
  ghlContactId: string | null;
  ghlContactStatus: 'not_linked' | 'linked' | 'sync_conflict' | 'sync_error';
  portalStatus: 'not_invited' | 'invited' | 'active';
  accessStatus: 'active' | 'grace' | 'complimentary' | 'inactive';
  graceUntil: string | null;
  currentPeriodEnd: string | null;
  lastGhlSync: string | null;
  syncError: string | null;
  openInHighLevelUrl: string | null;
};

export function buildAdminCrmProjection(input: {
  contactKey: string;
  ghlContactId?: string | null | undefined;
  syncStatus?: string | null | undefined;
  portalStatus?: 'not_invited' | 'invited' | 'active' | undefined;
  accessStatus?: 'active' | 'grace' | 'complimentary' | 'inactive' | undefined;
  graceUntil?: string | null | undefined;
  currentPeriodEnd?: string | null | undefined;
  lastGhlSync?: string | null | undefined;
  syncError?: string | null | undefined;
  openInHighLevelUrl?: string | null | undefined;
}): HighLevelAdminCrmProjection {
  return {
    contactKey: input.contactKey,
    ghlContactId: input.ghlContactId ?? null,
    ghlContactStatus: statusFor(input.ghlContactId, input.syncStatus, input.syncError),
    portalStatus: input.portalStatus ?? 'not_invited',
    accessStatus: input.accessStatus ?? 'inactive',
    graceUntil: input.graceUntil ?? null,
    currentPeriodEnd: input.currentPeriodEnd ?? null,
    lastGhlSync: input.lastGhlSync ?? null,
    syncError: input.syncError ?? null,
    openInHighLevelUrl: input.openInHighLevelUrl ?? null,
  };
}

function statusFor(
  ghlContactId: string | null | undefined,
  syncStatus: string | null | undefined,
  syncError: string | null | undefined,
): HighLevelAdminCrmProjection['ghlContactStatus'] {
  if (syncStatus === 'sync_conflict') return 'sync_conflict';
  if (syncError) return 'sync_error';
  if (ghlContactId) return 'linked';
  return 'not_linked';
}
