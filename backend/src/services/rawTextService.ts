import { logger } from '../utils/logger';
import { createBookmarkIfNotExists } from '../utils/deduplication';

export interface RawTextInput {
  content: string;
  title?: string;
}

/**
 * Add raw text or markdown content as a bookmark
 */
export async function addRawText(input: RawTextInput) {
  try {
    logger.info('Adding raw text bookmark', { hasTitle: !!input.title });

    const bookmark = await createBookmarkIfNotExists({
      source: 'raw',
      externalId: null, // Raw text doesn't have an external ID
      url: null,
      title: input.title || undefined,
      content: input.content,
    });

    return bookmark;
  } catch (error) {
    logger.error('Error adding raw text', error);
    throw error;
  }
}


