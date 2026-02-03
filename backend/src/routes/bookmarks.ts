import express, { Request, Response } from 'express';
import { fetchLinkedInSavedPosts } from '../services/linkedInIntegration';
import { fetchUrlContent } from '../services/urlFetcher';
import { createBookmarkIfNotExists, findExistingBookmark, updateBookmark } from '../utils/deduplication';
import { logger } from '../utils/logger';
import { prisma } from '../db/prismaClient';
import { config } from '../config/env';
import {
  getBookmarkTags,
  addTagToBookmark,
  removeTagFromBookmark,
  getTagBySlug,
} from '../services/tagService';

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

/** Item shape used when extracting bookmark source/url (e.g. from bulk body or platform payload) */
interface BookmarkItemLike {
  platform?: string;
  url?: string | null;
  author?: string | null;
}

/**
 * Normalize author string by removing leading '@' if present
 */
function normalizeAuthor(author: string | null | undefined): string | null {
  if (!author) return null;
  return author.replace(/^@+/, '').trim() || null;
}

/**
 * Helper function to extract external ID and source from an item
 * Matches the logic used in bulk save endpoint
 */
function extractBookmarkData(item: BookmarkItemLike): { source: string; externalId: string | null; url: string | null } {
  let externalId: string | null = null;
  let source = 'url';
  let match: RegExpMatchArray | null = null;

  if (!item.url) {
    throw new Error('URL is required');
  }

  switch (item.platform) {
    case 'x':
      source = 'x';
      match = item.url.match(/\/status\/(\d+)/) || item.url.match(/x\.com\/\w+\/status\/(\d+)/);
      if (match) {
        externalId = match[1];
      }
      break;
    case 'reddit':
      source = 'reddit';
      match = item.url.match(/^https?:\/\/(?:www\.)?reddit\.com\/r\/([^/]+)\/comments\/([^/]+)(?:\/[^/]+)?(?:\/comment\/([^/?#]+))?\/?(?:[?#].*)?$/i);
      if (match) {
        const [, subreddit, postId, commentId] = match;
        externalId = `${subreddit}-${postId}${commentId ? `-${commentId}` : ''}`;
      }
      break;
    case 'linkedin':
      source = 'linkedin';
      match = item.url.match(/^https?:\/\/(?:www\.)?linkedin\.com\/feed\/update\/([^/]+)/);
      if (match) {
        externalId = match[1];
      }
      break;
    default:
      source = 'url';
      externalId = item.url;
      break;
  }

  if (!externalId) {
    throw new Error('External ID is required');
  }

  return {
    source,
    externalId,
    url: item.url || null,
  };
}

/**
 * POST /api/bookmarks/check-duplicates
 * Check which items in the provided array are duplicates or have changed
 * 
 * Body: Array of bookmark items with platform, url, text, author, timestamp, etc.
 * Returns: Object with duplicateIndices and changedIndices arrays
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

    logger.info('Checking for duplicates and changes', { count: items.length });

    const duplicateIndices: number[] = [];
    const changedIndices: number[] = [];

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
        // Check if anything has changed
        const newContent = item.text || null;
        const newAuthor = normalizeAuthor(item.author);
        
        const contentChanged = newContent !== null && existing.content !== newContent;
        const authorChanged = newAuthor !== null && existing.author !== newAuthor;
        
        if (contentChanged || authorChanged) {
          changedIndices.push(i);
        } else {
          duplicateIndices.push(i);
        }
      }
    }

    return res.json({
      success: true,
      duplicateIndices,
      changedIndices,
      duplicateCount: duplicateIndices.length,
      changedCount: changedIndices.length,
    });
  } catch (error) {
    logger.error('Error checking for duplicates and changes', error);
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

        // Parse sourceCreatedAt from timestamp if provided
        const sourceCreatedAt = item.timestamp ? new Date(item.timestamp) : null;

        // Normalize author (strip leading '@')
        const author = normalizeAuthor(item.author);

        // Check if bookmark exists
        const existing = await findExistingBookmark({
          source,
          externalId,
          url,
        });

        let bookmark;
        if (existing) {
          // Update existing bookmark
          bookmark = await updateBookmark(existing.id, {
            content: item.text || null,
            sourceCreatedAt: sourceCreatedAt || undefined,
            author: author ?? undefined,
          });
        } else {
          // Create new bookmark
          bookmark = await createBookmarkIfNotExists({
            source,
            externalId,
            url,
            content: item.text || null,
            sourceCreatedAt,
            author,
          });
        }

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
 * Get all bookmarks with optional filtering by source or tags
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { source, tags } = req.query;

    const where: { source?: string; tags?: { some: { tag: { slug: { in: string[] } } } } } = {};

    if (source) {
      where.source = source as string;
    }

    // Filter by tags if provided (comma-separated list of tag slugs)
    if (tags) {
      const tagSlugs = (tags as string).split(',').map(t => t.trim());
      where.tags = {
        some: {
          tag: {
            slug: {
              in: tagSlugs,
            },
          },
        },
      };
    }

    const bookmarks = await prisma.bookmark.findMany({
      where,
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform to include tags in a simpler format
    const bookmarksWithTags = bookmarks.map(bookmark => ({
      ...bookmark,
      tags: bookmark.tags.map(bt => ({
        ...bt.tag,
        autoTagged: bt.autoTagged,
        confidence: bt.confidence,
      })),
    }));

    return res.json({
      success: true,
      count: bookmarksWithTags.length,
      bookmarks: bookmarksWithTags,
    });
  } catch (error) {
    logger.error('Error in GET /api/bookmarks', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch bookmarks',
    });
  }
});

/**
 * GET /api/bookmarks/:id/tags
 * Get all tags for a specific bookmark
 */
router.get('/:id/tags', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const bookmark = await prisma.bookmark.findUnique({
      where: { id },
    });

    if (!bookmark) {
      return res.status(404).json({
        success: false,
        error: 'Bookmark not found',
      });
    }

    const tags = await getBookmarkTags(id);

    return res.json({
      success: true,
      count: tags.length,
      tags,
    });
  } catch (error) {
    logger.error('Error in GET /api/bookmarks/:id/tags', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch bookmark tags',
    });
  }
});

/**
 * POST /api/bookmarks/:id/tags
 * Add tag(s) to a bookmark
 */
router.post('/:id/tags', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tagId, tagSlug } = req.body;

    if (!tagId && !tagSlug) {
      return res.status(400).json({
        success: false,
        error: 'Either tagId or tagSlug must be provided',
      });
    }

    const bookmark = await prisma.bookmark.findUnique({
      where: { id },
    });

    if (!bookmark) {
      return res.status(404).json({
        success: false,
        error: 'Bookmark not found',
      });
    }

    let finalTagId = tagId;
    if (tagSlug && !tagId) {
      const tag = await getTagBySlug(tagSlug);
      if (!tag) {
        return res.status(404).json({
          success: false,
          error: 'Tag not found',
        });
      }
      finalTagId = tag.id;
    }

    const bookmarkTag = await addTagToBookmark(id, finalTagId, false, null);

    return res.json({
      success: true,
      bookmarkTag,
    });
  } catch (error) {
    logger.error('Error in POST /api/bookmarks/:id/tags', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to add tag to bookmark',
    });
  }
});

