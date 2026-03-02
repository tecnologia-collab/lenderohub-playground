import { Request, Response } from 'express';
import { Note } from '../models/notes.model';
import { ActivityLog } from '../models/activity-log.model';
import { Notification } from '../models/notification.model';
import mongoose from 'mongoose';

export const playgroundStatsController = {
  async getStats(req: Request, res: Response) {
    try {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const [
        notesByStatus,
        notesByPriority,
        activityLast24h,
        unreadNotifications,
        usersByProfileType,
      ] = await Promise.all([
        // Notas por estado
        Note.aggregate([
          { $match: { isDeleted: { $ne: true } } },
          { $group: { _id: '$isResolved', count: { $sum: 1 } } },
        ]),
        // Notas por prioridad
        Note.aggregate([
          { $match: { isDeleted: { $ne: true } } },
          { $group: { _id: '$priority', count: { $sum: 1 } } },
        ]),
        // Actividad últimas 24h
        ActivityLog.countDocuments({ createdAt: { $gte: since24h } }),
        // Notificaciones no leídas
        Notification.countDocuments({ isRead: false }),
        // Usuarios por profileType
        mongoose.connection.db!.collection('users').aggregate([
          { $match: { disabled: { $ne: true } } },
          { $group: { _id: '$profileType', count: { $sum: 1 } } },
        ]).toArray(),
      ]);

      const totalNotes = notesByStatus.reduce((acc, s) => acc + s.count, 0);
      const resolvedNotes = notesByStatus.find((s) => s._id === true)?.count || 0;
      const pendingNotes = notesByStatus.find((s) => s._id === false)?.count || 0;

      return res.json({
        success: true,
        data: {
          notes: {
            total: totalNotes,
            resolved: resolvedNotes,
            pending: pendingNotes,
            byPriority: {
              low: notesByPriority.find((p) => p._id === 'low')?.count || 0,
              medium: notesByPriority.find((p) => p._id === 'medium')?.count || 0,
              high: notesByPriority.find((p) => p._id === 'high')?.count || 0,
            },
          },
          activity: {
            last24h: activityLast24h,
          },
          notifications: {
            unread: unreadNotifications,
          },
          users: {
            byProfileType: usersByProfileType.reduce((acc: Record<string, number>, u: any) => {
              acc[u._id || 'unknown'] = u.count;
              return acc;
            }, {}),
            total: usersByProfileType.reduce((acc: number, u: any) => acc + u.count, 0),
          },
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },
};

export default playgroundStatsController;