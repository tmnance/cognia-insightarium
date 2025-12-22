import express, { Request, Response } from 'express';
import { fetchXBookmarks } from '../services/xIntegration';
import { fetchLinkedInSavedPosts } from '../services/linkedInIntegration';
import { fetchUrlContent } from '../services/urlFetcher';
import { createBookmarkIfNotExists } from '../utils/deduplication';
import { logger } from '../utils/logger';
import { prisma } from '../db/prismaClient';

const router = express.Router();

// Extend Express Request to include session
declare module 'express-session' {
  interface SessionData {
    xAccessToken?: string;
    xUserId?: string;
    xUsername?: string;
  }
}

/**
 * GET /api/bookmarks/x
 * Fetch bookmarks from X (Twitter) and save them
 * 
 * Uses OAuth 2.0 access token from session if available, otherwise requires userId parameter.
 */
router.get('/x', async (req: Request, res: Response) => {
  try {
    // Prefer userId from session (OAuth), fallback to query parameter
    let userId = req.session.xUserId || (req.query.userId as string | undefined);
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated. Please login with X first.',
        authenticated: false,
        loginUrl: '/api/oauth/x/authorize',
      });
    }
    
    logger.info('Fetching X bookmarks via API', { 
      userId, 
      usingSessionAuth: !!req.session.xAccessToken,
      source: req.session.xUserId ? 'session' : 'query',
    });
    
    // Use session access token if available, otherwise fall back to env config
    const bookmarks = await fetchXBookmarks(userId, req.session.xAccessToken);

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

    return res.json({
      success: true,
      count: savedBookmarks.length,
      bookmarks: savedBookmarks,
    });
  } catch (error) {
    logger.error('Error in GET /api/bookmarks/x', error);
    
    const statusCode = error instanceof Error && error.message.includes('authentication') ? 401 
      : error instanceof Error && error.message.includes('forbidden') ? 403
      : error instanceof Error && error.message.includes('rate limit') ? 429
      : 500;

    return res.status(statusCode).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch X bookmarks',
    });
  }
});

/**
 * GET /api/bookmarks/x/user-id
 * Helper endpoint to get information about finding your X user ID
 */
router.get('/x/user-id', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    message: 'How to find your X (Twitter) User ID',
    methods: [
      {
        method: '1. Online Tools',
        description: 'Use a service like tweeterid.com',
        steps: [
          'Visit https://tweeterid.com/',
          'Enter your X username',
          'Copy your User ID',
        ],
      },
      {
        method: '2. X API with Username (if you have API access)',
        description: 'Use the GET /2/users/by/username/:username endpoint',
        steps: [
          'Call: GET https://api.twitter.com/2/users/by/username/YOUR_USERNAME',
          'The response will include your user ID',
        ],
      },
      {
        method: '3. Browser Developer Tools',
        description: 'Check X website source code',
        steps: [
          'Log into X in your browser',
          'Open Developer Tools (F12)',
          'Check network requests or page source for user ID',
        ],
      },
    ],
    usage: {
      endpoint: 'GET /api/bookmarks/x?userId=YOUR_USER_ID',
      example: 'GET /api/bookmarks/x?userId=1234567890',
    },
    note: 'Bearer Token authentication does not provide user context. You must provide your user ID manually, or implement OAuth 2.0 user authentication for automatic user context.',
  });
});

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
