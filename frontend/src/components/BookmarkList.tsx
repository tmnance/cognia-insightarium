import { useState, useRef, useEffect } from 'react';
import { Bookmark, Tag, bookmarkApi } from '../services/api';

interface BookmarkListProps {
  bookmarks: Bookmark[];
  isLoading?: boolean;
  onTagClick?: (tag: Tag) => void;
  onTagAdded?: (bookmarkId: string) => void;
  onTagRemoved?: (bookmarkId: string) => void;
  onBookmarkDeleted?: (bookmarkId: string) => void;
  allTags?: Tag[];
}

interface BookmarkItemProps {
  bookmark: Bookmark;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onTagClick?: (tag: Tag) => void;
  onTagAdded?: (bookmarkId: string) => void;
  onTagRemoved?: (bookmarkId: string) => void;
  onBookmarkDeleted?: (bookmarkId: string) => void;
  allTags?: Tag[];
  getSourceBadgeColor: (source: string) => string;
  getTagStyle: (tag: Tag) => React.CSSProperties;
  formatDate: (dateString: string) => string;
  getFullDate: (dateString: string) => string;
}

function BookmarkItem({
  bookmark,
  isExpanded,
  onToggleExpand,
  onTagClick,
  onTagAdded,
  onTagRemoved,
  onBookmarkDeleted,
  allTags = [],
  getSourceBadgeColor,
  getTagStyle,
  formatDate,
  getFullDate,
}: BookmarkItemProps) {
  const contentRef = useRef<HTMLParagraphElement>(null);
  const [showExpandButton, setShowExpandButton] = useState(false);
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [isRemovingTag, setIsRemovingTag] = useState<string | null>(null);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [tagFilterQuery, setTagFilterQuery] = useState('');
  const [selectedTagIndex, setSelectedTagIndex] = useState(0);
  const tagSelectorRef = useRef<HTMLDivElement>(null);
  const tagFilterInputRef = useRef<HTMLInputElement>(null);

  // Get available tags (tags not already on this bookmark)
  const availableTags = allTags.filter(
    (tag) => !bookmark.tags?.some((bt) => bt.id === tag.id)
  );

  // Get filtered tags based on query
  const getFilteredTags = () => {
    if (!tagFilterQuery.trim()) {
      return availableTags;
    }
    const query = tagFilterQuery.toLowerCase();
    return availableTags.filter(
      (tag) =>
        tag.name.toLowerCase().includes(query) ||
        tag.description?.toLowerCase().includes(query) ||
        tag.slug.toLowerCase().includes(query)
    );
  };

  const filteredTags = getFilteredTags();

  // Close tag selector when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagSelectorRef.current && !tagSelectorRef.current.contains(event.target as Node)) {
        setShowTagSelector(false);
        setTagFilterQuery('');
        setSelectedTagIndex(0);
      }
    };

    if (showTagSelector) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showTagSelector]);

  // Auto-focus input when dropdown opens
  useEffect(() => {
    if (showTagSelector && tagFilterInputRef.current) {
      tagFilterInputRef.current.focus();
    }
  }, [showTagSelector]);

  // Handle keyboard events for tag selector
  useEffect(() => {
    if (!showTagSelector) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle keyboard events if user is typing in the input (except navigation keys)
      if (event.target === tagFilterInputRef.current && event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Enter' && event.key !== 'Escape') {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        setShowTagSelector(false);
        setTagFilterQuery('');
        setSelectedTagIndex(0);
        return;
      }

      const filtered = getFilteredTags();

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedTagIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : prev));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedTagIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (filtered.length > 0 && selectedTagIndex < filtered.length) {
          handleAddTag(filtered[selectedTagIndex].id);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showTagSelector, tagFilterQuery, selectedTagIndex]);

  const handleRemoveTag = async (e: React.MouseEvent, tagId: string) => {
    e.stopPropagation();
    if (isRemovingTag) return;

    setIsRemovingTag(tagId);
    try {
      await bookmarkApi.bookmarkTags.remove(bookmark.id, tagId);
      onTagRemoved?.(bookmark.id);
    } catch (error) {
      console.error('Failed to remove tag:', error);
    } finally {
      setIsRemovingTag(null);
    }
  };

  const handleAddTag = async (tagId: string) => {
    if (isAddingTag) return;

    setIsAddingTag(true);
    try {
      await bookmarkApi.bookmarkTags.add(bookmark.id, tagId);
      setShowTagSelector(false);
      setTagFilterQuery('');
      setSelectedTagIndex(0);
      onTagAdded?.(bookmark.id);
    } catch (error) {
      console.error('Failed to add tag:', error);
    } finally {
      setIsAddingTag(false);
    }
  };

  const handleDelete = async () => {
    if (isDeleting || !onBookmarkDeleted) return;

    if (!confirm('Are you sure you want to delete this bookmark? It will be hidden from the dashboard but remain in the database.')) {
      return;
    }

    setIsDeleting(true);
    try {
      await bookmarkApi.delete(bookmark.id);
      onBookmarkDeleted(bookmark.id);
    } catch (error) {
      console.error('Failed to delete bookmark:', error);
      alert('Failed to delete bookmark. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Reset selected index when filter changes
  useEffect(() => {
    const currentFiltered = getFilteredTags();
    if (selectedTagIndex >= currentFiltered.length && currentFiltered.length > 0) {
      setSelectedTagIndex(Math.max(0, currentFiltered.length - 1));
    } else if (currentFiltered.length === 0) {
      setSelectedTagIndex(0);
    }
  }, [tagFilterQuery, availableTags.length]);

  const handleToggleTagSelector = () => {
    const newState = !showTagSelector;
    setShowTagSelector(newState);
    if (!newState) {
      setTagFilterQuery('');
      setSelectedTagIndex(0);
    }
  };

  useEffect(() => {
    if (contentRef.current && !isExpanded) {
      // Check if content is truncated by comparing scrollHeight to clientHeight
      const isTruncated =
        contentRef.current.scrollHeight > contentRef.current.clientHeight;
      setShowExpandButton(isTruncated);
    } else if (isExpanded) {
      // Always show "Show less" when expanded
      setShowExpandButton(true);
    }
  }, [isExpanded, bookmark.content]);

  const displayDate = bookmark.sourceCreatedAt || bookmark.createdAt;
  const displayDateLabel = bookmark.sourceCreatedAt ? 'Posted' : 'Added';

  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${getSourceBadgeColor(
              bookmark.source
            )}`}
          >
            {bookmark.source.toUpperCase()}
          </span>
          {bookmark.author && (
            <span className="text-sm text-gray-700 font-medium">
              @{bookmark.author}
            </span>
          )}
          <span className="text-xs text-gray-600 font-medium" title={getFullDate(displayDate)}>
            {displayDateLabel}: {formatDate(displayDate)}
          </span>
          {((bookmark.sourceCreatedAt && bookmark.createdAt) ||
            (bookmark.lastIngestedAt && bookmark.lastIngestedAt !== bookmark.createdAt)) && (
            <span
              className="text-xs text-gray-400"
              title={getFullDate(bookmark.lastIngestedAt ?? bookmark.createdAt)}
            >
              Synced {formatDate(bookmark.lastIngestedAt ?? bookmark.createdAt)}
            </span>
          )}
        </div>
        {onBookmarkDeleted && (
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="ml-auto text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Delete bookmark"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        )}
      </div>

      {bookmark.url && (
        <a
          href={bookmark.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 text-sm break-all mb-2 block"
        >
          {bookmark.url}
        </a>
      )}

      {bookmark.content && (
        <div className="mt-3">
          <p
            ref={contentRef}
            className={`text-gray-700 text-sm whitespace-pre-wrap ${
              isExpanded ? '' : 'line-clamp-3'
            }`}
          >
            {bookmark.content}
          </p>
          {showExpandButton && (
            <button
              onClick={onToggleExpand}
              className="mt-2 text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
            >
              {isExpanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2 items-center">
        {bookmark.tags && bookmark.tags.length > 0 && (
          <>
            {bookmark.tags.map((tag) => (
              <div
                key={tag.id}
                className="inline-flex items-center gap-1 rounded-md text-xs font-medium border"
                style={getTagStyle(tag)}
              >
                <button
                  onClick={() => onTagClick?.(tag)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-l-md transition-colors ${
                    onTagClick ? 'hover:opacity-80' : ''
                  }`}
                  title={tag.description || undefined}
                >
                  <span>{tag.name}</span>
                  {tag.autoTagged && (
                    <span title="Auto-tagged">
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                    </span>
                  )}
                </button>
                <button
                  onClick={(e) => handleRemoveTag(e, tag.id)}
                  disabled={isRemovingTag === tag.id}
                  className="px-1 py-1 rounded-r-md hover:bg-black/10 transition-colors disabled:opacity-50 border-l"
                  style={{ borderLeftColor: 'currentColor', opacity: 0.3 }}
                  title="Remove tag"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </>
        )}
        <div className="relative" ref={tagSelectorRef}>
          <button
            onClick={handleToggleTagSelector}
            disabled={isAddingTag}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
            title="Add tag"
          >
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span>Add tag</span>
          </button>
          {showTagSelector && (
            <div className="absolute z-10 mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-hidden min-w-[200px] flex flex-col">
              {/* Filter input */}
              <div className="p-2 border-b border-gray-200">
                <input
                  ref={tagFilterInputRef}
                  type="text"
                  value={tagFilterQuery}
                  onChange={(e) => {
                    setTagFilterQuery(e.target.value);
                    setSelectedTagIndex(0);
                  }}
                  placeholder="Filter tags..."
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => {
                    // Prevent form submission if this is inside a form
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (filteredTags.length > 0 && selectedTagIndex < filteredTags.length) {
                        handleAddTag(filteredTags[selectedTagIndex].id);
                      }
                    }
                  }}
                />
              </div>

              {/* Tag list */}
              <div className="overflow-y-auto max-h-48">
                {filteredTags.length > 0 ? (
                  <ul className="py-1">
                    {filteredTags.map((tag, index) => (
                      <li key={tag.id}>
                        <button
                          onClick={() => handleAddTag(tag.id)}
                          disabled={isAddingTag}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors disabled:opacity-50 flex items-center gap-2 ${
                            index === selectedTagIndex
                              ? 'bg-blue-50 text-blue-900'
                              : 'hover:bg-gray-100'
                          }`}
                          onMouseEnter={() => setSelectedTagIndex(index)}
                        >
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: tag.color || '#gray' }}
                          />
                          <span>{tag.name}</span>
                          {tag.description && (
                            <span className="text-xs text-gray-500 ml-auto truncate max-w-[150px]">
                              {tag.description}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="px-3 py-2 text-sm text-gray-500">
                    {availableTags.length === 0
                      ? 'No tags available to add'
                      : tagFilterQuery.trim()
                      ? `No tags match "${tagFilterQuery}"`
                      : 'No tags available to add'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BookmarkList({ bookmarks, isLoading, onTagClick, onTagAdded, onTagRemoved, onBookmarkDeleted, allTags }: BookmarkListProps) {
  const [expandedBookmarks, setExpandedBookmarks] = useState<Set<string>>(new Set());

  const toggleExpand = (bookmarkId: string) => {
    setExpandedBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(bookmarkId)) {
        next.delete(bookmarkId);
      } else {
        next.add(bookmarkId);
      }
      return next;
    });
  };
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();

    const toMidnight = (d: Date) => {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      return x.getTime();
    };
    const todayStart = toMidnight(now);
    const dateStart = toMidnight(date);
    const diffDays = Math.floor((todayStart - dateStart) / (1000 * 60 * 60 * 24));

    const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    if (diffDays === 0) {
      return `Today at ${timeStr}`;
    } else if (diffDays === 1) {
      return `Yesterday at ${timeStr}`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else if (diffDays < 365) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  const getFullDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getSourceBadgeColor = (source: string) => {
    switch (source) {
      case 'x':
        return 'bg-blue-100 text-blue-800';
      case 'linkedin':
        return 'bg-blue-600 text-white';
      case 'url':
        return 'bg-green-100 text-green-800';
      case 'raw':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTagStyle = (tag: Tag) => {
    if (tag.color) {
      return {
        backgroundColor: `${tag.color}20`,
        color: tag.color,
        borderColor: tag.color,
      };
    }
    return {};
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Loading bookmarks...</p>
      </div>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No bookmarks yet. Start adding some!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {bookmarks.map((bookmark) => (
        <BookmarkItem
          key={bookmark.id}
          bookmark={bookmark}
          isExpanded={expandedBookmarks.has(bookmark.id)}
          onToggleExpand={() => toggleExpand(bookmark.id)}
          onTagClick={onTagClick}
          onTagAdded={onTagAdded}
          onTagRemoved={onTagRemoved}
          onBookmarkDeleted={onBookmarkDeleted}
          allTags={allTags}
          getSourceBadgeColor={getSourceBadgeColor}
          getTagStyle={getTagStyle}
          formatDate={formatDate}
          getFullDate={getFullDate}
        />
      ))}
    </div>
  );
}
