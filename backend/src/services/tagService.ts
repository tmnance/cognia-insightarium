/**
 * Tag Service
 * 
 * Manages tags and bookmark-tag relationships
 */

import { prisma } from '../db/prismaClient';
import { logger } from '../utils/logger';
import {
  findTagsByKeywords,
  getAllTagDefinitions,
  getTagDefinitionBySlug,
} from './tagCategorization';

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
 * Initialize default tags in the database
 * Should be called on first run or after migration
 */
export async function initializeDefaultTags() {
  try {
    const tagDefinitions = getAllTagDefinitions();
    const createdTags: string[] = [];
    const existingTags: string[] = [];

    for (const tagDef of tagDefinitions) {
      try {
        const existing = await prisma.tag.findUnique({
          where: { slug: tagDef.slug },
        });

        if (existing) {
          // Update description and color if tag definition has them
          if (tagDef.description || tagDef.color) {
            await prisma.tag.update({
              where: { id: existing.id },
              data: {
                ...(tagDef.description && { description: tagDef.description }),
                ...(tagDef.color && { color: tagDef.color }),
              },
            });
          }
          existingTags.push(tagDef.name);
        } else {
          await getOrCreateTag(
            tagDef.name,
            tagDef.slug,
            tagDef.description,
            tagDef.color
          );
          createdTags.push(tagDef.name);
        }
      } catch (error) {
        logger.error('Error initializing tag', {
          error,
          tagName: tagDef.name,
          tagSlug: tagDef.slug,
        });
      }
    }

    logger.info('Tag initialization completed', {
      created: createdTags.length,
      existing: existingTags.length,
      createdTags,
    });

    return {
      created: createdTags.length,
      existing: existingTags.length,
      createdTags,
      existingTags,
    };
  } catch (error) {
    logger.error('Error initializing default tags', error);
    throw error;
  }
}

/**
 * Automatically tag a bookmark based on its content
 */
export async function autoTagBookmark(
  bookmarkId: string,
  content: string | null | undefined
) {
  try {
    // Find matching tags based on keywords
    const tagMatches = findTagsByKeywords(content);

    if (tagMatches.length === 0) {
      logger.debug('No tags matched for bookmark', { bookmarkId });
      return [];
    }

    // Get tag definitions to map slugs to tag data
    const appliedTags = [];

    for (const match of tagMatches) {
      try {
        // Get or create tag
        const tagDef = getTagDefinitionBySlug(match.tagSlug);
        if (!tagDef) {
          logger.warn('Tag definition not found', { slug: match.tagSlug });
          continue;
        }

        const tag = await getOrCreateTag(
          tagDef.name,
          tagDef.slug,
          tagDef.description,
          tagDef.color
        );

        // Check if bookmark-tag relationship already exists
        const existing = await prisma.bookmarkTag.findUnique({
          where: {
            bookmarkId_tagId: {
              bookmarkId,
              tagId: tag.id,
            },
          },
        });

        if (existing) {
          // Update if it wasn't auto-tagged before (user might have added manually)
          if (!existing.autoTagged) {
            await prisma.bookmarkTag.update({
              where: { id: existing.id },
              data: {
                autoTagged: true,
                confidence: match.confidence,
              },
            });
          } else if (
            existing.confidence === null ||
            existing.confidence < match.confidence
          ) {
            // Update confidence if higher
            await prisma.bookmarkTag.update({
              where: { id: existing.id },
              data: {
                confidence: match.confidence,
              },
            });
          }
          appliedTags.push({ tag, confidence: match.confidence });
        } else {
          // Create new bookmark-tag relationship
          await prisma.bookmarkTag.create({
            data: {
              bookmarkId,
              tagId: tag.id,
              autoTagged: true,
              confidence: match.confidence,
            },
          });
          appliedTags.push({ tag, confidence: match.confidence });
        }
      } catch (error) {
        logger.error('Error applying tag to bookmark', {
          error,
          bookmarkId,
          tagSlug: match.tagSlug,
        });
      }
    }

    logger.info('Auto-tagged bookmark', {
      bookmarkId,
      tagCount: appliedTags.length,
      tags: appliedTags.map(t => t.tag.name),
    });

    return appliedTags;
  } catch (error) {
    logger.error('Error auto-tagging bookmark', { error, bookmarkId });
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

    return bookmarkTags.map((bt: { id: string; autoTagged: boolean; confidence: number | null; tag: any }) => ({
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

    return tags.map((tag: any) => ({
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

