import type { AppConfig } from '../../../config/src/index.ts';

export type HighLevelRuntimeConfig = Pick<
  AppConfig,
  | 'highLevelMode'
  | 'highLevelBaseUrl'
  | 'highLevelLocationId'
  | 'highLevelPrivateIntegrationToken'
  | 'highLevelOutboundWebhookSecret'
  | 'highLevelSyncEnabled'
  | 'highLevelReconciliationEnabled'
  | 'highLevelReconciliationCron'
  | 'highLevelReconciliationMaxPages'
  | 'highLevelReconciliationMaxItems'
  | 'highLevelRequestTimeoutMs'
  | 'highLevelMaxRetries'
  | 'highLevelTestContactId'
  | 'highLevelWorkflowNewLeadId'
  | 'highLevelWorkflowPaymentActiveId'
  | 'highLevelWorkflowPaymentFailedId'
  | 'highLevelWorkflowCanceledId'
>;

export type HighLevelReadiness = {
  ready: boolean;
  mode: 'disabled' | 'mock' | 'provider';
  blockers: string[];
  tokenConfigured: boolean;
  locationConfigured: boolean;
  syncEnabled: boolean;
  reconciliationEnabled: boolean;
};

export function inspectHighLevelReadiness(config: HighLevelRuntimeConfig): HighLevelReadiness {
  const blockers: string[] = [];
  if (config.highLevelMode === 'disabled') {
    if (config.highLevelSyncEnabled) blockers.push('sync_enabled_while_disabled');
    if (config.highLevelReconciliationEnabled) {
      blockers.push('reconciliation_enabled_while_disabled');
    }
  }
  if (config.highLevelMode === 'provider') {
    if (!config.highLevelLocationId) blockers.push('location_id_missing');
    if (!config.highLevelPrivateIntegrationToken)
      blockers.push('private_integration_token_missing');
    if (!config.highLevelOutboundWebhookSecret) blockers.push('webhook_secret_missing');
  }
  if (config.highLevelReconciliationMaxPages < 1) blockers.push('max_pages_too_low');
  if (config.highLevelReconciliationMaxItems < 1) blockers.push('max_items_too_low');
  if (config.highLevelRequestTimeoutMs < 1000) blockers.push('request_timeout_too_low');
  if (config.highLevelMaxRetries < 0) blockers.push('max_retries_negative');
  return {
    ready: blockers.length === 0,
    mode: config.highLevelMode,
    blockers,
    tokenConfigured: Boolean(config.highLevelPrivateIntegrationToken),
    locationConfigured: Boolean(config.highLevelLocationId),
    syncEnabled: config.highLevelSyncEnabled,
    reconciliationEnabled: config.highLevelReconciliationEnabled,
  };
}

export function assertHighLevelProviderReady(config: HighLevelRuntimeConfig) {
  const readiness = inspectHighLevelReadiness(config);
  if (config.highLevelMode !== 'provider') {
    throw new Error(`highlevel_provider_not_enabled:${config.highLevelMode}`);
  }
  if (!readiness.ready) {
    throw new Error(`highlevel_provider_not_ready:${readiness.blockers[0] ?? 'unknown'}`);
  }
}
