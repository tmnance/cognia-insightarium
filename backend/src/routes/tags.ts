import express, { Request, Response } from 'express';
import { logger } from '../utils/logger';
import {
  getAllTagsWithCounts,
  getTagBySlug,
  createTag as createTagService,
  updateTag as updateTagService,
  deleteTag as deleteTagService,
  copyTagAssignment as copyTagAssignmentService,
} from '../services/tagService';
import { serializeTag, serializeTagWithCount } from '../serializers/tagSerializer';
import { createTagSchema, updateTagSchema } from '../validators/schemas';

const router = express.Router();

/**
 * POST /api/tags
 * Create a new tag
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = createTagSchema.safeParse(req.body);
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors;
      const message = Object.values(first).flat().join(' ') || 'Validation failed';
      return res.status(400).json({
        success: false,
        error: message,
      });
    }

    const { name, slug, description, color } = parsed.data;
    const tag = await createTagService(name, slug, description, color);

    return res.status(201).json({
      success: true,
      tag: serializeTag(tag),
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        error: error.message,
      });
    }
    logger.error('Error in POST /api/tags', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create tag',
    });
  }
});

/**
 * GET /api/tags
 * Get all tags with bookmark counts
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const tags = await getAllTagsWithCounts();

    return res.json({
      success: true,
      count: tags.length,
      tags: tags.map(serializeTagWithCount),
    });
  } catch (error) {
    logger.error('Error in GET /api/tags', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch tags',
    });
  }
});

/**
 * GET /api/tags/:slug
 * Get a specific tag by slug
 */
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const tag = await getTagBySlug(slug);

    if (!tag) {
      return res.status(404).json({
        success: false,
        error: 'Tag not found',
      });
    }

    return res.json({
      success: true,
      tag: serializeTag(tag),
    });
  } catch (error) {
    logger.error('Error in GET /api/tags/:slug', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch tag',
    });
  }
});

/**
 * PUT /api/tags/:id
 * Update a tag by ID
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parsed = updateTagSchema.safeParse(req.body);

    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors;
      const message = Object.values(first).flat().join(' ') || 'Validation failed';
      return res.status(400).json({
        success: false,
        error: message,
      });
    }

    const { name, slug, description, color } = parsed.data;
    const tag = await updateTagService(id, name, slug, description, color);

    return res.json({
      success: true,
      tag: serializeTag(tag),
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        return res.status(409).json({
          success: false,
          error: error.message,
        });
      }
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }
    }
    logger.error('Error in PUT /api/tags/:id', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update tag',
    });
  }
});

/**
 * DELETE /api/tags/:id
 * Delete a tag by ID
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const bookmarkCount = await deleteTagService(id);

    return res.json({
      success: true,
      bookmarkCount,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }
    logger.error('Error in DELETE /api/tags/:id', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete tag',
    });
  }
});

/**
 * POST /api/tags/:id/copy-assignment
 * Add From tag to every bookmark that has the To tag
 */
router.post('/:id/copy-assignment', async (req: Request, res: Response) => {
  try {
    const { id: fromTagId } = req.params;
    const toTagId =
      typeof req.body?.toTagId === 'string' ? req.body.toTagId.trim() : '';

    if (!toTagId) {
      return res.status(400).json({
        success: false,
        error: 'toTagId is required',
      });
    }

    const result = await copyTagAssignmentService(fromTagId, toTagId);

    return res.json({
      success: true,
      bookmarksUpdated: result.bookmarksUpdated,
      bookmarksWithToTag: result.bookmarksWithToTag,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }
      if (error.message.includes('must be different')) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    }
    logger.error('Error in POST /api/tags/:id/copy-assignment', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to copy tag assignment',
    });
  }
});

export default router;

