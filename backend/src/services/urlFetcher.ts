import axios from 'axios';
import { logger } from '../utils/logger';

export interface FetchedUrlContent {
  url: string;
  title?: string;
  content?: string;
}

/**
 * Fetch content from a given URL
 * Extracts title and content from the HTML
 */
export async function fetchUrlContent(url: string): Promise<FetchedUrlContent> {
  try {
    logger.info('Fetching content from URL', { url });

    const response = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      maxRedirects: 5,
      timeout: 10000,
    });

    const html = response.data;
    const title = extractTitle(html);
    const content = extractContent(html);

    return {
      url,
      title: title || undefined,
      content: content || undefined,
    };
  } catch (error) {
    logger.error('Error fetching URL content', { url, error });
    throw new Error(`Failed to fetch URL: ${url}`);
  }
}

/**
 * Extract title from HTML
 */
function extractTitle(html: string): string | null {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    return titleMatch[1].trim();
  }

  // Try Open Graph title
  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  if (ogTitleMatch && ogTitleMatch[1]) {
    return ogTitleMatch[1].trim();
  }

  return null;
}

/**
 * Extract main content from HTML
 * Simple implementation - can be enhanced with libraries like cheerio or jsdom
 */
function extractContent(html: string): string | null {
  // Remove scripts and styles
  let cleaned = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Try to find main content area
  const mainMatch = cleaned.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch && mainMatch[1]) {
    return stripHtmlTags(mainMatch[1]).trim();
  }

  // Try article tag
  const articleMatch = cleaned.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch && articleMatch[1]) {
    return stripHtmlTags(articleMatch[1]).trim();
  }

  // Fallback: extract all text
  return stripHtmlTags(cleaned).trim();
}

/**
 * Strip HTML tags and decode entities
 */
function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}


