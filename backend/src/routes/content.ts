import express, { Request, Response } from 'express';
import { addRawText } from '../services/rawTextService';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * POST /api/content/raw
 * Add raw text or markdown content
 */
router.post('/raw', async (req: Request, res: Response) => {
  try {
    const { content, title } = req.body;

    if (!content || typeof content !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Content is required and must be a string',
      });
    }

    logger.info('Adding raw text content via API', { hasTitle: !!title });
    const bookmark = await addRawText({
      content,
      title: title || undefined,
    });

    return res.json({
      success: true,
      bookmark,
    });
  } catch (error) {
    logger.error('Error in POST /api/content/raw', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to add raw text content',
    });
  }
});

export default router;

