/** OPS-08 inventory semantic validation. */
import { requireTaskPacket } from './OPS-08-toolkit-core.mjs';
import { isHex, validateMigrationThresholds } from './OPS-08-toolkit-validation-common.mjs';

export function validateInventory(inventory, authorization = null) {
  requireTaskPacket(inventory, 'inventory');
  const required = [
    'state',
    'source',
    'domains',
    'railway_services',
    'routes',
    'traffic_migration',
    'email',
    'callbacks',
    'monitoring',
    'rollback',
    'mutation_audit',
  ];
  for (const key of required) {
    if (!(key in inventory)) throw new Error(`inventory missing ${key}`);
  }

  const selectedSha = inventory.source.selected_sha;
  const selectedRef = inventory.source.selected_ref;
  if (selectedSha === null) {
    if (inventory.state !== 'blocked_source_convergence_required' || selectedRef !== null) {
      throw new Error('selected source ref/SHA may be null only for blocked_source_convergence_required');
    }
  } else {
    if (!isHex(selectedSha, 40)) throw new Error('inventory selected source SHA is not immutable');
    if (typeof selectedRef !== 'string' || selectedRef.length < 1) {
      throw new Error('inventory selected source ref is missing');
    }
    if (inventory.source.version_contract.expected_sha !== selectedSha) {
      throw new Error('inventory version contract expected SHA differs from selected SHA');
    }
    if (
      inventory.source.version_contract.match === true &&
      inventory.source.version_contract.observed_sha !== selectedSha
    ) {
      throw new Error('inventory version contract claims a match with another SHA');
    }
  }

  const roots = inventory.domains.filter((domain) => domain.role === 'root');
  const launches = inventory.domains.filter((domain) => domain.role === 'launch');
  if (roots.length !== 1 || roots[0].hostname !== 'onetimeonetime.com') {
    throw new Error('inventory must contain exactly one onetimeonetime.com root entry');
  }
  if (launches.length !== 1 || launches[0].hostname !== 'join.onetimeonetime.com') {
    throw new Error('inventory must contain exactly one retained launch-domain entry');
  }
  const root = roots[0];
  const launch = launches[0];
  const hostnames = inventory.domains.map((domain) => domain.hostname);
  if (new Set(hostnames).size !== hostnames.length) {
    throw new Error('inventory contains duplicate domain hostnames');
  }

  if (!authorization) {
    if (root.root_mutation_permitted !== false) {
      throw new Error('root mutation must remain false without exact authorization');
    }
    if (inventory.mutation_audit.root_dns_changed !== false) {
      throw new Error('root DNS drift detected without authorization');
    }
    if (launch.root_mutation_permitted !== false) {
      throw new Error('launch-domain mutation must remain false without exact authorization');
    }
    if (
      inventory.mutation_audit.launch_dns_changed !== false ||
      inventory.mutation_audit.production_deployed !== false ||
      inventory.mutation_audit.provider_registration_changed !== false ||
      inventory.mutation_audit.email_dns_changed !== false ||
      inventory.mutation_audit.mutation_count !== 0
    ) {
      throw new Error('audit/preparation inventory records an unauthorized external mutation');
    }
    if (inventory.source.release_authorized !== false) {
      throw new Error('source release authorization cannot be true without an authorization document');
    }
  } else {
    if (root.root_mutation_permitted && authorization.root_mutation_authorized !== true) {
      throw new Error('inventory permits root mutation but authorization does not');
    }
    if (inventory.mutation_audit.root_dns_changed && authorization.root_mutation_authorized !== true) {
      throw new Error('inventory records root mutation without authorization');
    }
    if (inventory.source.release_authorized && selectedSha !== authorization.target.git_sha) {
      throw new Error('inventory release SHA differs from authorization target');
    }
  }

  if (inventory.mutation_audit.production_send_enabled !== false) {
    throw new Error('production send must remain disabled');
  }
  if (inventory.email.production_send_enabled !== false) {
    throw new Error('email production send must remain disabled');
  }

  const readinessStates = new Set([
    'ready_for_dns_operator_action',
    'authorized_window_pending',
    'cutover_in_progress',
    'cutover_observing',
    'cutover_complete',
  ]);
  for (const service of inventory.railway_services) {
    if (service.healthcheck_request_host !== 'healthcheck.railway.app') {
      throw new Error(`service ${service.service_key} has the wrong Railway healthcheck request host`);
    }
    if (service.healthcheck_host_validation === 'pass' && service.healthcheck_host_path_only !== true) {
      throw new Error(`service ${service.service_key} healthcheck Host is not path-restricted`);
    }
    if (
      readinessStates.has(inventory.state) &&
      (service.healthcheck_host_path_only !== true || service.healthcheck_host_validation !== 'pass')
    ) {
      throw new Error(`service ${service.service_key} lacks passing path-only healthcheck Host proof`);
    }
  }

  for (const callback of inventory.callbacks) {
    if (callback.secret_material_stored !== false) {
      throw new Error(`callback ${callback.callback_id} stores secret material`);
    }
  }

  if (
    inventory.monitoring.external_probe_interval_seconds !== null &&
    inventory.monitoring.external_probe_interval_seconds !== 60
  ) {
    throw new Error('external probe interval must be 60 seconds');
  }
  if (inventory.monitoring.regions !== null && inventory.monitoring.regions < 3) {
    throw new Error('external monitoring requires at least three regions');
  }

  if (inventory.traffic_migration.all_thresholds_pass === true) {
    validateMigrationThresholds(inventory.traffic_migration);
  }
}

