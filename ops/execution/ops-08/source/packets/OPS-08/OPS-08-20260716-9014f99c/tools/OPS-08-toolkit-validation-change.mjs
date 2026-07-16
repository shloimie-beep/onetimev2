/** OPS-08 reversible-change semantic validation. */
import { requireTaskPacket } from './OPS-08-toolkit-core.mjs';
import { isHex } from './OPS-08-toolkit-validation-common.mjs';

export function validateChangeManifest(manifest, authorization = null) {
  requireTaskPacket(manifest, 'change manifest');
  if (!['readiness_draft', 'authorized'].includes(manifest.status)) {
    throw new Error('change manifest status invalid');
  }
  if (manifest.raw_secret_values_embedded !== false) {
    throw new Error('change manifest contains or permits raw secret values');
  }
  if (manifest.launch_domain_preservation?.hostname !== 'join.onetimeonetime.com') {
    throw new Error('change manifest does not preserve the launch hostname');
  }
  if ((manifest.launch_domain_preservation?.minimum_days ?? 0) < 180) {
    throw new Error('change manifest launch retention is below 180 days');
  }
  if (manifest.email_dns_change_count !== 0) {
    throw new Error('standard OPS-08 change manifest includes email DNS');
  }
  if (manifest.status === 'readiness_draft') {
    if (manifest.authorization_sha256 !== null) {
      throw new Error('readiness draft must not claim an authorization digest');
    }
    if (manifest.root_mutation_authorized !== false) {
      throw new Error('readiness draft cannot authorize root mutation');
    }
  } else if (!authorization) {
    throw new Error('authorized change manifest requires an authorization document');
  }

  const allChangeIds = [];
  const allRollbackIds = [];
  let rootChangeCount = 0;
  for (const change of manifest.dns_changes ?? []) {
    allChangeIds.push(change.change_id);
    allRollbackIds.push(change.rollback_change_id);
    if (change.email_dns_record !== false) {
      throw new Error(`change ${change.change_id} includes email DNS`);
    }
    if (change.root_record) rootChangeCount += 1;
    if (manifest.status === 'authorized') {
      if (!isHex(change.before_value_sha256, 64)) {
        throw new Error(`change ${change.change_id} before digest invalid`);
      }
      if (!isHex(change.after_value_sha256, 64)) {
        throw new Error(`change ${change.change_id} after digest invalid`);
      }
      if (typeof change.private_value_reference !== 'string' || change.private_value_reference.length < 8) {
        throw new Error(`change ${change.change_id} private value reference missing`);
      }
    }
  }
  for (const change of manifest.callback_changes ?? []) {
    allChangeIds.push(change.change_id);
    allRollbackIds.push(change.rollback_change_id);
    if (manifest.status === 'authorized') {
      if (change.before_url_sha256 !== null && !isHex(change.before_url_sha256, 64)) {
        throw new Error(`callback ${change.change_id} before URL digest invalid`);
      }
      if (change.after_url_sha256 !== null && !isHex(change.after_url_sha256, 64)) {
        throw new Error(`callback ${change.change_id} after URL digest invalid`);
      }
      if (
        typeof change.private_registration_reference !== 'string' ||
        change.private_registration_reference.length < 8
      ) {
        throw new Error(`callback ${change.change_id} private registration reference missing`);
      }
    }
  }
  for (const change of manifest.application_config_changes ?? []) {
    if (manifest.status === 'authorized') {
      if (change.before_value_sha256 !== null && !isHex(change.before_value_sha256, 64)) {
        throw new Error(`config ${change.name} before digest invalid`);
      }
      if (change.after_value_sha256 !== null && !isHex(change.after_value_sha256, 64)) {
        throw new Error(`config ${change.name} after digest invalid`);
      }
      if (typeof change.rollback_value_reference !== 'string' || change.rollback_value_reference.length < 8) {
        throw new Error(`config ${change.name} rollback reference missing`);
      }
    }
  }
  if (new Set(allChangeIds).size !== allChangeIds.length) {
    throw new Error('duplicate change IDs in reversible manifest');
  }
  if (new Set(allRollbackIds).size !== allRollbackIds.length) {
    throw new Error('duplicate rollback IDs in reversible manifest');
  }
  if (
    manifest.status === 'authorized' &&
    rootChangeCount > 0 &&
    manifest.root_mutation_authorized !== true
  ) {
    throw new Error('authorized manifest has a root change without root authorization');
  }
  if (
    rootChangeCount === 0 &&
    manifest.root_dns_fingerprint_before_sha256 !== null &&
    manifest.expected_root_dns_fingerprint_after_sha256 !== null &&
    manifest.root_dns_fingerprint_before_sha256 !== manifest.expected_root_dns_fingerprint_after_sha256
  ) {
    throw new Error('root fingerprint changes despite no root operation');
  }
}

