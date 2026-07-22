export type ZoomSpotlightCommand = 'spotlight_replace' | 'spotlight_remove';

const SDK_ERROR_CATEGORIES = {
  '1': 'provider_rejected',
} as const;

export function sdkErrorSummary(error: unknown) {
  if (!error || typeof error !== 'object') return 'code unknown / category unknown';
  const record = error as { errorCode?: unknown; error_code?: unknown };
  const rawCode = record.errorCode ?? record.error_code;
  const code =
    typeof rawCode === 'number' && Number.isSafeInteger(rawCode)
      ? String(rawCode)
      : typeof rawCode === 'string' && /^\d{1,4}$/.test(rawCode)
        ? rawCode
        : '';
  const category = SDK_ERROR_CATEGORIES[code as keyof typeof SDK_ERROR_CATEGORIES];
  return category ? `code ${code} / category ${category}` : 'code unknown / category unknown';
}

export function zoomSpotlightOptions(userId: number, command: ZoomSpotlightCommand) {
  return {
    userId,
    operate: command === 'spotlight_replace' ? ('replace' as const) : ('remove' as const),
  };
}