/**
 * DELETE /api/bookmarks/:id/tags/:tagId
 * Remove a tag from a bookmark
 */
router.delete('/:id/tags/:tagId', async (req: Request, res: Response) => {
  try {
    const { id, tagId } = req.params;

    const bookmark = await prisma.bookmark.findUnique({
      where: { id },
    });

    if (!bookmark) {
      return res.status(404).json({
        success: false,
        error: 'Bookmark not found',
      });
    }

    const removed = await removeTagFromBookmark(id, tagId);

    if (!removed) {
      return res.status(404).json({
        success: false,
        error: 'Tag not found on bookmark',
      });
    }

    return res.json({
      success: true,
      message: 'Tag removed from bookmark',
    });
  } catch (error) {
    logger.error('Error in DELETE /api/bookmarks/:id/tags/:tagId', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to remove tag from bookmark',
    });
  }
});

/**
 * GET /api/bookmarks/llm-tagging/stats
 * Get statistics about tagging progress (without generating a prompt)
 */
router.get('/llm-tagging/stats', async (_req: Request, res: Response) => {
  try {
    const { getUntaggedBookmarkCount, getTotalBookmarkCount } = await import('../services/promptGeneration');
    
    const totalUntagged = await getUntaggedBookmarkCount();
    const totalBookmarks = await getTotalBookmarkCount();

    return res.json({
      success: true,
      totalUntaggedCount: totalUntagged,
      totalBookmarkCount: totalBookmarks,
      llmBookmarkCategorizationUrl: config.llmBookmarkCategorizationUrl,
    });
  } catch (error) {
    logger.error('Error getting tagging stats', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get tagging stats',
    });
  }
});

