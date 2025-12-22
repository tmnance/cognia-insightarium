# X API OAuth 2.0 Manual Setup Guide

> **Note**: This guide describes the manual OAuth 2.0 flow using curl commands. For most users, the **UI-based OAuth flow is recommended** - see [OAUTH_UI_SETUP.md](./OAUTH_UI_SETUP.md) instead.

This guide is useful for:
- Testing the OAuth flow manually
- Understanding how OAuth 2.0 works under the hood
- Advanced users who prefer command-line setup

Based on the [official X API samples](https://github.com/xdevplatform/samples/blob/main/javascript/users/bookmark/get_bookmarks.js), this guide explains how to set up OAuth 2.0 authentication manually for fetching X bookmarks.

## Why OAuth 2.0?

The X bookmarks endpoint requires **user authentication context**. Bearer Token authentication doesn't provide this, so you need OAuth 2.0 to:
- Access user-specific endpoints like bookmarks
- Get automatic user ID detection
- Properly authenticate on behalf of the user

## Prerequisites

1. **X Developer Account**: Sign up at https://developer.x.com
2. **App Created**: Create a Project and App in the X Developer Portal
3. **Credentials Obtained**:
   - Client ID (API Key) → Set as `X_API_KEY`
   - Client Secret (API Secret) → Set as `X_API_SECRET`
4. **Redirect URI Configured**: In your X app settings, add a callback URL (e.g., `http://localhost:3001/api/oauth/x/callback`)

## Setup Steps

### 1. Configure Environment Variables

Add to `backend/.env`:

```env
X_API_KEY=your_client_id_here
X_API_SECRET=your_client_secret_here
```

### 2. Start OAuth Flow

**Option A: Use the API endpoint**

```bash
# Get authorization URL
curl http://localhost:3001/api/oauth/x/authorize

# Response will include:
# - authorizationUrl: Visit this URL in your browser
# - codeVerifier: Save this for the callback step
# - state: Save this to verify the callback
```

**Option B: Manual Setup (like the sample code)**

1. Visit the authorization URL returned from the endpoint
2. Authorize the application
3. Copy the full callback URL (e.g., `http://localhost:3001/api/oauth/x/callback?code=...&state=...`)

### 3. Exchange Code for Access Token

```bash
curl -X POST http://localhost:3001/api/oauth/x/callback \
  -H "Content-Type: application/json" \
  -d '{
    "callbackUrl": "http://localhost:3001/api/oauth/x/callback?code=...&state=...",
    "codeVerifier": "your_code_verifier_from_step_2",
    "redirectUri": "http://localhost:3001/api/oauth/x/callback"
  }'
```

The response will include:
- `access_token`: Your OAuth 2.0 access token
- `userId`: Your X user ID
- Instructions on adding it to `.env`

### 4. Add Access Token to .env (Optional - Not Recommended)

**Note**: The UI-based OAuth flow stores tokens in the session automatically. You only need to add `X_ACCESS_TOKEN` to `.env` if you want to use it as a fallback or for testing.

Add the access token to `backend/.env`:

```env
X_ACCESS_TOKEN=your_access_token_here
```

### 5. Fetch Bookmarks

**With UI Flow (Recommended)**:
- Just click "Fetch X Bookmarks" in the UI after logging in

**With Manual Token**:
```bash
curl "http://localhost:3001/api/bookmarks/x?userId=YOUR_USER_ID"
```

The session-based OAuth flow (UI) is preferred because:
- Tokens are stored securely in server-side sessions
- No need to manage tokens manually
- Better security (tokens not in environment variables)
- Multi-user ready

## Recommended: Use UI-Based OAuth Flow

Instead of this manual process, we recommend using the built-in UI OAuth flow:

1. Set `X_API_KEY` and `X_API_SECRET` in `backend/.env`
2. Start the application: `npm run dev`
3. Click "Login with X" button in the UI
4. Authorize the app
5. Click "Fetch X Bookmarks"

This is much simpler and more secure. See [OAUTH_UI_SETUP.md](./OAUTH_UI_SETUP.md) for details.

## Important Notes

- **Access Token Expiration**: OAuth 2.0 access tokens can expire. If you get a 401 error, you'll need to re-authenticate.
- **Refresh Tokens**: If your OAuth flow provides refresh tokens, you can use them to get new access tokens without re-authenticating.
- **Scopes Required**: Ensure your app has these scopes:
  - `tweet.read`
  - `users.read`
  - `bookmark.read`
- **Redirect URI**: Must match exactly what's configured in your X app settings

## Troubleshooting

### 403 Forbidden
- Make sure you're using an OAuth 2.0 access token (X_ACCESS_TOKEN), not just a Bearer Token
- Verify your app has the correct scopes enabled
- Check that the redirect URI matches exactly

### 401 Unauthorized
- Your access token may have expired - re-authenticate
- Verify X_ACCESS_TOKEN is set correctly in `.env`

### Invalid redirect_uri
- The redirect URI in your callback request must match exactly what's configured in your X app
- Common format: `http://localhost:3001/api/oauth/x/callback`

## References

- [X API Bookmarks Documentation](https://developer.x.com/en/docs/x-api/tweets/bookmarks/introduction)
- [X API OAuth 2.0 Documentation](https://developer.x.com/en/docs/authentication/oauth-2-0)
- [Sample Code](https://github.com/xdevplatform/samples/blob/main/javascript/users/bookmark/get_bookmarks.js)


