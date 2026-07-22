export type ZoomSpotlightCommand = 'spotlight_replace' | 'spotlight_remove';

export type ZoomReadinessView = {
  ready: boolean;
  provider_gate_blockers: string[];
  phases: {
    sdk_app: { ready: boolean };
    s2s_meeting_provisioning: { ready: boolean };
    host_authorization: { ready: boolean };
    real_control_canary_authorization: { ready: boolean };
  };
};

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

export function zoomProviderOffSummary(readiness: ZoomReadinessView | undefined) {
  if (!readiness) {
    return 'Provider off: readiness has not been loaded. Controlled fake execution remains active.';
  }
  if (readiness.provider_gate_blockers.length > 0) {
    return 'Provider off: isolated-runtime or real-provider policy gates are disabled. Controlled fake execution remains active.';
  }
  if (!readiness.phases.sdk_app.ready) {
    return 'Provider off: the Meeting SDK General app or exact runtime-origin binding is not ready. Controlled fake execution remains active.';
  }
  if (!readiness.phases.s2s_meeting_provisioning.ready) {
    return 'Provider off: protected S2S meeting provisioning is not ready. Controlled fake execution remains active.';
  }
  if (!readiness.phases.host_authorization.ready) {
    return 'Provider off: protected host authorization is not ready. Controlled fake execution remains active.';
  }
  if (!readiness.phases.real_control_canary_authorization.ready) {
    return 'Provider off: the real-control canary is not authorized. Controlled fake execution remains active.';
  }
  return 'Real-control readiness is complete.';
}
