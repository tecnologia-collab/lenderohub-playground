import { Notification, NotificationType } from '../../models/notification.model';

class NotificationsService {
  /**
   * Create a notification (fire-and-forget pattern, never throws).
   */
  async create(params: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      await Notification.create({
        user: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        link: params.link,
        metadata: params.metadata,
      });
    } catch (error) {
      // Notification creation should never crash the app
      console.error('Notification create error:', error);
    }
  }

  /**
   * Get notifications for a user with pagination.
   */
  async getForUser(userId: string, options?: {
    unreadOnly?: boolean;
    page?: number;
    limit?: number;
  }) {
    const query: any = { user: userId };
    if (options?.unreadOnly) {
      query.isRead = false;
    }

    const page = options?.page || 1;
    const limit = options?.limit || 20;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ user: userId, isRead: false }),
    ]);

    return {
      notifications,
      total,
      unreadCount,
      page,
      limit,
      hasMore: page * limit < total,
    };
  }

  /**
   * Mark a single notification as read (only if it belongs to the user).
   */
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const result = await Notification.updateOne(
      { _id: notificationId, user: userId },
      { isRead: true }
    );
    return result.modifiedCount > 0;
  }

  /**
   * Mark all unread notifications as read for a user.
   */
  async markAllAsRead(userId: string): Promise<number> {
    const result = await Notification.updateMany(
      { user: userId, isRead: false },
      { isRead: true }
    );
    return result.modifiedCount;
  }

  /**
   * Get only the unread count (lightweight query for polling).
   */
  async getUnreadCount(userId: string): Promise<number> {
    return Notification.countDocuments({ user: userId, isRead: false });
  }
}

export const notificationsService = new NotificationsService();
export { NotificationType };
