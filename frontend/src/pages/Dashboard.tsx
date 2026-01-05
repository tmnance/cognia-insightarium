import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, Tag, bookmarkApi } from '../services/api';
import BookmarkList from '../components/BookmarkList';
import AddBookmarkForm from '../components/AddBookmarkForm';

export default function Dashboard() {
  const navigate = useNavigate();
  const [allBookmarks, setAllBookmarks] = useState<Bookmark[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTags, setIsLoadingTags] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddBookmarkModalOpen, setIsAddBookmarkModalOpen] = useState(false);

  // Filtering and pagination state
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

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
      // Sort by newest first
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAllBookmarks(data);
      setCurrentPage(1); // Reset to first page when filters change
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

  // Filter bookmarks
  const filteredBookmarks = useMemo(() => {
    if (!searchQuery.trim()) {
      return allBookmarks;
    }

    const query = searchQuery.toLowerCase();
    return allBookmarks.filter((bookmark) => {
      const contentMatch = bookmark.content?.toLowerCase().includes(query);
      const urlMatch = bookmark.url?.toLowerCase().includes(query);
      const tagMatch = bookmark.tags?.some(
        (tag) =>
          tag.name.toLowerCase().includes(query) ||
          tag.description?.toLowerCase().includes(query)
      );
      return contentMatch || urlMatch || tagMatch;
    });
  }, [allBookmarks, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredBookmarks.length / itemsPerPage);
  const paginatedBookmarks = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredBookmarks.slice(startIndex, endIndex);
  }, [filteredBookmarks, currentPage, itemsPerPage]);

  const handleTagClick = (tag: Tag) => {
    setSelectedTags((prev) => {
      if (prev.includes(tag.slug)) {
        return prev.filter((slug) => slug !== tag.slug);
      } else {
        return [...prev, tag.slug];
      }
    });
  };

  const clearTagFilters = () => {
    setSelectedTags([]);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const hasActiveFilters = searchQuery.trim() || selectedTags.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <header className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Cognia Insightarium</h1>
            <p className="text-gray-600">Your personal library of insights</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setIsAddBookmarkModalOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
            >
              + Add Bookmark
            </button>
            <button
              onClick={() => navigate('/tagging')}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium shadow-sm"
            >
              🤖 LLM Tagging
            </button>
          </div>
        </header>

        {/* Search Bar */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search bookmarks by content, URL, or tags..."
              className="w-full px-4 py-2 pl-10 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchQuery ? (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            ) : (
              <svg
                className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            )}
          </div>
        </div>

        {/* Tags Filter */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-700">Filter by Tags</label>
            {selectedTags.length > 0 && (
              <button
                onClick={clearTagFilters}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Clear ({selectedTags.length})
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
                    className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                      isSelected ? 'ring-2 ring-offset-1' : ''
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
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Bookmarks List Header with Results Count */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Bookmarks</h2>
            <p className="text-sm text-gray-600 mt-1">
              {filteredBookmarks.length === 0
                ? 'No bookmarks found'
                : `Showing ${paginatedBookmarks.length} of ${filteredBookmarks.length} bookmark${filteredBookmarks.length !== 1 ? 's' : ''}`}
              {hasActiveFilters && (
                <button
                  onClick={() => {
                    clearSearch();
                    clearTagFilters();
                  }}
                  className="ml-2 text-blue-600 hover:text-blue-800 underline"
                >
                  Clear all filters
                </button>
              )}
            </p>
          </div>
        </div>

        {/* Pagination - Top */}
        {totalPages > 1 && (
          <div className="mb-6 flex items-center justify-center gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>

            <div className="flex gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                if (
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - 1 && page <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`px-4 py-2 border rounded-lg transition-colors ${
                        currentPage === page
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  );
                } else if (page === currentPage - 2 || page === currentPage + 2) {
                  return <span key={page} className="px-2 py-2">...</span>;
                }
                return null;
              })}
            </div>

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        )}

        {/* Bookmarks List */}
        <BookmarkList
          bookmarks={paginatedBookmarks}
          isLoading={isLoading}
          onTagClick={handleTagClick}
        />

        {/* Pagination - Bottom */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>

            <div className="flex gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                if (
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - 1 && page <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`px-4 py-2 border rounded-lg transition-colors ${
                        currentPage === page
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  );
                } else if (page === currentPage - 2 || page === currentPage + 2) {
                  return <span key={page} className="px-2 py-2">...</span>;
                }
                return null;
              })}
            </div>

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        )}

        {/* Add Bookmark Modal */}
        <AddBookmarkForm
          isOpen={isAddBookmarkModalOpen}
          onClose={() => setIsAddBookmarkModalOpen(false)}
          onBookmarkAdded={loadBookmarks}
        />
      </div>
    </div>
  );
}
