import { api } from '@/lib/api';

export interface Announcement {
  _id: string;
  title: string;
  content: string;
  priority: 'normal' | 'important' | 'urgent';
  isPinned: boolean;
  imageUrl?: string;
  expiresAt?: string;
  createdBy?: { name: string; email: string };
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AnnouncementsResponse {
  success: boolean;
  data: Announcement[];
  total: number;
  page: number;
  totalPages: number;
}

export const announcementsService = {
  async getAnnouncements(params?: {
    page?: number;
    limit?: number;
    priority?: string;
    unreadOnly?: boolean;
    search?: string;
  }): Promise<AnnouncementsResponse> {
    const query: Record<string, string | number | boolean | undefined> = {};
    if (params?.page) query.page = params.page;
    if (params?.limit) query.limit = params.limit;
    if (params?.priority) query.priority = params.priority;
    if (params?.unreadOnly) query.unreadOnly = 'true';
    if (params?.search) query.search = params.search;
    return api.get<AnnouncementsResponse>('/announcements', query);
  },

  async getUnreadCount(): Promise<number> {
    const res = await api.get<{ success: boolean; count: number }>('/announcements/unread-count');
    return res.count;
  },

  async getById(id: string): Promise<Announcement> {
    const res = await api.get<{ success: boolean; data: Announcement }>(`/announcements/${id}`);
    return res.data;
  },

  async create(data: Partial<Announcement>): Promise<Announcement> {
    const res = await api.post<{ success: boolean; data: Announcement }>('/announcements', data);
    return res.data;
  },

  async update(id: string, data: Partial<Announcement>): Promise<Announcement> {
    const res = await api.put<{ success: boolean; data: Announcement }>(`/announcements/${id}`, data);
    return res.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/announcements/${id}`);
  },

  async pin(id: string): Promise<Announcement> {
    const res = await api.put<{ success: boolean; data: Announcement }>(`/announcements/${id}/pin`, {});
    return res.data;
  },

  async markAsRead(id: string): Promise<void> {
    await api.put(`/announcements/${id}/read`, {});
  },

  async getStats(id: string): Promise<{ readCount: number }> {
    const res = await api.get<{ success: boolean; data: { readCount: number } }>(`/announcements/${id}/stats`);
    return res.data;
  },
};