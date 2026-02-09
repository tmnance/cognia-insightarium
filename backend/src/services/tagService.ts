/**
 * Tag Service
 *
 * Manages tags and bookmark-tag relationships
 */

import { Tag } from '@prisma/client';
import { prisma } from '../db/prismaClient';
import { logger } from '../utils/logger';
import { getAllDefaultTagDefinitions } from './tagDefinitions';

export interface TagWithCount {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  createdAt: Date;
  updatedAt: Date;
  bookmarkCount: number;
}

/**
 * Create a new tag. Throws if a tag with the same slug or name already exists.
 */
export async function createTag(
  name: string,
  slug: string,
  description?: string | null,
  color?: string | null
) {
  try {
    const existingBySlug = await prisma.tag.findUnique({
      where: { slug },
    });
    if (existingBySlug) {
      throw new Error(`A tag with slug "${slug}" already exists`);
    }

    const existingByName = await prisma.tag.findUnique({
      where: { name },
    });
    if (existingByName) {
      throw new Error(`A tag with name "${name}" already exists`);
    }

    const tag = await prisma.tag.create({
      data: {
        name,
        slug,
        description: description ?? null,
        color: color ?? null,
      },
    });

    logger.info('Created new tag', { id: tag.id, name, slug });
    return tag;
  } catch (error) {
    if (error instanceof Error && (error.message.includes('already exists'))) {
      throw error;
    }
    logger.error('Error creating tag', { error, name, slug });
    throw error;
  }
}

/**
 * Get or create a tag by name and slug
 */
export async function getOrCreateTag(
  name: string,
  slug: string,
  description?: string,
  color?: string
) {
  try {
    // Try to find existing tag by slug first
    let tag = await prisma.tag.findUnique({
      where: { slug },
    });

    if (!tag) {
      // Try to find by name as fallback
      tag = await prisma.tag.findUnique({
        where: { name },
      });
    }

    if (tag) {
      // Update description and color if provided and different
      if (description !== undefined || color !== undefined) {
        tag = await prisma.tag.update({
          where: { id: tag.id },
          data: {
            ...(description !== undefined && { description }),
            ...(color !== undefined && { color }),
          },
        });
      }
      return tag;
    }

    // Create new tag
    tag = await prisma.tag.create({
      data: {
        name,
        slug,
        description: description || null,
        color: color || null,
      },
    });

    logger.info('Created new tag', { id: tag.id, name, slug });
    return tag;
  } catch (error) {
    logger.error('Error getting or creating tag', { error, name, slug });
    throw error;
  }
}

/**
 * Initialize default tags in the database (if none exist).
 */
export async function initializeDefaultTagsIfNone() {
  try {
    const existingTags = await getAllTagsWithCounts();
    if (existingTags.length > 0) {
      logger.info('Tags already exist, skipping initialization');
      return;
    }

    const toCreate = getAllDefaultTagDefinitions();

    await prisma.tag.createMany({
      data: toCreate.map((def) => ({
        name: def.name,
        slug: def.slug,
        description: def.description ?? null,
        color: def.color ?? null,
      })),
    });

    const createdNames = toCreate.map((d) => d.name);
    logger.info('Tag initialization completed', {
      created: toCreate.length,
      existing: existingTags.length,
      createdTags: createdNames,
    });

    return {
      created: toCreate.length,
      existing: existingTags.length,
      createdTags: createdNames,
      existingTags: existingTags.map((t) => t.name),
    };
  } catch (error) {
    logger.error('Error initializing default tags', error);
    throw error;
  }
}

/**
 * Get all tags for a bookmark
 */
export async function getBookmarkTags(bookmarkId: string) {
  try {
    const bookmarkTags = await prisma.bookmarkTag.findMany({
      where: { bookmarkId },
      include: {
        tag: true,
      },
      orderBy: [
        { autoTagged: 'desc' }, // Auto-tagged first
        { confidence: 'desc' }, // Higher confidence first
        { createdAt: 'asc' }, // Oldest first
      ],
    });

    return bookmarkTags.map((bt: { id: string; autoTagged: boolean; confidence: number | null; tag: Tag }) => ({
      ...bt.tag,
      autoTagged: bt.autoTagged,
      confidence: bt.confidence,
      bookmarkTagId: bt.id,
    }));
  } catch (error) {
    logger.error('Error getting bookmark tags', { error, bookmarkId });
    throw error;
  }
}

