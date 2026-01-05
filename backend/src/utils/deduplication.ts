import { prisma } from '../db/prismaClient';
import { logger } from './logger';

export interface BookmarkData {
  source: string;
  externalId?: string | null;
  url?: string | null;
  content?: string | null;
}

/**
 * Check if a bookmark already exists based on externalId or url
 * Returns the existing bookmark if found, null otherwise
 */
export async function findExistingBookmark(data: BookmarkData) {
  try {
    // First, try to find by externalId if provided
    if (data.externalId && data.source) {
      const byExternalId = await prisma.bookmark.findUnique({
        where: {
          source_externalId: {
            source: data.source,
            externalId: data.externalId,
          },
        },
      });

      if (byExternalId) {
        logger.debug('Found existing bookmark by externalId', {
          source: data.source,
          externalId: data.externalId,
        });
        return byExternalId;
      }
    }

    // Fallback to URL if provided
    if (data.url) {
      const byUrl = await prisma.bookmark.findFirst({
        where: {
          url: data.url,
        },
      });

      if (byUrl) {
        logger.debug('Found existing bookmark by URL', { url: data.url });
        return byUrl;
      }
    }

    return null;
  } catch (error) {
    logger.error('Error checking for existing bookmark', error);
    throw error;
  }
}

/**
 * Create a bookmark only if it doesn't already exist
 * Returns the created or existing bookmark
 */
export async function createBookmarkIfNotExists(data: BookmarkData) {
  const existing = await findExistingBookmark(data);

  if (existing) {
    logger.info('Bookmark already exists, skipping creation', {
      id: existing.id,
      source: data.source,
    });
    return existing;
  }

  try {
    const bookmark = await prisma.bookmark.create({
      data: {
        source: data.source,
        externalId: data.externalId || null,
        url: data.url || null,
        content: data.content || null,
      },
    });

    logger.info('Created new bookmark', { id: bookmark.id, source: data.source });

    return bookmark;
  } catch (error) {
    logger.error('Error creating bookmark', error);
    throw error;
  }
}


