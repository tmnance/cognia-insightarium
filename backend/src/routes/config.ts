import express, { Request, Response } from 'express';
import { savedBookmarkUrls } from '../config/env';

const router = express.Router();

/**
 * GET /api/config
 * Returns public config for the frontend (e.g. sync bookmark URLs).
 */
router.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    savedBookmarkUrls,
  });
});

export default router;