/**
 * Add a tag to a bookmark
 */
export async function addTagToBookmark(
  bookmarkId: string,
  tagId: string,
  autoTagged: boolean = false,
  confidence: number | null = null
) {
  try {
    // Check if relationship already exists
    const existing = await prisma.bookmarkTag.findUnique({
      where: {
        bookmarkId_tagId: {
          bookmarkId,
          tagId,
        },
      },
    });

    if (existing) {
      // Update if needed
      if (existing.autoTagged !== autoTagged || existing.confidence !== confidence) {
        return await prisma.bookmarkTag.update({
          where: { id: existing.id },
          data: {
            autoTagged,
            confidence,
          },
        });
      }
      return existing;
    }

    // Create new relationship
    const bookmarkTag = await prisma.bookmarkTag.create({
      data: {
        bookmarkId,
        tagId,
        autoTagged,
        confidence,
      },
      include: {
        tag: true,
      },
    });

    logger.info('Added tag to bookmark', {
      bookmarkId,
      tagId,
      autoTagged,
    });

    return bookmarkTag;
  } catch (error) {
    logger.error('Error adding tag to bookmark', { error, bookmarkId, tagId });
    throw error;
  }
}

/**
 * Add a tag to multiple bookmarks
 */
export async function addTagToBookmarks(
  bookmarkIds: string[],
  tagId: string,
) {
  try {
    // Check if relationships already exists
    const existingBookmarkIds = await prisma.bookmarkTag.findMany({
      where: {
        bookmarkId: { in: bookmarkIds },
        tagId,
      },
    }).then(result => new Set(result.map(r => r.bookmarkId)));
    const bookmarkIdsToUpdate = bookmarkIds.filter(id => !existingBookmarkIds.has(id));

    if (bookmarkIdsToUpdate.length === 0) {
      logger.info('No bookmarks to update', { bookmarkIds, tagId });
      return 0;
    }

    // add tag to bookmarks in a single transaction
    await prisma.bookmarkTag.createMany({
      data: bookmarkIdsToUpdate.map(bookmarkId => ({
        bookmarkId,
        tagId,
        autoTagged: false,
        confidence: null,
      })),
    });

    logger.info('Added tag to bookmarks', {
      bookmarkIds: bookmarkIdsToUpdate,
      tagId,
    });

    return bookmarkIdsToUpdate.length;
  } catch (error) {
    logger.error('Error adding tag to bookmarks', { error, bookmarkIds, tagId });
    throw error;
  }
}

/**
 * Remove a tag from a bookmark
 */
export async function removeTagFromBookmark(bookmarkId: string, tagId: string) {
  try {
    const deleted = await prisma.bookmarkTag.deleteMany({
      where: {
        bookmarkId,
        tagId,
      },
    });

    logger.info('Removed tag from bookmark', {
      bookmarkId,
      tagId,
      deleted: deleted.count > 0,
    });

    return deleted.count > 0;
  } catch (error) {
    logger.error('Error removing tag from bookmark', { error, bookmarkId, tagId });
    throw error;
  }
}

/**
 * Get all tags with bookmark counts
 */
