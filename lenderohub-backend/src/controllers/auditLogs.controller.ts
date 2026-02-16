import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { auditService } from '../services/audit';

/**
 * GET /api/v1/audit-logs
 * Query audit logs
 *
 * Permission: users:read (admins/corporate only)
 */
export const getAuditLogs = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { action, userId, from, to, page, limit } = req.query;

    const filters: any = {
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 50
    };

    if (action) filters.action = action as string;
    if (userId) filters.userId = userId as string;
    if (from) filters.from = new Date(from as string);
    if (to) filters.to = new Date(to as string);

    const result = await auditService.query(filters);

    res.json({
      success: true,
      data: result.data,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        hasMore: result.hasMore
      }
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getAuditLogs
};
