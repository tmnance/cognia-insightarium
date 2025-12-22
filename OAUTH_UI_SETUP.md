# OAuth UI Setup - Complete Guide

The application now supports a complete OAuth 2.0 flow with a "Login with X" button, similar to "Login with Google/Facebook".

## How It Works

1. **User clicks "Login with X" button** in the header
2. **Redirects to X authorization page** - user logs in and authorizes
3. **X redirects back to backend callback** - `/api/oauth/x/callback`
4. **Backend exchanges code for access token** and stores it in session
5. **User is redirected to frontend** with success
6. **Bookmarks can be fetched automatically** using the session token

## Setup Steps

### 1. Configure X App Redirect URI

In your X Developer Portal app settings, add this callback URL:
```
http://localhost:3001/api/oauth/x/callback
```

For production, update to your production backend URL.

### 2. Environment Variables

Add to `backend/.env`:

```env
# X OAuth 2.0 Credentials (required)
X_API_KEY=your_client_id_here
X_API_SECRET=your_client_secret_here

# Optional: Session secret (change in production!)
SESSION_SECRET=your-random-secret-key-here

# Optional: Frontend URL (defaults to http://localhost:3000)
FRONTEND_URL=http://localhost:3000
```

### 3. Start the Application

```bash
npm run dev
```

## User Experience

### Login Flow

1. User visits the application at `http://localhost:3000`
2. Clicks the **"Login with X"** button in the header
3. Browser redirects to X authorization page
4. User authorizes the application
5. Browser redirects back to the application
6. User sees "Connected as [username]" in the header
7. **"Fetch X Bookmarks"** button becomes enabled

### Fetching Bookmarks

Once authenticated:
- Click **"Fetch X Bookmarks"** button
- Bookmarks are automatically fetched using the session token
- No need to enter user ID manually
- User ID is automatically detected from the OAuth token

### Logout

- Click **"Disconnect"** link next to the username
- Session is cleared
- User needs to login again to fetch bookmarks

## API Endpoints

### OAuth Endpoints

- `GET /api/oauth/x/authorize` - Initiates OAuth flow (redirects to X)
- `GET /api/oauth/x/callback` - OAuth callback (handles X redirect)
- `GET /api/oauth/x/status` - Check authentication status
- `POST /api/oauth/x/logout` - Logout and clear session

### Bookmarks Endpoint

- `GET /api/bookmarks/x` - Fetch bookmarks (uses session token automatically)

## Session Management

- Sessions are stored server-side using `express-session`
- Sessions use secure HTTP-only cookies
- Session expires after 30 days
- Tokens are stored in the session, not exposed to the client

## Security Notes

1. **Session Secret**: Change `SESSION_SECRET` in production to a strong random string
2. **HTTPS**: Use HTTPS in production for secure cookie transmission
3. **Cookie Settings**: Cookies are set with `httpOnly: true` and `sameSite: 'lax'`
4. **State Validation**: OAuth state parameter is validated to prevent CSRF attacks

## Troubleshooting

### "Not authenticated" error

- Make sure you've clicked "Login with X" and authorized the app
- Check that cookies are enabled in your browser
- Verify the session is active by checking `/api/oauth/x/status`

### OAuth callback errors

- Verify the redirect URI matches exactly in X app settings
- Check that `X_API_KEY` and `X_API_SECRET` are set correctly
- Review backend logs for detailed error messages

### 403 Forbidden / "Unsupported Authentication" error

- This error means the app is trying to use Bearer Token instead of OAuth 2.0 User Context
- **Solution**: Make sure you've completed the OAuth login flow (click "Login with X")
- The session token is automatically used when you're logged in
- If you see this error after logging in, check backend logs - the session token should be used automatically

### Session not persisting

- Check browser cookie settings
- Verify `withCredentials: true` is set in axios (already done)
- Ensure CORS is configured to allow credentials

## Production Deployment

For production:

1. Set `SESSION_SECRET` to a strong random string
2. Update `FRONTEND_URL` to your production frontend URL
3. Update redirect URI in X app to production backend URL
4. Use HTTPS for both frontend and backend
5. Configure secure cookie settings:
   - Set `secure: true` in session config (requires HTTPS)
   - Consider adjusting `sameSite` based on your domain setup

## Differences from Manual Setup

- **No manual user ID entry** - automatically detected from OAuth
- **No manual token management** - stored in session automatically
- **Better UX** - simple "Login with X" button
- **Session-based** - no need to set environment variables for tokens
- **Multi-user ready** - each user has their own session


