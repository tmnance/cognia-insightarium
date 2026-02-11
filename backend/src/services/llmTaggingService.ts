/**
 * LLM Tagging Service - Orchestrates automated bookmark tagging via LLM
 *
 * Combines prompt generation, LLM call, response parsing, and tag application.
 */

import { prisma } from '../db/prismaClient';
import { logger } from '../utils/logger';
import { chatCompletion, isLLMConfigured } from './llmService';
import {
  generateTaggingPrompt,
  parseTaggingResponse,
  type ParsedTaggingResponse,
} from './promptGeneration';
import { addTagToBookmark, getTagBySlug } from './tagService';

export interface TaggingDetail {
  bookmarkId: string;
  tagSlugs: string[];
}

export interface ApplyTaggingResult {
  processed: number;
  tagged: number;
  errors: Array<{ bookmarkId: string; error: string }>;
  details: TaggingDetail[];
}

/**
 * Apply parsed tagging response to bookmarks.
 * Shared by both manual (paste response) and automated (direct LLM call) flows.
 */
export async function applyParsedTaggingResponse(
  parsed: ParsedTaggingResponse[]
): Promise<ApplyTaggingResult> {
  const results: ApplyTaggingResult = {
    processed: 0,
    tagged: 0,
    errors: [],
    details: [],
  };

  for (const item of parsed) {
    try {
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
      results.details.push({
        bookmarkId: item.bookmarkId,
        tagSlugs: [...item.tagSlugs],
      });
    } catch (error) {
      results.errors.push({
        bookmarkId: item.bookmarkId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}

export interface AutoTagResult {
  processed: number;
  tagged: number;
  errors?: Array<{ bookmarkId: string; error: string }>;
  details: TaggingDetail[];
  bookmarkCount: number;
  totalUntaggedCount: number;
  totalBookmarkCount: number;
}

/**
 * Automatically tag bookmarks using the configured LLM.
 * Generates prompt, calls LLM, parses response, and applies tags.
 */
export async function autoTagBookmarks(limit: number = 20): Promise<AutoTagResult> {
  if (!isLLMConfigured()) {
    throw new Error(
      'LLM is not configured for auto-tagging. Set LLM_ENABLED=true and configure LLM_API_BASE_URL, LLM_MODEL, and LLM_API_KEY in .env'
    );
  }

  const promptResult = await generateTaggingPrompt(limit);

  const llmResponse = await chatCompletion(
    [{ role: 'user', content: promptResult.prompt }],
    { temperature: 0.1 }
  );

  const parsed = parseTaggingResponse(llmResponse);
  const applyResult = await applyParsedTaggingResponse(parsed);

  logger.info('Auto-tagged bookmarks', {
    bookmarkCount: promptResult.bookmarkCount,
    processed: applyResult.processed,
    tagged: applyResult.tagged,
    errors: applyResult.errors.length,
  });

  return {
    processed: applyResult.processed,
    tagged: applyResult.tagged,
    errors: applyResult.errors.length > 0 ? applyResult.errors : undefined,
    details: applyResult.details,
    bookmarkCount: promptResult.bookmarkCount,
    totalUntaggedCount: promptResult.totalUntaggedCount,
    totalBookmarkCount: promptResult.totalBookmarkCount,
  };
}
