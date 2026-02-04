// LinkedIn saved posts page
// https://www.linkedin.com/my-items/saved-posts/

(() => {
  // ------ CONFIG ------

  const ITEMS_WRAPPER_SELECTOR = 'ul[role="list"]';
  const ITEMS_WRAPPER_OBSERVER_CONFIG = {
    attributes: false,
    childList: true,
    subtree: false,
    characterData: false,
  };
  const CURRENTLY_DISPLAYED_ITEMS_SELECTOR = 'ul[role="list"] .entity-result__content-container'

  // ------ CUSTOM FUNCTIONS & LOGIC FOR THIS PLATFORM ------

  const getItemId = (item) => {
    return item.parentElement.getAttribute('data-chameleon-result-urn') || null;
  };

  const getTimestampFromRelativeAgeString = (relativeAgeString) => {
    // 5m / 22h / 5d / 2w / 3mo / 1yr / 5yr
    const amount = parseInt(relativeAgeString.replace(/[^0-9]/g, ''));
    if (isNaN(amount)) return null;
    const unit = relativeAgeString.toLowerCase().replace(/[^a-z]/g, '');

    let resultDate = new Date();
    switch (unit) {
      // minutes
      case 'm': resultDate.setMinutes(resultDate.getMinutes() - amount); break;
      // hours
      case 'h': resultDate.setHours(resultDate.getHours() - amount); break;
      // days
      case 'd': resultDate.setDate(resultDate.getDate() - amount); break;
      // weeks
      case 'w': resultDate.setDate(resultDate.getDate() - amount * 7); break;
      // months
      case 'mo': resultDate.setMonth(resultDate.getMonth() - amount); break;
      // years
      case 'yr': resultDate.setFullYear(resultDate.getFullYear() - amount); break;
      default: return null;
    }
    return resultDate.toISOString();
  };

  /** Build bookmark object from item DOM, or null if invalid. */
  const extractBookmarkFromItem = async (item) => {
    // await clickShowMoreAndWait(item);
    const itemId = getItemId(item);

    const bookmarkUrl = `https://www.linkedin.com/feed/update/${itemId}`;
    const author = item.querySelector('.entity-result__content-actor a[href*="/in/"] > span > span:first-child')?.textContent.trim();

    const relativeAgeString = item.querySelector(
      '.entity-result__content-actor > .linked-area > p > span'
    )?.textContent.replace(/[^a-zA-Z0-9 ]/g, '').trim().split(' ').pop();
    const timestamp = getTimestampFromRelativeAgeString(relativeAgeString);
    if (!timestamp) return null;

    const contentEl = item.querySelector('[class*="entity-result__content-inner-container"]');
    const content = (contentEl ? window.__bookmarkSyncShared?.htmlToMarkdown(contentEl) : null);
    if (!content) return null;

    return {
      platform: 'linkedin',
      url: bookmarkUrl,
      author: author,
      text: content,
      timestamp: timestamp
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
