import { useState, useEffect } from 'react';
import { bookmarkApi } from '../services/api';

interface AddBookmarkFormProps {
  isOpen: boolean;
  onClose: () => void;
  onBookmarkAdded: () => void;
}

export default function AddBookmarkForm({ isOpen, onClose, onBookmarkAdded }: AddBookmarkFormProps) {
  const [url, setUrl] = useState('');
  const [rawText, setRawText] = useState('');
  const [activeTab, setActiveTab] = useState<'url' | 'raw'>('url');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setUrl('');
      setRawText('');
      setError(null);
      setSuccess(null);
      setActiveTab('url');
    }
  }, [isOpen]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      await bookmarkApi.addUrl(url);
      setSuccess('URL added successfully!');
      setUrl('');
      onBookmarkAdded();
      // Close modal after a short delay to show success message
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add URL');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRawTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      await bookmarkApi.addRawText(rawText);
      setSuccess('Text added successfully!');
      setRawText('');
      onBookmarkAdded();
      // Close modal after a short delay to show success message
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add text');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">Add Bookmark</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <svg
                className="w-6 h-6"
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

          {/* Content */}
          <div className="p-6">
                  <div className="flex gap-2 mb-4 border-b border-gray-200">
        <button
          onClick={() => {
            setActiveTab('url');
            setError(null);
            setSuccess(null);
          }}
          className={`px-4 py-2 font-medium ${
            activeTab === 'url'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          URL
        </button>
        <button
          onClick={() => {
            setActiveTab('raw');
            setError(null);
            setSuccess(null);
          }}
          className={`px-4 py-2 font-medium ${
            activeTab === 'raw'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Raw Text / Markdown
            </button>
            </div>

                  {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
                {success}
              </div>
            )}

                  {activeTab === 'url' && (
              <form onSubmit={handleUrlSubmit}>
          <div className="mb-4">
            <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
              URL
            </label>
            <input
              type="url"
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/article"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              disabled={isSubmitting}
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
                {isSubmitting ? 'Adding...' : 'Add URL'}
              </button>
              </form>
            )}

            {/* Raw Text Form */}
            {activeTab === 'raw' && (
              <form onSubmit={handleRawTextSubmit}>
          <div className="mb-4">
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
              Content (Markdown supported)
            </label>
            <textarea
              id="content"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Enter your text or markdown content..."
              rows={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              required
              disabled={isSubmitting}
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
                {isSubmitting ? 'Adding...' : 'Add Text'}
              </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}


