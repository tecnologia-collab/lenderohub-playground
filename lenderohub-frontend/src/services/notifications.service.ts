import { api } from '@/lib/api';

export interface AppNotification {
  _id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  link?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface NotificationsResponse {
  success: boolean;
  data: {
    notifications: AppNotification[];
    total: number;
    unreadCount: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

export interface UnreadCountResponse {
  success: boolean;
  data: {
    count: number;
  };
}

export const notificationsService = {
  async getNotifications(params?: {
    unreadOnly?: boolean;
    page?: number;
    limit?: number;
  }): Promise<NotificationsResponse> {
    const queryParams: Record<string, string | number | boolean | undefined> = {};
    if (params?.unreadOnly !== undefined) queryParams.unreadOnly = String(params.unreadOnly);
    if (params?.page) queryParams.page = params.page;
    if (params?.limit) queryParams.limit = params.limit;

    return api.get<NotificationsResponse>('/notifications', queryParams);
  },

  async getUnreadCount(): Promise<number> {
    const res = await api.get<UnreadCountResponse>('/notifications/unread-count');
    return res.data.count;
  },

  async markAsRead(id: string): Promise<void> {
    await api.put(`/notifications/${id}/read`);
  },

  async markAllAsRead(): Promise<void> {
    await api.put('/notifications/read-all');
  },
};
