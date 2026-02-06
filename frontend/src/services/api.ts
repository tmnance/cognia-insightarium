import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface Tag {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  color?: string | null;
  autoTagged?: boolean;
  confidence?: number | null;
  bookmarkCount?: number;
}

export interface Bookmark {
  id: string;
  source: string;
  externalId?: string | null;
  url?: string | null;
  content?: string | null;
  author?: string | null;
  createdAt: string;
  updatedAt: string;
  sourceCreatedAt?: string | null;
  firstIngestedAt?: string | null;
  lastIngestedAt?: string | null;
  tags?: Tag[];
}

export interface ApiResponse<T> {
  success: boolean;
  count?: number;
  bookmarks?: T[];
  bookmark?: T;
  error?: string;
}

export interface SavedBookmarkUrl {
  label: string;
  url: string;
}

export const configApi = {
  getConfig: async (): Promise<{ savedBookmarkUrls: SavedBookmarkUrl[] }> => {
    const response = await api.get<{ success: boolean; savedBookmarkUrls: SavedBookmarkUrl[] }>('/config');
    if (!response.data.success) throw new Error('Failed to load config');
    return { savedBookmarkUrls: response.data.savedBookmarkUrls };
  },
};

export const bookmarkApi = {
  // Get all bookmarks
  getAll: async (source?: string, tags?: string[]): Promise<Bookmark[]> => {
    const params: Record<string, string> = {};
    if (source) params.source = source;
    if (tags && tags.length > 0) params.tags = tags.join(',');
    const response = await api.get<ApiResponse<Bookmark>>('/bookmarks', { params });
    return response.data.bookmarks || [];
  },

  // Add URL bookmark
  addUrl: async (url: string): Promise<Bookmark> => {
    const response = await api.post<ApiResponse<Bookmark>>('/bookmarks/url', { url });
    if (!response.data.bookmark) {
      throw new Error(response.data.error || 'Failed to add URL');
    }
    return response.data.bookmark;
  },

  // Add raw text content
  addRawText: async (content: string): Promise<Bookmark> => {
    const response = await api.post<ApiResponse<Bookmark>>('/content/raw', {
      content,
    });
    if (!response.data.bookmark) {
      throw new Error(response.data.error || 'Failed to add raw text');
    }
    return response.data.bookmark;
  },

  // Delete bookmark (soft delete)
  delete: async (bookmarkId: string): Promise<void> => {
    const response = await api.delete<ApiResponse<Bookmark>>(`/bookmarks/${bookmarkId}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete bookmark');
    }
  },

  // Bulk save bookmarks
  bulkSave: async (items: Array<{ platform: string; url?: string; text?: string; author?: string; timestamp?: string }>): Promise<{ saved: number; failed: number; bookmarks: Bookmark[] }> => {
    const response = await api.post<{ success: boolean; saved: number; failed: number; bookmarks: Bookmark[]; errors?: Array<{ item: unknown; error: string }> }>('/bookmarks/bulk', items);
    if (!response.data.success) {
      throw new Error('Failed to save bookmarks');
    }
    return {
      saved: response.data.saved,
      failed: response.data.failed,
      bookmarks: response.data.bookmarks,
    };
  },

  // Check for duplicates and changes (batched to avoid 413 Payload Too Large)
  checkDuplicates: async (items: Array<{ platform: string; url?: string; text?: string; author?: string; timestamp?: string }>): Promise<{ duplicateIndices: number[]; changedIndices: number[]; changeDetails: Record<number, { fields: string[]; existingContent?: string | null; existingAuthor?: string | null; newContent?: string | null; newAuthor?: string | null }> }> => {
    const BATCH_SIZE = 100;
    const duplicateIndices: number[] = [];
    const changedIndices: number[] = [];
    const changeDetails: Record<number, { fields: string[] }> = {};

    for (let offset = 0; offset < items.length; offset += BATCH_SIZE) {
      const batch = items.slice(offset, offset + BATCH_SIZE);
      const response = await api.post<{ success: boolean; duplicateIndices: number[]; changedIndices: number[]; changeDetails: Record<number, { fields: string[]; existingContent?: string | null; existingAuthor?: string | null; newContent?: string | null; newAuthor?: string | null }>; duplicateCount: number; changedCount: number }>('/bookmarks/check-duplicates', batch);
      if (!response.data.success) {
        throw new Error('Failed to check for duplicates');
      }
      duplicateIndices.push(...response.data.duplicateIndices.map((i) => i + offset));
      const batchChangedIndices = response.data.changedIndices.map((i) => i + offset);
      changedIndices.push(...batchChangedIndices);
      // Map change details with adjusted indices
      if (response.data.changeDetails) {
        Object.entries(response.data.changeDetails).forEach(([key, value]) => {
          changeDetails[parseInt(key) + offset] = value;
        });
      }
    }

    return { duplicateIndices, changedIndices, changeDetails };
  },

  // Tag-related methods
  tags: {
    // Get all tags
    getAll: async (): Promise<Tag[]> => {
      const response = await api.get<{ success: boolean; count: number; tags: Tag[] }>('/tags');
      return response.data.tags || [];
    },
    // Get tag by slug
    getBySlug: async (slug: string): Promise<Tag> => {
      const response = await api.get<{ success: boolean; tag: Tag }>(`/tags/${slug}`);
      return response.data.tag;
    },
    // Create a new tag
    create: async (data: {
      name: string;
      slug: string;
      description?: string | null;
      color?: string | null;
    }): Promise<Tag> => {
      const response = await api.post<{ success: boolean; tag: Tag; error?: string }>('/tags', data);
      if (!response.data.tag) {
        throw new Error(response.data.error || 'Failed to create tag');
      }
      return response.data.tag;
    },
  },

  // Bookmark tag management
  bookmarkTags: {
    // Get tags for a bookmark
    getByBookmarkId: async (bookmarkId: string): Promise<Tag[]> => {
      const response = await api.get<{ success: boolean; count: number; tags: Tag[] }>(`/bookmarks/${bookmarkId}/tags`);
      return response.data.tags || [];
    },
    // Add tag to bookmark
    add: async (bookmarkId: string, tagId: string): Promise<void> => {
      await api.post(`/bookmarks/${bookmarkId}/tags`, { tagId });
    },
    // Add tag to bookmark by slug
    addBySlug: async (bookmarkId: string, tagSlug: string): Promise<void> => {
      await api.post(`/bookmarks/${bookmarkId}/tags`, { tagSlug });
    },
    // Remove tag from bookmark
    remove: async (bookmarkId: string, tagId: string): Promise<void> => {
      await api.delete(`/bookmarks/${bookmarkId}/tags/${tagId}`);
    },
  },

  // LLM-based tagging
  tagging: {
    // Get tagging statistics
    getStats: async (): Promise<{ totalUntaggedCount: number; totalBookmarkCount: number; llmBookmarkCategorizationUrl: string }> => {
      const response = await api.get<{ success: boolean; totalUntaggedCount: number; totalBookmarkCount: number; llmBookmarkCategorizationUrl: string }>('/bookmarks/llm-tagging/stats');
      return {
        totalUntaggedCount: response.data.totalUntaggedCount,
        totalBookmarkCount: response.data.totalBookmarkCount,
        llmBookmarkCategorizationUrl: response.data.llmBookmarkCategorizationUrl,
      };
    },
    // Generate prompt for LLM tagging
    generatePrompt: async (limit?: number): Promise<{ prompt: string; bookmarkIds: string[]; bookmarkCount: number; remainingCount: number; totalUntaggedCount: number; totalBookmarkCount: number }> => {
      const params = limit ? { limit: limit.toString() } : {};
      const response = await api.get<{ success: boolean; prompt: string; bookmarkIds: string[]; bookmarkCount: number; remainingCount: number; totalUntaggedCount: number; totalBookmarkCount: number }>('/bookmarks/llm-tagging/prompt', { params });
      return {
        prompt: response.data.prompt,
        bookmarkIds: response.data.bookmarkIds,
        bookmarkCount: response.data.bookmarkCount,
        remainingCount: response.data.remainingCount,
        totalUntaggedCount: response.data.totalUntaggedCount,
        totalBookmarkCount: response.data.totalBookmarkCount,
      };
    },
    // Apply tags from LLM response
    applyResponse: async (llmResponse: string): Promise<{ processed: number; tagged: number; errors?: Array<{ bookmarkId: string; error: string }> }> => {
      const response = await api.post<{ success: boolean; processed: number; tagged: number; errors?: Array<{ bookmarkId: string; error: string }> }>('/bookmarks/llm-tagging/apply', { llmResponse });
      return {
        processed: response.data.processed,
        tagged: response.data.tagged,
        errors: response.data.errors,
      };
    },
  },
};

