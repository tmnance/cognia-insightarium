import express, { Request, Response } from 'express';
import { getAuthorizationUrl, exchangeCodeForToken, getUserIdFromAccessToken } from '../services/xOAuth';
import { logger } from '../utils/logger';
import { config } from '../config/env';

const router = express.Router();

// Extend Express Session type
declare module 'express-session' {
  interface SessionData {
    xCodeVerifier?: string;
    xState?: string;
    xAccessToken?: string;
    xUserId?: string;
    xUsername?: string;
  }
}

/**
 * GET /api/oauth/x/authorize
 * Initiate OAuth 2.0 authorization flow - redirects to X
 */
router.get('/x/authorize', async (req: Request, res: Response) => {
  try {
    // Use backend URL for OAuth callback (X redirects here)
    const redirectUri = `${req.protocol}://${req.get('host')}/api/oauth/x/callback`;

    const { url, codeVerifier, state } = await getAuthorizationUrl(redirectUri);

    // Store codeVerifier and state in session
    req.session.xCodeVerifier = codeVerifier;
    req.session.xState = state;

    logger.info('Initiating OAuth flow', { state, redirectUri });
    
    // Redirect to X authorization
    res.redirect(url);
  } catch (error) {
    logger.error('Error generating authorization URL', error);
    res.status(500).send(`
      <html>
        <body>
          <h1>OAuth Error</h1>
          <p>${error instanceof Error ? error.message : 'Failed to generate authorization URL'}</p>
          <a href="/">Go back</a>
        </body>
      </html>
    `);
  }
});

/**
 * GET /api/oauth/x/callback
 * OAuth callback - handles the redirect from X after authorization
 */
router.get('/x/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query;

    // Check for OAuth errors
    if (error) {
      logger.error('OAuth authorization error', { error });
      return res.redirect(`${config.frontendUrl}/?oauth_error=${encodeURIComponent(String(error))}`);
    }

    // Validate state
    if (!state || state !== req.session.xState) {
      logger.error('OAuth state mismatch', { receivedState: state, sessionState: req.session.xState });
      return res.redirect(`${config.frontendUrl}/?oauth_error=state_mismatch`);
    }

    if (!code) {
      return res.redirect(`${config.frontendUrl}/?oauth_error=no_code`);
    }

    const codeVerifier = req.session.xCodeVerifier;
    if (!codeVerifier) {
      logger.error('No code verifier in session');
      return res.redirect(`${config.frontendUrl}/?oauth_error=no_verifier`);
    }

    const redirectUri = `${req.protocol}://${req.get('host')}/api/oauth/x/callback`;

    // Exchange code for tokens
    logger.info('Exchanging authorization code for tokens');
    const tokens = await exchangeCodeForToken(String(code), codeVerifier, redirectUri);

    // Get user info
    const userInfo = await getUserIdFromAccessToken(tokens.access_token);
    
    if (!userInfo) {
      logger.error('Failed to get user info from access token');
      return res.redirect(`${config.frontendUrl}/?oauth_error=no_user_id`);
    }

    // Store tokens and user info in session
    req.session.xAccessToken = tokens.access_token;
    req.session.xUserId = userInfo.id;
    req.session.xUsername = userInfo.username;
    
    // Clear temporary OAuth data
    delete req.session.xCodeVerifier;
    delete req.session.xState;

    logger.info('OAuth flow completed successfully', { userId: userInfo.id, username: userInfo.username });

    // Redirect to frontend with success
    res.redirect(`${config.frontendUrl}/?oauth_success=true`);
  } catch (error) {
    logger.error('Error in OAuth callback', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.redirect(`${config.frontendUrl}/?oauth_error=${encodeURIComponent(errorMessage)}`);
  }
});

/**
 * GET /api/oauth/x/status
 * Check OAuth authentication status
 */
router.get('/x/status', (req: Request, res: Response) => {
  const isAuthenticated = !!req.session.xAccessToken && !!req.session.xUserId;
  
  return res.json({
    success: true,
    authenticated: isAuthenticated,
    userId: req.session.xUserId || null,
    username: req.session.xUsername || null,
  });
});

/**
 * POST /api/oauth/x/logout
 * Logout and clear session
 */
router.post('/x/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      logger.error('Error destroying session', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to logout',
      });
    }

    return res.json({
      success: true,
      message: 'Logged out successfully',
    });
  });
});

export default router;
