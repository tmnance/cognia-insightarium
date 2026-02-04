// Shared bookmark sync infrastructure
// Platform-specific scripts should call window.__bookmarkSyncShared.init(config) after defining:
// - ITEMS_WRAPPER_SELECTOR - CSS selector for items container
// - ITEMS_WRAPPER_OBSERVER_CONFIG - MutationObserver config
// - CURRENTLY_DISPLAYED_ITEMS_SELECTOR - CSS selector for items
// - getItemId(item) - returns unique ID for an item
// - extractBookmarkFromItem(item) - returns bookmark object or null

window.__bookmarkSyncShared = (() => {
  // ------ SHARED STATE & CONFIG ------
  const LOCAL_SAVE_BOOKMARKS_URL = 'http://localhost:3000/save';
  const processedItemIds = new Set();
  const pendingNewBookmarks = [];
  const sentBookmarksCount = { value: 0 };

  let config = null;

  const htmlToMarkdown = (wrapperEl) => {
    const processNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return '';
      }

      const tag = node.tagName.toLowerCase();
      const content = Array.from(node.childNodes).map(processNode).join('');

      switch (tag) {
        case 'h1': return `# ${content.trim()}\n\n`;
        case 'h2': return `## ${content.trim()}\n\n`;
        case 'h3': return `### ${content.trim()}\n\n`;
        case 'h4': return `#### ${content.trim()}\n\n`;
        case 'h5': return `##### ${content.trim()}\n\n`;
        case 'h6': return `###### ${content.trim()}\n\n`;

        case 'p': return `${content.trim()}\n\n`;
        case 'br': return `\n`;

        case 'strong':
        case 'b': return `**${content.trim()}**`;

        case 'em':
        case 'i': return `*${content.trim()}*`;

        case 'code': return `\`${content.trim()}\``;

        case 'pre': return `\n\`\`\`\n${node.textContent.trim()}\n\`\`\`\n\n`;

        case 'a':
          const href = node.getAttribute('href')?.trim() || '';
          const linkText = content.trim();
          if (!linkText || !href) return '';
          return `[${linkText}](${href})`;

        case 'ul':
          return '\n' + Array.from(node.children)
            .map(li => `- ${processNode(li).trim()}`)
            .join('\n') + '\n\n';

        case 'ol':
          return '\n' + Array.from(node.children)
            .map((li, i) => `${i + 1}. ${processNode(li).trim()}`)
            .join('\n') + '\n\n';

        case 'li':
          return content;

        case 'button':
          return '';

        default:
          return content;
      }
    };

    return Array.from(wrapperEl.childNodes)
      .map(processNode)
      .join('')
      .trim()
      .replace(/[ \t]+\n/g, '\n') // remove trailing spaces
      .replace(/\n[ \t]+/g, '\n') // remove leading spaces
      .replace(/\n{3,}/g, '\n\n') // max 2 newlines
  };

  const init = (platformConfig) => {
    config = platformConfig;
    const {
      ITEMS_WRAPPER_SELECTOR,
      ITEMS_WRAPPER_OBSERVER_CONFIG,
      CURRENTLY_DISPLAYED_ITEMS_SELECTOR,
      getItemId,
      extractBookmarkFromItem,
    } = config;

  // ------ UTILITY FUNCTIONS ------

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

  // ------ ITEM PROCESSING FUNCTIONS ------

  /** Add visual outline to indicate item was successfully processed. */
  const addItemProcessedOutline = (item) => {
    item.style.outline = '2px solid #1d9bf0';
    item.style.outlineOffset = '2px';
  };

  /** Add visual outline to indicate item was unable to be processed. */
  const addItemErrorOutline = (item) => {
    item.style.outline = '2px solid #ff0000';
    item.style.outlineOffset = '2px';
  };

  /** Process one item: extract data if new/unsent, mark processed. Returns bookmark or null. */
  const processItemAndExtractBookmarkIfNew = async (item) => {
    const itemId = getItemId(item);
    if (!itemId) {
      addItemErrorOutline(item);
      return;
    }
    if (processedItemIds.has(itemId)) {
      addItemProcessedOutline(item);
      return;
    }

    try {
      const bookmark = await extractBookmarkFromItem(item);
      if (!bookmark) {
        addItemErrorOutline(item);
        return;
      }
      if (processedItemIds.has(itemId)) {
        // race condition, but should be rare
        addItemProcessedOutline(item);
        return;
      }
      processedItemIds.add(itemId);
      addItemProcessedOutline(item);
      return bookmark;
    } catch {
      addItemErrorOutline(item);
      return;
    }
  };

  /** Process all visible items and extract any new bookmarks. */
  const processCurrentlyDisplayedItems = async () => {
    const items = Array.from(document.querySelectorAll(CURRENTLY_DISPLAYED_ITEMS_SELECTOR));
    const newBookmarks = (
      await Promise.all(items.map((item) => processItemAndExtractBookmarkIfNew(item)))
    ).filter(Boolean);
    if (newBookmarks.length === 0) {
      return;
    }
    pendingNewBookmarks.push(...newBookmarks);
    updateBookmarksStatusDisplay();
  };

  /** Open save page and post payload with retries. */
  const sendUnsentBookmarksToSavePage = () => {
    const destinationWindow = window.open(LOCAL_SAVE_BOOKMARKS_URL, '_blank');
    if (!destinationWindow) {
      alert('Popup blocked');
      return;
    }

    const postRequest = () => {
      setTimeout(() => {
        destinationWindow.postMessage({ bookmarksToSave: pendingNewBookmarks }, '*');
        sentBookmarksCount.value += pendingNewBookmarks.length;
        // reset pending
        pendingNewBookmarks.length = 0;
        updateBookmarksStatusDisplay();
      }, 200);
    };

    if (destinationWindow.document?.readyState === 'complete') {
      postRequest();
    } else {
      destinationWindow.addEventListener('load', postRequest, { once: true });
    }
  };

  const getOrCreateCustomActionsWrapper = () => {
    let wrapper = document.getElementById('customActions-wrapper');
    if (wrapper) return wrapper;

    // Create a wrapper for any buttons and status display
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
      padding: '6px',
    });
    document.body.appendChild(wrapper);
    return wrapper;
  };

  const setupItemsWrapperMutationObserver = (callback) => {
    waitForElement(ITEMS_WRAPPER_SELECTOR, (itemsWrapperEl) => {
      const observer = new MutationObserver(callback);
      observer.observe(itemsWrapperEl, ITEMS_WRAPPER_OBSERVER_CONFIG);
      return observer;
    });
  };

  const setupBookmarksStatusDisplay = () => {
    const bookmarksStatusDiv = document.createElement('div');
    bookmarksStatusDiv.id = 'bookmarksStatus';
    Object.assign(bookmarksStatusDiv.style, {
      fontSize: '10px',
      color: '#333',
      textAlign: 'right'
    });
    bookmarksStatusDiv.innerHTML = 'Pending new: <span></span><br />Sent: <span></span>';
    getOrCreateCustomActionsWrapper().appendChild(bookmarksStatusDiv);
    bookmarksStatusDiv.querySelector('span:first-child').addEventListener('click', () => {
      console.log('pendingNewBookmarks', pendingNewBookmarks);
    });
    updateBookmarksStatusDisplay();
  };

  const updateBookmarksStatusDisplay = () => {
    const bookmarksStatusDiv = document.querySelector('#bookmarksStatus');
    if (bookmarksStatusDiv) {
      const [pendingNewCountSpan, sentCountSpan] = Array.from(bookmarksStatusDiv.querySelectorAll('span'));
      pendingNewCountSpan.textContent = pendingNewBookmarks.length;
      sentCountSpan.textContent = sentBookmarksCount.value;
    }
  };

  const setupStartProcessingButton = () => {
    const processButton = document.createElement('button');
    processButton.id = 'processButton';
    Object.assign(processButton.style, {
      background: '#fff',
      border: '1px solid #aaa',
      borderRadius: '8px',
      padding: '6px',
      fontSize: '12px',
      color: '#333',
      cursor: 'pointer',
    });
    processButton.textContent = 'Process';
    processButton.addEventListener('click', () => {
      processButton.disabled = true;
      processButton.textContent = 'Processing...';
      processButton.style.backgroundColor = '#f0f0f0';
      processButton.style.color = '#666';
      setupItemsWrapperMutationObserver(() => {
        processCurrentlyDisplayedItems();
      });
      // fire immediately for current content as observer only fires after DOM updates
      processCurrentlyDisplayedItems();
    });
    getOrCreateCustomActionsWrapper().appendChild(processButton);
  };

  const setupSendButton = () => {
    const sendButton = document.createElement('button');
    Object.assign(sendButton.style, {
      background: '#fff',
      border: '1px solid #aaa',
      borderRadius: '8px',
      padding: '6px',
      fontSize: '12px',
      color: '#333',
      cursor: 'pointer',
    });
    sendButton.textContent = 'Send';
    sendButton.addEventListener('click', sendUnsentBookmarksToSavePage);
    getOrCreateCustomActionsWrapper().appendChild(sendButton);
  };

  const triggerAutoSync = () => {
    const initialDelayMs = 1600;
    const postScrollDelayMs = 300;
    const pageDownTarget = 7;

    setTimeout(() => {
      const processButton = document.getElementById('processButton');
      if (!processButton) return;
      // initiate bookmarks harvesting
      processButton.click();
      let pageDownRemaining = pageDownTarget;
      // initiate page down scrolling
      const interval = setInterval(() => {
        window.scrollBy(0, window.innerHeight);
        pageDownRemaining--;
        if (pageDownRemaining <= 0) {
          clearInterval(interval);
          // send unsent bookmarks to save page after scrolling
          setTimeout(() => {
            sendUnsentBookmarksToSavePage();
          }, postScrollDelayMs);
          return;
        }
      }, postScrollDelayMs);
    }, initialDelayMs);
  };

    // ------ INITIALIZATION ------

    const initialize = () => {
      setupBookmarksStatusDisplay();
      setupStartProcessingButton();
      setupSendButton();
      updateBookmarksStatusDisplay();
      if (window.location.search.includes('autosync=true')) {
        triggerAutoSync();
      }
    };

    initialize();
  };

  // Expose shared state and utilities
  const shared = {
    init,
    htmlToMarkdown,
    LOCAL_SAVE_BOOKMARKS_URL,
    processedItemIds,
    pendingNewBookmarks,
    sentBookmarksCount,
  };
  return shared;
})();
