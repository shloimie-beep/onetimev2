/** OPS-08 cross-document digest and target validation. */
import { sha256, stableJson } from './OPS-08-toolkit-core.mjs';

export function validateCrossDocuments(authorization, authorizationText, manifest) {
  if (manifest.status !== 'authorized') return;
  if (manifest.authorization_sha256 !== sha256(authorizationText)) {
    throw new Error('manifest authorization digest does not match the authorization file');
  }
  if (manifest.source_transition.after_sha !== authorization.target.git_sha) {
    throw new Error('manifest target SHA differs from authorization');
  }
  if (
    manifest.source_transition.after_service_id_sha256 !==
      authorization.target.railway_service_id_sha256 ||
    manifest.source_transition.after_deployment_id_sha256 !==
      authorization.target.railway_deployment_id_sha256
  ) {
    throw new Error('manifest target service/deployment differs from authorization');
  }
  if (
    manifest.private_dns_change_set_sha256 !== authorization.private_dns_change_set.change_set_sha256 ||
    manifest.private_dns_rollback_set_sha256 !== authorization.private_dns_change_set.rollback_set_sha256
  ) {
    throw new Error('manifest DNS digests differ from authorization');
  }
  if (
    manifest.private_callback_change_set_sha256 !==
      authorization.private_callback_change_set.change_set_sha256 ||
    manifest.private_callback_rollback_set_sha256 !==
      authorization.private_callback_change_set.rollback_set_sha256
  ) {
    throw new Error('manifest callback digests differ from authorization');
  }
  if (manifest.root_mutation_authorized !== authorization.root_mutation_authorized) {
    throw new Error('manifest root authorization differs from authorization');
  }
  const includesRoot = (manifest.dns_changes ?? []).some((change) => change.root_record);
  if (includesRoot !== authorization.private_dns_change_set.includes_root) {
    throw new Error('manifest root change scope differs from authorization');
  }
  if ((manifest.dns_changes ?? []).length !== authorization.private_dns_change_set.record_count) {
    throw new Error('manifest DNS record count differs from authorization');
  }
  if (
    (manifest.callback_changes ?? []).length !==
    authorization.private_callback_change_set.registration_count
  ) {
    throw new Error('manifest callback count differs from authorization');
  }
  const configDigest = sha256(stableJson(manifest.application_config_changes ?? []));
  if (configDigest !== authorization.application_config_change_set_sha256) {
    throw new Error('manifest application configuration digest differs from authorization');
  }
}

