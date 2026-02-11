import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookmarkApi, type TaggingResultDetail } from '../services/api';

const SCROLL_DELAY_AFTER_COPY_MS = 600;
const PROMPT_COPIED_DURATION_MS = 2000;

export interface TaggingResultView {
  processed: number;
  tagged: number;
  errors?: Array<{ bookmarkId: string; error: string }>;
  details: TaggingResultDetail[];
  totalUntaggedCount: number;
  totalBookmarkCount: number;
}

export default function Tagging() {
  const navigate = useNavigate();
  const promptSectionRef = useRef<HTMLDivElement>(null);
  const pasteResponseSectionRef = useRef<HTMLDivElement>(null);
  const scrollToPromptAfterGenerateRef = useRef(false);

  const [prompt, setPrompt] = useState<string>('');
  const [bookmarkCount, setBookmarkCount] = useState<number>(0);
  const [totalUntaggedCount, setTotalUntaggedCount] = useState<number>(0);
  const [totalBookmarkCount, setTotalBookmarkCount] = useState<number>(0);
  const [llmBookmarkCategorizationUrl, setLlmBookmarkCategorizationUrl] = useState<string>('');
  const [llmEnabled, setLlmEnabled] = useState<boolean>(false);
  const [llmResponse, setLlmResponse] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isAutoTagging, setIsAutoTagging] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [limit, setLimit] = useState<number>(20);
  const [promptJustCopied, setPromptJustCopied] = useState(false);
  const [taggingResult, setTaggingResult] = useState<TaggingResultView | null>(null);
  const [allTags, setAllTags] = useState<Array<{ slug: string; color?: string | null }>>([]);

  // Load stats on component mount
  useEffect(() => {
    const loadStats = async () => {
      try {
        setIsLoadingStats(true);
        const stats = await bookmarkApi.tagging.getStats();
        setTotalUntaggedCount(stats.totalUntaggedCount);
        setTotalBookmarkCount(stats.totalBookmarkCount);
        setLlmBookmarkCategorizationUrl(stats.llmBookmarkCategorizationUrl);
        setLlmEnabled(stats.llmEnabled);
      } catch (err) {
        console.error('Failed to load tagging stats:', err);
        // Don't show error to user for stats loading failure
      } finally {
        setIsLoadingStats(false);
      }
    };

    loadStats();
  }, []);

  // After prompt is updated in the DOM (e.g. after Generate Prompt), scroll to it smoothly
  useEffect(() => {
    if (prompt && scrollToPromptAfterGenerateRef.current) {
      scrollToPromptAfterGenerateRef.current = false;
      // scroll just above promptSectionRef.current
      window.scrollTo({ top: (promptSectionRef.current?.offsetTop ?? 0) - 100, behavior: 'smooth' });
      // promptSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [prompt]);

  const handleGeneratePrompt = async () => {
    try {
      setIsGenerating(true);
      setError(null);
      setSuccess(null);
      setLlmResponse('');

      const result = await bookmarkApi.tagging.generatePrompt(limit);

      // Update stats from result
      setTotalUntaggedCount(result.totalUntaggedCount);
      setTotalBookmarkCount(result.totalBookmarkCount);

      // Check if there are bookmarks to tag
      if (result.bookmarkCount === 0) {
        setError('No untagged bookmarks found to process. All bookmarks have been reviewed.');
        setPrompt('');
        setBookmarkCount(0);
        return;
      }

      scrollToPromptAfterGenerateRef.current = true;
      setPrompt(result.prompt);
      setBookmarkCount(result.bookmarkCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate prompt');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAutoTag = async () => {
    try {
      setIsAutoTagging(true);
      setError(null);
      setSuccess(null);
      setTaggingResult(null);

      const result = await bookmarkApi.tagging.autoTag(limit);

      let stats = { totalUntaggedCount: 0, totalBookmarkCount: 0 };
      try {
        const s = await bookmarkApi.tagging.getStats();
        stats = { totalUntaggedCount: s.totalUntaggedCount, totalBookmarkCount: s.totalBookmarkCount };
        setTotalUntaggedCount(s.totalUntaggedCount);
        setTotalBookmarkCount(s.totalBookmarkCount);
        setLlmBookmarkCategorizationUrl(s.llmBookmarkCategorizationUrl);
        setLlmEnabled(s.llmEnabled);
      } catch (err) {
        console.error('Failed to refresh stats:', err);
      }

      setTaggingResult({
        processed: result.processed,
        tagged: result.tagged,
        errors: result.errors,
        details: result.details,
        totalUntaggedCount: stats.totalUntaggedCount,
        totalBookmarkCount: stats.totalBookmarkCount,
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to auto-tag bookmarks');
    } finally {
      setIsAutoTagging(false);
    }
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setPromptJustCopied(true);
      setTimeout(() => setPromptJustCopied(false), PROMPT_COPIED_DURATION_MS);
      setTimeout(() => {
        pasteResponseSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, SCROLL_DELAY_AFTER_COPY_MS);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to copy prompt to clipboard');
    }
  };

  const handleApplyTags = async () => {
    if (!llmResponse.trim()) {
      setError('Please paste the LLM response first');
      return;
    }

    try {
      setIsApplying(true);
      setError(null);
      setSuccess(null);
      setTaggingResult(null);

      const result = await bookmarkApi.tagging.applyResponse(llmResponse);
      setLlmResponse('');
      setPrompt('');

      let totalUntaggedCount = 0;
      let totalBookmarkCount = 0;
      try {
        const stats = await bookmarkApi.tagging.getStats();
        totalUntaggedCount = stats.totalUntaggedCount;
        totalBookmarkCount = stats.totalBookmarkCount;
        setTotalUntaggedCount(stats.totalUntaggedCount);
        setTotalBookmarkCount(stats.totalBookmarkCount);
        setLlmBookmarkCategorizationUrl(stats.llmBookmarkCategorizationUrl);
        setLlmEnabled(stats.llmEnabled);
      } catch (err) {
        console.error('Failed to refresh stats:', err);
      }

      setTaggingResult({
        processed: result.processed,
        tagged: result.tagged,
        errors: result.errors,
        details: result.details,
        totalUntaggedCount,
        totalBookmarkCount,
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply tags');
    } finally {
      setIsApplying(false);
    }
  };

  const clearTaggingResult = (e: React.MouseEvent) => {
    e.preventDefault();
    setTaggingResult(null);
    setSuccess(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Load tags for result view (for slug -> color)
  useEffect(() => {
    if (!taggingResult) {
      setAllTags([]);
      return;
    }
    bookmarkApi.tags.getAll().then((tags) => {
      setAllTags(tags.map((t) => ({ slug: t.slug, color: t.color })));
    }).catch(() => setAllTags([]));
  }, [taggingResult]);

  // Results view after tagging (replaces redirect to dashboard)
  if (taggingResult) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <header className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-2">Tagging Results</h1>
                <p className="text-gray-600">
                  Processed {taggingResult.processed} bookmark{taggingResult.processed !== 1 ? 's' : ''}, added tags to {taggingResult.tagged}.
                  {taggingResult.errors && taggingResult.errors.length > 0 && (
                    <span className="text-amber-700 ml-1">
                      {taggingResult.errors.length} error{taggingResult.errors.length !== 1 ? 's' : ''}.
                    </span>
                  )}
                </p>
              </div>
            </div>
          </header>

          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Bookmarks tagged</h2>
            {taggingResult.details.length === 0 ? (
              <p className="text-gray-500">No bookmarks in this batch.</p>
            ) : (
              <ul className="space-y-4">
                {taggingResult.details.map((d) => (
                  <li
                    key={d.bookmarkId}
                    className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {d.tagSlugs.length > 0 ? (
                        d.tagSlugs.map((slug) => {
                          const tagMeta = allTags.find((t) => t.slug === slug);
                          const color = tagMeta?.color;
                          const style = color
                            ? {
                                backgroundColor: `${color}20`,
                                color,
                                borderColor: color,
                                borderWidth: '1px',
                                borderStyle: 'solid',
                              }
                            : undefined;
                          return (
                            <span
                              key={slug}
                              className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium"
                              style={style}
                            >
                              {slug}
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-gray-400 text-sm">No tags assigned</span>
                      )}
                    </div>
                    {d.url && (
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-sm break-all block mb-1"
                      >
                        {d.url}
                      </a>
                    )}
                    {d.content && (
                      <p className="text-sm text-gray-700 line-clamp-2">{d.content}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1 font-mono">ID: {d.bookmarkId}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {taggingResult.errors && taggingResult.errors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-amber-900 mb-2">Errors</h3>
              <ul className="text-sm text-amber-800 space-y-1">
                {taggingResult.errors.map((e, i) => (
                  <li key={i}>
                    {e.bookmarkId}: {e.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <a
              href="/"
              className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors font-medium inline-block"
            >
              Back to Dashboard
            </a>
            {taggingResult.totalUntaggedCount > 0 && (
              <a
                href="/tagging"
                onClick={clearTaggingResult}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium inline-block"
              >
                Tag more untagged bookmarks ({taggingResult.totalUntaggedCount} remaining)
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <header className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">LLM-Based Tagging</h1>
              <p className="text-gray-600">
                Generate a prompt to categorize bookmarks using ChatGPT, Grok, or other LLM tools
              </p>
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
            <strong>Error:</strong> {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
            <strong>Success:</strong> {success}
          </div>
        )}

        {/* Step 1: Generate Prompt */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Step 1: Generate Prompt</h2>

          {isLoadingStats ? (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-sm text-gray-600">Loading tagging statistics...</div>
            </div>
          ) : totalBookmarkCount > 0 ? (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-sm text-gray-700 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Tagging Progress:</span>
                  <span>
                    {totalBookmarkCount - totalUntaggedCount} tagged / {totalBookmarkCount} total
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Untagged remaining:</span>
                  <span className="font-semibold text-gray-900">{totalUntaggedCount}</span>
                </div>
                {totalBookmarkCount > 0 && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{
                          width: `${((totalBookmarkCount - totalUntaggedCount) / totalBookmarkCount) * 100}%`,
                        }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 text-right">
                      {Math.round(((totalBookmarkCount - totalUntaggedCount) / totalBookmarkCount) * 100)}% complete
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of bookmarks to process (default: 20)
            </label>
            <input
              type="number"
              min="1"
              max="50"
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value) || 20)}
              className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleGeneratePrompt}
              disabled={isGenerating || isAutoTagging}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isGenerating ? 'Generating...' : 'Generate Prompt'}
            </button>
            {llmEnabled && (
              <button
                onClick={handleAutoTag}
                disabled={isGenerating || isAutoTagging || totalUntaggedCount === 0}
                className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isAutoTagging ? 'Tagging...' : 'Auto-Tag with LLM'}
              </button>
            )}
          </div>

          {prompt && (
            <div ref={promptSectionRef} className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Generated Prompt ({bookmarkCount} bookmark{bookmarkCount !== 1 ? 's' : ''}, {prompt.length.toLocaleString()} characters)
                </label>
                <button
                  onClick={handleCopyPrompt}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium min-w-[120px]"
                >
                  {promptJustCopied ? '✓ Prompt Copied' : '📋 Copy Prompt'}
                </button>
              </div>
              <textarea
                readOnly
                value={prompt}
                className="w-full h-96 p-4 border border-gray-300 rounded-lg font-mono text-sm bg-gray-50 overflow-auto"
              />
              <p className="mt-2 text-sm text-gray-600">
                Copy the prompt above and paste it into{' '}
                {llmBookmarkCategorizationUrl ? (
                  <a
                    href={llmBookmarkCategorizationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline font-medium"
                  >
                    {llmBookmarkCategorizationUrl}
                  </a>
                ) : (
                  'ChatGPT, Grok, or another LLM tool'
                )}
                .
              </p>
            </div>
          )}
        </div>

        {/* Step 2: Paste Response */}
        <div ref={pasteResponseSectionRef} className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Step 2: Paste LLM Response</h2>

          <p className="text-sm text-gray-600 mb-4">
            After pasting the prompt into your LLM tool and getting a response, paste the response here:
          </p>

          <textarea
            value={llmResponse}
            onChange={(e) => setLlmResponse(e.target.value)}
            placeholder="Paste the LLM response here (JSON format)..."
            className="w-full h-48 p-4 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Step 3: Apply Tags */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Step 3: Apply Tags</h2>

          <p className="text-sm text-gray-600 mb-4">
            Click the button below to parse the LLM response and apply tags to your bookmarks.
          </p>

          <button
            onClick={handleApplyTags}
            disabled={isApplying || !llmResponse.trim() || !prompt}
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isApplying ? 'Applying Tags...' : 'Apply Tags to Bookmarks'}
          </button>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">📋 Instructions</h3>
          {llmEnabled && (
            <p className="text-sm text-blue-800 mb-3 font-medium">
              <strong>Quick path:</strong> Use &quot;Auto-Tag with LLM&quot; to tag bookmarks automatically (no copy/paste).
            </p>
          )}
          <p className="text-sm text-blue-800 mb-2 font-medium">Manual path:</p>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
            <li>Click &quot;Generate Prompt&quot; to create a prompt with untagged bookmarks</li>
            <li>Copy the generated prompt</li>
            {llmBookmarkCategorizationUrl ? (
              <li>
                Paste it into{' '}
                <a
                  href={llmBookmarkCategorizationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline font-medium"
                >
                  {llmBookmarkCategorizationUrl}
                </a>
              </li>
            ) : (
              <li>Paste it into ChatGPT, Grok, Claude, or another LLM tool</li>
            )}
            <li>Copy the LLM's JSON response</li>
            <li>Paste the response into the "Step 2" textarea above</li>
            <li>Click "Apply Tags to Bookmarks" to save the tags</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

