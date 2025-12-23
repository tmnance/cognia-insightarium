import express, { Request, Response } from 'express';
import { fetchLinkedInSavedPosts } from '../services/linkedInIntegration';
import { fetchUrlContent } from '../services/urlFetcher';
import { createBookmarkIfNotExists, findExistingBookmark } from '../utils/deduplication';
import { logger } from '../utils/logger';
import { prisma } from '../db/prismaClient';

const router = express.Router();

/**
 * GET /api/bookmarks/linkedin
 * Fetch saved posts from LinkedIn and save them
 */
router.get('/linkedin', async (_req: Request, res: Response) => {
  try {
    logger.info('Fetching LinkedIn saved posts via API');
    const posts = await fetchLinkedInSavedPosts();

    const savedPosts = [];
    for (const post of posts) {
      const saved = await createBookmarkIfNotExists({
        source: 'linkedin',
        externalId: post.externalId,
        url: post.url,
        title: post.title,
        content: post.content,
      });
      savedPosts.push(saved);
    }

    return res.json({
      success: true,
      count: savedPosts.length,
      bookmarks: savedPosts,
    });
  } catch (error) {
    logger.error('Error in GET /api/bookmarks/linkedin', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch LinkedIn saved posts',
    });
  }
});

/**
 * POST /api/bookmarks/url
 * Fetch content from a custom URL and save it
 */
router.post('/url', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'URL is required and must be a string',
      });
    }

    logger.info('Fetching URL content via API', { url });
    const fetchedContent = await fetchUrlContent(url);

    const bookmark = await createBookmarkIfNotExists({
      source: 'url',
      externalId: null,
      url: fetchedContent.url,
      title: fetchedContent.title,
      content: fetchedContent.content,
    });

    return res.json({
      success: true,
      bookmark,
    });
  } catch (error) {
    logger.error('Error in POST /api/bookmarks/url', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch URL content',
    });
  }
});

/**
 * Helper function to extract external ID and source from an item
 * Matches the logic used in bulk save endpoint
 */
function extractBookmarkData(item: any): { source: string; externalId: string | null; url: string | null } {
  let externalId: string | null = null;
  let source = 'url';

  if (item.platform === 'x' && item.url) {
    source = 'x';
    const match = item.url.match(/\/status\/(\d+)/) || item.url.match(/x\.com\/\w+\/status\/(\d+)/);
    if (match) {
      externalId = match[1];
    }
  }

  return {
    source,
    externalId,
    url: item.url || null,
  };
}

/**
 * POST /api/bookmarks/check-duplicates
 * Check which items in the provided array are duplicates
 * 
 * Body: Array of bookmark items with platform, url, text, author, etc.
 * Returns: Array of indices that are duplicates
 */
router.post('/check-duplicates', async (req: Request, res: Response) => {
  try {
    const items = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        error: 'Body must be an array of bookmark items',
      });
    }

    logger.info('Checking for duplicates', { count: items.length });

    const duplicateIndices: number[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const { source, externalId, url } = extractBookmarkData(item);

      // Check if this bookmark already exists
      const existing = await findExistingBookmark({
        source,
        externalId,
        url,
      });

      if (existing) {
        duplicateIndices.push(i);
      }
    }

    return res.json({
      success: true,
      duplicateIndices,
      count: duplicateIndices.length,
    });
  } catch (error) {
    logger.error('Error checking for duplicates', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check for duplicates',
    });
  }
});

/**
 * POST /api/bookmarks/bulk
 * Bulk save multiple bookmarks
 * 
 * Body: Array of bookmark items with platform, url, text, author, etc.
 */
router.post('/bulk', async (req: Request, res: Response) => {
  try {
    const items = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        error: 'Body must be an array of bookmark items',
      });
    }

    logger.info('Bulk saving bookmarks', { count: items.length });

    const savedBookmarks = [];
    const errors: Array<{ item: unknown; error: string }> = [];

    for (const item of items) {
      try {
        // Extract external ID and source from item
        const { source, externalId, url } = extractBookmarkData(item);

        // Create bookmark
        const bookmark = await createBookmarkIfNotExists({
          source,
          externalId,
          url,
          title: item.text?.substring(0, 200) || item.author || null,
          content: item.text || null,
        });

        savedBookmarks.push(bookmark);
      } catch (error) {
        logger.error('Error saving bookmark item', { item, error });
        errors.push({
          item,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return res.json({
      success: true,
      saved: savedBookmarks.length,
      failed: errors.length,
      bookmarks: savedBookmarks,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    logger.error('Error in POST /api/bookmarks/bulk', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save bookmarks',
    });
  }
});

/**
 * GET /api/bookmarks
 * Get all bookmarks
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { source } = req.query;

    const where = source ? { source: source as string } : {};

    const bookmarks = await prisma.bookmark.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.json({
      success: true,
      count: bookmarks.length,
      bookmarks,
    });
  } catch (error) {
    logger.error('Error in GET /api/bookmarks', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch bookmarks',
    });
  }
});

export default router;
