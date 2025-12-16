import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  nodeEnv: process.env.NODE_ENV || 'development',
  // X (Twitter) API credentials
  xApiKey: process.env.X_API_KEY || '',
  xApiSecret: process.env.X_API_SECRET || '',
  xBearerToken: process.env.X_BEARER_TOKEN || '',
  // LinkedIn API credentials
  linkedInClientId: process.env.LINKEDIN_CLIENT_ID || '',
  linkedInClientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
  linkedInAccessToken: process.env.LINKEDIN_ACCESS_TOKEN || '',
};

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}

