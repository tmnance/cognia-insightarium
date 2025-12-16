import express, { Request, Response } from 'express';
import { fetchXBookmarks } from '../services/xIntegration';
import { fetchLinkedInSavedPosts } from '../services/linkedInIntegration';
import { fetchUrlContent } from '../services/urlFetcher';
import { createBookmarkIfNotExists } from '../utils/deduplication';
import { logger } from '../utils/logger';
import { prisma } from '../db/prismaClient';

const router = express.Router();

/**
 * GET /api/bookmarks/x
 * Fetch bookmarks from X (Twitter) and save them
 */
router.get('/x', async (req: Request, res: Response) => {
  try {
    logger.info('Fetching X bookmarks via API');
    const bookmarks = await fetchXBookmarks();

    const savedBookmarks = [];
    for (const bookmark of bookmarks) {
      const saved = await createBookmarkIfNotExists({
        source: 'x',
        externalId: bookmark.externalId,
        url: bookmark.url,
        title: bookmark.title,
        content: bookmark.content,
      });
      savedBookmarks.push(saved);
    }

    res.json({
      success: true,
      count: savedBookmarks.length,
      bookmarks: savedBookmarks,
    });
  } catch (error) {
    logger.error('Error in GET /api/bookmarks/x', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch X bookmarks',
    });
  }
});

/**
 * GET /api/bookmarks/linkedin
 * Fetch saved posts from LinkedIn and save them
 */
router.get('/linkedin', async (req: Request, res: Response) => {
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

    res.json({
      success: true,
      count: savedPosts.length,
      bookmarks: savedPosts,
    });
  } catch (error) {
    logger.error('Error in GET /api/bookmarks/linkedin', error);
    res.status(500).json({
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

    res.json({
      success: true,
      bookmark,
    });
  } catch (error) {
    logger.error('Error in POST /api/bookmarks/url', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch URL content',
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

    res.json({
      success: true,
      count: bookmarks.length,
      bookmarks,
    });
  } catch (error) {
    logger.error('Error in GET /api/bookmarks', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bookmarks',
    });
  }
});

export default router;

