import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookmarkApi } from '../services/api';

interface SaveItem {
  platform: string;
  url: string;
  author?: string;
  text?: string;
  timestamp?: string;
}

interface PostMessageData {
  itemsToSave: SaveItem[];
}

/** Remove leading '@' from author string if present */
const normalizeAuthor = (author: string | undefined): string | undefined => {
  if (!author) return undefined;
  const normalized = author.replace(/^@+/, '').trim();
  return normalized || undefined;
};

export default function Save() {
  const navigate = useNavigate();
  const [items, setItems] = useState<SaveItem[]>([]);
  const [duplicateIndices, setDuplicateIndices] = useState<Set<number>>(new Set());
  const [changedIndices, setChangedIndices] = useState<Set<number>>(new Set());
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const messageHandlerRef = useRef<((event: MessageEvent) => void) | null>(null);

  const checkForDuplicates = async (itemsToCheck: SaveItem[]) => {
    if (itemsToCheck.length === 0) return;

    try {
      setIsCheckingDuplicates(true);
      const result = await bookmarkApi.checkDuplicates(itemsToCheck);
      setDuplicateIndices(new Set(result.duplicateIndices));
      setChangedIndices(new Set(result.changedIndices));

      if (result.duplicateIndices.length > 0 || result.changedIndices.length > 0) {
        console.log(`Found ${result.duplicateIndices.length} duplicate(s) and ${result.changedIndices.length} changed item(s)`, result);
      }
    } catch (err) {
      console.error('Error checking for duplicates:', err);
      // Don't show error to user, just log it - duplicate checking is not critical
    } finally {
      setIsCheckingDuplicates(false);
    }
  };

  useEffect(() => {
    // Set up postMessage listener
    const handleMessage = (event: MessageEvent<PostMessageData>) => {
      // Validate message structure
      if (!event.data || typeof event.data !== 'object') {
        return;
      }

      const data = event.data as PostMessageData;
      console.log('Received message:', data);

      try {
        // Parse the payload
        if (!data.itemsToSave || data.itemsToSave.length === 0) {
          setError('Received message but no itemsToSave found');
          return;
        }

        // Validate items have required fields
        const validItems = data.itemsToSave.filter((item: SaveItem) => item && (item.url || item.text));

        if (validItems.length === 0) {
          setError('No valid items found. Items must have at least a "url" or "text" field.');
          return;
        }

        setItems(validItems);
        setError(null);
        setDuplicateIndices(new Set()); // Reset duplicate indices
        setChangedIndices(new Set()); // Reset changed indices

        console.log('Received bookmarks:', validItems);

        // Check for duplicates after receiving items
        checkForDuplicates(validItems);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to parse data';
        setError(`Error parsing save data: ${errorMessage}. Make sure the payload contains valid JSON.`);
        console.error('Error parsing save data:', err);
        console.error('Message data:', event.data);
      }
    };

    // Store handler reference for cleanup
    messageHandlerRef.current = handleMessage;

    // Add event listener
    window.addEventListener('message', handleMessage);
    setIsReady(true);

    // Cleanup
    return () => {
      if (messageHandlerRef.current) {
        window.removeEventListener('message', messageHandlerRef.current);
      }
    };
  }, []);

  const handleSaveAll = async () => {
    // Save new items and changed items (exclude true duplicates)
    const itemsToSave = items
      .filter((_, index) => !duplicateIndices.has(index))
      .map((item) => ({
        ...item,
        author: normalizeAuthor(item.author),
      }));

    if (itemsToSave.length === 0) return;

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await bookmarkApi.bulkSave(itemsToSave);

      const newCount = items.length - duplicateIndices.size - changedIndices.size;
      const updatedCount = changedIndices.size;

      if (result.saved > 0) {
        setSuccessMessage(
          `Successfully saved ${newCount} new bookmark${newCount > 1 ? 's' : ''}${updatedCount > 0 ? ` and updated ${updatedCount} existing bookmark${updatedCount > 1 ? 's' : ''}` : ''}${result.failed > 0 ? ` (${result.failed} failed)` : ''}`
        );

        // Redirect to dashboard after a short delay
        setTimeout(() => {
          navigate('/');
        }, 2000);
      } else {
        setError(`Failed to save all items. ${result.failed} item(s) failed.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save bookmarks');
    } finally {
      setIsSaving(false);
    }
  };

  const newItemsCount = items.length - duplicateIndices.size - changedIndices.size;
  const changedItemsCount = changedIndices.size;
  const duplicateItemsCount = duplicateIndices.size;
  const itemsToSaveCount = newItemsCount + changedItemsCount;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Save Bookmarks</h1>
          <p className="text-gray-600">
            {isReady ? 'Ready to receive bookmarks via postMessage' : 'Initializing...'}
          </p>
        </header>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            <strong>Error:</strong> {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
            <strong>Success:</strong> {successMessage}
            <br />
            <span className="text-sm">Redirecting to dashboard...</span>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Items Received ({items.length})
              </h2>
              <div className="flex items-center gap-4 mt-1 text-sm">
                {newItemsCount > 0 && (
                  <span className="text-gray-600">
                    <span className="font-semibold text-green-600">{newItemsCount}</span> new
                  </span>
                )}
                {changedItemsCount > 0 && (
                  <span className="text-blue-600">
                    <span className="font-semibold">{changedItemsCount}</span> to update
                  </span>
                )}
                {duplicateItemsCount > 0 && (
                  <span className="text-amber-600">
                    <span className="font-semibold">{duplicateItemsCount}</span> duplicate{duplicateItemsCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
            {items.length > 0 && (
              <button
                onClick={handleSaveAll}
                disabled={isSaving || itemsToSaveCount === 0}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving
                  ? 'Saving...'
                  : itemsToSaveCount > 0
                  ? `Save ${newItemsCount > 0 ? `${newItemsCount} New${changedItemsCount > 0 ? ' + ' : ''}` : ''}${changedItemsCount > 0 ? `${changedItemsCount} Updated` : ''}`
                  : 'No Items to Save'}
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="space-y-6">
              <div className="text-center py-4">
                <p className="text-gray-500 mb-2">
                  {isReady
                    ? 'Waiting for bookmarks data via postMessage...'
                    : 'Initializing message listener...'}
                </p>
              </div>

              <div className="border-t pt-6">
                <p className="text-sm text-gray-400 mb-2">Expected message format:</p>
                <pre className="bg-gray-100 px-4 py-2 rounded text-xs text-left overflow-auto">
{`window.postMessage({
  itemsToSave: [{
    platform: "x", // "x", "reddit", "linkedin", etc
    url: "https://x.com/...",
    text: "...",
    author: "@username",
    timestamp: "2025-01-01T00:00:00.000Z"
  }]
}, "*");`}
                </pre>
                <p className="text-xs text-gray-500 mt-2">
                  Use <code>platform: "reddit"</code> for Reddit URLs.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {isCheckingDuplicates && (
                <div className="text-center py-2 text-sm text-gray-500">
                  Checking for duplicates and changes...
                </div>
              )}
              {items.map((item, index) => {
                const isDuplicate = duplicateIndices.has(index);
                const isChanged = changedIndices.has(index);
                return (
                  <div
                    key={index}
                    className={`border rounded-lg p-4 transition-colors ${
                      isDuplicate
                        ? 'border-amber-300 bg-amber-50 hover:bg-amber-100'
                        : isChanged
                        ? 'border-blue-300 bg-blue-50 hover:bg-blue-100'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                            {item.platform.toUpperCase()}
                          </span>
                          {isDuplicate && (
                            <span className="px-2 py-1 bg-amber-200 text-amber-800 text-xs font-semibold rounded flex items-center gap-1">
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
                                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                              </svg>
                              Duplicate
                            </span>
                          )}
                          {isChanged && (
                            <span className="px-2 py-1 bg-blue-200 text-blue-800 text-xs font-semibold rounded flex items-center gap-1">
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
                                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                              </svg>
                              Updated
                            </span>
                          )}
                          {item.author && (
                            <span className="text-sm text-gray-600">@{item.author}</span>
                          )}
                          {item.timestamp && (
                            <span className="text-xs text-gray-400">
                              {new Date(item.timestamp).toLocaleDateString()}
                            </span>
                          )}
                        </div>
        
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm break-all block mb-2"
                          >
                            {item.url}
                          </a>
                        )}
        
                        {item.text && (
                          <p className="text-gray-700 text-sm line-clamp-3">{item.text}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
