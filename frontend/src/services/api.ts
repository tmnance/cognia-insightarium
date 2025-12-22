import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Include cookies for session support
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

  // Fetch X bookmarks (no userId needed if authenticated via OAuth)
  fetchX: async (): Promise<Bookmark[]> => {
    const response = await api.get<ApiResponse<Bookmark>>('/bookmarks/x');
    return response.data.bookmarks || [];
  },

  // OAuth endpoints
  oauth: {
    // Get OAuth status
    getStatus: async (): Promise<{ authenticated: boolean; userId: string | null; username: string | null }> => {
      const response = await api.get<{ success: boolean; authenticated: boolean; userId: string | null; username: string | null }>('/oauth/x/status');
      return {
        authenticated: response.data.authenticated,
        userId: response.data.userId,
        username: response.data.username,
      };
    },
    // Initiate OAuth login
    login: (): void => {
      window.location.href = '/api/oauth/x/authorize';
    },
    // Logout
    logout: async (): Promise<void> => {
      await api.post('/oauth/x/logout');
    },
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
};

