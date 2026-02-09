import { z } from 'zod';

/** Slug: lowercase letters, numbers, hyphens only */
const slugSchema = z
  .string()
  .min(1, 'Slug is required')
  .max(100)
  .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only');

/** Optional hex color (#xxx or #xxxxxx) */
const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/, 'Color must be a hex code (e.g. #f00 or #ff0000)')
  .optional()
  .nullable();

export const createTagSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: slugSchema,
  description: z.string().max(500).optional().nullable(),
  color: hexColorSchema,
});

export type CreateTagInput = z.infer<typeof createTagSchema>;

export const updateTagSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100).optional(),
  slug: slugSchema.optional(),
  description: z.string().max(500).optional().nullable(),
  color: hexColorSchema,
});

export type UpdateTagInput = z.infer<typeof updateTagSchema>;