/**
 * GET /api/bookmarks/llm-tagging/prompt
 * Generate a prompt for LLM-based tag categorization
 */
router.get('/llm-tagging/prompt', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const { generateTaggingPrompt } = await import('../services/promptGeneration');
    
    const result = await generateTaggingPrompt(limit);

    return res.json({
      success: true,
      prompt: result.prompt,
      bookmarkIds: result.bookmarkIds,
      bookmarkCount: result.bookmarkCount,
      remainingCount: result.remainingCount,
      totalUntaggedCount: result.totalUntaggedCount,
      totalBookmarkCount: result.totalBookmarkCount,
    });
  } catch (error) {
    // Handle the case where there are no untagged bookmarks
    if (error instanceof Error && error.message === 'No untagged bookmarks found') {
      // Still return stats even when no bookmarks to tag
      const { getUntaggedBookmarkCount, getTotalBookmarkCount } = await import('../services/promptGeneration');
      const totalUntagged = await getUntaggedBookmarkCount();
      const totalBookmarks = await getTotalBookmarkCount();
      
      return res.json({
        success: true,
        prompt: '',
        bookmarkIds: [],
        bookmarkCount: 0,
        remainingCount: totalUntagged,
        totalUntaggedCount: totalUntagged,
        totalBookmarkCount: totalBookmarks,
      });
    }
    
    logger.error('Error generating tagging prompt', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate tagging prompt',
    });
  }
});

/**
 * POST /api/bookmarks/llm-tagging/apply
 * Apply tags from LLM response
 */
router.post('/llm-tagging/apply', async (req: Request, res: Response) => {
  try {
    const { llmResponse } = req.body;

    if (!llmResponse || typeof llmResponse !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'llmResponse is required and must be a string',
      });
    }

    const { parseTaggingResponse } = await import('../services/promptGeneration');
    const { getTagBySlug, addTagToBookmark } = await import('../services/tagService');

    // Parse the LLM response
    const parsed = parseTaggingResponse(llmResponse);

    const results = {
      processed: 0,
      tagged: 0,
      errors: [] as Array<{ bookmarkId: string; error: string }>,
    };

    // Apply tags to bookmarks
    for (const item of parsed) {
      try {
        // Verify bookmark exists
        const bookmark = await prisma.bookmark.findUnique({
          where: { id: item.bookmarkId },
        });

        if (!bookmark) {
          results.errors.push({
            bookmarkId: item.bookmarkId,
            error: 'Bookmark not found',
          });
          continue;
        }

        // Apply each tag
        let tagApplied = false;
        for (const tagSlug of item.tagSlugs) {
          try {
            const tag = await getTagBySlug(tagSlug);
            if (!tag) {
              logger.warn('Tag not found', { tagSlug, bookmarkId: item.bookmarkId });
              continue;
            }

            await addTagToBookmark(item.bookmarkId, tag.id, true, null);
            tagApplied = true;
          } catch (tagError) {
            logger.error('Error applying tag to bookmark', {
              error: tagError,
              bookmarkId: item.bookmarkId,
              tagSlug,
            });
          }
        }

        // Mark bookmark as reviewed, regardless of whether tags were applied
        // This prevents re-processing bookmarks that got no tags
        await prisma.bookmark.update({
          where: { id: item.bookmarkId },
          data: {
            taggingReviewedAt: new Date(),
          },
        });

        if (tagApplied) {
          results.tagged++;
        }
        results.processed++;
      } catch (error) {
        results.errors.push({
          bookmarkId: item.bookmarkId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info('Applied tags from LLM response', {
      processed: results.processed,
      tagged: results.tagged,
      errors: results.errors.length,
    });

    return res.json({
      success: true,
      processed: results.processed,
      tagged: results.tagged,
      errors: results.errors.length > 0 ? results.errors : undefined,
    });
  } catch (error) {
    logger.error('Error applying tags from LLM response', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to apply tags',
    });
  }
});

export default router;
