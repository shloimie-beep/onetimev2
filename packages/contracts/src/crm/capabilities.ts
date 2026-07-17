import { z } from 'zod';

export const crmCapabilitySchema = z.enum([
  'crm.contacts.read',
  'crm.contacts.create',
  'crm.contacts.edit',
  'crm.contacts.archive',
  'crm.contacts.reactivate',
  'crm.contacts.assign',
  'crm.tags.read',
  'crm.tags.manage',
  'crm.notes.read',
  'crm.notes.append',
  'crm.relationships.read',
  'crm.relationships.manage',
  'crm.tasks.read',
  'crm.tasks.manage',
  'crm.identity.read',
  'crm.identity.resolve',
]);

export type CrmCapability = z.infer<typeof crmCapabilitySchema>;

export const ot42CrmCapabilities = crmCapabilitySchema.options;

export const capabilityBootstrapSchema = z.object({
  capabilities: z.array(crmCapabilitySchema).readonly(),
  role_label: z.string().min(1).max(80),
});

export type CapabilityBootstrap = z.infer<typeof capabilityBootstrapSchema>;
