import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface Bookmark {
  id: string;
  source: string;
  externalId?: string | null;
  url?: string | null;
  title?: string | null;
  content?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  count?: number;
  bookmarks?: T[];
  bookmark?: T;
  error?: string;
}

export const bookmarkApi = {
  // Get all bookmarks
  getAll: async (source?: string): Promise<Bookmark[]> => {
    const params = source ? { source } : {};
    const response = await api.get<ApiResponse<Bookmark>>('/bookmarks', { params });
    return response.data.bookmarks || [];
  },

  // Fetch LinkedIn saved posts
  fetchLinkedIn: async (): Promise<Bookmark[]> => {
    const response = await api.get<ApiResponse<Bookmark>>('/bookmarks/linkedin');
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
  addRawText: async (content: string, title?: string): Promise<Bookmark> => {
    const response = await api.post<ApiResponse<Bookmark>>('/content/raw', {
      content,
      title,
    });
    if (!response.data.bookmark) {
      throw new Error(response.data.error || 'Failed to add raw text');
    }
    return response.data.bookmark;
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

  // Check for duplicates
  checkDuplicates: async (items: Array<{ platform: string; url?: string; text?: string; author?: string; timestamp?: string }>): Promise<number[]> => {
    const response = await api.post<{ success: boolean; duplicateIndices: number[]; count: number }>('/bookmarks/check-duplicates', items);
    if (!response.data.success) {
      throw new Error('Failed to check for duplicates');
    }
    return response.data.duplicateIndices;
  },
};

