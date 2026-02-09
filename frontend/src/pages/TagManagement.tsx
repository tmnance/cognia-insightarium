import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tag, bookmarkApi } from '../services/api';

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Parse hex color with or without #; 3-digit (e.g. ccc) becomes 6-digit (#cccccc). Returns #rrggbb or ''. */
function normalizeHex(str: string): string {
  const s = str.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(s)) {
    return '#' + s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  }
  if (/^[0-9a-fA-F]{6}$/.test(s)) {
    return '#' + s.toLowerCase();
  }
  return '';
}

/** Ensure color has a leading # for display (e.g. in title). */
function toHexWithHash(color: string | null | undefined): string | undefined {
  if (!color?.trim()) return undefined;
  const c = color.trim();
  return c.startsWith('#') ? c : `#${c}`;
}

export default function TagManagement() {
  const navigate = useNavigate();
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Edit state
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editColor, setEditColor] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete state
  const [deletingTag, setDeletingTag] = useState<Tag | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Copy tag assignment state
  const [copyFromTag, setCopyFromTag] = useState<Tag | null>(null);
  const [copyToId, setCopyToId] = useState('');
  const [isCopying, setIsCopying] = useState(false);

  const loadTags = async () => {
    try {
      setIsLoading(true);
      const data = await bookmarkApi.tags.getAll();
      setTags(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tags');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTags();
  }, []);

  useEffect(() => {
    if (name.trim()) {
      setSlug(slugFromName(name));
    }
  }, [name]);

  useEffect(() => {
    if (editingTag) {
      setEditName(editingTag.name);
      setEditSlug(editingTag.slug);
      setEditDescription(editingTag.description || '');
      setEditColor(editingTag.color || '');
    }
  }, [editingTag]);

  useEffect(() => {
    if (copyFromTag) {
      setCopyToId('');
    }
  }, [copyFromTag]);

  const startEdit = (tag: Tag) => {
    setEditingTag(tag);
    setError(null);
    setSuccess(null);
  };

  const cancelEdit = () => {
    setEditingTag(null);
    setEditName('');
    setEditSlug('');
    setEditDescription('');
    setEditColor('');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTag) return;

    setError(null);
    setSuccess(null);

    const trimmedName = editName.trim();
    const trimmedSlug = editSlug.trim().toLowerCase();

    if (!trimmedName) {
      setError('Name is required');
      return;
    }
    if (!trimmedSlug) {
      setError('Slug is required (use lowercase letters, numbers, and hyphens)');
      return;
    }
    if (!/^[a-z0-9-]+$/.test(trimmedSlug)) {
      setError('Slug must contain only lowercase letters, numbers, and hyphens');
      return;
    }

    try {
      setIsUpdating(true);
      await bookmarkApi.tags.update(editingTag.id, {
        name: trimmedName,
        slug: trimmedSlug,
        description: editDescription.trim() || null,
        color: normalizeHex(editColor) || null,
      });
      setSuccess('Tag updated successfully');
      setEditingTag(null);
      loadTags();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tag');
    } finally {
      setIsUpdating(false);
    }
  };

  const startDelete = (tag: Tag) => {
    setDeletingTag(tag);
    setError(null);
    setSuccess(null);
  };

  const cancelDelete = () => {
    setDeletingTag(null);
  };

  const handleDelete = async () => {
    if (!deletingTag) return;

    try {
      setIsDeleting(true);
      const result = await bookmarkApi.tags.delete(deletingTag.id);
      setSuccess(`Tag deleted successfully. Removed from ${result.bookmarkCount} bookmark${result.bookmarkCount !== 1 ? 's' : ''}.`);
      setDeletingTag(null);
      loadTags();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete tag');
    } finally {
      setIsDeleting(false);
    }
  };

  const startCopyAssignment = (tag: Tag) => {
    setCopyFromTag(tag);
    setCopyToId('');
    setError(null);
    setSuccess(null);
  };

  const cancelCopyAssignment = () => {
    setCopyFromTag(null);
    setCopyToId('');
  };

  const handleCopyAssignment = async () => {
    if (!copyFromTag || !copyToId) return;

    try {
      setIsCopying(true);
      const result = await bookmarkApi.tags.copyAssignment(copyFromTag.id, copyToId);
      setSuccess(
        `Added From tag "${copyFromTag.name}" to ${result.bookmarksUpdated} bookmark${result.bookmarksUpdated !== 1 ? 's' : ''}.`
      );
      setCopyFromTag(null);
      setCopyToId('');
      loadTags();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to copy tag assignment');
    } finally {
      setIsCopying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedName = name.trim();
    const trimmedSlug = slug.trim().toLowerCase();

    if (!trimmedName) {
      setError('Name is required');
      return;
    }
    if (!trimmedSlug) {
      setError('Slug is required (use lowercase letters, numbers, and hyphens)');
      return;
    }
    if (!/^[a-z0-9-]+$/.test(trimmedSlug)) {
      setError('Slug must contain only lowercase letters, numbers, and hyphens');
      return;
    }

    try {
      setIsCreating(true);
      await bookmarkApi.tags.create({
        name: trimmedName,
        slug: trimmedSlug,
        description: description.trim() || null,
        color: normalizeHex(color) || null,
      });
      setSuccess('Tag created successfully');
      setName('');
      setSlug('');
      setDescription('');
      setColor('');
      loadTags();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tag');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <header className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Tag Management</h1>
              <p className="text-gray-600">Create and view tags for organizing bookmarks</p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              ← Back to Dashboard
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
            {success}
          </div>
        )}

        {/* Create tag form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Tag</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Health & Fitness"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                maxLength={100}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="e.g. health-fitness"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                maxLength={100}
              />
              <p className="mt-1 text-xs text-gray-500">
                Lowercase letters, numbers, and hyphens only. Auto-generated from name if left blank.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description for this tag"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                maxLength={500}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Color (optional)
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#3b82f6"
                  className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                />
                <input
                  type="color"
                  value={normalizeHex(color) || '#000000'}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-10 h-10 cursor-pointer rounded border border-gray-300 p-0 flex-shrink-0"
                  title="Pick color"
                  aria-label="Pick color"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Hex code with or without #, e.g. #3b82f6, ccc, or #f00
              </p>
            </div>
            <button
              type="submit"
              disabled={isCreating || !name.trim() || !slug.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isCreating ? 'Creating...' : 'Create Tag'}
            </button>
          </form>
        </div>

        {/* Existing tags list */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-xl font-bold text-gray-900">All Tags</h2>
            <button
              type="button"
              onClick={async () => {
                const json = JSON.stringify(
                  tags.map((t) => ({
                    name: t.name,
                    slug: t.slug,
                    description: t.description ?? null,
                    color: toHexWithHash(t.color) ?? null,
                  })),
                  null,
                  2
                );
                await navigator.clipboard.writeText(json);
                setCopyFeedback(true);
                setTimeout(() => setCopyFeedback(false), 2000);
              }}
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              {copyFeedback ? 'Copied!' : 'Copy Json'}
            </button>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : tags.length === 0 ? (
            <p className="text-gray-500">No tags yet. Create one above.</p>
          ) : (
            <ul className="space-y-2">
              {tags.map((tag) => (
                <li
                  key={tag.id}
                  className="flex items-center gap-3 py-2 px-3 rounded-lg bg-gray-50 border border-gray-100"
                >
                  {editingTag?.id === tag.id ? (
                    <form onSubmit={handleUpdate} className="flex-1 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            maxLength={100}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Slug</label>
                          <input
                            type="text"
                            value={editSlug}
                            onChange={(e) => setEditSlug(e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                            maxLength={100}
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                        <input
                          type="text"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          maxLength={500}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Color</label>
                        <div className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={editColor}
                            onChange={(e) => setEditColor(e.target.value)}
                            placeholder="#3b82f6"
                            className="w-24 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                          />
                          <input
                            type="color"
                            value={normalizeHex(editColor) || '#000000'}
                            onChange={(e) => setEditColor(e.target.value)}
                            className="w-8 h-8 cursor-pointer rounded border border-gray-300 p-0 flex-shrink-0"
                            title="Pick color"
                            aria-label="Pick color"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={isUpdating}
                          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isUpdating ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={isUpdating}
                          className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      {tag.color && (
                        <span
                          className="w-4 h-4 rounded flex-shrink-0"
                          style={{ backgroundColor: tag.color }}
                          title={toHexWithHash(tag.color)}
                          aria-hidden
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-gray-900">{tag.name}</span>
                        <span className="text-gray-500 text-sm ml-2 font-mono">{tag.slug}</span>
                        {tag.description && (
                          <p className="text-sm text-gray-600 mt-0.5 truncate">{tag.description}</p>
                        )}
                      </div>
                      {tag.bookmarkCount !== undefined && (
                        <span className="text-sm text-gray-500 flex-shrink-0">
                          {tag.bookmarkCount} bookmark{tag.bookmarkCount !== 1 ? 's' : ''}
                        </span>
                      )}
                      <div className="flex gap-1 flex-shrink-0 items-center">
                        <button
                          onClick={() => startCopyAssignment(tag)}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Copy tag assignment"
                          aria-label="Copy tag assignment"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => startEdit(tag)}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit tag"
                          aria-label="Edit tag"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => startDelete(tag)}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete tag"
                          aria-label="Delete tag"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Delete confirmation modal */}
        {deletingTag && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Tag</h3>
              <p className="text-gray-700 mb-4">
                Are you sure you want to delete <strong>{deletingTag.name}</strong>?
              </p>
              {deletingTag.bookmarkCount !== undefined && deletingTag.bookmarkCount > 0 && (
                <p className="text-red-600 font-medium mb-4">
                  This will remove the tag from <strong>{deletingTag.bookmarkCount}</strong> bookmark{deletingTag.bookmarkCount !== 1 ? 's' : ''}.
                </p>
              )}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={cancelDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Copy tag assignment modal */}
        {copyFromTag && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Copy tag assignment</h3>
              <div className="space-y-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Add the <strong>{copyFromTag.name}</strong> tag to bookmarks with tag:</label>
                  <select
                    value={copyToId}
                    onChange={(e) => setCopyToId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="">Select a tag...</option>
                    {tags
                      .filter((t) => t.id !== copyFromTag.id)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.slug})
                          {t.bookmarkCount !== undefined ? ` — ${t.bookmarkCount} bookmarks` : ''}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              {copyToId && (() => {
                const toTag = tags.find((t) => t.id === copyToId);
                return toTag?.bookmarkCount !== undefined && toTag.bookmarkCount > 0 ? (
                  <p className="text-sm text-gray-700 mb-4">
                    This will add the <strong>{copyFromTag.name}</strong> tag to <strong>{toTag.bookmarkCount}</strong> bookmark{toTag.bookmarkCount !== 1 ? 's' : ''}.
                  </p>
                ) : null;
              })()}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={cancelCopyAssignment}
                  disabled={isCopying}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCopyAssignment}
                  disabled={isCopying || !copyToId}
                  className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isCopying ? 'Adding...' : 'Add From tag to bookmarks'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
