import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, Tag, bookmarkApi, configApi, SavedBookmarkUrl } from '../services/api';
import BookmarkList from '../components/BookmarkList';
import AddBookmarkForm from '../components/AddBookmarkForm';

type SortField = 'sourceCreatedAt' | 'createdAt' | 'lastIngestedAt' | null;
type SortDirection = 'asc' | 'desc';

export default function Dashboard() {
  const navigate = useNavigate();
  const [allBookmarks, setAllBookmarks] = useState<Bookmark[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showUntaggedOnly, setShowUntaggedOnly] = useState(false);
  const [pinnedBookmarkIds, setPinnedBookmarkIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTags, setIsLoadingTags] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddBookmarkModalOpen, setIsAddBookmarkModalOpen] = useState(false);
  const [savedBookmarkUrls, setSavedBookmarkUrls] = useState<SavedBookmarkUrl[]>([]);
  const [syncDropdownOpen, setSyncDropdownOpen] = useState(false);
  const syncDropdownRef = useRef<HTMLDivElement>(null);

  // Filtering, sorting, and pagination state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('sourceCreatedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
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
      setAllBookmarks(data);
      setCurrentPage(1); // Reset to first page when filters change
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bookmarks');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTagAdded = async (bookmarkId: string) => {
    try {
      // Fetch the updated tags for this bookmark
      const updatedTags = await bookmarkApi.bookmarkTags.getByBookmarkId(bookmarkId);

      // If untagged filter is active, pin this bookmark so it stays visible
      if (showUntaggedOnly) {
        setPinnedBookmarkIds((prev) => new Set(prev).add(bookmarkId));
      }

      // Update the bookmark in-place without reloading
      setAllBookmarks((prev) =>
        prev.map((bookmark) =>
          bookmark.id === bookmarkId
            ? { ...bookmark, tags: updatedTags }
            : bookmark
        )
      );
    } catch (error) {
      console.error('Failed to fetch updated tags:', error);
      // Fallback to full reload if in-place update fails
      loadBookmarks();
    }
  };

  const handleTagRemoved = async (bookmarkId: string) => {
    try {
      // Fetch the updated tags for this bookmark
      const updatedTags = await bookmarkApi.bookmarkTags.getByBookmarkId(bookmarkId);

      // If tag filters are active, pin this bookmark so it stays visible
      if (selectedTags.length > 0) {
        setPinnedBookmarkIds((prev) => new Set(prev).add(bookmarkId));
      }

      // Update the bookmark in-place without reloading
      setAllBookmarks((prev) =>
        prev.map((bookmark) =>
          bookmark.id === bookmarkId
            ? { ...bookmark, tags: updatedTags }
            : bookmark
        )
      );
    } catch (error) {
      console.error('Failed to fetch updated tags:', error);
      // Fallback to full reload if in-place update fails
      loadBookmarks();
    }
  };

  useEffect(() => {
    loadTags();
  }, []);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const { savedBookmarkUrls: urls } = await configApi.getConfig();
        setSavedBookmarkUrls(urls);
      } catch (err) {
        console.error('Failed to load config', err);
      }
    };
    loadConfig();
  }, []);

  useEffect(() => {
    // Clear pinned bookmarks when tag filters change
    setPinnedBookmarkIds(new Set());
    loadBookmarks();
  }, [selectedTags]);

  // Close sync dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (syncDropdownRef.current && !syncDropdownRef.current.contains(event.target as Node)) {
        setSyncDropdownOpen(false);
      }
    };
    if (syncDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [syncDropdownOpen]);

  // Filter and sort bookmarks
  const filteredAndSortedBookmarks = useMemo(() => {
    let filtered = [...allBookmarks];

    // Apply untagged filter (takes precedence over tag filters)
    // Include pinned bookmarks that were visible when tags were added
    if (showUntaggedOnly) {
      filtered = filtered.filter((bookmark) => 
        !bookmark.tags || bookmark.tags.length === 0 || pinnedBookmarkIds.has(bookmark.id)
      );
    } else if (selectedTags.length > 0) {
      // Apply tag filter - include bookmarks that match selected tags OR are pinned
      filtered = filtered.filter((bookmark) => {
        // If pinned, always include
        if (pinnedBookmarkIds.has(bookmark.id)) {
          return true;
        }
        // Otherwise, check if bookmark has any of the selected tags
        const bookmarkTagSlugs = bookmark.tags?.map((tag) => tag.slug) || [];
        return selectedTags.some((selectedSlug) => bookmarkTagSlugs.includes(selectedSlug));
      });
    }

    // Apply text search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((bookmark) => {
        const contentMatch = bookmark.content?.toLowerCase().includes(query);
        const urlMatch = bookmark.url?.toLowerCase().includes(query);
        const authorMatch = bookmark.author?.toLowerCase().includes(query);
        const tagMatch = bookmark.tags?.some(
          (tag) =>
            tag.name.toLowerCase().includes(query) ||
            tag.description?.toLowerCase().includes(query)
        );
        return contentMatch || urlMatch || authorMatch || tagMatch;
      });
    }

    // Apply sorting
    if (sortField) {
      filtered.sort((a, b) => {
        let aValue: number;
        let bValue: number;

        switch (sortField) {
          case 'sourceCreatedAt':
            aValue = a.sourceCreatedAt ? new Date(a.sourceCreatedAt).getTime() : 0;
            bValue = b.sourceCreatedAt ? new Date(b.sourceCreatedAt).getTime() : 0;
            break;
          case 'createdAt':
            aValue = new Date(a.createdAt).getTime();
            bValue = new Date(b.createdAt).getTime();
            break;
          case 'lastIngestedAt':
            aValue = a.lastIngestedAt ? new Date(a.lastIngestedAt).getTime() : 0;
            bValue = b.lastIngestedAt ? new Date(b.lastIngestedAt).getTime() : 0;
            break;
          default:
            return 0;
        }

        // Handle null/zero values - push to end
        if (aValue === 0 && bValue === 0) return 0;
        if (aValue === 0) return 1;
        if (bValue === 0) return -1;

        const comparison = aValue - bValue;
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  }, [allBookmarks, searchQuery, sortField, sortDirection, showUntaggedOnly, pinnedBookmarkIds]);

  // Calculate untagged count
  const untaggedCount = useMemo(() => {
    return allBookmarks.filter((bookmark) => !bookmark.tags || bookmark.tags.length === 0).length;
  }, [allBookmarks]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedBookmarks.length / itemsPerPage);
  const paginatedBookmarks = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredAndSortedBookmarks.slice(startIndex, endIndex);
  }, [filteredAndSortedBookmarks, currentPage, itemsPerPage]);

  const handleTagClick = (tag: Tag) => {
    // If clicking a tag, disable untagged filter
    if (showUntaggedOnly) {
      setShowUntaggedOnly(false);
    }
    setSelectedTags((prev) => {
      if (prev.includes(tag.slug)) {
        return prev.filter((slug) => slug !== tag.slug);
      } else {
        return [...prev, tag.slug];
      }
    });
  };

  const handleUntaggedToggle = () => {
    const newValue = !showUntaggedOnly;
    setShowUntaggedOnly(newValue);
    // If enabling untagged filter, clear tag selections
    if (newValue) {
      setSelectedTags([]);
    }
    setPinnedBookmarkIds(new Set());
    setCurrentPage(1);
  };

  const clearTagFilters = () => {
    setSelectedTags([]);
    setShowUntaggedOnly(false);
    setPinnedBookmarkIds(new Set());
  };

  const clearSearch = () => {
    setSearchQuery('');
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to desc
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  const hasActiveFilters = searchQuery.trim() || selectedTags.length > 0 || showUntaggedOnly;

  const SortButton = ({ field, label }: { field: SortField; label: string }) => {
    const isActive = sortField === field;
    return (
      <button
        onClick={() => handleSort(field)}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
          isActive
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        <span>{label}</span>
        {isActive && (
          <svg
            className={`w-4 h-4 ${sortDirection === 'desc' ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 15l7-7 7 7"
            />
          </svg>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <header className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Cognia Insightarium</h1>
            <p className="text-gray-600">Your personal library of insights</p>
          </div>
          <div className="flex gap-3 items-center flex-wrap">
            <button
              onClick={() => setIsAddBookmarkModalOpen(true)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium shadow-sm"
            >
              + Add Bookmark
            </button>
            {savedBookmarkUrls.length > 0 && (
              <div className="relative" ref={syncDropdownRef}>
                <button
                  type="button"
                  onClick={() => setSyncDropdownOpen((open) => !open)}
                  className="py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors font-medium shadow-sm flex items-stretch overflow-hidden"
                >
                  <span className="pl-4 pr-3 flex items-center">Sync Bookmarks</span>
                  <span className="flex items-center border-l border-sky-500/50 px-3">
                    <svg
                      className={`w-4 h-4 transition-transform ${syncDropdownOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </button>
                {syncDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1 py-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[180px]">
                    {savedBookmarkUrls.map(({ label, url }) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        {label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => navigate('/tags')}
              className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors font-medium shadow-sm"
            >
              Manage Tags
            </button>
            <button
              onClick={() => navigate('/tagging')}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium shadow-sm"
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
              placeholder="Search bookmarks by content, URL, author, or tags..."
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
            {(selectedTags.length > 0 || showUntaggedOnly) && (
              <button
                onClick={clearTagFilters}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Clear ({selectedTags.length + (showUntaggedOnly ? 1 : 0)})
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
            <div className="flex flex-wrap items-center gap-2">
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
                      showUntaggedOnly ? 'opacity-50' : ''
                    } ${
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
              {tags.length > 0 && (
                <div className="h-6 w-px bg-gray-300"></div>
              )}
              {/* Untagged Filter Button */}
              <button
                onClick={handleUntaggedToggle}
                className={`px-3 py-1.5 rounded-md text-sm font-semibold border-2 transition-all ${
                  showUntaggedOnly ? 'ring-2 ring-offset-1 ring-gray-400' : ''
                } ${
                  showUntaggedOnly
                    ? 'bg-gray-700 text-white border-gray-700 shadow-md shadow-gray-500/30'
                    : 'bg-gray-50 text-gray-600 border-gray-400 hover:bg-gray-100 hover:border-gray-500'
                }`}
                title={`Show only bookmarks with no tags (${untaggedCount} bookmarks)`}
              >
                Untagged
                <span className="ml-1 opacity-75">({untaggedCount})</span>
              </button>
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Bookmarks List Header with Sort Buttons */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Bookmarks</h2>
            <p className="text-sm text-gray-600 mt-1">
              {filteredAndSortedBookmarks.length === 0
                ? 'No bookmarks found'
                : `Showing ${paginatedBookmarks.length} of ${filteredAndSortedBookmarks.length} bookmark${filteredAndSortedBookmarks.length !== 1 ? 's' : ''}`}
              {hasActiveFilters && (
                <button
                  onClick={() => {
                    clearSearch();
                    clearTagFilters();
                    setShowUntaggedOnly(false);
                  }}
                  className="ml-2 text-blue-600 hover:text-blue-800 underline"
                >
                  Clear all filters
                </button>
              )}
            </p>
          </div>

          {/* Sort Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-600 font-medium">Sort by:</span>
            <SortButton field="sourceCreatedAt" label="Posted" />
            <SortButton field="createdAt" label="Added" />
            <SortButton field="lastIngestedAt" label="Updated" />
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
          onTagAdded={handleTagAdded}
          onTagRemoved={handleTagRemoved}
          allTags={tags}
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
