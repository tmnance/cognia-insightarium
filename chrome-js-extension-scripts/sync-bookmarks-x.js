// X bookmarks page
// https://x.com/i/bookmarks
const __VERSION__ = 'v1.0.1';

(() => {
  const LOCAL_BOOKMARKS_SAVE_URL = 'http://localhost:3000/save';
  const SHOW_MORE_DELAY_MS = 100;

  const processedArticleIds = new Set();
  const extractedBookmarks = [];
  let sentBookmarksCount = 0;

  const isBookmarksPage = () => /^https:\/\/x\.com\/i\/bookmarks/.test(location.href);

  const waitForElement = (selector, callback, maxWait = 10000) => {
    let elapsedTime = 0;
    const interval = setInterval(() => {
      elapsedTime += 100;
      if (elapsedTime > maxWait) {
        clearInterval(interval);
        return;
      }
      const element = document.querySelector(selector);
      if (element) {
        clearInterval(interval);
        callback(element);
      }
    }, 100);
  };

  const getArticleId = (article) => {
    return article.querySelector("time")?.parentElement?.href?.split("/").pop() || null;
  };

  /** Click "show more" if present and wait for DOM to update. */
  const clickShowMoreAndWait = (article) => {
    const showMoreLinkEl = article.querySelector('button[data-testid="tweet-text-show-more-link"]');
    if (!showMoreLinkEl) return Promise.resolve();
    showMoreLinkEl.click();
    return new Promise((resolve) => setTimeout(resolve, SHOW_MORE_DELAY_MS));
  };

  /** Extract [type, content] from article (tweet text or article card). */
  const getArticleTypeAndContent = (article) => {
    const tweetTextEl = article.querySelector('[data-testid="tweetText"]');
    if (tweetTextEl) return ['tweet', tweetTextEl.innerText.trim()];

    const articleLabelEl = article.querySelector('[aria-label="Article"]');
    if (articleLabelEl) {
      const container = articleLabelEl.closest('[data-testid="article-cover-image"]') || articleLabelEl.parentElement.parentElement;
      const text = (container?.parentElement?.innerText ?? '').replace(/^\s*article\s*/i, "#").trim();
      return ['article', text];
    }
    return [null, null];
  };

  /** Build bookmark object from article DOM, or null if invalid. */
  const extractBookmarkFromArticle = (article) => {
    const [articleType, articleContent] = getArticleTypeAndContent(article);
    if (!articleType || !articleContent) return null;

    const statusLinkEl = article.querySelector('a[href*="/status/"]');
    if (!statusLinkEl) return null;

    const bookmarkUrl = statusLinkEl.href.split("?")[0];
    const authorLinkEl = article.querySelector('a[href^="/"][role="link"]');
    const timeEl = article.querySelector("time");

    return {
      platform: "x",
      url: bookmarkUrl,
      author: authorLinkEl ? "@" + authorLinkEl.getAttribute("href").slice(1) : null,
      text: articleContent ?? '',
      timestamp: timeEl ? timeEl.getAttribute("datetime") : null
    };
  };

  /** Add visual outline to indicate article has been processed. */
  const addArticleProcessedOutline = (article) => {
    article.style.outline = "2px solid #1d9bf0";
    article.style.outlineOffset = "2px";
  };

  /** Add visual outline to indicate article has been processed. */
  const addArticleErrorOutline = (article) => {
    article.style.outline = "2px solid #ff0000";
    article.style.outlineOffset = "2px";
  };

  /** Process one article: expand "show more", extract data, mark processed. Returns bookmark or null. */
  const processSingleArticle = async (article) => {
    const articleId = getArticleId(article);
    if (!articleId) {
      addArticleErrorOutline(article);
      return null;
    }
    if (processedArticleIds.has(articleId)) {
      addArticleProcessedOutline(article);
      return null;
    }

    try {
      await clickShowMoreAndWait(article);
      const bookmark = extractBookmarkFromArticle(article);
      if (!bookmark) {
        addArticleErrorOutline(article);
        return null;
      }
      if (processedArticleIds.has(articleId)) {
        // race condition, but should be rare
        addArticleProcessedOutline(article);
        return null;
      }
      processedArticleIds.add(articleId);
      addArticleProcessedOutline(article);
      return bookmark;
    } catch {
      addArticleErrorOutline(article);
      return null;
    }
  };

  /** Process all visible articles in parallel; returns array of bookmark objects. */
  const processAllArticles = async () => {
    const articles = Array.from(document.querySelectorAll('article[role="article"]'));
    const results = await Promise.all(articles.map((article) => processSingleArticle(article)));
    return results.filter(Boolean);
  };

  /** Open save page and post payload with retries. */
  const sendBookmarksToSavePage = () => {
    const destinationWindow = window.open(LOCAL_BOOKMARKS_SAVE_URL, "_blank");
    if (!destinationWindow) {
      alert("Popup blocked");
      return;
    }

    const postRequest = () => {
      setTimeout(() => {
        destinationWindow.postMessage({ itemsToSave: extractedBookmarks }, "*");
        sentBookmarksCount += extractedBookmarks.length;
        // reset extracted
        extractedBookmarks.length = 0;
        updateExtractedStatusDisplay()
      }, 200);
    };

    if (destinationWindow.document?.readyState === 'complete') {
      postRequest();
    } else {
      destinationWindow.addEventListener('load', postRequest, { once: true });
    }
  };

  const processCurrentlyDisplayedBookmarks = async () => {
    const newExtractedBookmarks = await processAllArticles();
    if (!newExtractedBookmarks.length) {
      return;
    }
    extractedBookmarks.push(...newExtractedBookmarks);
    updateExtractedStatusDisplay()
  };

  const getOrCreateCustomActionsWrapper = () => {
    let wrapper = document.getElementById('customActions-wrapper');
    if (wrapper) return wrapper;

    // Create a wrapper for any buttons and version display
    wrapper = document.createElement('div');
    wrapper.id = 'customActions-wrapper';
    Object.assign(wrapper.style, {
      position: 'fixed',
      right: '86px',
      bottom: '12px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      background: '#f0f0f0',
      border: '1px solid #aaa',
      borderRadius: '8px',
      padding: '6px'
    });
    document.body.appendChild(wrapper);
    return wrapper;
  };

  const setupTimelineMutationObserver = (callback) => {
    waitForElement('[aria-label="Timeline: Bookmarks"] > div', (timelineWrapperEl) => {
      const observer = new MutationObserver(callback);
      observer.observe(timelineWrapperEl, { attributes: false, childList: true, subtree: false, characterData: false });
      return observer;
    });
  };

  const setupExtractedStatusDisplay = () => {
    const extractedStatusDiv = document.createElement("div");
    extractedStatusDiv.id = 'extractedStatus';
    Object.assign(extractedStatusDiv.style, {
      fontSize: '10px',
      color: '#333',
      textAlign: 'right'
    });
    extractedStatusDiv.innerHTML = `Extracted + unsent: <span></span><br />Sent: <span></span>`;
    getOrCreateCustomActionsWrapper().appendChild(extractedStatusDiv);
    extractedStatusDiv.querySelector('span:first-child').addEventListener('click', () => {
      console.log('extractedBookmarks', extractedBookmarks);
    });
    updateExtractedStatusDisplay();
  };

  const updateExtractedStatusDisplay = () => {
    const extractedStatusDiv = document.querySelector('#extractedStatus');
    if (extractedStatusDiv) {
      const [extractedCountSpan, sentCountSpan] = Array.from(extractedStatusDiv.querySelectorAll('span'));
      extractedCountSpan.textContent = extractedBookmarks.length;
      sentCountSpan.textContent = sentBookmarksCount;
    }
  };

  const setupProcessButton = () => {
    const processButton = document.createElement("button");
    processButton.id = 'processButton';
    Object.assign(processButton.style, {
      background: '#fff',
      border: '1px solid #aaa',
      borderRadius: '8px',
      padding: '6px',
      fontSize: '12px',
      color: '#333',
      cursor: 'pointer'
    });
    processButton.textContent = "Process";
    processButton.addEventListener("click", () => {
      processButton.disabled = true;
      processButton.textContent = "Processing...";
      processButton.style.backgroundColor = '#f0f0f0';
      processButton.style.color = '#666';
      setupTimelineMutationObserver(() => {
        processCurrentlyDisplayedBookmarks();
      });
      // fire immediately for current content as observer only fires after DOM updates
      processCurrentlyDisplayedBookmarks();
    });
    getOrCreateCustomActionsWrapper().appendChild(processButton);
  };

  const setupSendButton = () => {
    const sendButton = document.createElement("button");
    Object.assign(sendButton.style, {
      background: '#fff',
      border: '1px solid #aaa',
      borderRadius: '8px',
      padding: '6px',
      fontSize: '12px',
      color: '#333',
      cursor: 'pointer'
    });
    sendButton.textContent = "Send";
    sendButton.addEventListener("click", sendBookmarksToSavePage);
    getOrCreateCustomActionsWrapper().appendChild(sendButton);
  };

  const setupVersionDisplay = () => {
    const versionDiv = document.createElement("div");
    versionDiv.style.fontSize = '10px';
    versionDiv.textContent = `Version: ${__VERSION__}`;
    getOrCreateCustomActionsWrapper().appendChild(versionDiv);
  };

  const triggerAutoSync = () => {
    const initialDelayMs = 1600;
    const postScrollDelayMs = 300;
    const pageDownTarget = 7;

    setTimeout(() => {
      const processButton = document.getElementById('processButton');
      if (!processButton) return;
      // initiate bookmark harvesting
      processButton.click();
      let pageDownRemaining = pageDownTarget;
      // initiate page scrolling
      const interval = setInterval(() => {
        window.scrollBy(0, window.innerHeight);
        pageDownRemaining--;
        if (pageDownRemaining <= 0) {
          clearInterval(interval);
          // send extracted bookmarks to save page
          setTimeout(() => {
            sendBookmarksToSavePage();
          }, postScrollDelayMs);
          return;
        }
      }, postScrollDelayMs);
    }, initialDelayMs);
  };

  const init = () => {
    if (!isBookmarksPage()) {
      alert("Run on x.com/i/bookmarks");
      return;
    }
    setupExtractedStatusDisplay();
    setupProcessButton();
    setupSendButton();
    setupVersionDisplay();
    updateExtractedStatusDisplay();
    if (window.location.search.includes('autosync=true')) {
      triggerAutoSync();
    }
  };

  init();
})();
