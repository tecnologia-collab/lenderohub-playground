import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { Notification } from '../models/notification.model';

export const notificationsController = {

  async getNotifications(req: AuthRequest, res: Response) {
    try {
      const userId = req.user._id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        Notification.find({ user: userId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
        Notification.countDocuments({ user: userId }),
      ]);

      return res.json({ success: true, data, total, page, totalPages: Math.ceil(total / limit) });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  async getUnreadCount(req: AuthRequest, res: Response) {
    try {
      const count = await Notification.countDocuments({ user: req.user._id, isRead: false });
      return res.json({ success: true, count });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  async markAsRead(req: AuthRequest, res: Response) {
    try {
      const notification = await Notification.findOneAndUpdate(
        { _id: req.params.id, user: req.user._id },
        { isRead: true },
        { new: true }
      );
      if (!notification) return res.status(404).json({ success: false, error: 'Notificación no encontrada' });
      return res.json({ success: true, data: notification });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  async markAllAsRead(req: AuthRequest, res: Response) {
    try {
      await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
      return res.json({ success: true, message: 'Todas las notificaciones marcadas como leídas' });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  async createNotification(req: AuthRequest, res: Response) {
    try {
      const profileType = req.user?.profileType;
      if (profileType !== 'corporate') {
        return res.status(403).json({ success: false, error: 'Solo administradores pueden crear notificaciones' });
      }

      const { title, message, type, userId, link } = req.body;
      if (!title || !message || !userId || !type) {
        return res.status(400).json({ success: false, error: 'title, message, type y userId son requeridos' });
      }

      const notification = await Notification.create({ title, message, type, user: userId, link });
      return res.status(201).json({ success: true, data: notification });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },
};

export default notificationsController;