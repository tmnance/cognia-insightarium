// Reddit saved posts/comments page
// https://www.reddit.com/user/*/saved/
const __VERSION__ = 'v1.0.1';

(() => {
  const LOCAL_BOOKMARKS_SAVE_URL = 'http://localhost:3000/save';

  const processedItemIds = new Set();
  const extractedItems = [];
  let sentItemsCount = 0;

  const isSavedPage = () =>
    /^https:\/\/(www\.)?reddit\.com\/user\/[^/]+\/saved/.test(location.href);

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
        case 'h1': return `# ${content}\n\n`;
        case 'h2': return `## ${content}\n\n`;
        case 'h3': return `### ${content}\n\n`;
        case 'h4': return `#### ${content}\n\n`;
        case 'h5': return `##### ${content}\n\n`;
        case 'h6': return `###### ${content}\n\n`;
  
        case 'p': return `${content}\n\n`;
        case 'br': return `  \n`;
  
        case 'strong':
        case 'b': return `**${content}**`;
  
        case 'em':
        case 'i': return `*${content}*`;
  
        case 'code': return `\`${content}\``;
  
        case 'pre': return `\n\`\`\`\n${node.textContent}\n\`\`\`\n\n`;
  
        case 'a':
          const href = node.getAttribute('href') || '';
          return `[${content}](${href})`;
  
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

  /** Get stable unique item ID from permalink (subreddit + post id + comment id). */
  const getUniqueItemIdFromUrl = (url) => {
    if (!url) return null;
    // https://www.reddit.com/r/<subreddit>/comments/<post-id>/<post-title>/
    // or https://www.reddit.com/r/<subreddit>/comments/<post-id>/<post-title>/comment/<comment-id>/
    // or https://www.reddit.com/r/<subreddit>/comments/<post-id>/comment/<comment-id>/
    const match = url.match(/^https?:\/\/(?:www\.)?reddit\.com\/r\/([^/]+)\/comments\/([^/]+)(?:\/[^/]+)?(?:\/comment\/([^/?#]+))?\/?(?:[?#].*)?$/i);
    const [, subreddit, postId, commentId] = match || [];
    return `${subreddit}-${postId}${commentId ? `-${commentId}` : ''}`;
  };

  /** Extract item data from shreddit-post element. */
  const extractFromShredditPost = (postEl) => {
    const postTitleLinkEl = postEl.querySelector('a[slot="title"]');
    if (!postTitleLinkEl) return null;

    const itemUrl = ensureRedditPrefix(postTitleLinkEl.href.split('?')[0]);
    const subreddit = extractSubredditFromUrl(itemUrl);
    const postTitle = postTitleLinkEl.textContent.trim();
    const postBodyEl = postEl.querySelector('[slot="text-body"] > a');
    const content = `subreddit: ${subreddit}\n# ${postTitle}` + (postBodyEl ? `\n${htmlToMarkdown(postBodyEl)}` : '');

    const author = postEl.getAttribute('author');
    const timestamp = postEl.getAttribute('created-timestamp');

    return {
      platform: 'reddit',
      url: itemUrl,
      author: author || undefined,
      text: content || undefined,
      timestamp: timestamp || undefined,
    };
  };

  /** Extract item data from shreddit-profile-comment element. */
  const extractFromShredditComment = (commentEl) => {
    const itemUrl = ensureRedditPrefix(commentEl.getAttribute('href')?.split('?')[0])
    const subreddit = extractSubredditFromUrl(itemUrl);
    const parentPostTitle = commentEl.querySelector('h2 > a')?.textContent.trim();

    const commentBodyEl = commentEl.querySelector('div[id="-post-rtjson-content"]');
    const commentBodyMarkdown = (commentBodyEl ? htmlToMarkdown(commentBodyEl) : null) || undefined;
    if (!commentBodyMarkdown) return null;

    const content = `subreddit: ${subreddit}\nOriginal post title: ${parentPostTitle}\nComment:\n---\n${commentBodyMarkdown}`;

    const author = commentEl.querySelector('faceplate-hovercard[data-id="user-hover-card"] > a:first-child')?.textContent.trim();
    const timestamp = commentEl.querySelector('faceplate-timeago > time')?.getAttribute('datetime');

    return {
      platform: 'reddit',
      url: itemUrl,
      author: author || undefined,
      text: content || undefined,
      timestamp: timestamp || undefined,
    };
  };

  /** Add visual outline for processed item. */
  const addItemProcessedOutline = (el) => {
    el.style.outline = '2px solid #1d9bf0';
    el.style.outlineOffset = '2px';
  };

  /** Add visual outline for error. */
  const addItemErrorOutline = (el) => {
    el.style.outline = '2px solid #ff0000';
    el.style.outlineOffset = '2px';
  };

  /** Process one post/comment item: extract data, mark processed. Returns item or null. */
  const processSingleItem = (itemEl) => {
    const itemData = (() => {
      if (itemEl.matches('shreddit-post')) {
        return extractFromShredditPost(itemEl);
      } else if (itemEl.matches('shreddit-profile-comment')) {
        return extractFromShredditComment(itemEl);
      }
      return null;
    })();
    if (!itemData) {
      addItemErrorOutline(itemEl);
      return null;
    }

    const itemId = getUniqueItemIdFromUrl(itemData.url);
    if (!itemId) {
      addItemErrorOutline(itemEl);
      return null;
    }
    if (processedItemIds.has(itemId)) {
      addItemProcessedOutline(itemEl);
      return null;
    }

    processedItemIds.add(itemId);
    addItemProcessedOutline(itemEl);
    return itemData;
  };

  /** Process all visible posts/comments; returns array of item objects. */
  const processAllItems = () => {
    const postsAndComments = Array.from(document.querySelectorAll('shreddit-post, shreddit-profile-comment'));
    const results = postsAndComments.map((el) => processSingleItem(el));
    return results.filter(Boolean);
  };

  /** Open save page and post payload. */
  const sendItemsToSavePage = () => {
    const destinationWindow = window.open(LOCAL_BOOKMARKS_SAVE_URL, '_blank');
    if (!destinationWindow) {
      alert('Popup blocked');
      return;
    }

    const postRequest = () => {
      setTimeout(() => {
        destinationWindow.postMessage({ itemsToSave: extractedItems }, '*');
        sentItemsCount += extractedItems.length;
        extractedItems.length = 0;
        updateExtractedStatusDisplay();
      }, 200);
    };

    if (destinationWindow.document?.readyState === 'complete') {
      postRequest();
    } else {
      destinationWindow.addEventListener('load', postRequest, { once: true });
    }
  };

  const processCurrentlyDisplayedItems = () => {
    const newExtractedItems = processAllItems();
    if (!newExtractedItems.length) return;
    extractedItems.push(...newExtractedItems);
    updateExtractedStatusDisplay();
  };

  const getOrCreateCustomActionsWrapper = () => {
    let wrapper = document.getElementById('customActions-wrapper-reddit');
    if (wrapper) return wrapper;

    wrapper = document.createElement('div');
    wrapper.id = 'customActions-wrapper-reddit';
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

  const setupFeedMutationObserver = (callback) => {
    waitForElement('shreddit-feed', (feedEl) => {
      const observer = new MutationObserver(callback);
      observer.observe(feedEl, {
        childList: true,
        subtree: true,
      });
    });
  };

  const setupExtractedStatusDisplay = () => {
    const extractedStatusDiv = document.createElement('div');
    extractedStatusDiv.id = 'extractedStatusReddit';
    Object.assign(extractedStatusDiv.style, {
      fontSize: '10px',
      color: '#333',
      textAlign: 'right',
    });
    extractedStatusDiv.innerHTML = 'Extracted + unsent: <span></span><br />Sent: <span></span>';
    getOrCreateCustomActionsWrapper().appendChild(extractedStatusDiv);
    extractedStatusDiv.querySelector('span:first-child').addEventListener('click', () => {
      console.log('extractedItems', extractedItems);
    });

    updateExtractedStatusDisplay();
  };

  const updateExtractedStatusDisplay = () => {
    const extractedStatusDiv = document.querySelector('#extractedStatusReddit');
    if (extractedStatusDiv) {
      const [extractedCountSpan, sentCountSpan] = Array.from(extractedStatusDiv.querySelectorAll('span'));
      extractedCountSpan.textContent = extractedItems.length;
      sentCountSpan.textContent = sentItemsCount;
    }
  };

  const setupProcessButton = () => {
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
      setupFeedMutationObserver(() => processCurrentlyDisplayedItems());
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
    sendButton.addEventListener('click', sendItemsToSavePage);
    getOrCreateCustomActionsWrapper().appendChild(sendButton);
  };

  const setupVersionDisplay = () => {
    const versionDiv = document.createElement('div');
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
            sendItemsToSavePage();
          }, postScrollDelayMs);
          return;
        }
      }, postScrollDelayMs);
    }, initialDelayMs);
  };

  const init = () => {
    if (!isSavedPage()) {
      alert('Run on Reddit saved page: reddit.com/user/<username>/saved/');
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
