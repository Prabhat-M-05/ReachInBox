import axios from 'axios';

// Base API configuration referencing environment variables or local express backend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Enables cross-origin cookies for OAuth sessions
});

// Interface definitions matching backend & Elasticsearch data structures
export interface EmailItem {
  id: string;
  userId: string;
  senderId: string;
  campaignId?: string | null;
  recipientEmail?: string;
  recipient?: string; // Fallback field from bulk/CSV workers
  recipients?: string[];
  subject: string;
  body: string;
  status: 'PENDING' | 'SCHEDULED' | 'PROCESSING' | 'RATE_LIMITED' | 'SENT' | 'FAILED';
  scheduledAt: string;
  startTime?: string;
  sentAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmailSearchResponse {
  data: EmailItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ScheduleEmailPayload {
  userId: string;
  senderId?: string;
  recipients: string[];
  recipientEmail?: string;
  subject: string;
  body: string;
  startTime?: string;
  scheduledAt?: string;
  delayBetweenMs?: number;
  campaignId?: string;
}

// API Helper Methods
export const emailApi = {
  // Search emails with instant search parameters (Queries Elasticsearch)
  searchEmails: async (params: {
    userId: string;
    query?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<EmailSearchResponse> => {
    const cleanParams: Record<string, any> = { ...params };

    // If status is 'ALL' or empty, delete key so backend fetches all statuses
    if (!cleanParams.status || cleanParams.status === 'ALL') {
      delete cleanParams.status;
    }

    const response = await api.get('/api/emails/search', { params: cleanParams });
    
    // Normalize Elasticsearch/PostgreSQL responses
    const responseData = response.data;
    if (Array.isArray(responseData)) {
      return {
        data: responseData,
        pagination: { total: responseData.length, page: 1, limit: responseData.length, totalPages: 1 },
      };
    }

    return responseData;
  },

  // Schedule or send a new email (Matches CSV/bulk dispatch backend schema)
  scheduleEmail: async (payload: ScheduleEmailPayload): Promise<{ success: boolean; data: EmailItem }> => {
    const formattedPayload = {
      ...payload,
      // Provide both single & array recipient formats to satisfy DB & ES indexers
      recipientEmail: payload.recipientEmail || payload.recipients[0] || '',
      startTime: payload.startTime || payload.scheduledAt || new Date().toISOString(),
      delayBetweenMs: payload.delayBetweenMs ?? 2000,
    };

    const response = await api.post('/api/emails/schedule', formattedPayload);
    return response.data;
  },

  // Get user authentication and connection status
  getAuthStatus: async (userId: string) => {
    const response = await api.get(`/api/auth/status`, { params: { userId } });
    return response.data;
  },
};

export default api;