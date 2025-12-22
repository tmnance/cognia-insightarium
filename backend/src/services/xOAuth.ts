import axios from 'axios';
import crypto from 'crypto';
import { config } from '../config/env';
import { logger } from '../utils/logger';

/**
 * OAuth 2.0 helper functions for X API
 * Based on: https://github.com/xdevplatform/samples/blob/main/javascript/users/bookmark/get_bookmarks.js
 */

export interface OAuth2Config {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface OAuth2Tokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
}

/**
 * Generate a code verifier for PKCE (Proof Key for Code Exchange)
 */
export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Generate a code challenge from a code verifier for PKCE
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const hash = crypto.createHash('sha256').update(verifier).digest();
  return hash.toString('base64url');
}

/**
 * Get the OAuth 2.0 authorization URL
 * 
 * @param redirectUri - The redirect URI registered in your X app
 * @param state - Optional state parameter for security
 * @returns Authorization URL and code verifier (store the verifier for token exchange)
 */
export async function getAuthorizationUrl(
  redirectUri: string,
  state?: string
): Promise<{ url: string; codeVerifier: string; state: string }> {
  // Validate and trim client ID
  const clientId = config.xApiKey?.trim();
  if (!clientId) {
    logger.error('X_API_KEY is missing or empty', {
      hasValue: !!config.xApiKey,
      length: config.xApiKey?.length || 0,
    });
    throw new Error(
      'X_API_KEY (Client ID) is required for OAuth 2.0. ' +
      'Please set X_API_KEY in your backend/.env file. ' +
      'Find it in your X Developer Portal under "Keys and tokens" -> "Client ID and Client Secret"'
    );
  }

  // Log client ID (first 4 chars only for security)
  logger.info('Generating OAuth authorization URL', {
    clientIdPrefix: clientId.substring(0, 4) + '...',
    redirectUri,
  });

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const authState = state || crypto.randomBytes(16).toString('hex');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId, // Use trimmed value
    redirect_uri: redirectUri,
    scope: 'tweet.read users.read bookmark.read',
    state: authState,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  const url = `https://twitter.com/i/oauth2/authorize?${params.toString()}`;

  return {
    url,
    codeVerifier,
    state: authState,
  };
}

/**
 * Exchange authorization code for access token
 * 
 * @param code - Authorization code from the callback
 * @param codeVerifier - Code verifier used in authorization
 * @param redirectUri - The redirect URI registered in your X app
 * @returns Access token and refresh token
 */
export async function exchangeCodeForToken(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<OAuth2Tokens> {
  // Validate and trim credentials
  const clientId = config.xApiKey?.trim();
  const clientSecret = config.xApiSecret?.trim();

  if (!clientId || !clientSecret) {
    logger.error('X OAuth credentials missing', {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
    });
    throw new Error(
      'X_API_KEY and X_API_SECRET are required for OAuth 2.0 token exchange. ' +
      'Please check your backend/.env file. ' +
      'Find these in your X Developer Portal under "Keys and tokens" -> "Client ID and Client Secret"'
    );
  }

  try {
    logger.info('Exchanging authorization code for token', {
      clientIdPrefix: clientId.substring(0, 4) + '...',
      redirectUri,
    });

    const response = await axios.post<OAuth2Tokens>(
      'https://api.twitter.com/2/oauth2/token',
      new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: clientId, // Use trimmed value
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`, // Use trimmed values
        },
      }
    );

    logger.info('Successfully exchanged authorization code for access token');
    return response.data;
  } catch (error) {
    logger.error('Error exchanging code for token', error);
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const errorData = error.response?.data as { error?: string; error_description?: string } | undefined;

      // Provide helpful error messages for common issues
      if (errorData?.error === 'invalid_client') {
        logger.error('Invalid client credentials', {
          errorDescription: errorData.error_description,
          clientIdPrefix: clientId.substring(0, 4) + '...',
          hasClientSecret: !!clientSecret,
        });
        throw new Error(
          `Invalid Client ID or Client Secret. ` +
          `Error: ${errorData.error_description || 'invalid_client'}\n\n` +
          `Please verify:\n` +
          `1. X_API_KEY matches your "Client ID" from X Developer Portal\n` +
          `2. X_API_SECRET matches your "Client Secret" from X Developer Portal\n` +
          `3. No extra spaces or quotes in your .env file\n` +
          `4. You're using OAuth 2.0 credentials, not API Key/Secret (those are different)`
        );
      }

      throw new Error(
        `Failed to exchange code for token: ${status} - ${JSON.stringify(errorData)}`
      );
    }
    throw error;
  }
}

/**
 * Get the authenticated user's ID using OAuth 2.0 access token
 */
export async function getUserIdFromAccessToken(accessToken: string): Promise<{ id: string; username: string } | null> {
  try {
    const response = await axios.get<{ data: { id: string; username: string } }>(
      'https://api.twitter.com/2/users/me',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'CogniaInsightarium/1.0',
        },
      }
    );

    return response.data.data || null;
  } catch (error) {
    logger.debug('Unable to get user info from access token', error);
    return null;
  }
}

