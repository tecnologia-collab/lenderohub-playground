import { Response } from 'express';
import { z } from 'zod';

import { AuthRequest } from '../middlewares/auth.middleware';
import { notificationsService } from '../services/notifications';

// Zod schemas
const getNotificationsSchema = z.object({
  unreadOnly: z.enum(['true', 'false']).optional().transform(v => v === 'true'),
  page: z.string().optional().transform(v => v ? parseInt(v, 10) : 1),
  limit: z.string().optional().transform(v => v ? Math.min(parseInt(v, 10), 50) : 20),
});

export const notificationsController = {
  /**
   * GET /api/v1/notifications
   * Get user's notifications (paginated, optional unreadOnly filter)
   */
  async getNotifications(req: AuthRequest, res: Response) {
    try {
      const parsed = getNotificationsSchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'Parametros invalidos',
          message: parsed.error.issues.map(e => e.message).join(', '),
        });
      }

      const { unreadOnly, page, limit } = parsed.data;
      const userId = req.user._id.toString();

      const result = await notificationsService.getForUser(userId, {
        unreadOnly,
        page,
        limit,
      });

      return res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error fetching notifications:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch notifications',
        message: error.message,
      });
    }
  },

  /**
   * GET /api/v1/notifications/unread-count
   * Lightweight endpoint for polling unread count
   */
  async getUnreadCount(req: AuthRequest, res: Response) {
    try {
      const userId = req.user._id.toString();
      const count = await notificationsService.getUnreadCount(userId);

      return res.json({
        success: true,
        data: { count },
      });
    } catch (error: any) {
      console.error('Error fetching unread count:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch unread count',
        message: error.message,
      });
    }
  },

  /**
   * PUT /api/v1/notifications/:id/read
   * Mark a single notification as read
   */
  async markAsRead(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user._id.toString();

      const updated = await notificationsService.markAsRead(id, userId);

      if (!updated) {
        return res.status(404).json({
          success: false,
          error: 'Notificacion no encontrada',
        });
      }

      return res.json({
        success: true,
        message: 'Notificacion marcada como leida',
      });
    } catch (error: any) {
      console.error('Error marking notification as read:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to mark notification as read',
        message: error.message,
      });
    }
  },

  /**
   * PUT /api/v1/notifications/read-all
   * Mark all notifications as read for the user
   */
  async markAllAsRead(req: AuthRequest, res: Response) {
    try {
      const userId = req.user._id.toString();
      const count = await notificationsService.markAllAsRead(userId);

      return res.json({
        success: true,
        data: { markedCount: count },
        message: `${count} notificaciones marcadas como leidas`,
      });
    } catch (error: any) {
      console.error('Error marking all notifications as read:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to mark all notifications as read',
        message: error.message,
      });
    }
  },
};
