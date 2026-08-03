import { z } from 'zod';
import { studentPortalDashboardSchema } from '../portals/index.ts';

export const experiencePreviewRoleIdSchema = z.enum([
  'parent',
  'student_1',
  'student_2',
  'student_3',
  'rabbi_classroom',
]);
export type ExperiencePreviewRoleId = z.infer<typeof experiencePreviewRoleIdSchema>;

export const experiencePreviewStateSchema = z.enum(['ready', 'provider_off', 'unavailable']);
export type ExperiencePreviewState = z.infer<typeof experiencePreviewStateSchema>;

export const experiencePreviewItemSchema = z.object({
  label: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(320),
  state: experiencePreviewStateSchema.optional(),
});

export const experiencePreviewSectionSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(320).optional(),
  items: z.array(experiencePreviewItemSchema).min(1).max(8),
});

export const experiencePreviewRoleCardSchema = z.object({
  role_id: experiencePreviewRoleIdSchema,
  label: z.string().trim().min(1).max(80),
  subtitle: z.string().trim().min(1).max(160),
  state: experiencePreviewStateSchema,
});

export const experiencePreviewRoleSchema = z.object({
  role_id: experiencePreviewRoleIdSchema,
  label: z.string().trim().min(1).max(80),
  headline: z.string().trim().min(1).max(200),
  banner: z.string().trim().min(1).max(240),
  fictional: z.literal(true),
  read_only: z.literal(true),
  can_open_student_session: z.boolean(),
  sections: z.array(experiencePreviewSectionSchema).min(1).max(8),
});
export type ExperiencePreviewRole = z.infer<typeof experiencePreviewRoleSchema>;

export const experiencePreviewCatalogSchema = z.object({
  goal_id: z.literal('OT-LAUNCH-01'),
  scenario_title: z.string().trim().min(1).max(160),
  household_label: z.string().trim().min(1).max(160),
  fictional: z.literal(true),
  roles: z.array(experiencePreviewRoleCardSchema).length(5),
  previews: z.array(experiencePreviewRoleSchema).length(5),
  safe_routes: z.object({
    experience_preview: z.literal('/app/experience-preview'),
    live_console: z.literal('/app/live-console'),
    content_factory: z.literal('/app/content'),
    classes: z.literal('/app/classes'),
    vimeo_demo: z.literal('/app/learning-delivery/demo/vimeo-autotrim'),
  }),
});
export type ExperiencePreviewCatalog = z.infer<typeof experiencePreviewCatalogSchema>;

export const experiencePreviewResponseSchema = z.object({
  success: z.literal(true),
  data: experiencePreviewCatalogSchema,
});

export const fictionalStudentSessionResponseSchema = z.object({
  success: z.literal(true),
  expires_at: z.string().datetime(),
  preview: experiencePreviewRoleSchema,
  student_portal: studentPortalDashboardSchema,
});