export async function getAllTagsWithCounts(): Promise<TagWithCount[]> {
  try {
    const tags = await prisma.tag.findMany({
      include: {
        _count: {
          select: {
            bookmarks: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    return tags.map((tag: Tag & { _count: { bookmarks: number } }) => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      description: tag.description,
      color: tag.color,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
      bookmarkCount: tag._count.bookmarks,
    }));
  } catch (error) {
    logger.error('Error getting all tags with counts', { error });
    throw error;
  }
}

/**
 * Get tag by slug
 */
export async function getTagBySlug(slug: string) {
  try {
    return await prisma.tag.findUnique({
      where: { slug },
    });
  } catch (error) {
    logger.error('Error getting tag by slug', { error, slug });
    throw error;
  }
}

/**
 * Get tag by ID
 */
export async function getTagById(id: string) {
  try {
    return await prisma.tag.findUnique({
      where: { id },
    });
  } catch (error) {
    logger.error('Error getting tag by ID', { error, id });
    throw error;
  }
}

/**
 * Update a tag by ID. Throws if slug or name conflicts with another tag.
 */
export async function updateTag(
  id: string,
  name?: string,
  slug?: string,
  description?: string | null,
  color?: string | null
) {
  try {
    const tag = await prisma.tag.findUnique({ where: { id } });
    if (!tag) {
      throw new Error('Tag not found');
    }

    // Check for conflicts if slug or name is being changed
    if (slug && slug !== tag.slug) {
      const existingBySlug = await prisma.tag.findUnique({
        where: { slug },
      });
      if (existingBySlug) {
        throw new Error(`A tag with slug "${slug}" already exists`);
      }
    }

    if (name && name !== tag.name) {
      const existingByName = await prisma.tag.findUnique({
        where: { name },
      });
      if (existingByName) {
        throw new Error(`A tag with name "${name}" already exists`);
      }
    }

    const updated = await prisma.tag.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(slug !== undefined && { slug }),
        ...(description !== undefined && { description: description ?? null }),
        ...(color !== undefined && { color: color ?? null }),
      },
    });

    logger.info('Updated tag', { id, name: updated.name, slug: updated.slug });
    return updated;
  } catch (error) {
    if (error instanceof Error && (error.message.includes('already exists') || error.message.includes('not found'))) {
      throw error;
    }
    logger.error('Error updating tag', { error, id });
    throw error;
  }
}

/**
 * Delete a tag by ID. Returns the number of bookmarks that had this tag.
 */
export async function deleteTag(id: string) {
  try {
    const tag = await prisma.tag.findUnique({ where: { id } });
    if (!tag) {
      throw new Error('Tag not found');
    }

    // Get count of bookmarks with this tag before deletion
    const bookmarkCount = await prisma.bookmarkTag.count({
      where: { tagId: id },
    });

    // Delete the tag (cascade will remove bookmark-tag relationships)
    await prisma.tag.delete({
      where: { id },
    });

    logger.info('Deleted tag', { id, name: tag.name, bookmarkCount });
    return bookmarkCount;
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw error;
    }
    logger.error('Error deleting tag', { error, id });
    throw error;
  }
}

/**
 * Copy tag assignment: add From tag to every bookmark that has the To tag.
 * Does not remove any tags. Returns the number of bookmarks that received the new tag
 * (may be less than To tag count if some already had the From tag).
 */
export async function copyTagAssignment(fromTagId: string, toTagId: string) {
  try {
    const fromTag = await prisma.tag.findUnique({ where: { id: fromTagId } });
    const toTag = await prisma.tag.findUnique({ where: { id: toTagId } });
    if (!fromTag) throw new Error('From tag not found');
    if (!toTag) throw new Error('To tag not found');
    if (fromTagId === toTagId) {
      throw new Error('From and To tag must be different');
    }

    // Find all bookmarks that have the To tag and not the From tag
    const bookmarkIdsToUpdate = await prisma.bookmarkTag.findMany({
      where: { tagId: toTagId, NOT: { tagId: fromTagId } },
      select: { bookmarkId: true },
    }).then(result => new Set(result.map(r => r.bookmarkId)));

    // Add the From tag to each bookmark that has the To tag
    const added = await addTagToBookmarks(Array.from(bookmarkIdsToUpdate), fromTagId);

    logger.info('Copy tag assignment', {
      fromTagId,
      toTagId,
      bookmarksWithToTag: bookmarkIdsToUpdate.size,
      added,
    });
    return { bookmarksUpdated: added, bookmarksWithToTag: bookmarkIdsToUpdate.size };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('not found') || error.message.includes('must be different'))
    ) {
      throw error;
    }
    logger.error('Error copying tag assignment', { error, fromTagId, toTagId });
    throw error;
  }
}
