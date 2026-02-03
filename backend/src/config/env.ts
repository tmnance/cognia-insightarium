import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  // LinkedIn API credentials
  linkedInClientId: process.env.LINKEDIN_CLIENT_ID || '',
  linkedInClientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
  linkedInAccessToken: process.env.LINKEDIN_ACCESS_TOKEN || '',
  // LLM Tagging
  llmBookmarkCategorizationUrl: process.env.LLM_BOOKMARK_CATEGORIZATION_URL || '',
};

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}
