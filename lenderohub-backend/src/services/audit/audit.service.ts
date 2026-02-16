import { Request } from 'express';
import { AuditLog, AuditAction, IAuditLog } from '../../models/auditLog.model';

class AuditService {
  async log(params: {
    action: AuditAction;
    userId?: string;
    userEmail?: string;
    targetId?: string;
    targetType?: string;
    details?: Record<string, any>;
    req?: Request;
  }): Promise<void> {
    try {
      await AuditLog.create({
        action: params.action,
        userId: params.userId,
        userEmail: params.userEmail,
        targetId: params.targetId,
        targetType: params.targetType,
        details: params.details,
        ipAddress: params.req?.ip || params.req?.socket?.remoteAddress,
        userAgent: params.req?.headers['user-agent'],
        timestamp: new Date()
      });
    } catch (error) {
      // Audit logging should never crash the app
      console.error('Audit log error:', error);
    }
  }

  async query(filters: {
    action?: string;
    userId?: string;
    targetId?: string;
    from?: Date;
    to?: Date;
    page?: number;
    limit?: number;
  }) {
    const { action, userId, targetId, from, to, page = 1, limit = 50 } = filters;

    const query: any = {};
    if (action) query.action = action;
    if (userId) query.userId = userId;
    if (targetId) query.targetId = targetId;
    if (from || to) {
      query.timestamp = {};
      if (from) query.timestamp.$gte = from;
      if (to) query.timestamp.$lte = to;
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(query)
    ]);

    return {
      data: logs,
      total,
      page,
      limit,
      hasMore: page * limit < total
    };
  }
}

export const auditService = new AuditService();
export { AuditAction };
