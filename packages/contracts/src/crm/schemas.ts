import { z } from 'zod';
import { leadStatusSchema } from '../index.ts';
import { crmCapabilitySchema } from './capabilities.ts';

export const uuidSchema = z.string().uuid();

export const opaqueIdSchema = z
  .string()
  .trim()
  .min(3)
  .max(180)
  .regex(/^[A-Za-z0-9_:-]+$/);

export const etagSchema = z
  .string()
  .trim()
  .min(3)
  .max(160)
  .regex(/^"[^"]+"$/);

export const tagMatchModeSchema = z.enum(['any', 'all']);
export const archiveStateSchema = z.enum(['active', 'archived', 'all']).default('active');
export const contactSortSchema = z.enum(['updated_desc', 'created_desc', 'name_asc']);

export const contactSearchBodySchema = z
  .object({
    search: z.string().trim().max(120).optional(),
    classification: z.enum(['family', 'school']).optional(),
    lead_status: leadStatusSchema.optional(),
    source: z.string().trim().max(80).optional(),
    assigned_user_key: opaqueIdSchema.optional(),
    archive_state: archiveStateSchema.optional(),
    tag_ids: z.array(opaqueIdSchema).max(12).optional().default([]),
    tag_match: tagMatchModeSchema.optional().default('any'),
    sort: contactSortSchema.optional().default('updated_desc'),
    cursor: z.string().trim().max(900).optional(),
    limit: z.number().int().min(1).max(25).optional().default(12),
  })
  .strict();

export type ContactSearchBody = z.infer<typeof contactSearchBodySchema>;

export const crmOptionsResponseSchema = z
  .object({
    success: z.literal(true),
    capabilities: z.array(crmCapabilitySchema),
    lead_statuses: z.array(leadStatusSchema),
    tag_match_modes: z.array(tagMatchModeSchema),
    archive_states: z.array(z.enum(['active', 'archived', 'all'])),
  })
  .strict();

export const contactListItemV1Schema = z
  .object({
    contact_id: opaqueIdSchema,
    display_name: z.string().min(1).max(180),
    lead_status: leadStatusSchema,
    source: z.string().min(1).max(80),
    assigned_user: z
      .object({
        user_id: opaqueIdSchema,
        display_name: z.string().min(1).max(120),
        active: z.boolean(),
      })
      .nullable(),
    tags: z
      .array(
        z.object({
          tag_id: opaqueIdSchema,
          display_name: z.string().min(1).max(60),
          visual_token: z.string().min(1).max(40).nullable(),
        }),
      )
      .max(8),
    system_facts: z
      .array(
        z.object({
          dimension: z.string().min(1).max(60),
          value: z.string().min(1).max(80),
          source: z.string().min(1).max(80),
        }),
      )
      .max(8),
    archived: z.boolean(),
    updated_at: z.string().datetime(),
    version: z.number().int().min(1),
    etag: etagSchema,
  })
  .strict();

export const contactListResponseSchema = z
  .object({
    success: z.literal(true),
    contacts: z.array(contactListItemV1Schema).max(25),
    next_cursor: z.string().max(900).nullable(),
  })
  .strict();

export const crmMutationHeadersSchema = z
  .object({
    idempotency_key: uuidSchema,
    if_match: etagSchema,
    csrf_token: z.string().min(16).max(160),
  })
  .strict();

export const tagNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .refine(isSafePlainText, 'Tag names must be plain text.');

export const createTagBodySchema = z.object({ display_name: tagNameSchema }).strict();
export const renameTagBodySchema = z.object({ display_name: tagNameSchema }).strict();
export const appendNoteBodySchema = z.object({ body: z.string().trim().min(1).max(4000) }).strict();

export const relationshipTypeSchema = z.enum([
  'related',
  'parent_guardian',
  'child_dependent',
  'spouse_partner',
  'sibling',
  'household',
  'organization_contact',
  'other',
]);

export const createRelationshipBodySchema = z
  .object({
    target_contact_id: opaqueIdSchema,
    type: relationshipTypeSchema,
    label: z.string().trim().max(120).optional(),
  })
  .strict();

export const taskStatusSchema = z.enum(['open', 'in_progress', 'completed', 'cancelled']);

export const taskFilterSchema = z
  .object({
    status: taskStatusSchema.optional(),
    owner_user_key: opaqueIdSchema.optional(),
    window: z
      .enum(['all', 'active', 'overdue', 'today', 'upcoming_7_days', 'completed'])
      .optional(),
    cursor: z.string().trim().max(900).optional(),
    limit: z.number().int().min(1).max(25).optional().default(12),
  })
  .strict();

export const createTaskBodySchema = z
  .object({
    title: z.string().trim().min(1).max(180),
    detail: z.string().trim().max(1000).optional(),
    owner_user_key: opaqueIdSchema,
    due_at: z.string().datetime(),
  })
  .strict();

export const identityDecisionSchema = z
  .object({
    contact_ids: z.tuple([opaqueIdSchema, opaqueIdSchema]),
    canonical_contact_id: opaqueIdSchema.optional(),
    reason: z.string().trim().min(1).max(240).optional(),
  })
  .strict();

function isSafePlainText(value: string) {
  if (value.includes('<') || value.includes('>')) return false;
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code < 32 || code === 127) return false;
  }
  return true;
}
