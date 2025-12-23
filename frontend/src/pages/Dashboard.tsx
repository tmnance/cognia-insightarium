import { useEffect, useState } from 'react';
import { Bookmark, bookmarkApi } from '../services/api';
import BookmarkList from '../components/BookmarkList';
import AddBookmarkForm from '../components/AddBookmarkForm';

export default function Dashboard() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingLinkedIn, setIsFetchingLinkedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  }, []);

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
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Cognia Insightarium</h1>
          <p className="text-gray-600">Your personal library of insights</p>
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
          
          {/* LinkedIn Section */}
          <div>
            <button
              onClick={handleFetchLinkedIn}
              disabled={isFetchingLinkedIn}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

