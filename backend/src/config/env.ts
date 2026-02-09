import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  // LLM Tagging (manual workflow - link to external LLM tool)
  llmBookmarkCategorizationUrl: process.env.LLM_BOOKMARK_CATEGORIZATION_URL || '',
  // Direct LLM API (OpenAI-compatible - for auto-tagging and future LLM tasks)
  llm: {
    enabled: process.env.LLM_ENABLED === 'true',
    apiBaseUrl: (process.env.LLM_API_BASE_URL || '').replace(/\/$/, ''),
    apiKey: process.env.LLM_API_KEY || '',
    model: process.env.LLM_MODEL || '',
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '4096', 10),
    temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.1'),
  },
};

/** SAVED_BOOKMARK_URL_* or SAVED_BOOKMARKS_URL_* → { label, url }[] (label from suffix, e.g. X, REDDIT) */
function getSavedBookmarkUrls(): Array<{ label: string; url: string }> {
  const prefix1 = 'SAVED_BOOKMARK_URL_';
  const prefix2 = 'SAVED_BOOKMARKS_URL_';
  const result: Array<{ label: string; url: string }> = [];
  for (const key of Object.keys(process.env)) {
    const prefix = key.startsWith(prefix1) ? prefix1 : key.startsWith(prefix2) ? prefix2 : null;
    if (!prefix) continue;
    const url = process.env[key]?.trim();
    if (!url) continue;
    const suffix = key.slice(prefix.length);
    const label = suffix
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
    result.push({ label, url });
  }
  return result.sort((a, b) => a.label.localeCompare(b.label));
}

export const savedBookmarkUrls = getSavedBookmarkUrls();

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}
