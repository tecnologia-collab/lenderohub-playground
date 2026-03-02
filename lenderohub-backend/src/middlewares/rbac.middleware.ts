import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { hasPermission, Role, Resource, Action } from '../config/playground-rbac';

export function requireAccess(resource: Resource, action: Action) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const role = (req.user as any)?.playgroundRole as Role;

    if (!role) {
      return res.status(403).json({
        success: false,
        error: 'No tienes un rol asignado en el playground',
      });
    }

    if (!hasPermission(role, resource, action)) {
      return res.status(403).json({
        success: false,
        error: `No tienes permiso para ${action} en ${resource}`,
        required: { role, resource, action },
      });
    }

    return next();
  };
}

export default requireAccess;