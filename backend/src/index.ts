import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { config } from './config/env';
import { logger } from './utils/logger';
import bookmarkRoutes from './routes/bookmarks';
import contentRoutes from './routes/content';
import oauthRoutes from './routes/oauth';

const app = express();

// CORS configuration - allow credentials for sessions
app.use(
  cors({
    origin: 'http://localhost:3000',
    credentials: true,
  })
);

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'cognia-insightarium-session-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: config.nodeEnv === 'production',
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: 'lax',
    },
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/oauth', oauthRoutes);

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${config.nodeEnv}`);
});

