/** OPS-08 exact-authorization semantic validation. */
import { requireTaskPacket } from './OPS-08-toolkit-core.mjs';
import { isHex } from './OPS-08-toolkit-validation-common.mjs';

export function validateAuthorization(authorization) {
  requireTaskPacket(authorization, 'authorization');
  if (authorization.decision !== 'authorize_production_cutover') {
    throw new Error('authorization decision mismatch');
  }
  if (!isHex(authorization.target?.git_sha, 40)) {
    throw new Error('authorization target SHA invalid');
  }
  if (authorization.target.expected_version_sha !== authorization.target.git_sha) {
    throw new Error('authorization expected version SHA differs from target SHA');
  }
  for (const key of [
    'railway_project_id_sha256',
    'railway_environment_id_sha256',
    'railway_service_id_sha256',
    'railway_deployment_id_sha256',
  ]) {
    if (!isHex(authorization.target[key], 64)) {
      throw new Error(`authorization target ${key} is invalid`);
    }
  }
  if (!Number.isInteger(authorization.target.target_port) || authorization.target.target_port < 1) {
    throw new Error('authorization target port invalid');
  }
  if (authorization.target.healthcheck_path !== '/health') {
    throw new Error('authorization healthcheck path must be /health');
  }
  if (authorization.target.healthcheck_request_host !== 'healthcheck.railway.app') {
    throw new Error('authorization Railway healthcheck request host mismatch');
  }
  if (authorization.private_dns_change_set?.values_held_privately !== true) {
    throw new Error('DNS values must be held privately');
  }
  if (authorization.private_dns_change_set?.includes_email_dns !== false) {
    throw new Error('standard OPS-08 authorization must not include email DNS');
  }
  if (
    authorization.private_dns_change_set.includes_root === true &&
    authorization.root_mutation_authorized !== true
  ) {
    throw new Error('DNS change set includes root but root mutation is not authorized');
  }
  if (
    authorization.private_dns_change_set.change_set_sha256 ===
    authorization.private_dns_change_set.rollback_set_sha256
  ) {
    throw new Error('DNS change-set and rollback-set digests must differ');
  }
  if (authorization.private_callback_change_set?.values_held_privately !== true) {
    throw new Error('callback values must be held privately');
  }
  if (
    authorization.private_callback_change_set.change_set_sha256 ===
    authorization.private_callback_change_set.rollback_set_sha256
  ) {
    throw new Error('callback change-set and rollback-set digests must differ');
  }
  if (!isHex(authorization.application_config_change_set_sha256, 64)) {
    throw new Error('application configuration change-set digest invalid');
  }
  if (authorization.launch_domain_preservation?.hostname !== 'join.onetimeonetime.com') {
    throw new Error('authorization must preserve launch hostname');
  }
  if ((authorization.launch_domain_preservation?.minimum_days ?? 0) < 180) {
    throw new Error('launch hostname retention must be at least 180 days');
  }

  const architectureHost = {
    'OPS-08-JOIN_PRIMARY_ROOT_REDIRECT': 'join.onetimeonetime.com',
    'OPS-08-WWW_PRIMARY_ROOT_REDIRECT': 'www.onetimeonetime.com',
    'OPS-08-APEX_EDGE_TO_RAILWAY': 'onetimeonetime.com',
    'OPS-08-AUTHORITATIVE_DNS_MIGRATION_FOR_APEX': 'onetimeonetime.com',
  }[authorization.architecture_id];
  if (!architectureHost || authorization.target.primary_hostname !== architectureHost) {
    throw new Error('authorization primary hostname does not match the selected architecture');
  }

  if (!isHex(authorization.acceptance_gate_report_sha256, 64)) {
    throw new Error('acceptance-gate report digest invalid');
  }

  const migration = authorization.migration_evidence;
  if (!isHex(migration.inventory_sha256, 64)) {
    throw new Error('migration inventory digest invalid');
  }
  if (migration.passed !== true || migration.counts_equal !== true) {
    throw new Error('migration evidence is not passing');
  }
  if (migration.eligible_accounts !== migration.migrated_accounts) {
    throw new Error('authorized migration counts do not match');
  }
  if (migration.successful_old_app_accounts_14d !== 0) {
    throw new Error('authorized migration evidence still has old-application successful accounts');
  }
  if (migration.new_app_login_success_rate_14d < 0.99) {
    throw new Error('authorized new-application login success is below 99%');
  }
  if (migration.synthetic_new_app_login_success_rate_14d < 0.999) {
    throw new Error('authorized synthetic login success is below 99.9%');
  }
  if (
    migration.unresolved_identity_conflicts !== 0 ||
    migration.auth_incidents_p0_p1_14d !== 0 ||
    migration.unresolved_high_severity_auth_tickets !== 0 ||
    migration.auth_support_rate_7d > 0.01 ||
    migration.identity_recovery_paths_passed !== true ||
    migration.continuous_days < 14
  ) {
    throw new Error('authorized migration evidence fails one or more exact thresholds');
  }
  const migrationStart = Date.parse(migration.window_start);
  const migrationEnd = Date.parse(migration.window_end);
  if (
    !Number.isFinite(migrationStart) ||
    !Number.isFinite(migrationEnd) ||
    migrationEnd - migrationStart < 14 * 86_400_000
  ) {
    throw new Error('authorized migration evidence does not span 14 days');
  }

  const issued = Date.parse(authorization.issued_at);
  const expires = Date.parse(authorization.expires_at);
  const freeze = Date.parse(authorization.maintenance_window.freeze_start);
  const start = Date.parse(authorization.maintenance_window.start);
  const end = Date.parse(authorization.maintenance_window.end);
  const rollbackDeadline = Date.parse(authorization.maintenance_window.rollback_decision_deadline);
  if (![issued, expires, freeze, start, end, rollbackDeadline].every(Number.isFinite)) {
    throw new Error('authorization has an invalid timestamp');
  }
  if (!(issued <= freeze && freeze <= start && start < end && end <= expires)) {
    throw new Error('authorization window timestamps are out of order');
  }
  if (rollbackDeadline < start || rollbackDeadline > end) {
    throw new Error('rollback decision deadline must be inside the maintenance window');
  }

  const roles = new Set((authorization.authorizers ?? []).map((authorizer) => authorizer.role));
  if (!roles.has('product_owner') || !roles.has('technical_owner')) {
    throw new Error('authorization requires distinct product-owner and technical-owner approvals');
  }
}

