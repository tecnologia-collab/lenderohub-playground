import { Request, Response, NextFunction } from 'express';
import { ActivityLog } from '../models/activity-log.model';
import { AuthRequest } from './auth.middleware';

const SKIP_PATHS = ['/health', '/health/detailed'];

function extractResource(path: string): { resource: string; resourceId?: string } {
  const parts = path.replace(/^\/api\/v1\//, '').split('/');
  const resource = parts[0] || 'unknown';
  const resourceId = parts[1] && !parts[1].includes('?') ? parts[1] : undefined;
  return { resource, resourceId };
}

function extractAction(method: string, resource: string): string {
  switch (method) {
    case 'GET': return `read:${resource}`;
    case 'POST': return `create:${resource}`;
    case 'PUT': return `update:${resource}`;
    case 'PATCH': return `update:${resource}`;
    case 'DELETE': return `delete:${resource}`;
    default: return `${method.toLowerCase()}:${resource}`;
  }
}

export function activityLoggerMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip health checks
  const cleanPath = req.path.replace(/^\/api\/v1/, '');
  if (SKIP_PATHS.some((p) => cleanPath.startsWith(p))) return next();

  const start = Date.now();

  res.on('finish', async () => {
    try {
      const duration = Date.now() - start;
      const { resource, resourceId } = extractResource(req.path);
      const action = extractAction(req.method, resource);
      const userId = (req as AuthRequest).user?._id;

      await ActivityLog.create({
        userId: userId || undefined,
        action,
        resource,
        resourceId,
        method: req.method,
        path: req.path,
        ip: req.ip || req.socket.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] || '',
        statusCode: res.statusCode,
        duration,
      });
    } catch {
      // Silently ignore logging errors — never break the request
    }
  });

  next();
}