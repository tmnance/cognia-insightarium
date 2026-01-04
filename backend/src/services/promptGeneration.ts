/**
 * Prompt Generation Service
 * 
 * Generates prompts for LLM-based tag categorization
 */

import { getAllTagDefinitions } from './tagCategorization';
import { prisma } from '../db/prismaClient';
import { logger } from '../utils/logger';

export interface BookmarkForPrompt {
  id: string;
  title: string | null;
  content: string | null;
  url: string | null;
}

export interface TaggingPromptResult {
  prompt: string;
  bookmarkIds: string[];
  bookmarkCount: number;
  remainingCount: number;
  totalUntaggedCount: number;
  totalBookmarkCount: number;
}

/**
 * Get untagged bookmarks that haven't been reviewed yet
 * Excludes bookmarks that were already reviewed and resulted in no tags
 */
async function getUntaggedBookmarks(limit: number = 20): Promise<BookmarkForPrompt[]> {
  const bookmarks = await prisma.bookmark.findMany({
    where: {
      tags: {
        none: {},
      },
      // Only get bookmarks that haven't been reviewed yet
      // (bookmarks with taggingReviewedAt set were reviewed and got no tags, so skip them)
      taggingReviewedAt: null,
    },
    take: limit,
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
      title: true,
      content: true,
      url: true,
    },
  });

  return bookmarks;
}

/**
 * Get total count of untagged bookmarks that haven't been reviewed yet
 */
async function getUntaggedBookmarkCount(): Promise<number> {
  return await prisma.bookmark.count({
    where: {
      tags: {
        none: {},
      },
      // Only count bookmarks that haven't been reviewed
      taggingReviewedAt: null,
    },
  });
}

/**
 * Get total count of all bookmarks
 */
async function getTotalBookmarkCount(): Promise<number> {
  return await prisma.bookmark.count();
}

/**
 * Truncate content for prompt (keep it reasonable length)
 */
function truncateContent(text: string | null, maxLength: number = 500): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Generate a prompt for LLM-based tag categorization
 */
export async function generateTaggingPrompt(
  bookmarkLimit: number = 20
): Promise<TaggingPromptResult> {
  try {
    // Get available tags
    const tagDefinitions = getAllTagDefinitions();

    // Get untagged bookmarks
    const bookmarks = await getUntaggedBookmarks(bookmarkLimit);

    if (bookmarks.length === 0) {
      throw new Error('No untagged bookmarks found');
    }

    // Get total counts
    const totalUntagged = await getUntaggedBookmarkCount();
    const totalBookmarks = await getTotalBookmarkCount();
    const remainingCount = totalUntagged - bookmarks.length;

    // Build the prompt with structured JSON format
    const availableTagsJson = JSON.stringify(
      tagDefinitions.map(tag => ({
        slug: tag.slug,
        description: tag.description || tag.name,
      })),
      null,
      2
    );

    const bookmarksJson = JSON.stringify(
      bookmarks.map(bookmark => ({
        id: bookmark.id,
        content: truncateContent(bookmark.content),
      })),
      null,
      2
    );

    let prompt = `You are helping categorize bookmarks by analyzing their content.

AVAILABLE TAGS (JSON format):
${availableTagsJson}

BOOKMARKS TO CATEGORIZE (JSON format):
${bookmarksJson}

INSTRUCTIONS:
1. Analyze each bookmark's content
2. Assign one or more relevant tags from the available tags list above using the tag slug
3. Only assign tags that are clearly relevant - it's better to be conservative
4. Format your response as a JSON array of objects, where each object has:
   - "bookmarkId": The bookmark ID (must match exactly from the list above)
   - "tags": An array of tag slugs (e.g., ["coding", "programming"])

RESPONSE FORMAT (JSON):
[
  {
    "bookmarkId": "bookmark-id-1",
    "tags": ["tag-slug-1", "tag-slug-2"]
  },
  {
    "bookmarkId": "bookmark-id-2",
    "tags": ["tag-slug-3"]
  }
]

IMPORTANT: 
- Return ONLY the JSON array, no additional text or markdown formatting
- Use the exact bookmark IDs from the "id" field in the BOOKMARKS TO CATEGORIZE section
- Use the exact tag slugs from the "slug" field in the AVAILABLE TAGS section
- If a bookmark doesn't clearly match any tag, include it with an empty tags array: []

Now analyze the bookmarks and provide your response:`;

    logger.info('Generated tagging prompt', {
      bookmarkCount: bookmarks.length,
      remainingCount,
      totalUntagged: totalUntagged,
      totalBookmarks,
      tagCount: tagDefinitions.length,
    });

    return {
      prompt,
      bookmarkIds: bookmarks.map(b => b.id),
      bookmarkCount: bookmarks.length,
      remainingCount,
      totalUntaggedCount: totalUntagged,
      totalBookmarkCount: totalBookmarks,
    };
  } catch (error) {
    logger.error('Error generating tagging prompt', { error });
    throw error;
  }
}

/**
 * Parse LLM response and extract bookmark-tag mappings
 */
export interface ParsedTaggingResponse {
  bookmarkId: string;
  tagSlugs: string[];
}

export function parseTaggingResponse(llmResponse: string): ParsedTaggingResponse[] {
  try {
    // Try to extract JSON from the response (might have markdown code blocks or extra text)
    let jsonText = llmResponse.trim();

    // Remove markdown code blocks if present
    const codeBlockMatch = jsonText.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1];
    }

    // Try to find JSON array in the text
    const jsonArrayMatch = jsonText.match(/\[[\s\S]*\]/);
    if (jsonArrayMatch) {
      jsonText = jsonArrayMatch[0];
    }

    // Parse JSON
    const parsed = JSON.parse(jsonText);

    if (!Array.isArray(parsed)) {
      throw new Error('Response must be a JSON array');
    }

    // Validate and normalize the response
    const results: ParsedTaggingResponse[] = [];

    for (const item of parsed) {
      if (!item.bookmarkId) {
        logger.warn('Skipping item without bookmarkId', { item });
        continue;
      }

      const tagSlugs = Array.isArray(item.tags) ? item.tags : [];
      
      // Validate tag slugs are strings
      const validTagSlugs = tagSlugs.filter(
        (slug: unknown): slug is string => typeof slug === 'string' && slug.length > 0
      );

      results.push({
        bookmarkId: String(item.bookmarkId),
        tagSlugs: validTagSlugs,
      });
    }

    logger.info('Parsed LLM tagging response', {
      resultCount: results.length,
      totalTags: results.reduce((sum, r) => sum + r.tagSlugs.length, 0),
    });

    return results;
  } catch (error) {
    logger.error('Error parsing LLM tagging response', { error, response: llmResponse });
    throw new Error(
      `Failed to parse LLM response: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

