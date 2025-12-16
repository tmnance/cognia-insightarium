import { Bookmark } from '../services/api';

interface BookmarkListProps {
  bookmarks: Bookmark[];
  isLoading?: boolean;
}

export default function BookmarkList({ bookmarks, isLoading }: BookmarkListProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
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
        <div
          key={bookmark.id}
          className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${getSourceBadgeColor(
                  bookmark.source
                )}`}
              >
                {bookmark.source.toUpperCase()}
              </span>
              <span className="text-sm text-gray-500">{formatDate(bookmark.createdAt)}</span>
            </div>
          </div>

          {bookmark.title && (
            <h3 className="text-xl font-semibold text-gray-900 mb-2">{bookmark.title}</h3>
          )}

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
              <p className="text-gray-700 text-sm line-clamp-3 whitespace-pre-wrap">
                {bookmark.content}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

