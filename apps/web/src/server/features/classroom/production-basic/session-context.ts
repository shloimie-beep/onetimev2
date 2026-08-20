export type ProductionBasicBrowserPrincipal = Readonly<{
  source: 'adult' | 'legacy';
  principal_id: string;
  role: string;
}>;

export type ProductionBasicSessionContextDecision =
  | {
      status: 'resolved';
      principal: ProductionBasicBrowserPrincipal;
      clear_stale: 'adult' | 'legacy' | null;
    }
  | {
      status: 'missing';
      clear_stale: 'adult' | 'legacy' | 'both' | null;
    }
  | { status: 'session_context_conflict' };

/**
 * Never resolves one session family by cookie precedence. Both families are
 * evaluated first, and divergent valid principals fail closed.
 */
export function decideProductionBasicSessionContext(input: {
  adult_cookie_present: boolean;
  legacy_cookie_present: boolean;
  adult: ProductionBasicBrowserPrincipal | null;
  legacy: ProductionBasicBrowserPrincipal | null;
}): ProductionBasicSessionContextDecision {
  if (input.adult && input.legacy) {
    if (
      input.adult.principal_id !== input.legacy.principal_id ||
      input.adult.role !== input.legacy.role
    ) {
      return { status: 'session_context_conflict' };
    }
    return { status: 'resolved', principal: input.adult, clear_stale: 'legacy' };
  }
  if (input.adult) {
    return {
      status: 'resolved',
      principal: input.adult,
      clear_stale: input.legacy_cookie_present ? 'legacy' : null,
    };
  }
  if (input.legacy) {
    return {
      status: 'resolved',
      principal: input.legacy,
      clear_stale: input.adult_cookie_present ? 'adult' : null,
    };
  }
  const clearStale =
    input.adult_cookie_present && input.legacy_cookie_present
      ? ('both' as const)
      : input.adult_cookie_present
        ? ('adult' as const)
        : input.legacy_cookie_present
          ? ('legacy' as const)
          : null;
  return { status: 'missing', clear_stale: clearStale };
}

export function sanitizeStudentZoomDisplayName(value: string | null | undefined) {
  if (!value) return 'Student';
  const withoutControls = [...value.normalize('NFKC')]
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint <= 31 ||
        (codePoint >= 127 && codePoint <= 159) ||
        (codePoint >= 0x202a && codePoint <= 0x202e) ||
        (codePoint >= 0x2066 && codePoint <= 0x2069)
        ? ' '
        : character;
    })
    .join('');
  const normalized = withoutControls.replace(/[<>]/gu, '').replace(/\s+/gu, ' ').trim();
  if (!normalized || normalized.includes('@')) return 'Student';
  return [...normalized].slice(0, 64).join('').trim() || 'Student';
}
