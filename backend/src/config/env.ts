import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  // X (Twitter) API credentials
  xApiKey: process.env.X_API_KEY || '', // OAuth 2.0 Client ID
  xApiSecret: process.env.X_API_SECRET || '', // OAuth 2.0 Client Secret
  xBearerToken: process.env.X_BEARER_TOKEN || '', // Legacy Bearer Token (not recommended for bookmarks)
  xAccessToken: process.env.X_ACCESS_TOKEN || '', // OAuth 2.0 Access Token (preferred for bookmarks)
  // LinkedIn API credentials
  linkedInClientId: process.env.LINKEDIN_CLIENT_ID || '',
  linkedInClientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
  linkedInAccessToken: process.env.LINKEDIN_ACCESS_TOKEN || '',
};

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}

