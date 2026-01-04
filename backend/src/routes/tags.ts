import express, { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { getAllTagsWithCounts, getTagBySlug } from '../services/tagService';

const router = express.Router();

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
      tags,
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
      tag,
    });
  } catch (error) {
    logger.error('Error in GET /api/tags/:slug', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch tag',
    });
  }
});

export default router;

