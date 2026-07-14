import { z } from 'zod';
import { audienceTypeSchema, contactSortSchema, leadStatusSchema } from './index.ts';

export const contactSearchBodySchema = z.object({
  search: z.string().trim().max(120).optional().default(''),
  classification: audienceTypeSchema.optional(),
  lead_status: leadStatusSchema.optional(),
  source: z.string().trim().max(80).optional(),
  assigned_user_key: z.string().trim().max(160).optional(),
  sort: contactSortSchema.optional().default('updated_desc'),
  cursor: z.string().trim().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(25).optional().default(12),
});

export type ContactSearchBody = z.infer<typeof contactSearchBodySchema>;
