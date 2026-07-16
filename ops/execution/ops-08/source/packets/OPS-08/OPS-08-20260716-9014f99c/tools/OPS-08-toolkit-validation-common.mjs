/** OPS-08 shared semantic validation helpers. */
export function isHex(value, length) {
  return typeof value === 'string' && new RegExp(`^[0-9a-f]{${length}}$`).test(value);
}

export function requireFiniteNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return value;
}

export function validateMigrationThresholds(migration) {
  const requiredIntegers = [
    'eligible_accounts',
    'migrated_accounts',
    'unresolved_identity_conflicts',
    'successful_old_app_accounts_14d',
    'new_app_login_attempts_14d',
    'new_app_login_successes_14d',
    'synthetic_login_attempts_14d',
    'synthetic_login_successes_14d',
    'auth_incidents_p0_p1_14d',
    'unresolved_high_severity_auth_tickets',
    'measured_continuous_days',
  ];
  for (const key of requiredIntegers) {
    if (!Number.isInteger(migration[key]) || migration[key] < 0) {
      throw new Error(`traffic_migration.${key} must be a non-negative integer when thresholds pass`);
    }
  }
  if (migration.migrated_accounts !== migration.eligible_accounts) {
    throw new Error('migration counts do not match');
  }
  if (migration.unresolved_identity_conflicts !== 0) {
    throw new Error('migration identity conflicts remain');
  }
  if (migration.successful_old_app_accounts_14d !== 0) {
    throw new Error('old-application successful accounts remain in the 14-day window');
  }
  if (requireFiniteNumber(migration.new_app_login_success_rate, 'new_app_login_success_rate') < 0.99) {
    throw new Error('new-application login success is below 99%');
  }
  if (requireFiniteNumber(migration.synthetic_login_success_rate, 'synthetic_login_success_rate') < 0.999) {
    throw new Error('synthetic login success is below 99.9%');
  }
  if (migration.auth_incidents_p0_p1_14d !== 0) {
    throw new Error('P0/P1 authentication incidents remain in the 14-day window');
  }
  if (requireFiniteNumber(migration.auth_support_rate_7d, 'auth_support_rate_7d') > 0.01) {
    throw new Error('authentication support rate exceeds 1%');
  }
  if (migration.unresolved_high_severity_auth_tickets !== 0) {
    throw new Error('high-severity authentication tickets remain unresolved');
  }
  if (migration.measured_continuous_days < 14) {
    throw new Error('migration evidence is not a continuous 14-day window');
  }
  if (!isHex(migration.evidence_sha256, 64)) {
    throw new Error('migration evidence digest is missing or invalid');
  }
  if (migration.measurement_window_start && migration.measurement_window_end) {
    const start = Date.parse(migration.measurement_window_start);
    const end = Date.parse(migration.measurement_window_end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < 14 * 86_400_000) {
      throw new Error('migration measurement timestamps do not span 14 days');
    }
  }
}

