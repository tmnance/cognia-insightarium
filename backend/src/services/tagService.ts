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
