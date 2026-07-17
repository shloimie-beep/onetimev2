import type { UserRole } from '../../../contracts/src/index.ts';
import {
  ot42CrmCapabilities,
  type CrmCapability,
} from '../../../contracts/src/crm/capabilities.ts';

const allCapabilities = new Set<CrmCapability>(ot42CrmCapabilities);

const crmAgentCapabilities = new Set<CrmCapability>([
  'crm.contacts.read',
  'crm.contacts.create',
  'crm.contacts.edit',
]);

const viewerCapabilities = new Set<CrmCapability>(['crm.contacts.read']);

export function capabilitiesForCrmRole(role: UserRole | string): readonly CrmCapability[] {
  if (role === 'owner' || role === 'admin') return [...allCapabilities];
  if (role === 'crm_agent') return [...crmAgentCapabilities];
  if (role === 'viewer') return [...viewerCapabilities];
  return [];
}

export function hasCrmCapability(role: UserRole | string, capability: CrmCapability) {
  return capabilitiesForCrmRole(role).includes(capability);
}
