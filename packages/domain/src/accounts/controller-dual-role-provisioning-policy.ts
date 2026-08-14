import { createHash } from 'node:crypto';
import { stableKey } from '../lead/normalize.ts';

export const CONTROLLER_DUAL_ROLE_PROVISIONING_POLICY = 'controller-dual-role-adult-provision-v1';
export const CONTROLLER_DUAL_ROLE_PROVISIONING_ACTOR = 'controller_dual_role_adult_provision_v1';
export const CONTROLLER_DUAL_ROLE_ACCESS_EXPIRES_AT = '2026-09-11T18:00:00+03:00';
export const CONTROLLER_DUAL_ROLE_PROVISIONING_SCHEMA =
  'onetime.controller.dual_role_adult_provision.v1';

const CONTROLLER_DUAL_ROLE_TARGET_EMAIL_DIGEST =
  '0a5e76108b5b75d072ab93af59c7c5e427acdb207fc00c2d7799d1beca6793d2';
const CONTROLLER_DUAL_ROLE_TARGET_DISPLAY_NAME_DIGEST =
  '38b8d5e95e97ce1720e246a0069a704637be1ec9cb15e0e30cbc5b5f5da4c86a';
const CONTROLLER_DUAL_ROLE_TARGET_NORMALIZED_DISPLAY_NAME_DIGEST =
  '8aaf281a7f904ff74e6de8cd1d04079f4c6e8c7763557a593af4227e8113b127';
const CONTROLLER_DUAL_ROLE_COLLISION_EMAIL_DIGESTS = new Set([
  CONTROLLER_DUAL_ROLE_TARGET_EMAIL_DIGEST,
  '41bb255c7d39ace0755db95500957e415f1c633ac51bb1e8eb39411c1edef25d',
  '2e4e5a0a8a04740c8c18a9bc84ae98d0cd57e16bdd2fae5162c4f4d4cdc683d7',
  '14a151cccbc54b23ef5c3ba8cc67621333aa84b3ef0ae0a1907e301236d4fc21',
]);

const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');

export function isControllerDualRoleProvisioningTarget(input: {
  normalizedEmail: string;
  displayName: string;
}) {
  return (
    sha256(input.normalizedEmail) === CONTROLLER_DUAL_ROLE_TARGET_EMAIL_DIGEST &&
    sha256(input.displayName) === CONTROLLER_DUAL_ROLE_TARGET_DISPLAY_NAME_DIGEST
  );
}

export function isControllerDualRoleProvisioningSyntheticTestFixture(input: {
  normalizedEmail: string;
  displayName: string;
}) {
  return (
    input.normalizedEmail.endsWith('@example.test') &&
    input.displayName === 'Synthetic Dual Role Adult'
  );
}

export function isControllerDualRoleProvisioningCollisionCandidate(input: {
  normalizedEmail: string;
  displayName: string;
}) {
  const email = input.normalizedEmail.trim().toLowerCase();
  const displayName = input.displayName.trim().replace(/\s+/gu, ' ').toLowerCase();
  return (
    CONTROLLER_DUAL_ROLE_COLLISION_EMAIL_DIGESTS.has(sha256(email)) ||
    sha256(displayName) === CONTROLLER_DUAL_ROLE_TARGET_NORMALIZED_DISPLAY_NAME_DIGEST ||
    gmailMailboxDigest(email) === CONTROLLER_DUAL_ROLE_TARGET_EMAIL_DIGEST
  );
}

function gmailMailboxDigest(email: string) {
  const separator = email.lastIndexOf('@');
  if (separator < 1) return null;
  const domain = email.slice(separator + 1);
  if (domain !== 'gmail.com' && domain !== 'googlemail.com') return null;
  const mailbox = email.slice(0, separator).split('+', 1)[0]!.replace(/\./gu, '');
  return sha256(`${mailbox}@gmail.com`);
}

export function controllerDualRoleAccessSourceReference(householdId: string) {
  return stableKey('dual_role_adult_access', [householdId]);
}

export function controllerDualRoleAccessIdempotencyKey(householdId: string) {
  return `dual-role-adult-access-${createHash('sha256')
    .update(householdId, 'utf8')
    .digest('hex')
    .slice(0, 32)}`;
}

export type ControllerDualRoleScope = {
  accountKey: string;
  productKey: string;
  runtimeTier: string;
  verificationEnvironmentId: string;
  normalizedEmail: string;
};

export function controllerDualRoleProvisioningIdentityKeys(input: ControllerDualRoleScope) {
  const parts = controllerDualRoleScopeParts(input);
  return {
    adultId: stableKey('v21_adult', [...parts, 'controller_dual_role']),
    humanAccountId: stableKey('v21_human_account', [...parts, 'controller_dual_role']),
    householdId: stableKey('v21_household', [...parts, 'controller_dual_role']),
  };
}

export function controllerDualRoleProvisionAuditKey(input: ControllerDualRoleScope) {
  return stableKey('account_lifecycle_audit', [
    ...controllerDualRoleScopeParts(input),
    'controller_dual_role',
  ]);
}

export function controllerDualRoleSetupIdempotencyKey(input: ControllerDualRoleScope) {
  return `dual-role-adult-setup-${sha256(controllerDualRoleScopeParts(input).join('\u001f')).slice(
    0,
    32,
  )}`;
}

export function controllerDualRoleProvisionAuditMetadata(input: {
  adultId: string;
  humanAccountId: string;
  householdId: string;
}) {
  return {
    schema: CONTROLLER_DUAL_ROLE_PROVISIONING_SCHEMA,
    roles: ['admin', 'parent'],
    separate_family_household: true,
    canonical_access: 'free',
    compatibility_access_policy: CONTROLLER_DUAL_ROLE_PROVISIONING_POLICY,
    setup_delivery_separate: true,
    legacy_identity_created: false,
    contact_or_ghl_created: false,
    consent_recorded: false,
    billing_or_payment_claimed: false,
    student_created: false,
    raw_pii_or_secret_included: false,
    adult_reference_digest: sha256(input.adultId),
    human_account_reference_digest: sha256(input.humanAccountId),
    household_reference_digest: sha256(input.householdId),
  };
}

function controllerDualRoleScopeParts(input: ControllerDualRoleScope) {
  return [
    input.accountKey,
    input.productKey,
    input.runtimeTier,
    input.verificationEnvironmentId,
    input.normalizedEmail,
  ];
}
