import { Request, Response } from 'express';
import { ActivityLog } from '../models/activity-log.model';

export const activityLogController = {

  async getLogs(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      const filter: Record<string, any> = {};
      if (req.query.userId) filter.userId = req.query.userId;
      if (req.query.resource) filter.resource = req.query.resource;
      if (req.query.method) filter.method = req.query.method;
      if (req.query.statusCode) filter.statusCode = parseInt(req.query.statusCode as string);
      if (req.query.from || req.query.to) {
        filter.createdAt = {};
        if (req.query.from) filter.createdAt.$gte = new Date(req.query.from as string);
        if (req.query.to) filter.createdAt.$lte = new Date(req.query.to as string);
      }

      const [data, total] = await Promise.all([
        ActivityLog.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('userId', 'name email'),
        ActivityLog.countDocuments(filter),
      ]);

      return res.json({ success: true, data, total, page, totalPages: Math.ceil(total / limit) });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  async getStats(req: Request, res: Response) {
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const [requestsByHour, topEndpoints, topUsers, statusBreakdown] = await Promise.all([
        ActivityLog.aggregate([
          { $match: { createdAt: { $gte: since } } },
          { $group: { _id: { $hour: '$createdAt' }, count: { $sum: 1 } } },
          { $sort: { '_id': 1 } },
        ]),
        ActivityLog.aggregate([
          { $match: { createdAt: { $gte: since } } },
          { $group: { _id: '$path', count: { $sum: 1 }, avgDuration: { $avg: '$duration' } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
        ActivityLog.aggregate([
          { $match: { createdAt: { $gte: since }, userId: { $exists: true } } },
          { $group: { _id: '$userId', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 5 },
          { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
          { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        ]),
        ActivityLog.aggregate([
          { $match: { createdAt: { $gte: since } } },
          { $group: { _id: '$statusCode', count: { $sum: 1 } } },
          { $sort: { '_id': 1 } },
        ]),
      ]);

      return res.json({
        success: true,
        data: { requestsByHour, topEndpoints, topUsers, statusBreakdown },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },
};

export default activityLogController;