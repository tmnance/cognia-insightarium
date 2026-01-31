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
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
