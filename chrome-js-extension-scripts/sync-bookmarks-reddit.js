// Reddit saved posts/comments page
// https://www.reddit.com/user/*/saved/

(() => {
  // ------ CONFIG ------

  const ITEMS_WRAPPER_SELECTOR = 'shreddit-feed';
  const ITEMS_WRAPPER_OBSERVER_CONFIG = {
    childList: true,
    subtree: true,
  };
  const CURRENTLY_DISPLAYED_ITEMS_SELECTOR = 'shreddit-post, shreddit-profile-comment';

  // ------ CUSTOM FUNCTIONS & LOGIC FOR THIS PLATFORM ------

  /** Get stable unique item ID from permalink (subreddit + post id + comment id). */
  const getItemId = (item) => {
    const url = getItemUrl(item);
    if (!url) return null;
    // https://www.reddit.com/r/<subreddit>/comments/<post-id>/<post-title>/
    // or https://www.reddit.com/r/<subreddit>/comments/<post-id>/<post-title>/comment/<comment-id>/
    // or https://www.reddit.com/r/<subreddit>/comments/<post-id>/comment/<comment-id>/
    const match = url.match(/^https?:\/\/(?:www\.)?reddit\.com\/r\/([^/]+)\/comments\/([^/]+)(?:\/[^/]+)?(?:\/comment\/([^/?#]+))?\/?(?:[?#].*)?$/i);
    const [, subreddit, postId, commentId] = match || [];
    return `${subreddit}-${postId}${commentId ? `-${commentId}` : ''}`;
  };

  const getItemUrl = (item) => {
    const url = item.getAttribute(item.matches('shreddit-post') ? 'permalink' : 'href')?.split('?')[0] ?? null;
    return ensureRedditPrefix(url);
  };

  const ensureRedditPrefix = (url) => {
    if (!url) return null;
    if (url.startsWith('https://www.reddit.com/')) return url;
    return `https://www.reddit.com${(url.startsWith('/') ? '' : '/') + url}`;
  };

  const extractSubredditFromUrl = (url) => {
    if (!url) return null;
    const parts = url.split('/').slice(3, 5);
    return parts.length === 2 ? parts.join('/') : null;
  };

  /** Extract item data from shreddit-post element. */
  const extractFromShredditPost = (item) => {
    const itemUrl = getItemUrl(item);
    const subreddit = extractSubredditFromUrl(itemUrl);
    const author = item.getAttribute('author');
    const timestamp = item.getAttribute('created-timestamp');

    const postTitle = item.querySelector('a[slot="title"]')?.textContent.trim();
    const postBodyEl = item.querySelector('[slot="text-body"] > a');
    const postBodyMarkdown = (postBodyEl ? window.__bookmarkSyncShared?.htmlToMarkdown(postBodyEl) : null);
    if (!postTitle && !postBodyMarkdown) return null;

    const content = `subreddit: ${subreddit}` + 
      (postTitle ? `\n# ${postTitle}` : '') + 
      (postBodyMarkdown ? `\n${postBodyMarkdown}` : '');

    return {
      platform: 'reddit',
      url: itemUrl,
      author: author || undefined,
      text: content || undefined,
      timestamp: timestamp || undefined,
    };
  };

  /** Extract item data from shreddit-profile-comment element. */
  const extractFromShredditComment = (item) => {
    const itemUrl = getItemUrl(item);
    const subreddit = extractSubredditFromUrl(itemUrl);
    const author = item.querySelector('faceplate-hovercard[data-id="user-hover-card"] > a:first-child')?.textContent.trim();
    const timestamp = item.querySelector('faceplate-timeago > time')?.getAttribute('datetime');

    const parentPostTitle = item.querySelector('h2 > a')?.textContent.trim();
    const commentBodyEl = item.querySelector('div[id="-post-rtjson-content"]');
    const commentBodyMarkdown = (commentBodyEl ? window.__bookmarkSyncShared?.htmlToMarkdown(commentBodyEl) : null);
    if (!commentBodyMarkdown) return null;

    const content = `subreddit: ${subreddit}` + 
      (parentPostTitle ? `\nOriginal post title: ${parentPostTitle}` : '') + 
      (commentBodyMarkdown ? `\nComment:\n---\n${commentBodyMarkdown}` : '');

    return {
      platform: 'reddit',
      url: itemUrl,
      author: author || undefined,
      text: content || undefined,
      timestamp: timestamp || undefined,
    };
  };

  /** Build bookmark object from post/comment DOM, or null if invalid. */
  const extractBookmarkFromItem = async (item) => {
    if (item.matches('shreddit-post')) {
      return extractFromShredditPost(item);
    } else if (item.matches('shreddit-profile-comment')) {
      return extractFromShredditComment(item);
    }
    return null;
  };

  // ------ INITIALIZE SHARED INFRASTRUCTURE ------

  if (window.__bookmarkSyncShared) {
    window.__bookmarkSyncShared.init({
      ITEMS_WRAPPER_SELECTOR,
      ITEMS_WRAPPER_OBSERVER_CONFIG,
      CURRENTLY_DISPLAYED_ITEMS_SELECTOR,
      getItemId,
      extractBookmarkFromItem,
    });
  } else {
    console.error('__bookmarkSyncShared not found');
  }
})();
