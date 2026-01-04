import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, Tag, bookmarkApi } from '../services/api';
import BookmarkList from '../components/BookmarkList';
import AddBookmarkForm from '../components/AddBookmarkForm';

export default function Dashboard() {
  const navigate = useNavigate();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTags, setIsLoadingTags] = useState(true);
  const [isFetchingLinkedIn, setIsFetchingLinkedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTags = async () => {
    try {
      setIsLoadingTags(true);
      const data = await bookmarkApi.tags.getAll();
      setTags(data);
    } catch (err) {
      console.error('Failed to load tags', err);
    } finally {
      setIsLoadingTags(false);
    }
  };

  const loadBookmarks = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const tagSlugs = selectedTags.length > 0 ? selectedTags : undefined;
      const data = await bookmarkApi.getAll(undefined, tagSlugs);
      setBookmarks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bookmarks');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTags();
  }, []);

  useEffect(() => {
    loadBookmarks();
  }, [selectedTags]);

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

  const handleTagClick = (tag: Tag) => {
    setSelectedTags((prev) => {
      if (prev.includes(tag.slug)) {
        // Remove tag if already selected
        return prev.filter((slug) => slug !== tag.slug);
      } else {
        // Add tag if not selected
        return [...prev, tag.slug];
      }
    });
  };

  const clearTagFilters = () => {
    setSelectedTags([]);
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
          <button
            onClick={() => navigate('/tagging')}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
          >
            🤖 LLM Tagging
          </button>
        </header>

        {/* Tag Filter Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Filter by Tags</h2>
            {selectedTags.length > 0 && (
              <button
                onClick={clearTagFilters}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Clear filters ({selectedTags.length})
              </button>
            )}
          </div>
          
          {isLoadingTags ? (
            <div className="text-center py-4">
              <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            </div>
          ) : tags.length === 0 ? (
            <p className="text-gray-500 text-sm">No tags available yet</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const isSelected = selectedTags.includes(tag.slug);
                const tagStyle = tag.color
                  ? {
                      backgroundColor: isSelected ? tag.color : `${tag.color}20`,
                      color: isSelected ? '#ffffff' : tag.color,
                      borderColor: tag.color,
                    }
                  : {};
                
                return (
                  <button
                    key={tag.id}
                    onClick={() => handleTagClick(tag)}
                    className={`px-3 py-1 rounded-md text-sm font-medium border transition-colors ${
                      isSelected ? 'ring-2 ring-offset-2' : ''
                    } ${
                      tag.color && isSelected
                        ? ''
                        : tag.color
                        ? 'hover:opacity-80'
                        : isSelected
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                    }`}
                    style={tag.color ? tagStyle : {}}
                    title={`${tag.description || tag.name} (${tag.bookmarkCount || 0} bookmarks)`}
                  >
                    {tag.name}
                    {tag.bookmarkCount !== undefined && (
                      <span className="ml-1 opacity-75">({tag.bookmarkCount})</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

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
          <BookmarkList 
            bookmarks={bookmarks} 
            isLoading={isLoading} 
            onTagClick={handleTagClick}
          />
        </div>
      </div>
    </div>
  );
}

