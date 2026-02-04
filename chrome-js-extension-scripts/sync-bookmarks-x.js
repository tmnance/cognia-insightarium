// X bookmarks page
// https://x.com/i/bookmarks

(() => {
  // ------ CONFIG ------

  const SHOW_MORE_DELAY_MS = 100;
  const CURRENTLY_DISPLAYED_ITEMS_SELECTOR = 'article[role="article"]'
  const ITEMS_WRAPPER_SELECTOR = '[aria-label="Timeline: Bookmarks"] > div';
  const ITEMS_WRAPPER_OBSERVER_CONFIG = {
    attributes: false,
    childList: true,
    subtree: false,
    characterData: false,
  };

  // ------ CUSTOM FUNCTIONS & LOGIC FOR THIS PLATFORM ------

  const getItemId = (item) => {
    return item.querySelector('time')?.parentElement?.href?.split('/').pop() || null;
  };

  /** Click "show more" if present and wait for DOM to update. */
  const clickShowMoreAndWait = (item) => {
    const showMoreLinkEl = item.querySelector('button[data-testid="tweet-text-show-more-link"]');
    if (!showMoreLinkEl) return Promise.resolve();
    showMoreLinkEl.click();
    return new Promise((resolve) => setTimeout(resolve, SHOW_MORE_DELAY_MS));
  };

  /** Extract item content fromtweet text or article card. */
  const getItemContent = (item) => {
    const tweetTextEl = item.querySelector('[data-testid="tweetText"]');
    if (tweetTextEl) return tweetTextEl.innerText.trim();

    const articleLabelEl = item.querySelector('[aria-label="Article"]');
    if (articleLabelEl) {
      const container = articleLabelEl.closest('[data-testid="article-cover-image"]') || articleLabelEl.parentElement.parentElement;
      return (container?.parentElement?.innerText ?? '').replace(/^\s*article\s*/i, '#').trim();
    }

    return null;
  };

  /** Build bookmark object from item DOM, or null if invalid. */
  const extractBookmarkFromItem = async (item) => {
    await clickShowMoreAndWait(item);
    const content = getItemContent(item);
    if (!content) return null;

    const statusLinkEl = item.querySelector('a[href*="/status/"]');
    if (!statusLinkEl) return null;

    const bookmarkUrl = statusLinkEl.href.split('?')[0];
    const authorLinkEl = item.querySelector('a[href^="/"][role="link"]');
    const timeEl = item.querySelector('time');

    return {
      platform: 'x',
      url: bookmarkUrl,
      author: authorLinkEl ? '@' + authorLinkEl.getAttribute('href').slice(1) : null,
      text: content,
      timestamp: timeEl ? timeEl.getAttribute('datetime') : null
    };
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
