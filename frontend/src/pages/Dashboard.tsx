import { useEffect, useState } from 'react';
import { Bookmark, bookmarkApi } from '../services/api';
import BookmarkList from '../components/BookmarkList';
import AddBookmarkForm from '../components/AddBookmarkForm';
import XAuthButton from '../components/XAuthButton';

export default function Dashboard() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingX, setIsFetchingX] = useState(false);
  const [isFetchingLinkedIn, setIsFetchingLinkedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const loadBookmarks = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await bookmarkApi.getAll();
      setBookmarks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bookmarks');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBookmarks();
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const status = await bookmarkApi.oauth.getStatus();
      setIsAuthenticated(status.authenticated);
    } catch (error) {
      console.error('Error checking auth status', error);
    }
  };

  const handleFetchX = async () => {
    if (!isAuthenticated) {
      setError('Please login with X first to fetch bookmarks');
      bookmarkApi.oauth.login();
      return;
    }

    try {
      setIsFetchingX(true);
      setError(null);
      await bookmarkApi.fetchX();
      await loadBookmarks();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch X bookmarks';
      setError(errorMessage);
      
      // If authentication error, update auth status
      if (errorMessage.includes('authenticated') || errorMessage.includes('login')) {
        setIsAuthenticated(false);
      }
    } finally {
      setIsFetchingX(false);
    }
  };

  const handleFetchLinkedIn = async () => {
    try {
      setIsFetchingLinkedIn(true);
      setError(null);
      await bookmarkApi.fetchLinkedIn();
      await loadBookmarks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch LinkedIn saved posts');
    } finally {
      setIsFetchingLinkedIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <header className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Cognia Insightarium</h1>
            <p className="text-gray-600">Your personal library of insights</p>
          </div>
          <XAuthButton />
        </header>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Add Bookmark Form */}
        <AddBookmarkForm onBookmarkAdded={loadBookmarks} />

        {/* External Sources Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Fetch from External Sources</h2>
          
          {/* X Bookmarks Section */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                X (Twitter) Bookmarks
              </label>
              {!isAuthenticated && (
                <span className="text-xs text-gray-500">Login required</span>
              )}
            </div>
            <button
              onClick={handleFetchX}
              disabled={isFetchingX || !isAuthenticated}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isFetchingX ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  Fetching...
                </>
              ) : (
                'Fetch X Bookmarks'
              )}
            </button>
            {!isAuthenticated && (
              <p className="mt-2 text-xs text-gray-500 text-center">
                Please login with X using the button in the header to fetch bookmarks
              </p>
            )}
          </div>

          {/* LinkedIn Section */}
          <div>
            <button
              onClick={handleFetchLinkedIn}
              disabled={isFetchingLinkedIn}
              className="w-full bg-blue-700 text-white py-2 px-4 rounded-lg hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isFetchingLinkedIn ? 'Fetching...' : 'Fetch LinkedIn Saved Posts'}
            </button>
          </div>
        </div>

        {/* Bookmarks List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">All Bookmarks</h2>
            <span className="text-gray-600">{bookmarks.length} items</span>
          </div>
          <BookmarkList bookmarks={bookmarks} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}

