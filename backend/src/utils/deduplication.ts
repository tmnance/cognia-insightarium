import type { Prisma } from '@prisma/client';
import { prisma } from '../db/prismaClient';
import { logger } from './logger';

export interface BookmarkData {
  source: string;
  externalId?: string | null;
  url?: string | null;
  content?: string | null;
  author?: string | null; // Author/username from originating platform
  sourceCreatedAt?: Date | string | null; // When content was posted on originating platform
}

/**
 * Check if a bookmark already exists based on externalId or url
 * Returns the existing bookmark if found, null otherwise
 */
export async function findExistingBookmark(data: BookmarkData) {
  try {
    // First, try to find by externalId if provided (including deleted bookmarks)
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
          deleted: !!byExternalId.deletedAt,
        });
        return byExternalId;
      }
    }

    // Fallback to URL if provided (including deleted bookmarks)
    if (data.url) {
      const byUrl = await prisma.bookmark.findFirst({
        where: {
          url: data.url,
        },
      });

      if (byUrl) {
        logger.debug('Found existing bookmark by URL', { url: data.url, deleted: !!byUrl.deletedAt });
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
 * Check if author string represents a deleted user (Reddit uses [deleted] or @[deleted])
 */
export function isDeletedAuthor(author: string | null | undefined): boolean {
  if (!author) return false;
  const normalized = author.trim().toLowerCase();
  return normalized === '[deleted]' || normalized === '@[deleted]';
}

/**
 * Update an existing bookmark with new data
 * Note: Never updates author to [deleted] or @[deleted] (preserves existing author)
 */
export async function updateBookmark(bookmarkId: string, data: Partial<BookmarkData>) {
  const now = new Date();
  const sourceCreatedAt = data.sourceCreatedAt
    ? typeof data.sourceCreatedAt === 'string'
      ? new Date(data.sourceCreatedAt)
      : data.sourceCreatedAt
    : undefined;

  const updateData: Prisma.BookmarkUpdateInput = {
    lastIngestedAt: now,
  };

  if (data.content !== undefined) {
    updateData.content = data.content;
  }
  // Only update author if it's not a deleted author marker
  if (data.author !== undefined && !isDeletedAuthor(data.author)) {
    updateData.author = data.author;
  }
  if (sourceCreatedAt !== undefined) {
    updateData.sourceCreatedAt = sourceCreatedAt;
  }

  const updated = await prisma.bookmark.update({
    where: { id: bookmarkId },
    data: updateData,
  });

  logger.info('Updated bookmark', { id: bookmarkId });
  return updated;
}

/**
 * Create a bookmark only if it doesn't already exist
 * Returns the created or existing bookmark
 * Updates lastIngestedAt if bookmark exists
 */
export async function createBookmarkIfNotExists(data: BookmarkData) {
  const existing = await findExistingBookmark(data);
  const now = new Date();
  const sourceCreatedAt = data.sourceCreatedAt
    ? typeof data.sourceCreatedAt === 'string'
      ? new Date(data.sourceCreatedAt)
      : data.sourceCreatedAt
    : null;

  if (existing) {
    // If bookmark is deleted, return it without updating (don't create, don't undelete)
    if (existing.deletedAt) {
      logger.info('Bookmark exists but is deleted, skipping', {
        id: existing.id,
        source: data.source,
      });
      return existing;
    }

    // Update lastIngestedAt for existing non-deleted bookmark
    // Also update sourceCreatedAt if it's not set and we have a value
    const updateData: Prisma.BookmarkUpdateInput = {
      lastIngestedAt: now,
    };
    if (!existing.sourceCreatedAt && sourceCreatedAt) {
      updateData.sourceCreatedAt = sourceCreatedAt;
    }

    const updated = await prisma.bookmark.update({
      where: { id: existing.id },
      data: updateData,
    });

    logger.info('Bookmark already exists, updated lastIngestedAt', {
      id: existing.id,
      source: data.source,
    });
    return updated;
  }

  try {
    const bookmark = await prisma.bookmark.create({
      data: {
        source: data.source,
        externalId: data.externalId || null,
        url: data.url || null,
        content: data.content || null,
        author: data.author || null,
        sourceCreatedAt,
        firstIngestedAt: now,
        lastIngestedAt: now,
      },
    });

    logger.info('Created new bookmark', { id: bookmark.id, source: data.source });

    return bookmark;
  } catch (error) {
    logger.error('Error creating bookmark', error);
    throw error;
  }
}
