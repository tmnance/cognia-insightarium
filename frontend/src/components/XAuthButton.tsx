import { useEffect, useState } from 'react';
import { bookmarkApi } from '../services/api';

interface AuthStatus {
  authenticated: boolean;
  userId: string | null;
  username: string | null;
}

export default function XAuthButton() {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuthStatus = async () => {
    try {
      setIsLoading(true);
      const status = await bookmarkApi.oauth.getStatus();
      setAuthStatus(status);
    } catch (error) {
      console.error('Error checking auth status', error);
      setAuthStatus({ authenticated: false, userId: null, username: null });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuthStatus();

    // Check for OAuth callback parameters
    const urlParams = new URLSearchParams(window.location.search);
    const oauthSuccess = urlParams.get('oauth_success');
    const oauthError = urlParams.get('oauth_error');

    if (oauthSuccess) {
      // Remove query params and refresh auth status
      window.history.replaceState({}, '', window.location.pathname);
      checkAuthStatus();
    } else if (oauthError) {
      // Show error message
      alert(`OAuth error: ${oauthError}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleLogin = () => {
    bookmarkApi.oauth.login();
  };

  const handleLogout = async () => {
    try {
      await bookmarkApi.oauth.logout();
      setAuthStatus({ authenticated: false, userId: null, username: null });
    } catch (error) {
      console.error('Error logging out', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
        <span className="text-sm text-gray-600">Checking authentication...</span>
      </div>
    );
  }

  if (authStatus?.authenticated) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500"></div>
          <span className="text-sm text-gray-700">
            Connected as {authStatus.username || `User ${authStatus.userId}`}
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-600 hover:text-gray-900 underline"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleLogin}
      className="inline-flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
    >
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
      Login with X
    </button>
  );
}


