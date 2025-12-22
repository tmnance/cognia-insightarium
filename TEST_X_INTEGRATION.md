# Testing X (Twitter) Integration

## Quick Test

### 1. Start the Development Servers

Make sure PostgreSQL is running (via Docker):
```bash
docker-compose up -d
```

Start the backend and frontend:
```bash
npm run dev
```

### 2. Test via Frontend (Recommended)

1. Open http://localhost:3000 in your browser
2. Click the **"Login with X"** button in the header
3. Authorize the application on X
4. Click the **"Fetch X Bookmarks"** button in the dashboard
5. Check the browser console for any errors
6. Check the backend logs for API responses

### 3. Test Authentication Status

Check if you're authenticated:
```bash
curl http://localhost:3001/api/oauth/x/status
```

Expected response:
```json
{
  "success": true,
  "authenticated": true,
  "userId": "1234567890",
  "username": "your_username"
}
```

### 4. Test via API (curl)

**Note**: You need to be authenticated first (via the UI or by having a valid session cookie).

```bash
# Test the X bookmarks endpoint (requires OAuth session)
curl -b cookies.txt -c cookies.txt http://localhost:3001/api/bookmarks/x
```

Or if you have a session cookie from the browser:
```bash
# Copy the session cookie from your browser's DevTools
curl -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" http://localhost:3001/api/bookmarks/x
```

### 5. Check the Response

A successful response should look like:
```json
{
  "success": true,
  "count": 5,
  "bookmarks": [
    {
      "id": "...",
      "source": "x",
      "externalId": "1234567890",
      "url": "https://twitter.com/i/web/status/1234567890",
      "title": "First 100 chars of tweet...",
      "content": "Full tweet text...",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

## Common Issues

### 401 Unauthorized / "Not authenticated"
- **Cause**: Not logged in with X, or session expired
- **Solution**: 
  - Click "Login with X" button in the UI
  - Check that cookies are enabled in your browser
  - Verify session is active: `GET /api/oauth/x/status`

### 403 Forbidden / "Unsupported Authentication"
- **Cause**: Using Bearer Token instead of OAuth 2.0 User Context
- **Solution**: 
  - Use the OAuth 2.0 login flow (click "Login with X")
  - The bookmarks endpoint requires OAuth 2.0 User Context, not Application-Only Bearer Token
  - Ensure `X_API_KEY` and `X_API_SECRET` are set in `backend/.env`

### 429 Rate Limit
- **Cause**: Too many API requests
- **Solution**: Wait a few minutes and try again

### Empty Response / No Bookmarks
- **Cause**: You don't have any bookmarks on X
- **Solution**: 
  - Make sure you have bookmarks saved on X
  - Check backend logs for detailed information

## Checking Backend Logs

The backend will log detailed information:
- Successful fetches will show: "Successfully fetched X X bookmarks"
- OAuth flow will show: "OAuth flow completed successfully"
- Errors will show detailed error messages with helpful troubleshooting info

## OAuth Setup

If you haven't set up OAuth yet:
1. See [OAUTH_UI_SETUP.md](./OAUTH_UI_SETUP.md) for detailed setup instructions
2. Ensure `X_API_KEY` and `X_API_SECRET` are set in `backend/.env`
3. Add callback URL `http://localhost:3001/api/oauth/x/callback` in your X app settings


