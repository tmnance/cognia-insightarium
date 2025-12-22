import axios, { AxiosError } from 'axios';
import { config } from '../config/env';
import { logger } from '../utils/logger';

export interface XBookmark {
  externalId: string;
  url?: string;
  title?: string;
  content?: string;
}

interface XApiResponse {
  data?: XTweet[];
  meta?: {
    result_count: number;
    next_token?: string;
  };
  errors?: Array<{
    message: string;
    code: number;
    type?: string;
    title?: string;
    detail?: string;
    status?: number;
  }>;
}

interface XTweet {
  id: string;
  text: string;
  created_at?: string;
  author_id?: string;
}

/**
 * Fetch bookmarks from X (Twitter) API v2
 * 
 * @param userId - The X user ID to fetch bookmarks for (required)
 * @param sessionAccessToken - Optional OAuth 2.0 access token from session (preferred)
 * @param existingBookmarkIds - Optional Set of bookmark IDs we already have (to stop early when encountered)
 * 
 * Note: The bookmarks endpoint requires OAuth 2.0 User Context authentication.
 * Bookmarks are returned newest first, so we can stop fetching when we encounter one we already have.
 * 
 * API Documentation: https://developer.x.com/en/docs/twitter-api/tweets/bookmarks/api-reference/get-users-id-bookmarks
 */
export async function fetchXBookmarks(
  userId: string,
  sessionAccessToken?: string,
  existingBookmarkIds?: Set<string>
): Promise<XBookmark[]> {
  try {
    // Priority: session token > env token > bearer token
    const accessToken = sessionAccessToken || config.xAccessToken || config.xBearerToken;

    if (!accessToken) {
      logger.warn('X Access Token or Bearer Token not configured');
      throw new Error(
        'X authentication token not configured. ' +
        'Please set X_ACCESS_TOKEN (OAuth 2.0, recommended) or X_BEARER_TOKEN in your .env file. ' +
        'Note: Bookmarks endpoint requires OAuth 2.0 user authentication for proper access.'
      );
    }

    logger.info('Fetching bookmarks from X API', { 
      userId, 
      usingSessionToken: !!sessionAccessToken,
      usingOAuth: !!config.xAccessToken,
      hasExistingBookmarks: !!existingBookmarkIds && existingBookmarkIds.size > 0,
      existingCount: existingBookmarkIds?.size || 0,
    });

    const bookmarks: XBookmark[] = [];
    let nextToken: string | undefined;
    let requestCount = 0;
    let shouldContinue = true;

    do {
      requestCount++;
      // Use the accessToken determined above (prioritizes session token)
      const token = accessToken;
      const requestUrl = `https://api.twitter.com/2/users/${userId}/bookmarks`;
      const requestParams = {
        'tweet.fields': 'created_at,author_id,text',
        'user.fields': 'username',
        max_results: 100,
        ...(nextToken && { pagination_token: nextToken }),
      };

      logger.info('X API request', {
        url: requestUrl,
        params: requestParams,
        requestNumber: requestCount,
        hasPaginationToken: !!nextToken,
        userId,
      });
      
      const response = await axios.get<XApiResponse>(requestUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'CogniaInsightarium/1.0',
        },
        params: requestParams,
      });

      logger.info('X API response received', {
        status: response.status,
        statusText: response.statusText,
        requestNumber: requestCount,
        dataCount: response.data.data?.length || 0,
        hasErrors: !!response.data.errors,
        hasMeta: !!response.data.meta,
        nextToken: response.data.meta?.next_token ? 'present' : 'none',
        resultCount: response.data.meta?.result_count,
        responseHeaders: {
          'x-rate-limit-remaining': response.headers['x-rate-limit-remaining'],
          'x-rate-limit-reset': response.headers['x-rate-limit-reset'],
          'x-rate-limit-limit': response.headers['x-rate-limit-limit'],
        },
      });

      // Log full response data in debug mode for detailed troubleshooting
      logger.debug('X API full response data', {
        requestNumber: requestCount,
        fullResponse: response.data,
        responseHeaders: response.headers,
      });

      // Handle API errors
      if (response.data.errors) {
        const errorMessages = response.data.errors.map((e) => e.message).join(', ');
        logger.error('X API returned errors in response', {
          errors: response.data.errors,
          requestNumber: requestCount,
          fullResponse: response.data,
        });
        throw new Error(`X API error: ${errorMessages}`);
      }

      // Process tweets
      if (response.data.data) {
        const tweets: XBookmark[] = [];
        let foundExisting = false;

        for (const tweet of response.data.data) {
          // If we have existing bookmarks and we encounter one we already have,
          // stop fetching (bookmarks are returned newest first)
          if (existingBookmarkIds && existingBookmarkIds.has(tweet.id)) {
            logger.info('Encountered existing bookmark, stopping early to save API calls', {
              existingBookmarkId: tweet.id,
              requestNumber: requestCount,
              bookmarksFetched: bookmarks.length,
            });
            foundExisting = true;
            break;
          }

          tweets.push({
            externalId: tweet.id,
            url: `https://twitter.com/i/web/status/${tweet.id}`,
            title: tweet.text.substring(0, 100) || undefined,
            content: tweet.text,
          });
        }

        bookmarks.push(...tweets);
        logger.info(`Fetched ${tweets.length} bookmarks (total: ${bookmarks.length})`, {
          requestNumber: requestCount,
          tweetIds: tweets.map((t) => t.externalId).slice(0, 5), // Log first 5 IDs for reference
          stoppedEarly: foundExisting,
        });

        // If we found an existing bookmark, stop pagination
        if (foundExisting) {
          shouldContinue = false;
          nextToken = undefined;
        } else {
          nextToken = response.data.meta?.next_token;
        }
      } else {
        logger.warn('X API response has no data field', {
          requestNumber: requestCount,
          responseKeys: Object.keys(response.data),
          fullResponse: response.data,
        });
        nextToken = response.data.meta?.next_token;
      }
    } while (nextToken && shouldContinue);

    logger.info(`Successfully fetched ${bookmarks.length} X bookmarks`);
    return bookmarks;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<XApiResponse>;
      const status = axiosError.response?.status;
      const statusText = axiosError.response?.statusText;
      const errorData = axiosError.response?.data;
      const requestConfig = axiosError.config;

      // Log detailed error information
      logger.error('X API request failed', {
        status,
        statusText,
        url: requestConfig?.url,
        method: requestConfig?.method,
        errorData: errorData || axiosError.message,
        responseHeaders: axiosError.response?.headers,
        requestHeaders: {
          authorization: requestConfig?.headers?.Authorization
            ? `${String(requestConfig.headers.Authorization).substring(0, 20)}...`
            : 'not set',
          'user-agent': requestConfig?.headers?.['User-Agent'],
        },
      });

      // Log full error response if available
      if (errorData) {
        logger.error('X API error response details', {
          fullErrorResponse: errorData,
          errors: errorData.errors,
          meta: errorData.meta,
        });
      }

      if (status === 401) {
        logger.error('X API authentication failed - check your access token', {
          status,
          responseData: errorData,
        });
        throw new Error(
          'X API authentication failed. ' +
          'Please check your X_ACCESS_TOKEN (OAuth 2.0, recommended) or X_BEARER_TOKEN. ' +
          'If using OAuth 2.0, ensure your token is valid and includes the bookmark.read scope.'
        );
      } else if (status === 403) {
        // Check if it's the specific "Unsupported Authentication" error
        const isUnsupportedAuth = errorData?.errors?.some(
          (e) =>
            e.type?.includes('unsupported-authentication') ||
            e.title === 'Unsupported Authentication'
        );

        if (isUnsupportedAuth && errorData) {
          const errorDetail = errorData.errors?.find(
            (e) => e.title === 'Unsupported Authentication'
          )?.detail;
          logger.error('X API: Unsupported Authentication - Application-Only auth not allowed', {
            status,
            responseData: errorData,
            errorDetail,
          });
          throw new Error(
            'X API Error: Unsupported Authentication\n\n' +
            'The bookmarks endpoint requires OAuth 2.0 User Context authentication, not Application-Only (Bearer Token).\n\n' +
            'To fix this:\n' +
            '1. Complete the OAuth 2.0 flow to get a user access token:\n' +
            '   GET http://localhost:3001/api/oauth/x/authorize\n' +
            '2. Follow the authorization URL and authorize the app\n' +
            '3. Exchange the code for an access token:\n' +
            '   POST http://localhost:3001/api/oauth/x/callback\n' +
            '4. Add the access_token to your .env as X_ACCESS_TOKEN\n\n' +
            'See X_OAUTH_SETUP.md for detailed instructions.'
          );
        }

        logger.error('X API access forbidden - bookmarks require OAuth 2.0 user authentication', {
          status,
          responseData: errorData,
        });
        throw new Error(
          'X API access forbidden. Bookmarks endpoint requires OAuth 2.0 user authentication. ' +
          'Please use X_ACCESS_TOKEN obtained via OAuth 2.0 flow with bookmark.read scope. ' +
          'See: https://github.com/xdevplatform/samples/blob/main/javascript/users/bookmark/get_bookmarks.js'
        );
      } else if (status === 429) {
        logger.error('X API rate limit exceeded', {
          status,
          responseHeaders: axiosError.response?.headers,
          rateLimitRemaining: axiosError.response?.headers?.['x-rate-limit-remaining'],
          rateLimitReset: axiosError.response?.headers?.['x-rate-limit-reset'],
        });
        throw new Error('X API rate limit exceeded. Please try again later.');
      } else if (errorData?.errors) {
        const errorMessages = errorData.errors.map((e) => e.message).join(', ');
        logger.error('X API error response', {
          status,
          errors: errorData.errors,
          fullResponse: errorData,
        });
        throw new Error(`X API error: ${errorMessages}`);
      } else {
        // Log any other error responses
        logger.error('X API unexpected error', {
          status,
          statusText,
          errorData,
          message: axiosError.message,
        });
      }
    } else {
      // Non-Axios errors
      logger.error('Non-Axios error fetching X bookmarks', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }

    logger.error('Error fetching X bookmarks', error);
    throw error;
  }
}


